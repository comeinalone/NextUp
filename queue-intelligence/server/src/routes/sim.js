import { Router } from "express";
import { z } from "zod";
import { managerSnapshot } from "../core/managerSnapshot.js";
import * as sim from "../sim/simulator.js";

export const simRoutes = Router();

const startBody = z.object({ speed: z.number().min(1).max(120).optional() });
const floodBody = z.object({
  serviceId: z.number().int().positive(),
  count: z.number().int().min(1).max(100).optional(),
});

// Every route returns the full manager overview so the dashboard can update.
simRoutes.post("/sim/start", (req, res) => {
  const { speed } = startBody.parse(req.body ?? {});
  sim.startSim(speed ?? 5);
  res.json(managerSnapshot());
});

simRoutes.post("/sim/stop", (req, res) => {
  sim.stopSim();
  res.json(managerSnapshot());
});

simRoutes.post("/sim/flood", (req, res) => {
  const { serviceId, count } = floodBody.parse(req.body ?? {});
  sim.flood(serviceId, count ?? 10);
  res.json(managerSnapshot());
});

simRoutes.post("/sim/seed", (req, res) => {
  sim.reseed();
  res.json(managerSnapshot());
});

simRoutes.post("/sim/reset", (req, res) => {
  sim.resetAll();
  res.json(managerSnapshot());
});