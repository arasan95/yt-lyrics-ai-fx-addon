// Background Script for Lyrics Fetching

const DEEPSEEK_MODEL = "deepseek-v4-flash";

browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.command === "search_and_show") {
        const config = await browser.storage.local.get({
            provider: 'Gemini',
            gemini_key: '',
            gemini_model: '',
            deepseek_key: '',
            openai_key: '',
            openai_model: '',
            hf_token: '',
            hf_model: '',
            openrouter_key: '',
            openrouter_model: '',
            genius_token: ''
        });

        const { query, artist, song } = message;

        sendMessageToActiveTab({ action: "status", text: "Searching Genius..." });

        try {
            const lyrics = await fetchGeniusLyrics(query || `${artist} ${song}`, config.genius_token);
            if (!lyrics) {
                sendMessageToActiveTab({ action: "error", text: "Lyrics not found on Genius." });
                return;
            }

            sendMessageToActiveTab({ action: "status", text: `Translating via ${config.provider}...` });
            let translated = "";

            if (config.provider === "DeepSeek") {
                translated = await translateDeepSeek(lyrics, config.deepseek_key);
            } else if (config.provider === "OpenAI") {
                translated = await translateOpenAI(lyrics, config.openai_key, config.openai_model);
            } else if (config.provider === "HuggingFace") {
                translated = await translateHuggingFace(lyrics, config.hf_token, config.hf_model);
            } else if (config.provider === "OpenRouter") {
                translated = await translateOpenRouter(lyrics, config.openrouter_key, config.openrouter_model);
            } else {
                translated = await translateGemini(lyrics, config.gemini_key, config.gemini_model);
            }

            sendMessageToActiveTab({ action: "show_lyrics", text: translated });

            // Save to History
            const historyItem = {
                query,
                artist,
                song,
                lyrics,
                translated,
                timestamp: Date.now()
            };
            saveToHistory(historyItem);

            // Save to Cache by Video ID
            // We need the current tab's video ID.
            const tabs = await browser.tabs.query({ active: true, currentWindow: true });
            if (tabs[0] && tabs[0].url) {
                const videoId = getVideoIdFromUrl(tabs[0].url);
                if (videoId) {
                    const key = `lyrics_cache_${videoId}`;
                    // Save as object to support explanation
                    await browser.storage.local.set({ [key]: { lyrics: translated } });
                }
            }

        } catch (e) {
            console.error(e);
            sendMessageToActiveTab({ action: "error", text: "Error: " + e.message });
        }
    } else if (message.command === "show_history_item") {
        const { item } = message;
        if (item && item.translated) {
            sendMessageToActiveTab({ action: "show_lyrics", text: item.translated });
        }
    } else if (message.command === "explain_lyrics") {
        const { text } = message;
        
        try {
            const config = await browser.storage.local.get({
                provider: 'Gemini',
                gemini_key: '',
                deepseek_key: '',
                gemini_model: '',
                openai_key: '',
                openai_model: '',
                hf_token: '',
                hf_model: '',
                openrouter_key: '',
                openrouter_model: ''
            });

            // Prompt for explanation
            const prompt = `以下の歌詞（翻訳が含まれる場合があります）について、英語学習者や海外文化に興味がある人向けに、文化的背景、スラング、文脈的な意味、ダブルミーニングなどを日本語で詳しく解説してください。箇条書きで見やすくまとめてください。\n\nLyrics/Text:\n${text}`;

            let explanation = "";
            if (config.provider === "DeepSeek") {
                explanation = await fetchDeepSeekCompletion(prompt, config.deepseek_key);
            } else if (config.provider === "OpenAI") {
                explanation = await fetchOpenAICompletion(prompt, config.openai_key, config.openai_model);
            } else if (config.provider === "HuggingFace") {
                explanation = await fetchHFCompletion(prompt, config.hf_token, config.hf_model);
            } else if (config.provider === "OpenRouter") {
                explanation = await fetchOpenRouterCompletion(prompt, config.openrouter_key, config.openrouter_model);
            } else {
                explanation = await fetchGeminiCompletion(prompt, config.gemini_key, config.gemini_model);
            }

            sendMessageToActiveTab({ action: "show_explanation", text: explanation });

            // Save Explanation to Cache (if we have a video ID)
            if (sender.tab && sender.tab.url) {
                const videoId = getVideoIdFromUrl(sender.tab.url);
                if (videoId) {
                    const key = `lyrics_cache_${videoId}`;
                    const cached = await browser.storage.local.get(key);
                    let data = cached[key];
                    
                    // Handle legacy string cache or create new object
                    if (typeof data === 'string') {
                        data = { lyrics: data };
                    } else if (!data) {
                        data = { lyrics: "" }; // Should not happen if we explain existing lyrics, but safe fallback
                    }
                    
                    data.explanation = explanation;
                    await browser.storage.local.set({ [key]: data });
                }
            }

        } catch (e) {
             sendMessageToActiveTab({ action: "show_explanation", text: "Error fetching explanation: " + e.message });
        }
    }
});

// Cache Logic: Listen for tab updates
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes('youtube.com/watch')) {
        const videoId = getVideoIdFromUrl(tab.url);
        if (videoId) {
            const key = `lyrics_cache_${videoId}`;
            const cached = await browser.storage.local.get(key);
            if (cached[key]) {
                console.log("Found cached lyrics for", videoId);
                
                let lyrics = "";
                let explanation = null;
                const data = cached[key];

                if (typeof data === 'string') {
                    lyrics = data;
                } else {
                    lyrics = data.lyrics;
                    explanation = data.explanation;
                }

                // Send message with persistence (explanation)
                browser.tabs.sendMessage(tabId, { action: "show_lyrics", text: lyrics, explanation: explanation });
            }
        }
    }
});

function getVideoIdFromUrl(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.searchParams.get("v");
    } catch (e) {
        return null;
    }
}

async function saveToHistory(item) {
    const data = await browser.storage.local.get('searchHistory');
    let history = data.searchHistory || [];

    // Add new item to the beginning
    history.unshift(item);

    // Limit to 20 items
    if (history.length > 20) {
        history = history.slice(0, 20);
    }

    await browser.storage.local.set({ searchHistory: history });
}

async function sendMessageToActiveTab(msg) {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
        browser.tabs.sendMessage(tabs[0].id, msg);
    }
}

async function fetchGeniusLyrics(query, token) {
    if (!token) throw new Error("Genius Access Token is missing in Options.");

    const searchUrl = `https://api.genius.com/search?q=${encodeURIComponent(query)}`;
    const searchRes = await fetch(searchUrl, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!searchRes.ok) {
        throw new Error(`Genius API Search failed: ${searchRes.status} ${searchRes.statusText}`);
    }
    const searchData = await searchRes.json();

    if (searchData.response.hits.length === 0) return null;

    const songUrl = searchData.response.hits[0].result.url;
    const pageRes = await fetch(songUrl);
    const html = await pageRes.text();

    return extractLyricsFromHtml(html);
}

function extractLyricsFromHtml(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    let text = "";
    const containers = doc.querySelectorAll('[data-lyrics-container="true"]');
    if (containers.length > 0) {
        containers.forEach(div => {
            const htmlContent = div.innerHTML;
            const textContent = htmlContent.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
            text += textContent + "\n";
        });
    } else {
        const oldDiv = doc.querySelector('.lyrics');
        if (oldDiv) text = oldDiv.innerText;
    }

    return text.trim() || null;
}

async function translateGemini(text, key, customModel) {
    if (!key) throw new Error("Gemini API Key is missing.");

    // Default to a model found in the list (gemini-2.5-flash)
    let modelName = 'models/gemini-2.5-flash';

    if (customModel && customModel.trim() !== "") {
        modelName = customModel.includes('/') ? customModel : `models/${customModel}`;
        console.log("Gemini: Using user-configured model:", modelName);
    } else {
        // Dynamic Model Discovery fallback
        try {
            const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
            const listRes = await fetch(listUrl);
            if (listRes.ok) {
                const listData = await listRes.json();
                let flashModel = listData.models.find(m => m.name.includes('gemini-2.5-flash'));
                if (!flashModel) flashModel = listData.models.find(m => m.name.includes('gemini-2.0-flash'));
                if (!flashModel) flashModel = listData.models.find(m => m.name.includes('gemini-1.5-flash'));
                if (!flashModel) flashModel = listData.models.find(m => m.name.includes('flash'));

                if (flashModel) {
                    modelName = flashModel.name;
                    console.log("Gemini: Auto-discovered model:", modelName);
                }
            }
        } catch (e) {
            console.warn("Gemini: Failed to list models, using default.", e);
        }
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${key}`;
    const prompt = `Translate the lyrics to Japanese line-by-line. \n\nIMPORTANT: You MUST output the Original English line first, followed immediately by the Japanese translation.\n\nExample Format:\nHello, it's me\nやあ、私だよ\nI was wondering if after all these years\nこれだけの年月が経っても\n\nLyrics to translate:\n${text}`;

    const body = { contents: [{ parts: [{ text: prompt }] }] };

    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error("Gemini API Error: " + err);
    }

    const data = await res.json();
    try {
        return data.candidates[0].content.parts[0].text;
    } catch (e) {
        return "Translation parsing error.";
    }
}

async function translateDeepSeek(text, key) {
    if (!key) throw new Error("DeepSeek API Key is missing.");

    const url = "https://api.deepseek.com/v1/chat/completions";
    const body = {
        model: DEEPSEEK_MODEL,
        messages: [
            { role: "system", content: "You are a professional translator. Translate the lyrics to Japanese line-by-line. \n\nIMPORTANT: You MUST output the Original English line first, followed immediately by the Japanese translation.\n\nExample Format:\nHello, it's me\nやあ、私だよ\nI was wondering if after all these years\nこれだけの年月が経っても\n\nDo not output only the translation. Keep all original lines." },
            { role: "user", content: text }
        ]
    };

    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${key}`
        },
        body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error("DeepSeek API Error");
    const data = await res.json();
    return data.choices[0].message.content;
}

// General helper for Explanation (Gemini)
async function fetchGeminiCompletion(prompt, key, customModel) {
    if (!key) throw new Error("Gemini API Key is missing.");

    // Reuse model logic if possible or simplify
    let modelName = 'models/gemini-2.5-flash';
    if (customModel && customModel.trim() !== "") {
        modelName = customModel.includes('/') ? customModel : `models/${customModel}`;
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${key}`;
    const body = { contents: [{ parts: [{ text: prompt }] }] };

    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error("Gemini API Error: " + err);
    }

    const data = await res.json();
    try {
        return data.candidates[0].content.parts[0].text;
    } catch (e) {
        return "Explanation parsing error.";
    }
}

// General helper for Explanation (DeepSeek)
async function fetchDeepSeekCompletion(prompt, key) {
    if (!key) throw new Error("DeepSeek API Key is missing.");

    const url = "https://api.deepseek.com/v1/chat/completions";
    const body = {
        model: DEEPSEEK_MODEL,
        messages: [
            { role: "system", content: "You are a helpful assistant for explaining lyrics context." },
            { role: "user", content: prompt }
        ]
    };

    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${key}`
        },
        body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error("DeepSeek API Error");
    const data = await res.json();
    return data.choices[0].message.content;
}

// OpenAI
async function translateOpenAI(text, key, model) {
    if (!key) throw new Error("OpenAI API Key is missing.");
    const modelName = model || "gpt-3.5-turbo";

    const url = "https://api.openai.com/v1/chat/completions";
    const body = {
        model: modelName,
        messages: [
            { role: "system", content: "You are a professional translator. Translate the lyrics to Japanese line-by-line. \n\nIMPORTANT: You MUST output the Original English line first, followed immediately by the Japanese translation.\n\nExample Format:\nHello, it's me\nやあ、私だよ\nI was wondering if after all these years\nこれだけの年月が経っても\n\nDo not output only the translation. Keep all original lines." },
            { role: "user", content: text }
        ]
    };

    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${key}`
        },
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error("OpenAI API Error: " + err);
    }
    const data = await res.json();
    return data.choices[0].message.content;
}

// Hugging Face
async function translateHuggingFace(text, token, model) {
    if (!token) throw new Error("Hugging Face Token is missing.");
    const modelId = model || "mistralai/Mistral-7B-Instruct-v0.3";
    const url = `https://api-inference.huggingface.co/models/${modelId}`;

    const prompt = `Translate the lyrics to Japanese line-by-line. \n\nIMPORTANT: You MUST output the Original English line first, followed immediately by the Japanese translation.\n\nExample Format:\nHello, it's me\nやあ、私だよ\nI was wondering if after all these years\nこれだけの年月が経っても\n\nLyrics:\n${text}\n\nTranslation:`;
    
    const body = { inputs: `[INST] ${prompt} [/INST]`, parameters: { max_new_tokens: 2048, return_full_text: false } };

    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error("Hugging Face API Error: " + err);
    }
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
        return data[0].generated_text;
    } else if (data.generated_text) {
        return data.generated_text;
    }
    return "Translation failed (HF format)";
}

// OpenRouter
async function translateOpenRouter(text, key, model) {
    if (!key) throw new Error("OpenRouter API Key is missing.");
    const modelName = model || "anthropic/claude-3-haiku";

    const url = "https://openrouter.ai/api/v1/chat/completions";
    const body = {
        model: modelName,
        messages: [
            { role: "system", content: "You are a professional translator. Translate the lyrics to Japanese line-by-line. \n\nIMPORTANT: You MUST output the Original English line first, followed immediately by the Japanese translation.\n\nExample Format:\nHello, it's me\nやあ、私だよ\nI was wondering if after all these years\nこれだけの年月が経っても\n\nDo not output only the translation. Keep all original lines." },
            { role: "user", content: text }
        ]
    };

    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${key}`,
            // "HTTP-Referer": "", // Optional
            // "X-Title": "Lyrics Translator Ext" // Optional
        },
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error("OpenRouter API Error: " + err);
    }
    const data = await res.json();
    return data.choices[0].message.content;
}

// Helper: OpenAI Completion
async function fetchOpenAICompletion(prompt, key, model) {
    if (!key) throw new Error("OpenAI API Key is missing.");
    const modelName = model || "gpt-3.5-turbo";
    const url = "https://api.openai.com/v1/chat/completions";
    
    const body = {
        model: modelName,
        messages: [
            { role: "system", content: "You are a helpful assistant for explaining lyrics context." },
            { role: "user", content: prompt }
        ]
    };
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
        body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error("OpenAI API Error");
    const data = await res.json();
    return data.choices[0].message.content;
}

// Helper: HF Completion
async function fetchHFCompletion(prompt, token, model) {
    if (!token) throw new Error("Hugging Face Token is missing.");
    const modelId = model || "mistralai/Mistral-7B-Instruct-v0.3";
    const url = `https://api-inference.huggingface.co/models/${modelId}`;
    
    const body = { inputs: `[INST] ${prompt} [/INST]`, parameters: { max_new_tokens: 1024, return_full_text: false } };
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error("Hugging Face API Error");
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) return data[0].generated_text;
    return data.generated_text || "Error fetching explanation";
}

// Helper: OpenRouter Completion
async function fetchOpenRouterCompletion(prompt, key, model) {
    if (!key) throw new Error("OpenRouter API Key is missing.");
    const modelName = model || "anthropic/claude-3-haiku";
    const url = "https://openrouter.ai/api/v1/chat/completions";
    
    const body = {
        model: modelName,
        messages: [
            { role: "system", content: "You are a helpful assistant for explaining lyrics context." },
            { role: "user", content: prompt }
        ]
    };
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
        body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error("OpenRouter API Error");
    const data = await res.json();
    return data.choices[0].message.content;
}
