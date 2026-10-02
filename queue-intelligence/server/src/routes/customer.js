import { Router } from "express";
import { z } from "zod";
import { db } from "../db/db.js";
import * as qs from "../core/queueService.js";
import { tokenSnapshot, allServiceSnapshots } from "../core/snapshots.js";
import { refresh } from "../realtime/recompute.js";

export const customerRoutes = Router();

const createBody = z.object({
  serviceId: z.number().int().positive(),
  isPriority: z.boolean().optional(),
});

// Service cards: live status plus the documents the customer should bring.
customerRoutes.get("/services", (req, res) => {
  const docs = db
    .prepare(
      "SELECT service_id, label FROM checklist_items WHERE customer_facing = 1 ORDER BY position"
    )
    .all();
  res.json(
    allServiceSnapshots().map((s) => ({
      ...s,
      requiredDocuments: docs.filter((d) => d.service_id === s.serviceId).map((d) => d.label),
    }))
  );
});

// Get a token.
customerRoutes.post("/tokens", (req, res) => {
  const { serviceId, isPriority } = createBody.parse(req.body ?? {});
  const token = qs.createToken(serviceId, isPriority ?? false);
  refresh({ services: [serviceId] });
  res.status(201).json(tokenSnapshot(token.code));
});

// A token's current status.
customerRoutes.get("/tokens/:code", (req, res) => {
  res.json(tokenSnapshot(req.params.code.toUpperCase()));
});

// Leave the queue.
customerRoutes.post("/tokens/:code/cancel", (req, res) => {
  const code = req.params.code.toUpperCase();
  const before = qs.getTokenByCode(code);
  const calledAt = before.state === "CALLED" ? before.counter_id : null;

  qs.cancelToken(code);

  // If the token had been called, that counter is free again and may have
  // just finished a pending switch to another service.
  const services = new Set([before.service_id]);
  if (calledAt) services.add(qs.getCounter(calledAt).service_id);

  refresh({
    services: [...services],
    counters: calledAt ? [calledAt] : [],
    tokens: [code], // a cancelled token is no longer live, so name it
  });
  res.json(tokenSnapshot(code));
});