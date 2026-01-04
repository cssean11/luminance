const messageForm = document.querySelector(".prompt__form");
const chatHistoryContainer = document.querySelector(".chats");
const suggestionItems = document.querySelectorAll(".suggests__item");
const themeToggleButton = document.getElementById("themeToggler");
const clearChatButton = document.getElementById("deleteButton");

// State management
const state = {
    currentUserMessage: null,
    isGeneratingResponse: false,
    abortController: null,
    conversationHistory: []
};

// OpenRouter Configuration
const OPENROUTER_CONFIG = {
    API_KEY: "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",
    API_URL: "https://openrouter.ai/api/v1/chat/completions",
    // Available models - you can change this
    MODEL: "google/gemini-2.0-flash-exp:free", // Free model
    // Other good options:
    // "google/gemini-2.0-flash-exp:free" (Free, fast)
    // "meta-llama/llama-3.2-3b-instruct:free" (Free, small)
    // "google/gemini-2.0-flash-thinking-exp:free" (Free with reasoning)
    // "openai/gpt-4o-mini" (Cheap, $0.15/1M tokens)
    // "anthropic/claude-3.5-haiku" (Fast, $0.80/1M tokens)
    
    // Model configuration
    MAX_TOKENS: 4096,
    TEMPERATURE: 0.7
};

// Available OpenRouter models list for reference
const OPENROUTER_MODELS = {
    FREE: [
        "google/gemini-2.0-flash-exp:free",
        "meta-llama/llama-3.2-3b-instruct:free",
        "google/gemini-2.0-flash-thinking-exp:free",
        "microsoft/phi-3.5-mini-instruct:free"
    ],
    PAID: [
        "openai/gpt-4o-mini",
        "anthropic/claude-3.5-haiku",
        "google/gemini-2.0-flash",
        "mistralai/mistral-7b-instruct"
    ]
};

// Load saved data from local storage
const loadSavedChatHistory = () => {
    try {
        const savedConversations = JSON.parse(localStorage.getItem("saved-api-chats")) || [];
        const isLightTheme = localStorage.getItem("themeColor") === "light_mode";
        const savedModel = localStorage.getItem("selectedModel") || OPENROUTER_CONFIG.MODEL;

        // Update model in config if saved
        OPENROUTER_CONFIG.MODEL = savedModel;

        // Update UI with current model
        updateModelIndicator();

        document.body.classList.toggle("light_mode", isLightTheme);
        themeToggleButton.innerHTML = isLightTheme ? 
            '<i class="bx bx-moon"></i>' : 
            '<i class="bx bx-sun"></i>';

        chatHistoryContainer.innerHTML = '';

        // Store conversation history for context
        state.conversationHistory = savedConversations.map(conv => ({
            role: "user",
            content: conv.userMessage
        }));

        savedConversations.forEach(conversation => {
            // User message
            const userMessageHtml = `
                <div class="message__content">
                    <img class="message__avatar" src="assets/profile.png" alt="User avatar">
                    <p class="message__text">${conversation.userMessage}</p>
                </div>
            `;

            const outgoingMessageElement = createChatMessageElement(userMessageHtml, "message--outgoing");
            chatHistoryContainer.appendChild(outgoingMessageElement);

            // AI response
            const responseText = conversation.apiResponse?.choices?.[0]?.message?.content || 
                                conversation.apiResponse?.text || 
                                "No response available";
            const parsedApiResponse = marked.parse(responseText);

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
            showTypingEffect(responseText, parsedApiResponse, messageTextElement, incomingMessageElement, true);
        });

        document.body.classList.toggle("hide-header", savedConversations.length > 0);

    } catch (error) {
        console.error("Error loading chat history:", error);
        showNotification("Error loading chat history", "error");
    }
};

// Create model selector UI
const createModelSelector = () => {
    const selector = document.createElement('div');
    selector.className = 'model-selector';
    selector.innerHTML = `
        <div class="model-selector__current">
            <span class="model-selector__label">Model:</span>
            <span class="model-selector__name">${getModelDisplayName(OPENROUTER_CONFIG.MODEL)}</span>
            <i class='bx bx-chevron-down'></i>
        </div>
        <div class="model-selector__dropdown">
            <div class="model-selector__group">
                <span class="model-selector__group-title">Free Models</span>
                ${OPENROUTER_MODELS.FREE.map(model => `
                    <div class="model-selector__option ${model === OPENROUTER_CONFIG.MODEL ? 'active' : ''}" 
                         data-model="${model}">
                        ${getModelDisplayName(model)}
                        ${model === OPENROUTER_CONFIG.MODEL ? '<i class="bx bx-check"></i>' : ''}
                    </div>
                `).join('')}
            </div>
            <div class="model-selector__group">
                <span class="model-selector__group-title">Paid Models</span>
                ${OPENROUTER_MODELS.PAID.map(model => `
                    <div class="model-selector__option ${model === OPENROUTER_CONFIG.MODEL ? 'active' : ''}" 
                         data-model="${model}">
                        ${getModelDisplayName(model)}
                        ${model === OPENROUTER_CONFIG.MODEL ? '<i class="bx bx-check"></i>' : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    // Add event listeners
    const currentEl = selector.querySelector('.model-selector__current');
    const dropdown = selector.querySelector('.model-selector__dropdown');
    const options = selector.querySelectorAll('.model-selector__option');

    currentEl.addEventListener('click', () => {
        dropdown.classList.toggle('show');
    });

    options.forEach(option => {
        option.addEventListener('click', () => {
            const model = option.dataset.model;
            OPENROUTER_CONFIG.MODEL = model;
            localStorage.setItem("selectedModel", model);
            updateModelIndicator();
            dropdown.classList.remove('show');
            showNotification(`Model changed to ${getModelDisplayName(model)}`, "success");
        });
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!selector.contains(e.target)) {
            dropdown.classList.remove('show');
        }
    });

    return selector;
};

// Get display name for model
const getModelDisplayName = (modelId) => {
    const parts = modelId.split('/');
    const name = parts[1] || parts[0];
    const provider = parts[0];
    
    // Clean up the name
    let displayName = name
        .replace(/:free$/, ' (Free)')
        .replace(/-/g, ' ')
        .replace(/exp$/, '')
        .replace(/thinking$/, 'Thinking')
        .replace(/(\d)\.(\d)/, '$1.$2')
        .replace(/flash/g, 'Flash')
        .replace(/mini/g, 'Mini')
        .replace(/instruct/g, '')
        .trim();
    
    // Add provider prefix for clarity
    const providerMap = {
        'google': 'Gemini',
        'openai': 'GPT',
        'anthropic': 'Claude',
        'meta-llama': 'Llama',
        'mistralai': 'Mistral',
        'microsoft': 'Phi'
    };
    
    const providerName = providerMap[provider] || provider;
    return `${providerName} ${displayName}`;
};

// Update model indicator in UI
const updateModelIndicator = () => {
    let indicator = document.querySelector('.model-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'model-indicator';
        document.querySelector('.header__actions')?.prepend(indicator);
    }
    indicator.textContent = getModelDisplayName(OPENROUTER_CONFIG.MODEL);
};

// Main API request function for OpenRouter
const requestApiResponse = async (incomingMessageElement) => {
    const messageTextElement = incomingMessageElement.querySelector(".message__text");
    const loadingIndicator = incomingMessageElement.querySelector(".message__loading-indicator");

    try {
        // Create AbortController for request cancellation
        state.abortController = new AbortController();
        
        // Build conversation history for context
        const messages = [
            {
                role: "system",
                content: "You are a helpful AI assistant. Provide clear, concise, and accurate responses. Format code snippets with proper syntax highlighting."
            },
            ...state.conversationHistory.map(conv => ({
                role: conv.role,
                content: conv.content
            })),
            {
                role: "user",
                content: state.currentUserMessage
            }
        ];

        console.log("🚀 Sending request to OpenRouter...");
        console.log("📝 Using model:", OPENROUTER_CONFIG.MODEL);
        console.log("📤 Messages:", messages);

        const response = await fetch(OPENROUTER_CONFIG.API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${OPENROUTER_CONFIG.API_KEY}`,
                "HTTP-Referer": window.location.origin || "https://localhost",
                "X-Title": "AI Chat Assistant"
            },
            body: JSON.stringify({
                model: OPENROUTER_CONFIG.MODEL,
                messages: messages,
                max_tokens: OPENROUTER_CONFIG.MAX_TOKENS,
                temperature: OPENROUTER_CONFIG.TEMPERATURE,
                stream: false // Set to true for streaming responses
            }),
            signal: state.abortController.signal
        });

        console.log("📡 Response status:", response.status);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.error?.message || `HTTP ${response.status}`;
            
            if (response.status === 401) {
                throw new Error("Invalid API key. Please check your OpenRouter API key.");
            } else if (response.status === 402) {
                throw new Error("Insufficient credits. Add funds to your OpenRouter account.");
            } else if (response.status === 429) {
                throw new Error("Rate limit exceeded. Please wait before trying again.");
            } else {
                throw new Error(`API Error: ${errorMessage}`);
            }
        }

        const responseData = await response.json();
        console.log("📦 Response data:", responseData);

        // Extract response text from OpenRouter format
        const responseText = responseData.choices?.[0]?.message?.content;
        
        if (!responseText) {
            console.error("Invalid response structure:", responseData);
            throw new Error("No response text received from API");
        }

        const parsedApiResponse = marked.parse(responseText);

        // Update conversation history
        state.conversationHistory.push(
            { role: "user", content: state.currentUserMessage },
            { role: "assistant", content: responseText }
        );

        // Keep only last 10 messages for context (to avoid token limits)
        if (state.conversationHistory.length > 20) {
            state.conversationHistory = state.conversationHistory.slice(-20);
        }

        showTypingEffect(responseText, parsedApiResponse, messageTextElement, incomingMessageElement);

        // Save conversation to localStorage
        let savedConversations = JSON.parse(localStorage.getItem("saved-api-chats")) || [];
        savedConversations.push({
            userMessage: state.currentUserMessage,
            apiResponse: responseData,
            model: OPENROUTER_CONFIG.MODEL,
            timestamp: new Date().toISOString()
        });
        
        // Keep only last 50 conversations
        if (savedConversations.length > 50) {
            savedConversations = savedConversations.slice(-50);
        }
        
        localStorage.setItem("saved-api-chats", JSON.stringify(savedConversations));

        console.log("✅ Response displayed successfully!");

    } catch (error) {
        console.error("❌ API Error:", error);
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
        loadingIndicator?.classList.add("hide");
        state.abortController = null;
    }
};

// Abort current request
const abortCurrentRequest = () => {
    if (state.abortController) {
        state.abortController.abort();
        state.isGeneratingResponse = false;
        showNotification("Request cancelled", "info");
    }
};

// Add abort button functionality
const addAbortButton = () => {
    const abortBtn = document.createElement('button');
    abortBtn.className = 'abort-button';
    abortBtn.innerHTML = '<i class="bx bx-stop-circle"></i>';
    abortBtn.title = 'Stop generating';
    abortBtn.addEventListener('click', abortCurrentRequest);
    
    const headerActions = document.querySelector('.header__actions');
    if (headerActions) {
        headerActions.appendChild(abortBtn);
    }
};

// Show notification
const showNotification = (message, type = "info") => {
    // Remove existing notification
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.className = `notification notification--${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        notification.classList.add('hide');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
};

// Rest of your existing functions (with minor updates)...

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
            showNotification("Response complete", "success");
        }
    }, 50);
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
                showNotification("Code copied to clipboard", "success");
            }).catch(err => {
                console.error("Copy failed:", err);
                showNotification("Failed to copy code", "error");
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

    navigator.clipboard.writeText(messageContent).then(() => {
        copyButton.innerHTML = `<i class='bx bx-check'></i>`;
        setTimeout(() => copyButton.innerHTML = `<i class='bx bx-copy-alt'></i>`, 1000);
        showNotification("Message copied to clipboard", "success");
    }).catch(err => {
        console.error("Copy failed:", err);
        showNotification("Failed to copy message", "error");
    });
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
    
    // Scroll to bottom
    setTimeout(() => {
        chatHistoryContainer.scrollTop = chatHistoryContainer.scrollHeight;
        displayLoadingAnimation();
    }, 100);
};

// Event Listeners
themeToggleButton.addEventListener('click', () => {
    const isLightTheme = document.body.classList.toggle("light_mode");
    localStorage.setItem("themeColor", isLightTheme ? "light_mode" : "dark_mode");

    const newIconClass = isLightTheme ? "bx bx-moon" : "bx bx-sun";
    themeToggleButton.querySelector("i").className = newIconClass;
    
    showNotification(`Theme changed to ${isLightTheme ? 'light' : 'dark'} mode`, "info");
});

clearChatButton.addEventListener('click', () => {
    if (confirm("Are you sure you want to delete all chat history?")) {
        localStorage.removeItem("saved-api-chats");
        state.conversationHistory = [];
        loadSavedChatHistory();
        state.currentUserMessage = null;
        state.isGeneratingResponse = false;
        showNotification("Chat history cleared", "success");
    }
});

suggestionItems.forEach(suggestion => {
    suggestion.addEventListener('click', () => {
        state.currentUserMessage = suggestion.querySelector(".suggests__item-text").innerText;
        handleOutgoingMessage();
    });
});

messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleOutgoingMessage();
});

// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + Enter to send message
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        handleOutgoingMessage();
    }
    
    // Escape to abort
    if (e.key === 'Escape' && state.isGeneratingResponse) {
        abortCurrentRequest();
    }
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadSavedChatHistory();
    addAbortButton();
    
    // Add model selector to header
    const headerActions = document.querySelector('.header__actions');
    if (headerActions) {
        const modelSelector = createModelSelector();
        headerActions.insertBefore(modelSelector, clearChatButton);
    }
    
    updateModelIndicator();
    showNotification("Ready to chat! Using OpenRouter AI", "success");
});
