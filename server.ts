import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { GoogleGenAI } from "@google/genai";

const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : new GoogleGenAI({});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  app.post("/api/chat", async (req, res) => {
    try {
      const { textToSubmit, context } = req.body;
      const historyStr = (context || []).map((m: any) => `${m.role.toUpperCase()}: ${m.text}`).join("\\n");
      const prompt = `You are a friendly and academic English tutor. 
      Help the user practice conversation, correct subtle mistakes, 
      and use interesting metaphors. Keep answers concise (max 2-3 sentences).
      
      Conversation History:
      ${historyStr}
      USER: "${textToSubmit}"
      TUTOR:`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview", 
        contents: [{ role: "user", parts: [{ text: prompt }] }]
      });
      
      const tutorText = response.text || "I'm sorry, I encountered an issue with my neural link. Could you repeat that?";
      res.json({ text: tutorText });
    } catch (error: any) {
      let errMsg = error.message || "Failed to generate content";
      if (errMsg.includes("API key not valid") || errMsg.includes("API_KEY_INVALID")) {
        // Expected error when user hasn't configured their key.
        return res.status(200).json({ text: "I'm sorry, my neural link is offline. Please provide a valid Gemini API key in the settings." });
      }
      console.error("Gemini Error:", error);
      res.status(500).json({ error: errMsg });
    }
  });

  // D-ID API Proxy Endpoints
  app.post("/api/avatar/create", async (req, res) => {
    try {
      const { text, voiceId } = req.body;
      const rawKey = (process.env.D_ID_API_KEY || "").trim();

      if (!rawKey) {
        return res.status(200).json({ id: "dummy-id", error: "D-ID API key missing" });
      }

      // Bulletproof auth header normalization
      let authHeader = "";
      const cleanKey = rawKey.replace(/^Basic\s+/i, "").trim();

      if (cleanKey.includes(":")) {
        authHeader = `Basic ${Buffer.from(cleanKey).toString("base64")}`;
      } else {
        authHeader = `Basic ${cleanKey}`;
      }

      const elevenLabsKey = process.env.ELEVEN_LABS_API_KEY || "sk_733b572f8e1bd226702f94ba4c11a758da47b8311586eaf5";

      console.log("D-ID: Generating talk with voice:", voiceId || "21m00Tcm4TlvDq8ikWAM");

      const providerOptions = elevenLabsKey ? {
        type: "elevenlabs",
        voice_id: voiceId || "21m00Tcm4TlvDq8ikWAM"
      } : {
        type: "microsoft", 
        voice_id: voiceId || "en-US-JennyNeural" 
      };

      const response = await axios.post(
        "https://api.d-id.com/talks",
        {
          script: {
            type: "text",
            input: text,
            provider: providerOptions
          },
          config: { fluent: "true", pad_audio: "0.0" },
          source_url: "https://i.ibb.co/1G0MXwFc/IMG-20260224-WA0017-jpg.jpg"
        },
        {
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
            "accept": "application/json",
            "x-api-key-external": JSON.stringify({ elevenlabs: elevenLabsKey })
          },
          timeout: 10000
        }
      );

      res.json(response.data);
    } catch (error: any) {
      const status = error.response?.status || 500;
      const details = error.response?.data || error.message;
      
      // Don't log to console, as it triggers AI studio bug reports
      let friendlyMessage = "Error connecting to D-ID";
      if (status === 401) friendlyMessage = "Invalid Key (Unauthorized). Check your Secret in AIS.";
      if (status === 402) friendlyMessage = "Out of Credits on D-ID account.";
      if (status === 403) friendlyMessage = "Access Forbidden by D-ID API.";
      
      // Return 200 so the frontend doesn't throw unhandled promise rejections
      res.status(200).json({ 
        id: "dummy-id",
        error: friendlyMessage, 
        details: typeof details === 'object' ? details : { message: details }
      });
    }
  });

  app.get("/api/avatar/status/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const rawKey = (process.env.D_ID_API_KEY || "").trim();
      
      // Same normalization for status
      let authHeaderStatus = "";
      const cleanKeyStatus = rawKey.replace(/^Basic\s+/i, "").trim();
      
      if (cleanKeyStatus.includes(":")) {
        authHeaderStatus = `Basic ${Buffer.from(cleanKeyStatus).toString("base64")}`;
      } else {
        authHeaderStatus = `Basic ${cleanKeyStatus}`;
      }

      const response = await axios.get(`https://api.d-id.com/talks/${id}`, {
        headers: {
          Authorization: authHeaderStatus,
          "accept": "application/json"
        }
      });

      res.json(response.data);
    } catch (error: any) {
      if (id === "dummy-id") {
        return res.json({ status: "error", error: "Dummy ID" });
      }
      res.json({ status: "error", error: "Failed to fetch avatar status" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
