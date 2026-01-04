const OPENROUTER_API_KEY = "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";
const API_URL = "https://openrouter.ai/api/v1/chat/completions";

const promptForm = document.querySelector('.prompt__form');
const promptInput = document.querySelector('.prompt__form-input');
const chatContainer = document.querySelector('.chats');
const themeToggler = document.getElementById('themeToggler');
const deleteButton = document.getElementById('deleteButton');

// 1. Handle Theme Toggling
themeToggler.addEventListener('click', () => {
    document.body.classList.toggle('dark-theme');
    const icon = themeToggler.querySelector('i');
    icon.classList.toggle('bx-sun');
    icon.classList.toggle('bx-moon');
});

// 2. Handle Deleting Chats
deleteButton.addEventListener('click', () => {
    if (confirm("Clear all messages?")) {
        chatContainer.innerHTML = '';
    }
});

// 3. Create Chat Bubble
const createChatBubble = (content, className) => {
    const div = document.createElement('div');
    div.classList.add('chat', className);
    // Using marked.parse to render Markdown (like bold text or code)
    div.innerHTML = `
        <div class="chat__content">
            ${className === 'chat--incoming' ? '<b>AI:</b> ' : '<b>You:</b> '}
            <div class="message-text">${marked.parse(content)}</div>
        </div>
    `;
    chatContainer.appendChild(div);
    chatContainer.scrollTo(0, chatContainer.scrollHeight);
    return div;
};

// 4. Call OpenRouter API
async function getResponse(userPrompt) {
    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                "Content-Type": "application/json",
                "HTTP-Referer": window.location.origin, 
                "X-Title": "Luminance 2.0"
            },
            body: JSON.stringify({
                "model": "google/gemini-2.0-flash-001",
                "messages": [{ "role": "user", "content": userPrompt }]
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || "API Error");

        return data.choices[0].message.content;
    } catch (error) {
        console.error(error);
        return "Sorry, I couldn't connect to Teyvat. Error: " + error.message;
    }
}

// 5. Handle Form Submission
promptForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const prompt = promptInput.value.trim();
    if (!prompt) return;

    // Add User Message
    createChatBubble(prompt, 'chat--outgoing');
    promptInput.value = '';

    // Add Loading State
    const loadingBubble = createChatBubble("Thinking...", 'chat--incoming');

    // Get AI response
    const aiResponse = await getResponse(prompt);
    
    // Replace loading text with actual response
    loadingBubble.querySelector('.message-text').innerHTML = marked.parse(aiResponse);
    
    // Highlight any code blocks in the response
    loadingBubble.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block);
    });
    
    chatContainer.scrollTo(0, chatContainer.scrollHeight);
});

// 6. Suggestion Chips logic
document.querySelectorAll('.suggests__item').forEach(item => {
    item.addEventListener('click', () => {
        promptInput.value = item.querySelector('.suggests__item-text').innerText.trim();
        promptInput.focus();
    });
});
