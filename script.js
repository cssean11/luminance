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

// DeepSeek API Configuration
const DEEPSEEK_CONFIG = {
    API_KEY: "sk-a22270c199d34c8b969a2081607a8c37",
    API_URL: "https://api.deepseek.com/v1/chat/completions",
    MODEL: "deepseek-chat", // or "deepseek-coder" for coding tasks
    MAX_TOKENS: 4096,
    TEMPERATURE: 0.7
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

        // DeepSeek response format
        const responseText = conversation.apiResponse?.choices?.[0]?.message?.content || 
                             conversation.apiResponse?.text || 
                             "No response available";
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

// DeepSeek API request function
const requestApiResponse = async (incomingMessageElement) => {
    const messageTextElement = incomingMessageElement.querySelector(".message__text");

    try {
        console.log("🚀 Sending request to DeepSeek API...");
        console.log("📝 User message:", state.currentUserMessage);
        
        // Create AbortController for request cancellation
        state.abortController = new AbortController();

        const response = await fetch(DEEPSEEK_CONFIG.API_URL, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${DEEPSEEK_CONFIG.API_KEY}`
            },
            body: JSON.stringify({
                model: DEEPSEEK_CONFIG.MODEL,
                messages: [
                    {
                        role: "system",
                        content: "You are a helpful AI assistant. Provide clear, concise, and accurate responses. Format code snippets properly."
                    },
                    {
                        role: "user",
                        content: state.currentUserMessage
                    }
                ],
                max_tokens: DEEPSEEK_CONFIG.MAX_TOKENS,
                temperature: DEEPSEEK_CONFIG.TEMPERATURE,
                stream: false
            }),
            signal: state.abortController.signal
        });

        console.log("📡 Response status:", response.status);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.error?.message || `HTTP ${response.status}`;
            
            if (response.status === 401) {
                throw new Error("DeepSeek API key is invalid. Please check your key at https://platform.deepseek.com/api_keys");
            } else if (response.status === 429) {
                throw new Error("Rate limit exceeded. Please wait a moment and try again.");
            } else if (response.status === 402) {
                throw new Error("Insufficient credits. Check your DeepSeek account balance.");
            }
            throw new Error(`DeepSeek API Error: ${errorMessage}`);
        }

        const responseData = await response.json();
        console.log("📦 Response data:", responseData);

        // DeepSeek response format
        const responseText = responseData?.choices?.[0]?.message?.content;
        
        if (!responseText) {
            console.error("Invalid response structure:", responseData);
            throw new Error("No response text received from DeepSeek API");
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

        console.log("✅ DeepSeek response received successfully!");

    } catch (error) {
        console.error("❌ DeepSeek API Error:", error);
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

// Test the DeepSeek API key on page load
window.addEventListener('load', () => {
    console.log("🔑 Using DeepSeek API Key:", DEEPSEEK_CONFIG.API_KEY.substring(0, 10) + "...");
    console.log("🤖 Selected model:", DEEPSEEK_CONFIG.MODEL);
    console.log("🌐 API URL:", DEEPSEEK_CONFIG.API_URL);
    
    // Quick test of the API key
    testDeepSeekAPIKey();
});

// Test function for DeepSeek API key
async function testDeepSeekAPIKey() {
    try {
        console.log("🧪 Testing DeepSeek API key...");
        const response = await fetch('https://api.deepseek.com/v1/models', {
            headers: {
                'Authorization': `Bearer ${DEEPSEEK_CONFIG.API_KEY}`
            }
        });
        
        if (response.ok) {
            console.log("✅ DeepSeek API key is VALID!");
        } else {
            const error = await response.json();
            console.error("❌ DeepSeek API key is INVALID:", error.error?.message);
        }
    } catch (error) {
        console.error("❌ Test failed:", error.message);
    }
}
