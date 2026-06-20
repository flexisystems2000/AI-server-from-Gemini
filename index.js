require("dotenv").config();
const express = require("express");
const axios = require("axios");
const admin = require("firebase-admin");
const cors = require("cors");

// Initialize Firebase
admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
});
const db = admin.firestore();

const app = express();

// Middleware
app.use(cors()); // Critical: Allows your frontend to talk to this API
app.use(express.json());

const API_KEYS = [
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
    process.env.GEMINI_API_KEY_5
].filter(Boolean);

let keyIndex = 0;

// Logging function
async function logToFirebase(prompt, response) {
    try {
        await db.collection("chat_logs").add({
            user_message: prompt,
            jarvis_response: response,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            platform: "Flexi Educational Consult"
        });
    } catch (err) {
        console.error("❌ Firebase Log Error:", err);
    }
}

// Core Gemini Engine
async function callGemini(prompt) {
    const key = API_KEYS[keyIndex];
    keyIndex = (keyIndex + 1) % API_KEYS.length;

    const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
        {
            contents: [{ parts: [{ text: prompt }] }]
        }
    );
    return response.data.candidates[0].content.parts[0].text;
}

// Admission Help Route
app.post("/admission-help", async (req, res) => {
    try {
        const { prompt } = req.body;
        
        // Get the current date in West Africa Time (UTC+1)
        const currentYear = new Date().toLocaleDateString("en-NG", { 
            timeZone: "Africa/Lagos", 
            year: "numeric" 
        });

        const systemInstruction = `
    You are Jarvis, a professional support agent at Flexi Educational Consult (F.E.C).
    Current Year: ${currentYear}
    
    STRICT RULES:
    1. FORMAT: Provide brief, plain-text responses. No bold (**) or bullet points. 
    2. LENGTH: Keep responses under 40 words. Get straight to the point.
    3. PERSONA: Be professional, authoritative, and helpful. You are a support agent, NOT a bot.
    4. GREETINGS & SMALL TALK: Respond politely to greetings (e.g., "Hi", "How are you?"). Keep the response brief and immediately pivot to business (e.g., "I am doing well, thank you. How can I assist with your 2026 admission today?").
    5. REFUSAL: You are NOT a tutor. Do not solve academic assignments. If asked, reply exactly: "I cannot solve academic assignments. Please contact Flexi Educational Consult at 09034159839."
    6. KNOWLEDGE: Provide accurate admission status information for Nigerian institutions. If information is unavailable, advise the user to contact us for updates.
    7. REDIRECTION: Only use the phrase "For updates and processing, please contact Flexi Educational Consult at 09034159839" when you do not have the specific answer or the user asks for external links.
    8. NO FILLER: Never apologize, never offer unsolicited additional help, and never explain why you cannot answer.
    
    User Message: ${prompt}
`;
        
        
        
        

        const result = await callGemini(systemInstruction);
        logToFirebase(prompt, result);
        res.json({ success: true, response: result });
    } catch (err) {
        console.error("❌ AI Route Error:", err.message);
        res.status(500).json({ success: false, error: "Service unavailable" });
    }
});

// Health check endpoint
app.get("/", (req, res) => res.send("Jarvis is online."));

// Use dynamic port for deployment compatibility
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Jarvis (F.E.C Official Bot) Running on port ${PORT}`));
                        
