// Content Script - Injected into YouTube

let overlay = null;
let contentDiv = null;
let explanationDiv = null;
let resizer = null;
let splitContainer = null;
let isBlurEnabled = true;

// UI State Variables (Moved to top for safety)
let currentFontSize = 18;
let currentOpacity = 0.6; // Default opacity
let currentScrollMultiplier = 1.0; // Default speed multiplier
let currentEdgeSize = 0; // Default edge size (0px)
let cachedExplanation = null; // Store explanation if provided

// Compatibility for Chrome/Firefox
// console.error("[LyricsExt] Content script loaded (FORCE CHECK MODE)."); // Top-level log in RED

// Compatibility for Chrome/Firefox
const api = (typeof browser !== 'undefined' ? browser : chrome);

// Helper for storage.local.get (Promise wrapper for Chrome callback)
function storageGet(keys) {
    return new Promise((resolve, reject) => {
        if (typeof browser !== 'undefined') {
            browser.storage.local.get(keys).then(resolve).catch(reject);
        } else {
            chrome.storage.local.get(keys, (items) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(items);
                }
            });
        }
    });
}

api.runtime.onMessage.addListener((message) => {
    if (message.action === "status") {
        showOverlay(message.text);
    } else if (message.action === "show_lyrics") {
        showOverlay(message.text);
        
        // Handle optional explanation
        cachedExplanation = message.explanation || null;

        // Clear explanation when new lyrics show
        if (explanationDiv) explanationDiv.innerHTML = "";
        if (splitContainer) {
             // Reset split if needed, or keep as is? Let's hide explanation pane initially for new search to keep it clean, 
             // IF we assume user wants to explicitly ask for explanation.
             // But if they already had it open, maybe keep it? 
             // Let's keep it simple: just clear text. User can close pane if they want.
             // Actually, hiding the pane might be better UX if it's empty.
             // For now, let's just clear the text.
             if (explanationDiv) explanationDiv.style.display = 'none';
             if (resizer) resizer.style.display = 'none';
             if (contentDiv) contentDiv.style.flex = '1';
        }

        // Hide restore button since overlay is shown
        const restoreBtn = document.getElementById('lyrics-restore-btn');
        if (restoreBtn) restoreBtn.style.display = 'none';
    } else if (message.action === "show_explanation") {
        if (explanationDiv) {
            cachedExplanation = message.text; // Update cache
            renderMarkdownToElement(message.text, explanationDiv);
        }
    } else if (message.action === "error") {
        showOverlay("Error: " + message.text);
    }
});

function createOverlay() {
    if (document.getElementById('lyric-overlay-root')) return;

    const moviePlayer = document.querySelector('#movie_player') || document.querySelector('video')?.parentElement;
    if (!moviePlayer) return;

    // Container
    overlay = document.createElement('div');
    overlay.id = 'lyric-overlay-root';
    Object.assign(overlay.style, {
        position: 'absolute',
        top: '10px',
        left: '10px',
        width: '400px',
        height: '500px',
        height: '500px',
        backgroundColor: `rgba(0, 0, 0, ${currentOpacity})`, // Use variable for sync
        color: 'white',
        zIndex: '9999',
        borderRadius: '12px', // 12px radius
        display: 'flex',
        flexDirection: 'column',
        backdropFilter: 'blur(2px)',
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.2)',
        resize: 'both', // Enable native resizing
        minWidth: '200px',
        minHeight: '200px'
    });

    // Header (Info)
    const header = document.createElement('div');
    Object.assign(header.style, {
        padding: '10px',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        userSelect: 'none',
        fontWeight: 'bold',
        fontSize: '14px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    });
    
    const titleSpan = document.createElement('span');
    titleSpan.innerText = "Lyrics Translator";
    header.appendChild(titleSpan);

    // Close Button
    const btnClose = document.createElement('button');
    btnClose.innerText = "✕";
    Object.assign(btnClose.style, {
        background: 'transparent',
        border: 'none',
        color: 'white',
        cursor: 'pointer',
        fontSize: '16px'
    });
    btnClose.onclick = () => { 
        overlay.style.display = 'none'; 
        const restoreBtn = document.getElementById('lyrics-restore-btn');
        if (restoreBtn) restoreBtn.style.display = 'block';
    };
    header.appendChild(btnClose);

    // Draggable Logic (Anywhere)
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    // Attach to overlay for "drag anywhere"
    overlay.addEventListener('mousedown', (e) => {
        // Prevent drag if clicking buttons, scrollbar, or resizer
        if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target === resizer) return;

        // Also respect check for scrollbar interaction (right/bottom edges)
        const rect = overlay.getBoundingClientRect();
        const isResizeZone = (e.clientX > rect.right - 20) && (e.clientY > rect.bottom - 20);
        if (isResizeZone) return; // Allow resize

        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initialLeft = overlay.offsetLeft;
        initialTop = overlay.offsetTop;
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        overlay.style.left = `${initialLeft + dx}px`;
        overlay.style.top = `${initialTop + dy}px`;
    });

    document.addEventListener('mouseup', () => { isDragging = false; });

    document.addEventListener('mouseup', () => { isDragging = false; });

    // Auto Scroll Logic (Smooth Version)
    let isAutoScroll = false;
    let previousTime = 0;
    let animationFrameId = null;
    let scrollAccumulator = 0; // Accumulator for fractional pixels
    
    let autoScrollLoop = () => {
        if (!isAutoScroll) return;

        const video = document.querySelector('video');
        if (!video || !contentDiv) {
            animationFrameId = requestAnimationFrame(autoScrollLoop); 
            return;
        }
        
        const currentTime = video.currentTime;
        const duration = video.duration;

        if (isNaN(duration) || duration === 0 || video.paused) {
            previousTime = performance.now(); 
            animationFrameId = requestAnimationFrame(autoScrollLoop);
            return;
        }

        // Speed = (Height / Duration) * PlaybackRate
        const scrollableHeight = contentDiv.scrollHeight - contentDiv.clientHeight;
        if (scrollableHeight <= 0) {
            previousTime = performance.now();
            animationFrameId = requestAnimationFrame(autoScrollLoop);
            return;
        }
        
        const rate = video.playbackRate || 1.0;
        // Speed = (Height / (Duration * 0.9)) * Rate * Multiplier
        // This ensures scrolling finishes when video is at 90% progress, adjusted by user.
        const effectiveDuration = duration * 0.9;
        const pixelsPerSecond = (scrollableHeight / effectiveDuration) * rate * currentScrollMultiplier;

        const now = performance.now();
        const dt = (now - previousTime) / 1000; // seconds
        previousTime = now;

        // Apply scroll purely based on velocity with accumulator
        if (dt > 0) {
             const delta = pixelsPerSecond * dt;
             scrollAccumulator += delta;
             
             // Only apply integer pixels to avoid browser rounding loss
             const movePixels = Math.floor(scrollAccumulator);
             if (movePixels > 0) {
                 contentDiv.scrollTop += movePixels;
                 scrollAccumulator -= movePixels;
             }
        }
        
        animationFrameId = requestAnimationFrame(autoScrollLoop);
    };

    const toggleAutoScroll = () => {
        const video = document.querySelector('video');
        if (!video) return;

        isAutoScroll = !isAutoScroll;
        btnAutoScroll.innerText = isAutoScroll ? "Auto Scroll: ON" : "Auto Scroll: OFF";
        btnAutoScroll.style.background = isAutoScroll ? "#007aff" : "#444";

        if (isAutoScroll) {
            previousTime = performance.now();
            autoScrollLoop();
        } else {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        }
    };

    // Navigation Reset (Feature 11)
    const controls = document.createElement('div');
    Object.assign(controls.style, {
        padding: '5px 10px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        gap: '10px',
        fontSize: '12px',
        background: 'rgba(0,0,0,0.3)',
        flexWrap: 'wrap',
        alignItems: 'center'
    });

    // Font Size Slider
    const fontLabel = document.createElement('span');
    fontLabel.innerText = "Size:";
    const fontSlider = document.createElement('input');
    fontSlider.type = "range";
    fontSlider.min = "10";
    fontSlider.max = "40";
    fontSlider.value = currentFontSize;
    fontSlider.step = "1";
    fontSlider.style.width = "120px"; // Increased width
    fontSlider.oninput = (e) => setFontSize(parseInt(e.target.value));
    
    // Opacity Slider
    const opLabel = document.createElement('span');
    opLabel.innerText = "Op:";
    const opSlider = document.createElement('input');
    opSlider.type = "range";
    opSlider.min = "0.1";
    opSlider.max = "1.0";
    opSlider.step = "0.1";
    opSlider.value = currentOpacity;
    // Explicitly set attribute for visual sync
    opSlider.setAttribute('value', currentOpacity);
    opSlider.style.width = "120px"; // Increased width
    opSlider.oninput = (e) => setOpacity(parseFloat(e.target.value));

    // Speed Slider
    const spdLabel = document.createElement('span');
    spdLabel.innerText = "Spd:";
    const spdSlider = document.createElement('input');
    spdSlider.type = "range";
    spdSlider.min = "0.5";
    spdSlider.max = "2.0";
    spdSlider.step = "0.1";
    spdSlider.value = currentScrollMultiplier;
    spdSlider.style.width = "100px";
    spdSlider.oninput = (e) => {
        currentScrollMultiplier = parseFloat(e.target.value);
    };

    // Edge (Border) Slider
    const edgeLabel = document.createElement('span');
    edgeLabel.innerText = "Edge:";
    const edgeSlider = document.createElement('input');
    edgeSlider.type = "range";
    edgeSlider.min = "0";
    edgeSlider.max = "4";
    edgeSlider.step = "0.5";
    edgeSlider.value = currentEdgeSize;
    edgeSlider.style.width = "80px";
    edgeSlider.oninput = (e) => setEdgeSize(parseFloat(e.target.value));

    // Blur Button
    const btnBlur = document.createElement('button');
    btnBlur.innerText = isBlurEnabled ? "Blur: ON" : "Blur: OFF";
    Object.assign(btnBlur.style, {
        background: isBlurEnabled ? '#007aff' : '#444', 
        color: 'white', 
        border: 'none', 
        borderRadius: '4px', 
        padding: '2px 8px', 
        cursor: 'pointer', 
        marginLeft: 'auto'
    });
    btnBlur.onclick = (e) => {
        isBlurEnabled = !isBlurEnabled;
        overlay.style.backdropFilter = isBlurEnabled ? 'blur(2px)' : 'none';
        btnBlur.innerText = isBlurEnabled ? "Blur: ON" : "Blur: OFF";
        btnBlur.style.background = isBlurEnabled ? '#007aff' : '#444';
        e.stopPropagation();
    };

    // Auto Scroll Button
    const btnAutoScroll = document.createElement('button');
    btnAutoScroll.innerText = "Auto Scroll: OFF";
    Object.assign(btnAutoScroll.style, {
        background: '#444', color: 'white', border: 'none', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer'
    });
    btnAutoScroll.onclick = (e) => { e.stopPropagation(); toggleAutoScroll(); };

    // Explain Button
    const btnExplain = document.createElement('button');
    btnExplain.innerText = "Explain";
    Object.assign(btnExplain.style, {
        background: '#007aff', color: 'white', border: 'none', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer'
    });
    btnExplain.onclick = (e) => { e.stopPropagation(); toggleExplanation(); };

    controls.appendChild(fontLabel);
    controls.appendChild(fontSlider);
    controls.appendChild(opLabel);
    controls.appendChild(opSlider);
    controls.appendChild(spdLabel);
    controls.appendChild(spdSlider);
    controls.appendChild(edgeLabel);
    controls.appendChild(edgeSlider);
    controls.appendChild(btnBlur);
    controls.appendChild(btnAutoScroll);
    controls.appendChild(btnExplain);

    // Split Container
    splitContainer = document.createElement('div');
    Object.assign(splitContainer.style, {
        display: 'flex',
        flex: '1',
        overflow: 'hidden',
        position: 'relative'
    });

    // Left: LyricsContent Area
    contentDiv = document.createElement('div');
    contentDiv.id = 'lyrics-content';
    Object.assign(contentDiv.style, {
        flex: '1',
        padding: '15px',
        overflowY: 'auto',
        whiteSpace: 'pre-wrap',
        fontSize: `${currentFontSize}px`,
        lineHeight: '1.6',
        fontFamily: 'sans-serif',
        minWidth: '50px' // Prevent collapse
    });

    // Resizer
    resizer = document.createElement('div');
    Object.assign(resizer.style, {
        width: '5px',
        background: 'rgba(255,255,255,0.1)',
        cursor: 'col-resize',
        display: 'none', // Hidden initially
        userSelect: 'none'
    });

    // Resizer Logic
    let isResizingSplit = false;
    resizer.addEventListener('mousedown', (e) => {
        isResizingSplit = true;
        e.stopPropagation(); 
        e.preventDefault(); 
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizingSplit) return;
        const overlayRect = overlay.getBoundingClientRect();
        const relativeX = e.clientX - overlayRect.left;
        
        // Calculate percentage
        const percentage = (relativeX / overlayRect.width) * 100;
        if (percentage > 10 && percentage < 90) {
            contentDiv.style.flex = `0 0 ${percentage}%`;
        }
    });

    document.addEventListener('mouseup', () => { isResizingSplit = false; });

    // Right: Explanation Area
    explanationDiv = document.createElement('div');
    explanationDiv.id = 'explanation-content';
    Object.assign(explanationDiv.style, {
        flex: '1',
        padding: '15px',
        overflowY: 'auto',
        fontSize: `${Math.max(10, currentFontSize - 2)}px`,
        lineHeight: '1.5',
        fontFamily: 'sans-serif',
        borderLeft: '1px solid rgba(255,255,255,0.1)',
        background: 'rgba(0,0,0,0.2)',
        display: 'none', // Hidden initially
        minWidth: '50px'
    });

    // Custom Scrollbar Style (Applies to both)
    const style = document.createElement('style');
    style.textContent = `
        #lyrics-content::-webkit-scrollbar, #explanation-content::-webkit-scrollbar { width: 8px; }
        #lyrics-content::-webkit-scrollbar-track, #explanation-content::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); }
        #lyrics-content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.3); border-radius: 12px; }
        #lyrics-content::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.5); }
        /* Markdown Styles for Explanation */
        #explanation-content h3 { font-size: 1.1em; margin: 10px 0 5px; color: #eee; border-bottom: 1px solid rgba(255,255,255,0.2); }
        #explanation-content ul { margin: 5px 0; padding-left: 20px; }
        #explanation-content li { margin-bottom: 4px; }
        #explanation-content strong { color: #fff; }
    `;

    splitContainer.appendChild(contentDiv);
    splitContainer.appendChild(resizer);
    splitContainer.appendChild(explanationDiv);

    overlay.appendChild(header);
    overlay.appendChild(controls);
    overlay.appendChild(splitContainer);
    overlay.appendChild(style);

    moviePlayer.appendChild(overlay);

    // Create persistent restore button if not exists
    createRestoreButton(moviePlayer);
}

function createRestoreButton(container) {
    if (document.getElementById('lyrics-restore-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'lyrics-restore-btn';
    btn.innerText = "Lyrics";
    Object.assign(btn.style, {
        position: 'absolute',
        top: '10px',
        right: '10px',
        zIndex: '9998', // Below overlay (9999)
        background: 'rgba(0, 0, 0, 0.6)',
        color: 'white',
        border: '1px solid rgba(255,255,255,0.3)',
        borderRadius: '4px',
        padding: '5px 10px',
        cursor: 'pointer',
        fontSize: '14px',
        backdropFilter: 'blur(2px)',
        display: 'none' // Hidden by default, show if overlay is hidden but data exists
    });

    btn.onclick = async () => {
        // If overlay exists and has content, just show it
        if (overlay && contentDiv && contentDiv.innerText.trim() !== "") {
            overlay.style.display = 'flex';
            btn.style.display = 'none';
            return;
        }

        // If overlay is empty (e.g. strict page reload), fetch from cache
        btn.innerText = "Loading...";
        
        // Robust ID extraction
        let videoId = new URLSearchParams(window.location.search).get('v');
        if (!videoId && window.location.href) {
            const match = window.location.href.match(/[?&]v=([^&]+)/);
            if (match) videoId = match[1];
        }

        if (videoId) {
             const key = `lyrics_cache_${videoId}`;
             try {
                 const data = await storageGet(key);
                 if (data && data[key]) {
                      // Handle both string and object format
                      // Background script saves as { lyrics: "..." }
                      let text = "";
                      if (typeof data[key] === 'object') {
                          text = data[key].lyrics || data[key].text || "";
                      } else {
                          text = data[key];
                      }
                      
                      if (text) {
                          showOverlay(text);
                          // showOverlay handles UI state
                      } else {
                          // console.error("[LyricsExt] Cache found but text empty.");
                      }
                 } else {
                      // console.error("[LyricsExt] Cache not found on click.");
                 }
             } catch (e) {
                 console.error("[LyricsExt] Error fetching cache on click", e);
             }
        }
        
        btn.innerText = "Lyrics"; // Reset text
        btn.style.display = 'none'; // Hide button if successful (showOverlay does it too but safe here)
    };
    
    // Logic to show button when overlay is hidden but content exists
    // This needs to hook into overlay close event.
    // Update close button logic in createOverlay.
    
    container.appendChild(btn);
    
    // Check initial state
    checkCacheForButton();
}

async function checkCacheForButton(forceHideOverlay = false) {
    // Robust ID extraction
    let videoId = new URLSearchParams(window.location.search).get('v');
    if (!videoId && window.location.href) {
        const match = window.location.href.match(/[?&]v=([^&]+)/);
        if (match) videoId = match[1];
    }
    
    if (!videoId) {
        // console.error("[LyricsExt] No video ID found in URL.");
        return;
    }

    try {
        const key = `lyrics_cache_${videoId}`;
        // console.error("[LyricsExt] Checking cache for:", key);
        
        const data = await storageGet(key);
        // If cache exists
        if (data && data[key]) {
             // console.error("[LyricsExt] Cache hit! Data found.");
            
            // Ensure restore button exists
            let btn = document.getElementById('lyrics-restore-btn');
            if (!btn) {
                // Try create it if container exists
                const moviePlayer = document.querySelector('#movie_player') || document.querySelector('video')?.parentElement;
                if (moviePlayer) {
                    createRestoreButton(moviePlayer);
                    btn = document.getElementById('lyrics-restore-btn');
                } else {
                    console.warn("[LyricsExt] Player not found for button creation.");
                }
            }
            
            if (btn) {
                // Check if overlay is visible
                const isOverlayVisible = overlay && overlay.style.display !== 'none';
                
                // If overlay is hidden, SHOW button.
                // If overlay is visible, hide button.
                if (!isOverlayVisible) {
                     btn.style.display = 'block';
                } else {
                     btn.style.display = 'none';
                }
            }
        } else {
             // console.error("[LyricsExt] Cache miss. No data for key:", key);
             // No cache: ensure button hidden
             const btn = document.getElementById('lyrics-restore-btn');
             if (btn) btn.style.display = 'none';
        }
    } catch (e) {
        console.error("[LyricsExt] Error checking cache for button", e);
    }
}

function showOverlay(text) {
    createOverlay();
    overlay.style.display = 'flex';
    contentDiv.innerText = text;
}

async function toggleExplanation() {
    if (!explanationDiv || !resizer) return;
    
    if (explanationDiv.style.display === 'none') {
        // Show
        explanationDiv.style.display = 'block';
        resizer.style.display = 'block';
        contentDiv.style.flex = '0 0 60%'; // Defaut split 60/40
        
        if (cachedExplanation) {
            // Use cached explanation immediately from memory
            renderMarkdownToElement(cachedExplanation, explanationDiv);
            return;
        }

        // Try to fetch from storage directly if not in memory (Fix for refresh issue)
        explanationDiv.innerText = "Checking cache...";
        
        // Robust ID extraction (Handle playlists, etc.)
        let videoId = new URLSearchParams(window.location.search).get('v');
        if (!videoId && window.location.href) {
            const match = window.location.href.match(/[?&]v=([^&]+)/);
            if (match) videoId = match[1];
        }

        if (videoId) {
             const key = `lyrics_cache_${videoId}`;
             // console.error(`[LyricsExt] Checking explanation cache for: ${key}`);
             
             try {
                 const data = await storageGet(key);
                 if (data && data[key] && data[key].explanation) {
                     // console.error("[LyricsExt] Explanation found in cache. Using it.");
                     cachedExplanation = data[key].explanation;
                     renderMarkdownToElement(cachedExplanation, explanationDiv);
                     return;
                 } else {
                     // console.error("[LyricsExt] Explanation NOT found in cache.");
                 }
             } catch (e) {
                 console.error("[LyricsExt] Cache check failed", e);
             }
        } else {
            // console.error("[LyricsExt] Could not determine video ID for explanation cache.");
        }

        // Only fetch if not found in cache
        explanationDiv.innerText = "Loading explanation...";
        // console.error("[LyricsExt] Fetching explanation from API...");
        
        // Fetch explanation
        api.runtime.sendMessage({
            command: "explain_lyrics",
            text: contentDiv.innerText
        });
    } else {
        // Hide
        explanationDiv.style.display = 'none';
        resizer.style.display = 'none';
        contentDiv.style.flex = '1';
    }
}

// Helper Functions
function setFontSize(size) {
    currentFontSize = size;
    if (contentDiv) contentDiv.style.fontSize = `${currentFontSize}px`;
    if (explanationDiv) explanationDiv.style.fontSize = `${Math.max(10, currentFontSize - 2)}px`; 
}

function setOpacity(val) {
    currentOpacity = val;
    if (overlay) overlay.style.backgroundColor = `rgba(0, 0, 0, ${currentOpacity})`;
}

function setEdgeSize(size) {
    currentEdgeSize = size;
    if (contentDiv) {
        if (size > 0) {
            // Use multiple text-shadows to simulate stroke OUTSIDE the text
            // Generate shadows in a circle for smoother look
            const layers = [];
            const steps = 16; // Number of shadows for roundness
            for (let i = 0; i < steps; i++) {
                const angle = (i * 2 * Math.PI) / steps;
                const x = (size * Math.cos(angle)).toFixed(2);
                const y = (size * Math.sin(angle)).toFixed(2);
                layers.push(`${x}px ${y}px 0 #000`);
            }
            contentDiv.style.webkitTextStroke = '0px'; // Disable stroke which cuts inside
            contentDiv.style.textShadow = layers.join(', ');
        } else {
            contentDiv.style.webkitTextStroke = '0px';
            contentDiv.style.textShadow = 'none';
        }
    }
}

// Helper to wait for YouTube player element
function waitForPlayer() {
    return new Promise((resolve) => {
        const getPlayer = () => document.querySelector('#movie_player') || document.querySelector('video')?.parentElement || document.querySelector('#player');
        
        console.error("[LyricsExt] Waiting for player (Promise)...");
        const player = getPlayer();
        if (player) {
            // console.error("[LyricsExt] Player found immediately (Promise).");
            resolve(player);
            return;
        }

        let attempts = 0;
        const maxAttempts = 20; // 10 seconds (500ms * 20)

        const interval = setInterval(() => {
            attempts++;
            const p = getPlayer();
            if (p) {
                // console.error(`[LyricsExt] Player found after ${attempts} attempts (Promise).`);
                clearInterval(interval);
                resolve(p);
            } else if (attempts >= maxAttempts) {
                 // console.error(`[LyricsExt] Player NOT found after ${maxAttempts} attempts (Promise). Giving up.`);
                 clearInterval(interval);
                 // Resolve null to allow processing to continue or fail gracefully
                 resolve(null);
            }
        }, 500);
    });
}

function renderMarkdownToElement(text, targetElement) {
    targetElement.innerText = ""; // Clear existing
    if (!text) return;

    const lines = text.split('\n');
    let ul = null;

    lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            if (!ul) {
                ul = document.createElement('ul');
                targetElement.appendChild(ul);
            }
            const li = document.createElement('li');
            // Bold support in list items
            parseBoldToElement(trimmed.substring(2), li);
            ul.appendChild(li);
        } else {
            if (ul) ul = null;

            // Headers
            if (trimmed.startsWith('### ')) {
                const h3 = document.createElement('h3');
                h3.textContent = trimmed.substring(4);
                targetElement.appendChild(h3);
            } else if (trimmed.startsWith('## ')) {
                const h3 = document.createElement('h3');
                h3.textContent = trimmed.substring(3);
                targetElement.appendChild(h3);
            } else if (trimmed.startsWith('# ')) {
                const h3 = document.createElement('h3');
                h3.textContent = trimmed.substring(2);
                targetElement.appendChild(h3);
            } else {
                // Normal line
                if (trimmed === "") {
                    targetElement.appendChild(document.createElement('br'));
                } else {
                    const div = document.createElement('div');
                    parseBoldToElement(line, div);
                    targetElement.appendChild(div);
                }
            }
        }
    });
}

function parseBoldToElement(text, parent) {
    const parts = text.split('**');
    parts.forEach((part, index) => {
        if (index % 2 === 1) { // Inside **
            const strong = document.createElement('strong');
            strong.textContent = part;
            parent.appendChild(strong);
        } else {
            if (part) parent.appendChild(document.createTextNode(part));
        }
    });
}

// --- TOP LEVEL INITIALIZATION ---
// This runs immediately when content script loads

// Navigation Reset (Feature 11)
document.addEventListener('yt-navigate-finish', () => {
    // Reset overlay state when video changes
    if (overlay) {
            overlay.style.display = 'none';
            contentDiv.innerText = "";
            // Reset restore button visibility (hide it until new lyrics load)
            const restoreBtn = document.getElementById('lyrics-restore-btn');
            if (restoreBtn) restoreBtn.style.display = 'none';
            if (explanationDiv) {
                explanationDiv.style.display = 'none';
                explanationDiv.innerText = "";
                if (resizer) resizer.style.display = 'none';
                contentDiv.style.flex = '1';
            }
    }
    
    // Check cache immediately for current video to show restore button if exists
    checkCacheForButton(true);
});


// Initial check (load)
// FORCE CHECK: Do not wait for promise. 
// Start interval immediately to check for player and cache.
// console.error("[LyricsExt] Starting FORCE CHECK interval...");
let forceCheckCount = 0;
const forceInterval = setInterval(() => {
    forceCheckCount++;
    // Try to find player directly
    const player = document.querySelector('#movie_player') || document.querySelector('video')?.parentElement;
    
    if (player) {
        // console.error(`[LyricsExt] Player found (Interval ${forceCheckCount}). Checking cache...`);
        checkCacheForButton(false); // Pass false to not hide overlay
        
        // If we found it, maybe we can stop? But let's keep checking a few times just in case ID changes or player reloads.
        if (forceCheckCount > 10) clearInterval(forceInterval);
    } else {
            // if (forceCheckCount % 5 === 0) console.error(`[LyricsExt] Player NOT found yet (Interval ${forceCheckCount})...`);
    }
    
    // Stop after 30 seconds
    if (forceCheckCount > 30) {
        console.error("[LyricsExt] Force check timed out.");
        clearInterval(forceInterval);
    }
}, 1000);

// Also keep the robust wait as backup
waitForPlayer().then((player) => {
    if (player) {
        console.error("[LyricsExt] Player ready (Promise). Running initial checkCacheForButton.");
        checkCacheForButton();
    } else {
        console.error("[LyricsExt] Failed to initialize: player not found (Promise).");
    }
});


