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

// OpenRouter Configuration
const OPENROUTER_CONFIG = {
    API_KEY: "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",
    API_URL: "https://openrouter.ai/api/v1/chat/completions",
    MODEL: "google/gemini-2.0-flash-exp:free", // Free model
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

        // OpenRouter response format is different from Google's
        const responseText = conversation.apiResponse?.choices?.[0]?.message?.content || 
                             conversation.apiResponse?.text || 
                             "No response available";
        const parsedApiResponse = marked.parse(responseText);
        const rawApiResponse = responseText;

        const responseHtml = `
           <div class="message__content">
                <img class="message__avatar" src="assets/Gemini.png" alt="Columbina avatar">
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

// UPDATED: OpenRouter API request function
const requestApiResponse = async (incomingMessageElement) => {
    const messageTextElement = incomingMessageElement.querySelector(".message__text");

    try {
        console.log("🚀 Sending request to OpenRouter...");
        console.log("📝 User message:", state.currentUserMessage);
        
        // Create AbortController for request cancellation
        state.abortController = new AbortController();

        const response = await fetch(OPENROUTER_CONFIG.API_URL, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${OPENROUTER_CONFIG.API_KEY}`,
                "HTTP-Referer": window.location.origin || "http://localhost",
                "X-Title": "AI Chat Assistant"
            },
            body: JSON.stringify({
                model: OPENROUTER_CONFIG.MODEL,
                messages: [
                    {
                        role: "system",
                        content: "You are a helpful AI assistant. Provide clear, concise, and accurate responses."
                    },
                    {
                        role: "user",
                        content: state.currentUserMessage
                    }
                ],
                max_tokens: OPENROUTER_CONFIG.MAX_TOKENS,
                temperature: OPENROUTER_CONFIG.TEMPERATURE
            }),
            signal: state.abortController.signal
        });

        console.log("📡 Response status:", response.status);

        const responseData = await response.json();
        console.log("📦 Response data:", responseData);

        if (!response.ok) {
            // Handle OpenRouter specific errors
            if (response.status === 401) {
                throw new Error("OpenRouter API key is invalid. Please check your key at https://openrouter.ai/keys");
            } else if (response.status === 402) {
                throw new Error("Insufficient credits on OpenRouter. Add funds to your account.");
            } else if (response.status === 429) {
                throw new Error("Rate limit exceeded. Please wait a moment and try again.");
            }
            throw new Error(responseData.error?.message || `OpenRouter API Error: ${response.status}`);
        }

        // OpenRouter response format
        const responseText = responseData?.choices?.[0]?.message?.content;
        
        if (!responseText) {
            console.error("Invalid response structure:", responseData);
            throw new Error("No response text received from OpenRouter API");
        }

        const parsedApiResponse = marked.parse(responseText);
        const rawApiResponse = responseText;

        showTypingEffect(rawApiResponse, parsedApiResponse, messageTextElement, incomingMessageElement);

        // Save conversation to localStorage
        let savedConversations = JSON.parse(localStorage.getItem("saved-api-chats")) || [];
        savedConversations.push({
            userMessage: state.currentUserMessage,
            apiResponse: responseData
        });
        localStorage.setItem("saved-api-chats", JSON.stringify(savedConversations));

        console.log("✅ OpenRouter response received successfully!");

    } catch (error) {
        console.error("❌ OpenRouter API Error:", error);
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
            <img class="message__avatar" src="assets/Gemini.png" alt="Gemini avatar">
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

// Quick test to verify OpenRouter API key is working
window.addEventListener('load', () => {
    console.log("🔑 Using OpenRouter API Key:", OPENROUTER_CONFIG.API_KEY.substring(0, 10) + "...");
    console.log("🤖 Selected model:", OPENROUTER_CONFIG.MODEL);
});
