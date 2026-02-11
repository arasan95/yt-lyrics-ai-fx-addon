// DOM Elements
const queryInput = document.getElementById("query");
const artistInput = document.getElementById("artist");
const songInput = document.getElementById("song");
const btnSearch = document.getElementById("btnSearch");
const statusDiv = document.getElementById("status");
const providerSelect = document.getElementById("provider");

// Tabs
const tabSearch = document.getElementById("tabSearch");
const tabHistory = document.getElementById("tabHistory");
const viewSearch = document.getElementById("viewSearch");
const viewHistory = document.getElementById("viewHistory");
const historyList = document.getElementById("historyList");
const btnClearHistory = document.getElementById("btnClearHistory");

// Persistence: Load saved inputs
document.addEventListener("DOMContentLoaded", async () => {
  const saved = await browser.storage.local.get([
    "savedQuery",
    "savedArtist",
    "savedSong",
    "provider" 
  ]);
  if (saved.savedQuery) queryInput.value = saved.savedQuery;
  if (saved.savedArtist) artistInput.value = saved.savedArtist;
  if (saved.savedSong) songInput.value = saved.savedSong;
  if (saved.provider) providerSelect.value = saved.provider;

  loadHistory();
});

// Persistence: Save inputs on change
function saveInputs() {
  browser.storage.local.set({
    savedQuery: queryInput.value,
    savedArtist: artistInput.value,
    savedSong: songInput.value,
  });
}
queryInput.addEventListener("input", saveInputs);
artistInput.addEventListener("input", saveInputs);
songInput.addEventListener("input", saveInputs);

// Save provider immediately on change
providerSelect.addEventListener("change", () => {
    browser.storage.local.set({ provider: providerSelect.value });
});

// Tab Switching
tabSearch.addEventListener("click", () => {
  viewSearch.style.display = "block";
  viewHistory.style.display = "none";
  tabSearch.style.backgroundColor = "#007aff";
  tabSearch.style.color = "white";
  tabHistory.style.backgroundColor = "#ddd";
  tabHistory.style.color = "#333";
});

tabHistory.addEventListener("click", () => {
  viewSearch.style.display = "none";
  viewHistory.style.display = "block";
  tabSearch.style.backgroundColor = "#ddd";
  tabSearch.style.color = "#333";
  tabHistory.style.backgroundColor = "#007aff";
  tabHistory.style.color = "white";
  loadHistory();
});

// Search Logic
btnSearch.addEventListener("click", async () => {
  const query = queryInput.value.trim();
  const artist = artistInput.value.trim();
  const song = songInput.value.trim();

  if (!query && (!artist || !song)) {
    statusDiv.textContent = "Please enter Query or Artist + Song";
    statusDiv.style.color = "red";
    return;
  }

  statusDiv.textContent = "Sending to YouTube...";
  statusDiv.style.color = "blue";

  try {
    await browser.runtime.sendMessage({
      command: "search_and_show",
      query: query,
      artist: artist,
      song: song,
    });
    statusDiv.textContent = "Search Started!";
    statusDiv.style.color = "green";
  } catch (error) {
    console.error("Error:", error);
    statusDiv.textContent = "Failed. Are you on YouTube?";
    statusDiv.style.color = "red";
  }
});

// History Logic
async function loadHistory() {
  const data = await browser.storage.local.get("searchHistory");
  const history = data.searchHistory || [];

  historyList.innerHTML = "";
  if (history.length === 0) {
    historyList.innerHTML =
      '<li style="padding: 10px; text-align: center; color: #888;">No history yet.</li>';
    return;
  }

  history.forEach((item, index) => {
    const li = document.createElement("li");
    li.style.cssText =
      "padding: 10px; border-bottom: 1px solid #eee; display: flex; align-items: center; justify-content: space-between;";

    // Left side: Content
    const content = document.createElement("div");
    content.style.cssText = "flex: 1; cursor: pointer;";
    content.addEventListener("click", () => {
      // Open detailed viewer in new tab
      browser.tabs.create({ url: `history_viewer.html?index=${index}` });
    });

    const title = document.createElement("div");
    title.style.fontWeight = "bold";
    // Check for explanation existence to show icon or tag
    const hasExplanation = item.explanation ? " 📖" : "";
    title.textContent = (item.query || `${item.artist} - ${item.song}`) + hasExplanation;

    const sub = document.createElement("div");
    sub.style.fontSize = "10px";
    sub.style.color = "#888";
    sub.textContent = new Date(item.timestamp).toLocaleString();

    content.appendChild(title);
    content.appendChild(sub);
    
    // Right side: Delete Button
    const delBtn = document.createElement("button");
    delBtn.textContent = "×";
    delBtn.style.cssText = "width: 24px; height: 24px; padding: 0; margin-left: 10px; background: #ff3b30; color: white; border: none; border-radius: 50%; font-size: 16px; min-width: 24px;";
    delBtn.title = "Remove from history";
    
    delBtn.addEventListener("click", async (e) => {
        e.stopPropagation(); // prevent triggering restore
        if (confirm("Delete this item?")) {
            await deleteHistoryItem(index);
        }
    });

    li.appendChild(content);
    li.appendChild(delBtn);

    historyList.appendChild(li);
  });
}

async function deleteHistoryItem(index) {
  const data = await browser.storage.local.get("searchHistory");
  let history = data.searchHistory || [];
  
  if (index >= 0 && index < history.length) {
      history.splice(index, 1);
      await browser.storage.local.set({ searchHistory: history });
      loadHistory(); // Refresh list
  }
}

function restoreAndShow(item) {
  // Restore inputs logic if desired, or just show the result
  if (item.query) queryInput.value = item.query;
  if (item.artist) artistInput.value = item.artist;
  if (item.song) songInput.value = item.song;
  saveInputs(); // persist restored values

  // Send command to show saved lyrics
  statusDiv.textContent = "Restoring from history...";
  statusDiv.style.color = "blue";

  browser.runtime.sendMessage({
    command: "show_history_item",
    item: item,
  });
}

btnClearHistory.addEventListener("click", async () => {
  await browser.storage.local.set({ searchHistory: [] });
  loadHistory();
});
