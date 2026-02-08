import type { Express } from "express";
import { type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { joinSessionSchema, updatePlayerNameSchema, importBoardSchema } from "@shared/schema";
import { log } from "./index";
import type { IncomingMessage } from "http";
import { URL } from "url";

interface WSClient {
  ws: WebSocket;
  sessionId: string;
  playerId: string | null;
}

const clients: WSClient[] = [];

function broadcastToSession(sessionId: string) {
  storage.getPublicSession(sessionId).then((session) => {
    if (!session) return;
    const msg = JSON.stringify({ type: "session_update", session });
    clients.forEach((client) => {
      if (client.sessionId === sessionId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(msg);
      }
    });
  });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const sessionId = url.searchParams.get("sessionId") || "";
    const playerId = url.searchParams.get("playerId") || null;

    const client: WSClient = { ws, sessionId, playerId };
    clients.push(client);

    log(`WS client connected: session=${sessionId} player=${playerId}`, "ws");

    storage.getPublicSession(sessionId).then((session) => {
      if (session) {
        ws.send(JSON.stringify({ type: "session_update", session }));
      }
    });

    ws.on("message", async (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());

        if (!playerId) return;

        const session = await storage.getSession(sessionId);
        if (!session) return;
        const player = session.players.find((p) => p.id === playerId);
        if (!player || !player.teamId || player.banned) return;

        if (msg.type === "lock_answer" && msg.answer) {
          await storage.lockPlayerAnswer(sessionId, playerId, msg.answer);
          broadcastToSession(sessionId);
        }
      } catch (e) {
        log(`WS message error: ${e}`, "ws");
      }
    });

    ws.on("close", () => {
      const idx = clients.indexOf(client);
      if (idx !== -1) clients.splice(idx, 1);
    });
  });

  app.post("/api/sessions", async (_req, res) => {
    try {
      const session = await storage.createSession();
      res.json({ id: session.id, adminToken: session.adminToken });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/sessions/:id", async (req, res) => {
    try {
      const session = await storage.getPublicSession(req.params.id);
      if (!session) return res.status(404).json({ message: "Session not found" });
      res.json(session);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/sessions/:id/join", async (req, res) => {
    try {
      const parsed = joinSessionSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Ogiltigt namn" });

      const session = await storage.getSession(req.params.id);
      if (!session) return res.status(404).json({ message: "Session hittades inte" });

      const player = await storage.addPlayer(req.params.id, parsed.data.name);
      broadcastToSession(req.params.id);
      res.json(player);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/sessions/:id/players/:playerId", async (req, res) => {
    try {
      const session = await storage.getSession(req.params.id);
      if (!session) return res.status(404).json({ message: "Session not found" });
      if (session.adminToken !== req.body.adminToken) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const parsed = updatePlayerNameSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid name" });

      const player = await storage.updatePlayerName(req.params.id, req.params.playerId, parsed.data.name);
      if (!player) return res.status(404).json({ message: "Player not found" });

      broadcastToSession(req.params.id);
      res.json(player);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.delete("/api/sessions/:id/players/:playerId", async (req, res) => {
    try {
      const session = await storage.getSession(req.params.id);
      if (!session) return res.status(404).json({ message: "Session not found" });
      if (session.adminToken !== req.body.adminToken) {
        return res.status(403).json({ message: "Not authorized" });
      }

      await storage.removePlayer(req.params.id, req.params.playerId);
      broadcastToSession(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/sessions/:id/players/:playerId/ban", async (req, res) => {
    try {
      const session = await storage.getSession(req.params.id);
      if (!session) return res.status(404).json({ message: "Session not found" });
      if (session.adminToken !== req.body.adminToken) {
        return res.status(403).json({ message: "Not authorized" });
      }

      await storage.banPlayer(req.params.id, req.params.playerId);
      broadcastToSession(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/sessions/:id/players/:playerId/override", async (req, res) => {
    try {
      const session = await storage.getSession(req.params.id);
      if (!session) return res.status(404).json({ message: "Session not found" });
      if (session.adminToken !== req.body.adminToken) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const { boardIndex, correct } = req.body;
      if (boardIndex === undefined || correct === undefined) {
        return res.status(400).json({ message: "Missing boardIndex or correct" });
      }

      await storage.overridePlayerAnswer(req.params.id, req.params.playerId, boardIndex, correct);
      broadcastToSession(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/sessions/:id/players/:playerId/penalize", async (req, res) => {
    try {
      const session = await storage.getSession(req.params.id);
      if (!session) return res.status(404).json({ message: "Session not found" });
      if (session.adminToken !== req.body.adminToken) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const { points } = req.body;
      if (!points || points <= 0) {
        return res.status(400).json({ message: "Invalid points" });
      }

      await storage.penalizePlayer(req.params.id, req.params.playerId, points);
      broadcastToSession(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/sessions/:id/teams", async (req, res) => {
    try {
      const session = await storage.getSession(req.params.id);
      if (!session) return res.status(404).json({ message: "Session not found" });
      if (session.adminToken !== req.body.adminToken) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const teamSize = req.body.teamSize || 3;
      const teams = await storage.randomizeTeams(req.params.id, teamSize);
      broadcastToSession(req.params.id);
      res.json(teams);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/sessions/:id/boards", async (req, res) => {
    try {
      const session = await storage.getSession(req.params.id);
      if (!session) return res.status(404).json({ message: "Session not found" });
      if (session.adminToken !== req.body.adminToken) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const parsed = importBoardSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Ogiltigt format. Varje fråga behöver ett svar och exakt 5 ledtrådar." });

      await storage.setBoards(req.params.id, parsed.data.boards);
      broadcastToSession(req.params.id);
      res.json({ success: true, count: parsed.data.boards.length });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/sessions/:id/start", async (req, res) => {
    try {
      const session = await storage.getSession(req.params.id);
      if (!session) return res.status(404).json({ message: "Session not found" });
      if (session.adminToken !== req.body.adminToken) {
        return res.status(403).json({ message: "Not authorized" });
      }

      await storage.startGame(req.params.id);
      broadcastToSession(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/sessions/:id/next-clue", async (req, res) => {
    try {
      const session = await storage.getSession(req.params.id);
      if (!session) return res.status(404).json({ message: "Session not found" });
      if (session.adminToken !== req.body.adminToken) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const clueIndex = await storage.nextClue(req.params.id);
      broadcastToSession(req.params.id);
      res.json({ clueIndex });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/sessions/:id/reveal", async (req, res) => {
    try {
      const session = await storage.getSession(req.params.id);
      if (!session) return res.status(404).json({ message: "Session not found" });
      if (session.adminToken !== req.body.adminToken) {
        return res.status(403).json({ message: "Not authorized" });
      }

      await storage.revealAnswer(req.params.id);
      broadcastToSession(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/sessions/:id/next-question", async (req, res) => {
    try {
      const session = await storage.getSession(req.params.id);
      if (!session) return res.status(404).json({ message: "Session not found" });
      if (session.adminToken !== req.body.adminToken) {
        return res.status(403).json({ message: "Not authorized" });
      }

      await storage.nextQuestion(req.params.id);
      broadcastToSession(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/sessions/:id/finish", async (req, res) => {
    try {
      const session = await storage.getSession(req.params.id);
      if (!session) return res.status(404).json({ message: "Session not found" });
      if (session.adminToken !== req.body.adminToken) {
        return res.status(403).json({ message: "Not authorized" });
      }

      await storage.finishGame(req.params.id);
      broadcastToSession(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/sessions/:id/reset", async (req, res) => {
    try {
      const session = await storage.getSession(req.params.id);
      if (!session) return res.status(404).json({ message: "Session not found" });
      if (session.adminToken !== req.body.adminToken) {
        return res.status(403).json({ message: "Not authorized" });
      }

      await storage.resetSession(req.params.id);
      broadcastToSession(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  return httpServer;
}
