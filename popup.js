document.getElementById('btnSearch').addEventListener('click', async () => {
    const query = document.getElementById('query').value.trim();
    const artist = document.getElementById('artist').value.trim();
    const song = document.getElementById('song').value.trim();
    const statusDiv = document.getElementById('status');

    if (!query && (!artist || !song)) {
        statusDiv.textContent = "Please enter Query or Artist + Song";
        statusDiv.style.color = "red";
        return;
    }

    statusDiv.textContent = "Sending to YouTube...";
    statusDiv.style.color = "blue";

    try {
        // Send to Background Script
        await browser.runtime.sendMessage({
            command: "search_and_show",
            query: query,
            artist: artist,
            song: song
        });

        // We don't wait for "response" from background in the same way,
        // as background interacts with active tab.
        // But we can assume it started.

        statusDiv.textContent = "Search Started!";
        statusDiv.style.color = "green";

    } catch (error) {
        console.error("Error:", error);
        statusDiv.textContent = "Failed. Are you on YouTube?";
        statusDiv.style.color = "red";
    }
});
