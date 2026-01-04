const messageForm = document.querySelector(".prompt__form");
const chatHistoryContainer = document.querySelector(".chats");
const suggestionItems = document.querySelectorAll(".suggests__item");
const themeToggleButton = document.getElementById("themeToggler");
const clearChatButton = document.getElementById("deleteButton");

// State management
const state = {
    currentUserMessage: null,
    isGeneratingResponse: false,
    abortController: null
};

// Claude API Configuration
const CLAUDE_CONFIG = {
    API_KEY: "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",
    API_URL: "https://api.anthropic.com/v1/messages",
    MODEL: "claude-3-5-sonnet-20241022", // or "claude-3-haiku-20240307", "claude-3-opus-20240229"
    MAX_TOKENS: 4096,
    TEMPERATURE: 0.7,
    VERSION: "2023-06-01" // Required for Anthropic API
};

// Load saved data from local storage
const loadSavedChatHistory = () => {
    const savedConversations = JSON.parse(localStorage.getItem("saved-api-chats")) || [];
    const isLightTheme = localStorage.getItem("themeColor") === "light_mode";

    document.body.classList.toggle("light_mode", isLightTheme);
    themeToggleButton.innerHTML = isLightTheme ? '<i class="bx bx-moon"></i>' : '<i class="bx bx-sun"></i>';

    chatHistoryContainer.innerHTML = '';

    savedConversations.forEach(conversation => {
        const userMessageHtml = `
            <div class="message__content">
                <img class="message__avatar" src="assets/profile.png" alt="User avatar">
               <p class="message__text">${conversation.userMessage}</p>
            </div>
        `;

        const outgoingMessageElement = createChatMessageElement(userMessageHtml, "message--outgoing");
        chatHistoryContainer.appendChild(outgoingMessageElement);

        // Claude response format
        const responseText = conversation.apiResponse?.content?.[0]?.text || 
                             conversation.apiResponse?.text || 
                             "No response available";
        const parsedApiResponse = marked.parse(responseText);
        const rawApiResponse = responseText;

        const responseHtml = `
           <div class="message__content">
                <img class="message__avatar" src="assets/claude.png" alt="AI avatar">
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
        showTypingEffect(rawApiResponse, parsedApiResponse, messageTextElement, incomingMessageElement, true);
    });

    document.body.classList.toggle("hide-header", savedConversations.length > 0);
};

const createChatMessageElement = (htmlContent, ...cssClasses) => {
    const messageElement = document.createElement("div");
    messageElement.classList.add("message", ...cssClasses);
    messageElement.innerHTML = htmlContent;
    return messageElement;
};

const showTypingEffect = (rawText, htmlText, messageElement, incomingMessageElement, skipEffect = false) => {
    const copyIconElement = incomingMessageElement.querySelector(".message__icon");
    copyIconElement.classList.add("hide");

    if (skipEffect) {
        messageElement.innerHTML = htmlText;
        hljs.highlightAll();
        addCopyButtonToCodeBlocks();
        copyIconElement.classList.remove("hide");
        state.isGeneratingResponse = false;
        return;
    }

    const wordsArray = rawText.split(' ');
    let wordIndex = 0;

    const typingInterval = setInterval(() => {
        messageElement.innerText += (wordIndex === 0 ? '' : ' ') + wordsArray[wordIndex++];
        if (wordIndex === wordsArray.length) {
            clearInterval(typingInterval);
            state.isGeneratingResponse = false;
            messageElement.innerHTML = htmlText;
            hljs.highlightAll();
            addCopyButtonToCodeBlocks();
            copyIconElement.classList.remove("hide");
        }
    }, 75);
};

// Claude API request function
const requestApiResponse = async (incomingMessageElement) => {
    const messageTextElement = incomingMessageElement.querySelector(".message__text");

    try {
        console.log("🚀 Sending request to Claude API...");
        console.log("📝 User message:", state.currentUserMessage);
        
        // Create AbortController for request cancellation
        state.abortController = new AbortController();

        const response = await fetch(CLAUDE_CONFIG.API_URL, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "x-api-key": CLAUDE_CONFIG.API_KEY,
                "anthropic-version": CLAUDE_CONFIG.VERSION
            },
            body: JSON.stringify({
                model: CLAUDE_CONFIG.MODEL,
                messages: [
                    {
                        role: "user",
                        content: state.currentUserMessage
                    }
                ],
                max_tokens: CLAUDE_CONFIG.MAX_TOKENS,
                temperature: CLAUDE_CONFIG.TEMPERATURE
            }),
            signal: state.abortController.signal
        });

        console.log("📡 Response status:", response.status);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.error?.message || errorData.error?.type || `HTTP ${response.status}`;
            
            if (response.status === 401) {
                throw new Error("Claude API key is invalid. Please check your key at https://console.anthropic.com/");
            } else if (response.status === 429) {
                throw new Error("Rate limit exceeded. Please wait a moment and try again.");
            } else if (response.status === 402) {
                throw new Error("Insufficient credits. Check your Claude account balance.");
            } else if (errorData.error?.type === "authentication_error") {
                throw new Error("Authentication failed. Please check your API key.");
            } else if (errorData.error?.type === "invalid_request_error") {
                throw new Error("Invalid request. Please check your input.");
            }
            throw new Error(`Claude API Error: ${errorMessage}`);
        }

        const responseData = await response.json();
        console.log("📦 Response data:", responseData);

        // Claude response format
        const responseText = responseData?.content?.[0]?.text;
        
        if (!responseText) {
            console.error("Invalid response structure:", responseData);
            throw new Error("No response text received from Claude API");
        }

        const parsedApiResponse = marked.parse(responseText);
        const rawApiResponse = responseText;

        showTypingEffect(rawApiResponse, parsedApiResponse, messageTextElement, incomingMessageElement);

        // Save conversation to localStorage
        let savedConversations = JSON.parse(localStorage.getItem("saved-api-chats")) || [];
        savedConversations.push({
            userMessage: state.currentUserMessage,
            apiResponse: responseData,
            timestamp: new Date().toISOString()
        });
        localStorage.setItem("saved-api-chats", JSON.stringify(savedConversations));

        console.log("✅ Claude response received successfully!");

    } catch (error) {
        console.error("❌ Claude API Error:", error);
        state.isGeneratingResponse = false;
        
        if (error.name === 'AbortError') {
            messageTextElement.innerText = "⏹️ Request cancelled";
        } else if (error.message.includes("Failed to fetch")) {
            messageTextElement.innerText = "❌ Network error. Please check your internet connection.";
        } else {
            messageTextElement.innerText = `❌ ${error.message}`;
        }
        
        messageTextElement.closest(".message").classList.add("message--error");
    } finally {
        incomingMessageElement.classList.remove("message--loading");
        state.abortController = null;
    }
};

// Abort current request
const abortCurrentRequest = () => {
    if (state.abortController) {
        state.abortController.abort();
        state.isGeneratingResponse = false;
    }
};

const addCopyButtonToCodeBlocks = () => {
    const codeBlocks = document.querySelectorAll('pre');
    codeBlocks.forEach((block) => {
        if (block.querySelector('.code__copy-btn')) return;

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

const displayLoadingAnimation = () => {
    const loadingHtml = `
        <div class="message__content">
            <img class="message__avatar" src="assets/claude.png" alt="AI avatar">
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

const copyMessageToClipboard = (copyButton) => {
    const messageContent = copyButton.parentElement.querySelector(".message__text").innerText;

    navigator.clipboard.writeText(messageContent);
    copyButton.innerHTML = `<i class='bx bx-check'></i>`;
    setTimeout(() => copyButton.innerHTML = `<i class='bx bx-copy-alt'></i>`, 1000);
};

const handleOutgoingMessage = () => {
    state.currentUserMessage = messageForm.querySelector(".prompt__form-input").value.trim() || state.currentUserMessage;
    if (!state.currentUserMessage || state.isGeneratingResponse) return;

    state.isGeneratingResponse = true;

    const outgoingMessageHtml = `
        <div class="message__content">
            <img class="message__avatar" src="assets/profile.png" alt="User avatar">
            <p class="message__text"></p>
        </div>
    `;

    const outgoingMessageElement = createChatMessageElement(outgoingMessageHtml, "message--outgoing");
    outgoingMessageElement.querySelector(".message__text").innerText = state.currentUserMessage;
    chatHistoryContainer.appendChild(outgoingMessageElement);

    messageForm.reset();
    document.body.classList.add("hide-header");
    setTimeout(displayLoadingAnimation, 500);
};

// Theme toggle functionality
themeToggleButton.addEventListener('click', () => {
    const isLightTheme = document.body.classList.toggle("light_mode");
    localStorage.setItem("themeColor", isLightTheme ? "light_mode" : "dark_mode");

    const newIconClass = isLightTheme ? "bx bx-moon" : "bx bx-sun";
    themeToggleButton.querySelector("i").className = newIconClass;
});

// Clear chat history
clearChatButton.addEventListener('click', () => {
    if (confirm("Are you sure you want to delete all chat history?")) {
        localStorage.removeItem("saved-api-chats");
        loadSavedChatHistory();
        state.currentUserMessage = null;
        state.isGeneratingResponse = false;
    }
});

// Handle suggestion clicks
suggestionItems.forEach(suggestion => {
    suggestion.addEventListener('click', () => {
        state.currentUserMessage = suggestion.querySelector(".suggests__item-text").innerText;
        handleOutgoingMessage();
    });
});

// Handle form submission
messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleOutgoingMessage();
});

// Add keyboard shortcut for aborting requests (Escape key)
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.isGeneratingResponse) {
        abortCurrentRequest();
    }
});

// Load chat history on page load
loadSavedChatHistory();

// Test the Claude API key on page load
window.addEventListener('load', () => {
    console.log("🔑 Using Claude API Key:", CLAUDE_CONFIG.API_KEY.substring(0, 15) + "...");
    console.log("🤖 Selected model:", CLAUDE_CONFIG.MODEL);
    console.log("🌐 API URL:", CLAUDE_CONFIG.API_URL);
    console.log("📅 API Version:", CLAUDE_CONFIG.VERSION);
    
    // Quick test of the API key
    testClaudeAPIKey();
});

// Test function for Claude API key
async function testClaudeAPIKey() {
    try {
        console.log("🧪 Testing Claude API key...");
        const response = await fetch(CLAUDE_CONFIG.API_URL, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "x-api-key": CLAUDE_CONFIG.API_KEY,
                "anthropic-version": CLAUDE_CONFIG.VERSION
            },
            body: JSON.stringify({
                model: CLAUDE_CONFIG.MODEL,
                messages: [
                    {
                        role: "user",
                        content: "Hello"
                    }
                ],
                max_tokens: 10
            })
        });
        
        if (response.ok) {
            console.log("✅ Claude API key is VALID!");
        } else {
            const error = await response.json();
            console.error("❌ Claude API key is INVALID:", error.error?.message || error.error?.type);
        }
    } catch (error) {
        console.error("❌ Test failed:", error.message);
    }
}
