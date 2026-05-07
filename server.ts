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

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // D-ID API Proxy Endpoints
  app.post("/api/avatar/create", async (req, res) => {
    try {
      const { text, voiceId } = req.body;
      const rawKey = (process.env.D_ID_API_KEY || "").trim();

      if (!rawKey) {
        return res.status(500).json({ error: "D_ID_API_KEY missing in Secrets panel." });
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
      
      console.error(`D-ID CREATE ERROR [${status}]:`, JSON.stringify(details, null, 2));
      
      let friendlyMessage = "Error connecting to D-ID";
      if (status === 401) friendlyMessage = "Invalid Key (Unauthorized). Check your Secret in AIS.";
      if (status === 402) friendlyMessage = "Out of Credits on D-ID account.";
      if (status === 403) friendlyMessage = "Access Forbidden by D-ID API.";
      
      res.status(status).json({ 
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
      console.error("D-ID Status Check Error:", error.response?.data || error.message);
      res.status(500).json({ error: "Failed to fetch avatar status" });
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
