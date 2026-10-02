import express from "express";
import cors from "cors";
import { ServiceError } from "./core/errors.js";
import { customerRoutes } from "./routes/customer.js";
import { counterRoutes } from "./routes/counter.js";
import { managerRoutes } from "./routes/manager.js";
import { simRoutes } from "./routes/sim.js";
import { analyticsRoutes } from "./routes/analytics.js";
import { assistRoutes } from "./routes/assist.js";

function errorHandler(err, req, res, _next) {
  if (err instanceof ServiceError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }
  if (err?.name === "ZodError") {
    const message = err.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
    return res.status(400).json({ error: { code: "BAD_REQUEST", message } });
  }
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: { code: "BAD_JSON", message: "Request body is not valid JSON" } });
  }
  console.error(err);
  res.status(500).json({ error: { code: "INTERNAL", message: "Something went wrong" } });
}

// Built separately from index.js so tests can start it on their own port.
export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (req, res) => res.json({ ok: true }));
  app.use("/api", customerRoutes);
  app.use("/api", counterRoutes);
  app.use("/api", managerRoutes);
  app.use("/api", simRoutes);
  app.use("/api", analyticsRoutes);
  app.use("/api", assistRoutes);

  app.use("/api", (req, res) =>
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Unknown endpoint" } })
  );
  app.use(errorHandler);
  return app;
}