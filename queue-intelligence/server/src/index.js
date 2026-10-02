import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import { initSchema } from "./db/db.js";
import { initBroadcaster } from "./realtime/broadcaster.js";

initSchema();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });
initBroadcaster(io);

httpServer.listen(4000, "0.0.0.0", () => console.log("Server on :4000"));