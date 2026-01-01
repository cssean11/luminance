// Minimal working version
const messageForm = document.querySelector(".prompt__form");
const chatHistoryContainer = document.querySelector(".chats");

const GROQ_API_KEY = "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";
let currentUserMessage = null;

const handleOutgoingMessage = async () => {
    currentUserMessage = messageForm.querySelector(".prompt__form-input").value.trim();
    if (!currentUserMessage) return;

    // Add user message
    const userMsg = document.createElement("div");
    userMsg.className = "message message--outgoing";
    userMsg.innerHTML = `
        <div class="message__content">
            <img class="message__avatar" src="assets/profile.png" alt="User">
            <p class="message__text">${currentUserMessage}</p>
        </div>
    `;
    chatHistoryContainer.appendChild(userMsg);

    // Add AI loading message
    const aiMsg = document.createElement("div");
    aiMsg.className = "message message--incoming";
    aiMsg.innerHTML = `
        <div class="message__content">
            <img class="message__avatar" src="assets/Gemini.png" alt="AI">
            <p class="message__text">Thinking...</p>
        </div>
    `;
    chatHistoryContainer.appendChild(aiMsg);

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.1-70b-versatile",
                messages: [{ role: "user", content: currentUserMessage }],
                temperature: 0.7
            })
        });

        const data = await response.json();
        const aiText = data.choices?.[0]?.message?.content || "No response";
        
        aiMsg.querySelector(".message__text").textContent = aiText;
        messageForm.reset();
        
    } catch (error) {
        aiMsg.querySelector(".message__text").textContent = `Error: ${error.message}`;
    }
};

messageForm.addEventListener("submit", (e) => {
    e.preventDefault();
    handleOutgoingMessage();
});
