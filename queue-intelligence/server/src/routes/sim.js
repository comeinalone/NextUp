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
const botsBody = z.object({ counterIds: z.array(z.number().int().positive()).max(20) });
const arrivalsBody = z.object({ perMin: z.number().min(0).max(30) });

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

// Which counters are operated automatically: { counterIds: [1, 2] }, [] for none.
simRoutes.post("/sim/bots", (req, res) => {
  const { counterIds } = botsBody.parse(req.body ?? {});
  sim.setBotCounters(counterIds);
  res.json(managerSnapshot());
});

// Customers per simulated minute arriving on their own: { perMin: 4 }, 0 for off.
simRoutes.post("/sim/arrivals", (req, res) => {
  const { perMin } = arrivalsBody.parse(req.body ?? {});
  sim.setArrivals(perMin);
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