// Content Script - Injected into YouTube

let overlay = null;
let contentDiv = null;

browser.runtime.onMessage.addListener((message) => {
    if (message.action === "status") {
        showOverlay(message.text);
    } else if (message.action === "show_lyrics") {
        showOverlay(message.text);
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
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        color: 'white',
        zIndex: '9999',
        borderRadius: '8px',
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
    header.innerText = "Lyrics Translator";
    Object.assign(header.style, {
        padding: '10px',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        // cursor: 'move', // Cursor moved to overlay
        userSelect: 'none',
        fontWeight: 'bold',
        fontSize: '14px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    });

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
    btnClose.onclick = () => { overlay.style.display = 'none'; };
    header.appendChild(btnClose);

    // Draggable Logic (Anywhere)
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    // Attach to overlay for "drag anywhere"
    overlay.addEventListener('mousedown', (e) => {
        // Prevent drag if clicking buttons or scrollbar (approx)
        if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;

        // Also respect check for scrollbar interaction (right/bottom edges)
        const rect = overlay.getBoundingClientRect();
        const isResizeZone = (e.clientX > rect.right - 20) && (e.clientY > rect.bottom - 20);
        if (isResizeZone) return; // Allow resize

        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initialLeft = overlay.offsetLeft;
        initialTop = overlay.offsetTop;
        // e.preventDefault(); // Don't prevent default too early or text select fails?
        // User wants to move window, text selection might be secondary or require specific mode.
        // Assuming priority is moving window.
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        overlay.style.left = `${initialLeft + dx}px`;
        overlay.style.top = `${initialTop + dy}px`;
    });

    document.addEventListener('mouseup', () => { isDragging = false; });

    // Controls
    const controls = document.createElement('div');
    Object.assign(controls.style, {
        padding: '5px 10px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        gap: '10px',
        fontSize: '12px',
        background: 'rgba(0,0,0,0.3)'
    });

    const btnFontUp = document.createElement('button');
    btnFontUp.innerText = "A+";
    btnFontUp.onclick = (e) => { e.stopPropagation(); changeFontSize(2); };

    const btnFontDown = document.createElement('button');
    btnFontDown.innerText = "A-";
    btnFontDown.onclick = (e) => { e.stopPropagation(); changeFontSize(-2); };

    const btnOpUp = document.createElement('button');
    btnOpUp.innerText = "Op+";
    btnOpUp.onclick = (e) => { e.stopPropagation(); changeOpacity(0.1); };

    const btnOpDown = document.createElement('button');
    btnOpDown.innerText = "Op-";
    btnOpDown.onclick = (e) => { e.stopPropagation(); changeOpacity(-0.1); };

    [btnFontDown, btnFontUp, btnOpDown, btnOpUp].forEach(b => {
        Object.assign(b.style, {
            background: '#444', color: 'white', border: 'none', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer'
        });
        controls.appendChild(b);
    });

    // Content Area
    contentDiv = document.createElement('div');
    contentDiv.id = 'lyrics-content';
    Object.assign(contentDiv.style, {
        flex: '1',
        padding: '15px',
        overflowY: 'auto',
        whiteSpace: 'pre-wrap',
        fontSize: '18px',
        lineHeight: '1.6',
        fontFamily: 'sans-serif'
    });

    // Custom Scrollbar
    const style = document.createElement('style');
    style.textContent = `
        #lyrics-content::-webkit-scrollbar { width: 8px; }
        #lyrics-content::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); }
        #lyrics-content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.3); border-radius: 4px; }
        #lyrics-content::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.5); }
    `;

    overlay.appendChild(header);
    overlay.appendChild(controls);
    overlay.appendChild(contentDiv);
    overlay.appendChild(style);

    moviePlayer.appendChild(overlay);
}

function showOverlay(text) {
    createOverlay();
    overlay.style.display = 'flex';
    contentDiv.innerText = text;
}

let currentFontSize = 18;
function changeFontSize(delta) {
    currentFontSize = Math.max(10, currentFontSize + delta);
    if (contentDiv) contentDiv.style.fontSize = `${currentFontSize}px`;
}

let currentOpacity = 0.6;
function changeOpacity(delta) {
    currentOpacity = Math.max(0.1, Math.min(1.0, currentOpacity + delta));
    if (overlay) overlay.style.backgroundColor = `rgba(0, 0, 0, ${currentOpacity})`;
}
