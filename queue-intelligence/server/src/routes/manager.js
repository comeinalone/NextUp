import { Router } from "express";
import { z } from "zod";
import * as qs from "../core/queueService.js";
import { managerSnapshot } from "../core/managerSnapshot.js";
import { refresh } from "../realtime/recompute.js";

export const managerRoutes = Router();

const idParam = z.coerce.number().int().positive();
const assignBody = z.object({ serviceId: z.number().int().positive() });

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