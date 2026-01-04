const chatWindow = document.getElementById('chat-window');
const historyList = document.getElementById('history-list');
const API_KEY = "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";

let selectedBase64 = null;
let chatHistory = JSON.parse(localStorage.getItem('lum_hist')) || [];
let sessionLog = [];

// Image Handling
function handleImageUpload(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        selectedBase64 = ev.target.result;
        document.getElementById('img-preview').src = selectedBase64;
        document.getElementById('preview-bar').style.display = 'flex';
        document.getElementById('chat-form').classList.remove('full-round');
    };
    reader.readAsDataURL(file);
}

document.getElementById('file-input').onchange = (e) => handleImageUpload(e.target.files[0]);

// Paste Image Functionality
window.addEventListener('paste', (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
            const blob = item.getAsFile();
            handleImageUpload(blob);
        }
    }
});

function clearImage() {
    selectedBase64 = null;
    document.getElementById('preview-bar').style.display = 'none';
    document.getElementById('chat-form').classList.add('full-round');
    document.getElementById('file-input').value = '';
}

// Settings Logic
function openSettings() { document.getElementById('settings-modal').style.display = 'flex'; }
function closeSettings() { document.getElementById('settings-modal').style.display = 'none'; }
function applyTheme(t) { document.body.setAttribute('data-theme', t); localStorage.setItem('lum_theme', t); }

function renderHistory() {
    historyList.innerHTML = chatHistory.map(h => `<li class="history-item"><i class='bx bx-history'></i> ${h}</li>`).join('');
}

function addMessage(text, isUser, img = null) {
    const div = document.createElement('div');
    div.className = `message ${isUser ? 'user-msg' : 'ai-msg'}`;
    const avatarImg = isUser ? 'profile.png' : 'Gemini.png';
    let contentHtml = img ? `<img src="${img}" class="msg-img">` : '';
    contentHtml += `<div>${isUser ? text : marked.parse(text)}</div>`;
    div.innerHTML = `<img src="${avatarImg}" class="avatar" onerror="this.src='https://ui-avatars.com/api/?name=${isUser?'U':'L'}'"><div class="bubble">${contentHtml}</div>`;
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    sessionLog.push(`${isUser?'User':'AI'}: ${text}`);
    return div;
}

document.getElementById('chat-form').onsubmit = async (e) => {
    e.preventDefault();
    const input = document.getElementById('user-input');
    const prompt = input.value.trim();
    if(!prompt && !selectedBase64) return;

    const imgToSend = selectedBase64;
    addMessage(prompt, true, imgToSend);
    
    if(prompt) {
        chatHistory.unshift(prompt.substring(0, 25));
        if(chatHistory.length > 10) chatHistory.pop();
        localStorage.setItem('lum_hist', JSON.stringify(chatHistory));
        renderHistory();
    }
    input.value = '';
    clearImage();

    // --- THINKING STATE WITH SPINNING ICON ---
    const thinkingDiv = document.createElement('div');
    thinkingDiv.className = `message ai-msg`;
    thinkingDiv.innerHTML = `<img src="Gemini.png" class="avatar spinning" onerror="this.src='https://ui-avatars.com/api/?name=L'"><div class="bubble">Thinking...</div>`;
    chatWindow.appendChild(thinkingDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight;

    let content = [{ type: "text", text: prompt || "Analyze this." }];
    if(imgToSend) content.push({ type: "image_url", image_url: { url: imgToSend } });

    try {
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: "google/gemini-2.0-flash-001", messages: [{ role: "user", content }] })
        });
        const data = await res.json();
        
        // Remove the thinking placeholder
        chatWindow.removeChild(thinkingDiv);
        
        // Add the actual response
        addMessage(data.choices[0].message.content, false);
    } catch {
        chatWindow.removeChild(thinkingDiv);
        addMessage("Ley Line error.", false);
    }
};

function newChat() { chatWindow.innerHTML = ''; addMessage("Greetings, Traveler. I am Luminance. Use the image icon to show me something, paste an image, or just type a message.", false); }
function clearMemory() { localStorage.removeItem('lum_hist'); chatHistory = []; renderHistory(); closeSettings(); }
function exportChat() {
    const blob = new Blob([sessionLog.join('\n\n')], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'Luminance_Log.md';
    a.click();
}

window.onload = () => { applyTheme(localStorage.getItem('lum_theme') || 'dark'); renderHistory(); newChat(); };
