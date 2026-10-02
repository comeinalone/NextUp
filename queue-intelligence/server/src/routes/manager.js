import { Router } from "express";
import { z } from "zod";
import * as qs from "../core/queueService.js";
import { ServiceError } from "../core/errors.js";
import { managerSnapshot } from "../core/managerSnapshot.js";
import { computeRecommendation } from "../core/allocationEngine.js";
import { simulateQueue } from "../core/etaEngine.js";
import { refresh } from "../realtime/recompute.js";

export const managerRoutes = Router();

const round1 = (n) => (n === null || n === undefined ? null : Math.round(n * 10) / 10);
const idParam = z.coerce.number().int().positive();
const assignBody = z.object({ serviceId: z.number().int().positive() });
const applyBody = z.object({ id: z.string().min(1) });
const simulateQuery = z.object({
  service: z.coerce.number().int().positive(),
  counters: z.coerce.number().int().min(0).max(20),
});

managerRoutes.get("/manager/overview", (req, res) => {
  res.json(managerSnapshot());
});

// Move a counter to another service. If it is busy it finishes its current
// token first (state SWITCHING), then moves by itself.
managerRoutes.post("/counters/:id/assign", (req, res) => {
  const id = idParam.parse(req.params.id);
  const { serviceId } = assignBody.parse(req.body ?? {});
  const before = qs.getCounter(id).service_id;

  qs.assignCounter(id, serviceId);

  // Both services change: one loses a counter, the other gains one.
  refresh({ services: [before, serviceId], counters: [id] });
  res.json(managerSnapshot());
});

// The current recommendation, or null when there is nothing worth doing.
managerRoutes.get("/manager/recommendation", (req, res) => {
  res.json(computeRecommendation());
});

// Apply the recommendation the manager is looking at. It is re-checked first:
// if the situation changed since they saw it, nothing is moved.
managerRoutes.post("/manager/recommendation/apply", (req, res) => {
  const { id } = applyBody.parse(req.body ?? {});
  const rec = computeRecommendation();
  if (!rec || rec.id !== id) {
    throw new ServiceError("RECOMMENDATION_STALE", "That recommendation is no longer valid", 409);
  }

  const before = qs.getCounter(rec.counterId).service_id;
  qs.assignCounter(rec.counterId, rec.toServiceId);
  refresh({ services: [before, rec.toServiceId], counters: [rec.counterId] });
  res.json(managerSnapshot());
});

// What-if: how would this service look with N counters?
managerRoutes.get("/manager/simulate", (req, res) => {
  const { service, counters } = simulateQuery.parse(req.query);
  const sim = simulateQueue(service, { counters });
  res.json({
    serviceId: service,
    counters: sim.counters,
    etaMin: round1(sim.etaMin),
    customerMinutes: round1(sim.customerMinutes),
  });
});