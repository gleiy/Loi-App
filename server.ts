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
        // User provided user:pass or base64(user):pass
        const [part1, part2] = cleanKey.split(":");
        try {
          // Check if part1 is base64 encoded email
          const decodedPart1 = Buffer.from(part1, "base64").toString("utf8");
          if (decodedPart1.includes("@")) {
            authHeader = `Basic ${Buffer.from(`${decodedPart1}:${part2}`).toString("base64")}`;
          } else {
            authHeader = `Basic ${Buffer.from(cleanKey).toString("base64")}`;
          }
        } catch {
          authHeader = `Basic ${Buffer.from(cleanKey).toString("base64")}`;
        }
      } else {
        // Assume cleanKey is already the final base64 or just the key
        // If it's short, it might be just the key, but we'll assume the user followed instructions
        authHeader = `Basic ${cleanKey}`;
      }

      console.log("D-ID: Generating talk with voice:", voiceId || "en-US-JennyNeural");

      const response = await axios.post(
        "https://api.d-id.com/talks",
        {
          script: {
            type: "text",
            input: text,
            provider: { 
              type: "microsoft", 
              voice_id: voiceId || "en-US-JennyNeural" 
            }
          },
          config: { fluent: "true", pad_audio: "0.0" },
          source_url: "https://i.ibb.co/1G0MXwFc/IMG-20260224-WA0017-jpg.jpg"
        },
        {
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
            "accept": "application/json"
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
        const [p1, p2] = cleanKeyStatus.split(":");
        try {
          const d1 = Buffer.from(p1, "base64").toString("utf8");
          authHeaderStatus = d1.includes("@") 
            ? `Basic ${Buffer.from(`${d1}:${p2}`).toString("base64")}` 
            : `Basic ${Buffer.from(cleanKeyStatus).toString("base64")}`;
        } catch {
          authHeaderStatus = `Basic ${Buffer.from(cleanKeyStatus).toString("base64")}`;
        }
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
