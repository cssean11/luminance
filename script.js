// OpenRouter Configuration
const OPENROUTER_API_KEY = "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";
const API_URL = "https://openrouter.ai/api/v1/chat/completions";

// DOM Elements
const chatContainer = document.getElementById('chatContainer');
const userInput = document.getElementById('userInput');
const sendButton = document.getElementById('sendButton');

let isGenerating = false;

function addMessage(text, isUser = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user' : 'ai'}`;
    
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'avatar';
    avatarDiv.textContent = isUser ? 'You' : 'AI';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    // Use line breaks for readability
    contentDiv.innerText = text; 
    
    messageDiv.appendChild(avatarDiv);
    messageDiv.appendChild(contentDiv);
    chatContainer.appendChild(messageDiv);
    
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return contentDiv;
}

function showLoading() {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ai';
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'avatar';
    avatarDiv.textContent = 'AI';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content loading';
    contentDiv.innerHTML = `<div class="loading-dots"><div></div><div></div><div></div></div>`;
    
    messageDiv.appendChild(avatarDiv);
    messageDiv.appendChild(contentDiv);
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return contentDiv;
}

async function generateAIResponse(userMessage) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': window.location.href, // Required by OpenRouter
                'X-Title': 'AI Chat Assistant'        // Optional for OpenRouter
            },
            body: JSON.stringify({
                "model": "google/gemini-2.0-flash-001", // Or "openai/gpt-3.5-turbo"
                "messages": [
                    {"role": "user", "content": userMessage}
                ]
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `API Error: ${response.status}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error('Error:', error);
        return `Error: ${error.message}`;
    }
}

async function sendMessage() {
    if (isGenerating) return;
    
    const message = userInput.value.trim();
    if (!message) return;
    
    addMessage(message, true);
    userInput.value = '';
    
    const loadingElement = showLoading();
    isGenerating = true;
    sendButton.disabled = true;
    
    try {
        const aiResponse = await generateAIResponse(message);
        loadingElement.parentElement.remove();
        addMessage(aiResponse, false);
    } catch (error) {
        loadingElement.parentElement.remove();
        addMessage(`System Error: ${error.message}`, false);
    } finally {
        isGenerating = false;
        sendButton.disabled = false;
        userInput.focus();
    }
}

function useSuggestion(button) {
    userInput.value = button.textContent;
    userInput.focus();
}

function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

userInput.focus();
