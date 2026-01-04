import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// ⚠️ HARD-CODED KEY (unsafe, but exactly what you asked for)
const CLAUDE_API_KEY = "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";

app.post("/api/chat", async (req, res) => {
    try {
        const userMessage = req.body.message;

        if (!userMessage) {
            return res.status(400).json({ error: "Message is required" });
        }

        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": CLAUDE_API_KEY,
                "anthropic-version": "2023-06-01"
            },
            body: JSON.stringify({
                model: "claude-3-5-sonnet-20241022",
                max_tokens: 4096,
                temperature: 0.7,
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: userMessage }
                        ]
                    }
                ]
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({
                error: data.error?.message || "Claude API error"
            });
        }

        res.json({
            text: data.content[0].text
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(3000, () => {
    console.log("✅ Server running at http://localhost:3000");
});
