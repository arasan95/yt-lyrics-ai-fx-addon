document.addEventListener('DOMContentLoaded', async () => {
    // Get index from URL
    const params = new URLSearchParams(window.location.search);
    const index = params.get('index');

    if (index === null) {
        document.getElementById('lyrics').textContent = "No history item specified.";
        return;
    }

    try {
        const data = await browser.storage.local.get("searchHistory");
        const history = data.searchHistory || [];
        const item = history[index];

        if (!item) {
            document.getElementById('lyrics').textContent = "Item not found in history.";
            return;
        }

        // Populate basic info
        const title = item.query || `${item.artist} - ${item.song}`;
        document.getElementById('title').textContent = title;
        
        const date = new Date(item.timestamp).toLocaleString();
        document.getElementById('meta').textContent = `Saved on: ${date}`;

        // Populate lyrics
        const lyricsText = item.translated || item.lyrics || "No lyrics content.";
        document.getElementById('lyrics').textContent = lyricsText;

        // Populate explanation if exists
        if (item.explanation) {
             const explanationDiv = document.getElementById('explanation');
             explanationDiv.style.display = 'block';
             document.getElementById('explanation-text').textContent = item.explanation;
        }

    } catch (e) {
        console.error(e);
        document.getElementById('lyrics').textContent = "Error loading history.";
    }
});
