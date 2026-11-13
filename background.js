// Background Script for Lyrics Fetching

browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.command === "search_and_show") {
        const config = await browser.storage.local.get({
            provider: 'Gemini',
            gemini_key: '',
            gemini_model: '',
            deepseek_key: '',
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
            } else {
                translated = await translateGemini(lyrics, config.gemini_key, config.gemini_model);
            }

            sendMessageToActiveTab({ action: "show_lyrics", text: translated });

        } catch (e) {
            console.error(e);
            sendMessageToActiveTab({ action: "error", text: "Error: " + e.message });
        }
    }
});

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
        model: "deepseek-chat",
        messages: [
            { role: "system", content: "You are a professional translator. Translate the lyrics to Japanese. Output format: Original Line (newline) Japanese Translation. Keep all original lines." },
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
