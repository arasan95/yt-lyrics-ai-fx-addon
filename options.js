function saveOptions() {
    const provider = document.getElementById('provider').value;
    const gemini_key = document.getElementById('gemini_key').value;
    const gemini_model = document.getElementById('gemini_model').value;
    const deepseek_key = document.getElementById('deepseek_key').value;
    const openai_key = document.getElementById('openai_key').value;
    const openai_model = document.getElementById('openai_model').value;
    const hf_token = document.getElementById('hf_token').value;
    const hf_model = document.getElementById('hf_model').value;
    const openrouter_key = document.getElementById('openrouter_key').value;
    const openrouter_model = document.getElementById('openrouter_model').value;
    const genius_token = document.getElementById('genius_token').value;

    console.log("Saving options...");
    browser.storage.local.set({
        provider: provider,
        gemini_key: gemini_key,
        gemini_model: gemini_model,
        deepseek_key: deepseek_key,
        openai_key: openai_key,
        openai_model: openai_model,
        hf_token: hf_token,
        hf_model: hf_model,
        openrouter_key: openrouter_key,
        openrouter_model: openrouter_model,
        genius_token: genius_token
    }).then(() => {
        console.log("Options saved.");
        const status = document.getElementById('status');
        status.textContent = "Saved Successfully!";
        status.style.display = 'inline';
        status.style.color = "green";
        setTimeout(() => {
            status.style.display = 'none';
        }, 3000);
    }).catch((error) => {
        console.error("Error saving:", error);
        const status = document.getElementById('status');
        status.textContent = "Error: " + error;
        status.style.display = 'inline';
        status.style.color = "red";
    });
}

function restoreOptions() {
    browser.storage.local.get({
        provider: 'Gemini',
        gemini_key: '',
        gemini_model: '', // New
        deepseek_key: '',
        genius_token: ''
    }).then((items) => {
        document.getElementById('provider').value = items.provider;
        document.getElementById('gemini_key').value = items.gemini_key;
        document.getElementById('gemini_model').value = items.gemini_model || ''; // New
        document.getElementById('deepseek_key').value = items.deepseek_key;
        document.getElementById('openai_key').value = items.openai_key || '';
        document.getElementById('openai_model').value = items.openai_model || '';
        document.getElementById('hf_token').value = items.hf_token || '';
        document.getElementById('hf_model').value = items.hf_model || '';
        document.getElementById('openrouter_key').value = items.openrouter_key || '';
        document.getElementById('openrouter_model').value = items.openrouter_model || '';
        document.getElementById('genius_token').value = items.genius_token;
    }).catch((error) => {
        console.error("Error restoring:", error);
    });
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);
