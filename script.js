const messageForm = document.querySelector(".prompt__form");
const chatHistoryContainer = document.querySelector(".chats");
const suggestionItems = document.querySelectorAll(".suggests__item");
const themeToggleButton = document.getElementById("themeToggler");
const clearChatButton = document.getElementById("deleteButton");

// State
const state = {
    currentUserMessage: null,
    isGeneratingResponse: false,
    abortController: null
};

// Claude API config (hardcoded key)
const CLAUDE_CONFIG = {
    API_KEY: "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",
    API_URL: "https://api.anthropic.com/v1/messages",
    MODEL: "claude-3-5-sonnet-20241022",
    MAX_TOKENS: 4096,
    TEMPERATURE: 0.7,
    VERSION: "2023-06-01"
};

// Load saved chat
const loadSavedChatHistory = () => {
    const saved = JSON.parse(localStorage.getItem("saved-api-chats")) || [];
    const isLight = localStorage.getItem("themeColor") === "light_mode";

    document.body.classList.toggle("light_mode", isLight);
    themeToggleButton.innerHTML = isLight ? '<i class="bx bx-moon"></i>' : '<i class="bx bx-sun"></i>';
    chatHistoryContainer.innerHTML = '';

    saved.forEach(conv => {
        const userHtml = `
            <div class="message__content">
                <img class="message__avatar" src="assets/profile.png" alt="User avatar">
                <p class="message__text">${conv.userMessage}</p>
            </div>`;
        chatHistoryContainer.appendChild(createChatMessageElement(userHtml, "message--outgoing"));

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
            <span onClick="copyMessageToClipboard(this)" class="message__icon hide"><i class='bx bx-copy-alt'></i></span>`;

        const incoming = createChatMessageElement(responseHtml, "message--incoming");
        chatHistoryContainer.appendChild(incoming);

        const textEl = incoming.querySelector(".message__text");
        const rawText = conv.responseText || "No response";
        const htmlText = window.marked ? marked.parse(rawText) : rawText;
        showTypingEffect(rawText, htmlText, textEl, incoming, true);
    });

    document.body.classList.toggle("hide-header", saved.length > 0);
};

// Create message element
const createChatMessageElement = (html, ...classes) => {
    const el = document.createElement("div");
    el.classList.add("message", ...classes);
    el.innerHTML = html;
    return el;
};

// Typing effect
const showTypingEffect = (rawText, htmlText, msgEl, incomingEl, skip=false) => {
    const copyIcon = incomingEl.querySelector(".message__icon");
    copyIcon.classList.add("hide");

    if(skip){
        msgEl.innerHTML = htmlText;
        if(window.hljs) hljs.highlightAll();
        addCopyButtonToCodeBlocks();
        copyIcon.classList.remove("hide");
        state.isGeneratingResponse = false;
        return;
    }

    const words = rawText.split(' ');
    let i = 0;
    const interval = setInterval(()=>{
        msgEl.innerText += (i===0?'':' ')+words[i++];
        if(i===words.length){
            clearInterval(interval);
            msgEl.innerHTML = htmlText;
            if(window.hljs) hljs.highlightAll();
            addCopyButtonToCodeBlocks();
            copyIcon.classList.remove("hide");
            state.isGeneratingResponse = false;
        }
    }, 75);
};

// Request Claude directly
const requestApiResponse = async (incomingEl) => {
    const msgEl = incomingEl.querySelector(".message__text");
    try {
        state.abortController = new AbortController();

        const resp = await fetch(CLAUDE_CONFIG.API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": CLAUDE_CONFIG.API_KEY,
                "anthropic-version": CLAUDE_CONFIG.VERSION
            },
            body: JSON.stringify({
                model: CLAUDE_CONFIG.MODEL,
                max_tokens: CLAUDE_CONFIG.MAX_TOKENS,
                temperature: CLAUDE_CONFIG.TEMPERATURE,
                messages: [{
                    role: "user",
                    content: [{ type:"text", text: state.currentUserMessage }]
                }]
            }),
            signal: state.abortController.signal
        });

        if(!resp.ok){
            const err = await resp.json().catch(()=>({}));
            throw new Error(err.error?.message || `HTTP ${resp.status}`);
        }

        const data = await resp.json();
        const rawText = data?.content?.[0]?.text || "No response";
        const htmlText = window.marked ? marked.parse(rawText) : rawText;

        showTypingEffect(rawText, htmlText, msgEl, incomingEl);

        let saved = JSON.parse(localStorage.getItem("saved-api-chats")) || [];
        saved.push({ userMessage: state.currentUserMessage, responseText: rawText, timestamp: new Date().toISOString() });
        localStorage.setItem("saved-api-chats", JSON.stringify(saved));

    } catch(err){
        if(err.name==='AbortError'){
            msgEl.innerText="⏹️ Request cancelled";
        } else {
            msgEl.innerText=`❌ ${err.message}`;
        }
        msgEl.closest(".message").classList.add("message--error");
    } finally {
        incomingEl.classList.remove("message--loading");
        state.isGeneratingResponse=false;
        state.abortController=null;
    }
};

// Abort request
const abortCurrentRequest = ()=> {
    if(state.abortController){
        state.abortController.abort();
        state.isGeneratingResponse=false;
    }
};

// Copy code blocks
const addCopyButtonToCodeBlocks = ()=>{
    document.querySelectorAll('pre').forEach(block=>{
        if(block.querySelector('.code__copy-btn')) return;
        const code = block.querySelector('code');
        let lang = [...code.classList].find(c=>c.startsWith('language-'))?.replace('language-','')||'Text';

        const label = document.createElement('div');
        label.innerText = lang.charAt(0).toUpperCase()+lang.slice(1);
        label.classList.add('code__language-label');
        block.appendChild(label);

        const btn = document.createElement('button');
        btn.innerHTML=`<i class='bx bx-copy'></i>`;
        btn.classList.add('code__copy-btn');
        block.appendChild(btn);

        btn.addEventListener('click',()=>{
            navigator.clipboard.writeText(code.innerText).then(()=>{
                btn.innerHTML=`<i class='bx bx-check'></i>`;
                setTimeout(()=>btn.innerHTML=`<i class='bx bx-copy'></i>`,2000);
            }).catch(()=>alert("Unable to copy text!"));
        });
    });
};

// Loading animation
const displayLoadingAnimation = () => {
    const html = `
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
    const el = createChatMessageElement(html,"message--incoming","message--loading");
    chatHistoryContainer.appendChild(el);
    requestApiResponse(el);
};

// Copy message
const copyMessageToClipboard=(btn)=>{
    const text = btn.parentElement.querySelector(".message__text").innerText;
    navigator.clipboard.writeText(text);
    btn.innerHTML=`<i class='bx bx-check'></i>`;
    setTimeout(()=>btn.innerHTML=`<i class='bx bx-copy-alt'></i>`,1000);
};

// Handle outgoing message
const handleOutgoingMessage = ()=>{
    state.currentUserMessage = messageForm.querySelector(".prompt__form-input").value.trim() || state.currentUserMessage;
    if(!state.currentUserMessage||state.isGeneratingResponse) return;
    state.isGeneratingResponse=true;

    const html = `
        <div class="message__content">
            <img class="message__avatar" src="assets/profile.png" alt="User avatar">
            <p class="message__text"></p>
        </div>`;
    const el = createChatMessageElement(html,"message--outgoing");
    el.querySelector(".message__text").innerText=state.currentUserMessage;
    chatHistoryContainer.appendChild(el);

    messageForm.reset();
    document.body.classList.add("hide-header");
    setTimeout(displayLoadingAnimation,500);
};

// Theme toggle
themeToggleButton.addEventListener('click',()=>{
    const light = document.body.classList.toggle("light_mode");
    localStorage.setItem("themeColor",light?"light_mode":"dark_mode");
    themeToggleButton.querySelector("i").className = light?"bx bx-moon":"bx bx-sun";
});

// Clear chat
clearChatButton.addEventListener('click',()=>{
    if(confirm("Are you sure you want to delete all chat history?")){
        localStorage.removeItem("saved-api-chats");
        loadSavedChatHistory();
        state.currentUserMessage=null;
        state.isGeneratingResponse=false;
    }
});

// Suggestions
suggestionItems.forEach(s=>{
    s.addEventListener('click',()=>{
        state.currentUserMessage=s.querySelector(".suggests__item-text").innerText;
        handleOutgoingMessage();
    });
});

// Form submit
messageForm.addEventListener('submit',e=>{
    e.preventDefault();
    handleOutgoingMessage();
});

// Abort Escape key
document.addEventListener('keydown',e=>{
    if(e.key==='Escape' && state.isGeneratingResponse) abortCurrentRequest();
});

// Load history
loadSavedChatHistory();
