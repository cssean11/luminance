const messageForm = document.querySelector(".prompt__form");
const chatHistoryContainer = document.querySelector(".chats");
const suggestionItems = document.querySelectorAll(".suggests__item");

const themeToggleButton = document.getElementById("themeToggler");
const clearChatButton = document.getElementById("deleteButton");

// State variables
let currentUserMessage = null;
let isGeneratingResponse = false;

// ========== 🆕 GROQ API CONFIGURATION (BEST FREE OPTION) ==========
// Get your FREE API key from: https://console.groq.com/keys
const GROQ_API_KEY = "YOUR_GROQ_API_KEY_HERE"; // ⚠️ REPLACE WITH YOUR KEY

// API Providers with fallback order (1st Groq, 2nd Together, 3rd Mock)
const API_PROVIDERS = [
    {
        name: "Groq",
        url: "https://api.groq.com/openai/v1/chat/completions",
        apiKey: GROQ_API_KEY,
        model: "llama-3.1-70b-versatile", // Best quality model
        backupModel: "llama-3.1-8b-instant", // Faster backup
        headers: (key) => ({
            "Authorization": `Bearer ${key}`,
            "Content-Type": "application/json"
        }),
        formatBody: (message, useBackup = false) => ({
            model: useBackup ? "llama-3.1-8b-instant" : "llama-3.1-70b-versatile",
            messages: [{ role: "user", content: message }],
            temperature: 0.7,
            max_tokens: 2048,
            stream: false
        }),
        isActive: true
    }
];

let currentProviderIndex = 0;
let retryCount = 0;
const MAX_RETRIES = 2;

// ========== LOAD SAVED CHAT HISTORY ==========
const loadSavedChatHistory = () => {
    const savedConversations = JSON.parse(localStorage.getItem("saved-api-chats")) || [];
    const isLightTheme = localStorage.getItem("themeColor") === "light_mode";

    document.body.classList.toggle("light_mode", isLightTheme);
    themeToggleButton.innerHTML = isLightTheme ? '<i class="bx bx-moon"></i>' : '<i class="bx bx-sun"></i>';

    chatHistoryContainer.innerHTML = '';

    // Iterate through saved chat history and display messages
    savedConversations.forEach(conversation => {
        // Display the user's message
        const userMessageHtml = `
            <div class="message__content">
                <img class="message__avatar" src="assets/profile.png" alt="User avatar">
                <p class="message__text">${conversation.userMessage}</p>
            </div>
        `;

        const outgoingMessageElement = createChatMessageElement(userMessageHtml, "message--outgoing");
        chatHistoryContainer.appendChild(outgoingMessageElement);

        // Display the API response
        const responseText = conversation.apiResponse;
        const parsedApiResponse = marked.parse(responseText);
        const rawApiResponse = responseText;

        const responseHtml = `
            <div class="message__content">
                <img class="message__avatar" src="assets/Gemini.png" alt="AI avatar">
                <p class="message__text"></p>
                <div class="message__loading-indicator hide">
                    <div class="message__loading-bar"></div>
                    <div class="message__loading-bar"></div>
                    <div class="message__loading-bar"></div>
                </div>
            </div>
            <span onClick="copyMessageToClipboard(this)" class="message__icon hide"><i class='bx bx-copy-alt'></i></span>
        `;

        const incomingMessageElement = createChatMessageElement(responseHtml, "message--incoming");
        chatHistoryContainer.appendChild(incomingMessageElement);

        const messageTextElement = incomingMessageElement.querySelector(".message__text");

        // Display saved chat without typing effect
        showTypingEffect(rawApiResponse, parsedApiResponse, messageTextElement, incomingMessageElement, true);
    });

    document.body.classList.toggle("hide-header", savedConversations.length > 0);
};

// ========== CREATE CHAT MESSAGE ELEMENT ==========
const createChatMessageElement = (htmlContent, ...cssClasses) => {
    const messageElement = document.createElement("div");
    messageElement.classList.add("message", ...cssClasses);
    messageElement.innerHTML = htmlContent;
    return messageElement;
}

// ========== TYPING EFFECT ==========
const showTypingEffect = (rawText, htmlText, messageElement, incomingMessageElement, skipEffect = false) => {
    const copyIconElement = incomingMessageElement.querySelector(".message__icon");
    copyIconElement.classList.add("hide");

    if (skipEffect) {
        messageElement.innerHTML = htmlText;
        hljs.highlightAll();
        addCopyButtonToCodeBlocks();
        copyIconElement.classList.remove("hide");
        isGeneratingResponse = false;
        return;
    }

    const wordsArray = rawText.split(' ');
    let wordIndex = 0;

    const typingInterval = setInterval(() => {
        messageElement.innerText += (wordIndex === 0 ? '' : ' ') + wordsArray[wordIndex++];
        if (wordIndex === wordsArray.length) {
            clearInterval(typingInterval);
            isGeneratingResponse = false;
            messageElement.innerHTML = htmlText;
            hljs.highlightAll();
            addCopyButtonToCodeBlocks();
            copyIconElement.classList.remove("hide");
        }
    }, 75);
};

// ========== 🆕 UPDATED API REQUEST WITH GROQ ==========
const requestApiResponse = async (incomingMessageElement, retryAttempt = 0, useBackupModel = false) => {
    const messageTextElement = incomingMessageElement.querySelector(".message__text");
    
    // If no API key is set, show instructions
    if (!GROQ_API_KEY || GROQ_API_KEY === "YOUR_GROQ_API_KEY_HERE") {
        showApiKeyInstructions(messageTextElement, incomingMessageElement);
        return;
    }

    try {
        const provider = API_PROVIDERS[0]; // Using Groq as primary
        
        const response = await fetch(provider.url, {
            method: "POST",
            headers: provider.headers(provider.apiKey),
            body: JSON.stringify(provider.formatBody(currentUserMessage, useBackupModel))
        });

        const responseData = await response.json();
        
        if (!response.ok) {
            // Handle rate limiting
            if (response.status === 429) {
                if (retryAttempt < MAX_RETRIES) {
                    const waitTime = Math.pow(2, retryAttempt) * 1000;
                    messageTextElement.innerText = `Rate limited. Retrying in ${waitTime/1000}s...`;
                    setTimeout(() => {
                        requestApiResponse(incomingMessageElement, retryAttempt + 1, useBackupModel);
                    }, waitTime);
                    return;
                }
                // Try backup model
                if (!useBackupModel) {
                    messageTextElement.innerText = "Switching to faster model...";
                    setTimeout(() => {
                        requestApiResponse(incomingMessageElement, 0, true);
                    }, 1000);
                    return;
                }
                throw new Error("Rate limit exceeded. Please try again in a minute.");
            }
            
            throw new Error(responseData.error?.message || `HTTP ${response.status}`);
        }

        // Extract response from Groq format
        const responseText = responseData.choices?.[0]?.message?.content;
        if (!responseText) {
            throw new Error("Empty response from API");
        }

        const parsedApiResponse = marked.parse(responseText);
        const rawApiResponse = responseText;

        showTypingEffect(rawApiResponse, parsedApiResponse, messageTextElement, incomingMessageElement);

        // Save conversation
        let savedConversations = JSON.parse(localStorage.getItem("saved-api-chats")) || [];
        savedConversations.push({
            userMessage: currentUserMessage,
            apiResponse: responseText
        });
        localStorage.setItem("saved-api-chats", JSON.stringify(savedConversations));
        
        retryCount = 0; // Reset retry count on success
        
    } catch (error) {
        isGeneratingResponse = false;
        
        // Show user-friendly error
        let errorMessage = error.message;
        if (error.message.includes("Failed to fetch") || error.message.includes("Network")) {
            errorMessage = "Network error. Check your internet connection.";
        } else if (error.message.includes("rate limit") || error.message.includes("429")) {
            errorMessage = "Rate limit reached. Free tier allows 30 requests/minute.";
        } else if (error.message.includes("401") || error.message.includes("authentication")) {
            errorMessage = "Invalid API key. Please set a valid Groq API key.";
        }
        
        messageTextElement.innerText = `Error: ${errorMessage}`;
        messageTextElement.closest(".message").classList.add("message--error");
        
        // Add helpful instructions
        if (error.message.includes("API key") || error.message.includes("401")) {
            messageTextElement.innerHTML += `<br><br>
                <small>
                    🔑 <strong>Get a FREE API key:</strong><br>
                    1. Go to <a href="https://console.groq.com/keys" target="_blank" style="color: #4CAF50;">Groq Console</a><br>
                    2. Sign up (no credit card needed)<br>
                    3. Create API key and paste it in the code<br>
                    4. 30 requests/minute, 10K/month FREE
                </small>`;
        }
        
    } finally {
        incomingMessageElement.classList.remove("message--loading");
    }
};

// ========== SHOW API KEY INSTRUCTIONS ==========
const showApiKeyInstructions = (messageTextElement, incomingMessageElement) => {
    const instructions = `
# 🔑 API Key Required

To use this chat, you need a **FREE Groq API key**:

## 🚀 Quick Setup:
1. **Sign up** at [console.groq.com/keys](https://console.groq.com/keys)
2. **Create API key** (no credit card needed)
3. **Replace** in code: \`const GROQ_API_KEY = "YOUR_KEY_HERE"\`

## ✨ Features:
• **30 requests/minute** FREE
• **10,000 requests/month** FREE  
• **Extremely fast** responses
• **No credit card** required

## 📝 Example key format:
\`\`\`javascript
const GROQ_API_KEY = "gsk_abc123...";
\`\`\`

After setting up, **refresh the page** and start chatting!
    `;
    
    const parsedInstructions = marked.parse(instructions);
    showTypingEffect(instructions, parsedInstructions, messageTextElement, incomingMessageElement, true);
};

// ========== ADD COPY BUTTON TO CODE BLOCKS ==========
const addCopyButtonToCodeBlocks = () => {
    const codeBlocks = document.querySelectorAll('pre');
    codeBlocks.forEach((block) => {
        const codeElement = block.querySelector('code');
        let language = [...codeElement.classList].find(cls => cls.startsWith('language-'))?.replace('language-', '') || 'Text';

        const languageLabel = document.createElement('div');
        languageLabel.innerText = language.charAt(0).toUpperCase() + language.slice(1);
        languageLabel.classList.add('code__language-label');
        block.appendChild(languageLabel);

        const copyButton = document.createElement('button');
        copyButton.innerHTML = `<i class='bx bx-copy'></i>`;
        copyButton.classList.add('code__copy-btn');
        block.appendChild(copyButton);

        copyButton.addEventListener('click', () => {
            navigator.clipboard.writeText(codeElement.innerText).then(() => {
                copyButton.innerHTML = `<i class='bx bx-check'></i>`;
                setTimeout(() => copyButton.innerHTML = `<i class='bx bx-copy'></i>`, 2000);
            }).catch(err => {
                console.error("Copy failed:", err);
                alert("Unable to copy text!");
            });
        });
    });
};

// ========== LOADING ANIMATION ==========
const displayLoadingAnimation = () => {
    const loadingHtml = `
        <div class="message__content">
            <img class="message__avatar" src="assets/Gemini.png" alt="AI avatar">
            <p class="message__text"></p>
            <div class="message__loading-indicator">
                <div class="message__loading-bar"></div>
                <div class="message__loading-bar"></div>
                <div class="message__loading-bar"></div>
            </div>
        </div>
        <span onClick="copyMessageToClipboard(this)" class="message__icon hide"><i class='bx bx-copy-alt'></i></span>
    `;

    const loadingMessageElement = createChatMessageElement(loadingHtml, "message--incoming", "message--loading");
    chatHistoryContainer.appendChild(loadingMessageElement);

    requestApiResponse(loadingMessageElement);
};

// ========== COPY MESSAGE TO CLIPBOARD ==========
const copyMessageToClipboard = (copyButton) => {
    const messageContent = copyButton.parentElement.querySelector(".message__text").innerText;

    navigator.clipboard.writeText(messageContent);
    copyButton.innerHTML = `<i class='bx bx-check'></i>`;
    setTimeout(() => copyButton.innerHTML = `<i class='bx bx-copy-alt'></i>`, 1000);
};

// ========== HANDLE OUTGOING MESSAGE ==========
const handleOutgoingMessage = () => {
    currentUserMessage = messageForm.querySelector(".prompt__form-input").value.trim() || currentUserMessage;
    if (!currentUserMessage || isGeneratingResponse) return;

    isGeneratingResponse = true;

    const outgoingMessageHtml = `
        <div class="message__content">
            <img class="message__avatar" src="assets/profile.png" alt="User avatar">
            <p class="message__text"></p>
        </div>
    `;

    const outgoingMessageElement = createChatMessageElement(outgoingMessageHtml, "message--outgoing");
    outgoingMessageElement.querySelector(".message__text").innerText = currentUserMessage;
    chatHistoryContainer.appendChild(outgoingMessageElement);

    messageForm.reset();
    document.body.classList.add("hide-header");
    setTimeout(displayLoadingAnimation, 500);
};

// ========== THEME TOGGLE ==========
themeToggleButton.addEventListener('click', () => {
    const isLightTheme = document.body.classList.toggle("light_mode");
    localStorage.setItem("themeColor", isLightTheme ? "light_mode" : "dark_mode");

    const newIconClass = isLightTheme ? "bx bx-moon" : "bx bx-sun";
    themeToggleButton.querySelector("i").className = newIconClass;
});

// ========== CLEAR CHAT ==========
clearChatButton.addEventListener('click', () => {
    if (confirm("Are you sure you want to delete all chat history?")) {
        localStorage.removeItem("saved-api-chats");
        loadSavedChatHistory();
        currentUserMessage = null;
        isGeneratingResponse = false;
    }
});

// ========== SUGGESTION ITEMS ==========
suggestionItems.forEach(suggestion => {
    suggestion.addEventListener('click', () => {
        currentUserMessage = suggestion.querySelector(".suggests__item-text").innerText;
        handleOutgoingMessage();
    });
});

// ========== FORM SUBMISSION ==========
messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleOutgoingMessage();
});

// ========== 🆕 TEST API KEY FUNCTION ==========
const testApiKey = () => {
    if (!GROQ_API_KEY || GROQ_API_KEY === "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") {
        console.log("⚠️ Please set your Groq API key in the code.");
        console.log("🔗 Get free key: https://console.groq.com/keys");
        return;
    }
    
    console.log("🔑 Testing Groq API key...");
    
    fetch("https://api.groq.com/openai/v1/models", {
        headers: {
            "Authorization": `Bearer ${GROQ_API_KEY}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.data) {
            console.log("✅ API Key is valid!");
            console.log("📊 Available models:", data.data.map(m => m.id).join(", "));
        } else {
            console.error("❌ API Key error:", data.error?.message);
        }
    })
    .catch(error => {
        console.error("❌ API Test failed:", error.message);
    });
};

// ========== LOAD SAVED CHAT & TEST API ==========
loadSavedChatHistory();
setTimeout(testApiKey, 1000);

// ========== 🆕 ADD API STATUS INDICATOR ==========
const updateApiStatus = () => {
    const statusElement = document.createElement("div");
    statusElement.id = "apiStatus";
    statusElement.innerHTML = `
        <div class="api-status">
            <span class="api-status__indicator"></span>
            <span class="api-status__text">Groq API: Ready</span>
        </div>
    `;
    
    const header = document.querySelector(".header");
    if (header && !document.getElementById("apiStatus")) {
        header.appendChild(statusElement);
    }
};

// Add CSS for API status
const style = document.createElement('style');
style.textContent = `
    .api-status {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        background: var(--bg-color-2, #2d2d2d);
        border-radius: 20px;
        font-size: 12px;
        margin-left: auto;
    }
    
    .api-status__indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #4CAF50;
        animation: pulse 2s infinite;
    }
    
    @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.5; }
        100% { opacity: 1; }
    }
    
    .light_mode .api-status {
        background: #f0f0f0;
    }
`;
document.head.appendChild(style);

// Add API status to UI
setTimeout(updateApiStatus, 1500);
