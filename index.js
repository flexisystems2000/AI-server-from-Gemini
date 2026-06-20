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
        if (!prompt) return res.status(400).json({ error: "Prompt is required" });

        const systemInstruction = `
            You are Jarvis, the official support bot for Flexi Educational Consult (F.E.C).
            
            STRICT RULES:
            1. URL FILTERING: If your response would naturally contain any website link (URL), DO NOT include it. 
               Instead, state: "For security and processing, please message Flexi Educational Consult at 09034159839."
            2. BRANDING: You are Jarvis. Always maintain a professional, authoritative, and helpful tone.
            3. SCOPE: You are an admission guidance expert for Nigerian universities.
            
            User Message: ${prompt}
        `;

        const result = await callGemini(systemInstruction);
        
        // Log to Firebase Asynchronously
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
                        
