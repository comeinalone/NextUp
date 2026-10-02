import { createServer } from "http";
import { Server } from "socket.io";
import { config } from "./config.js";
import { initSchema } from "./db/db.js";
import { createApp } from "./app.js";
import { initBroadcaster } from "./realtime/broadcaster.js";
import { startTicker } from "./realtime/recompute.js";

initSchema();

const httpServer = createServer(createApp());
const io = new Server(httpServer, { cors: { origin: "*" } });
initBroadcaster(io);
startTicker();

httpServer.listen(config.port, "0.0.0.0", () => console.log(`Server on :${config.port}`));