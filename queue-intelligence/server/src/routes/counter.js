import { Router } from "express";
import { z } from "zod";
import * as qs from "../core/queueService.js";
import { ServiceError } from "../core/errors.js";
import { counterSnapshot } from "../core/snapshots.js";
import { refresh } from "../realtime/recompute.js";

export const counterRoutes = Router();

const idParam = z.coerce.number().int().positive();
const reasonBody = z.object({ reason: z.string().max(200).optional() });
const stateBody = z.object({
  state: z.enum(["OPEN", "BREAK", "CLOSED"]),
  reason: z.string().max(200).optional(),
});
const checkBody = z.object({ done: z.boolean() });

// After an action: refresh the service the counter was in AND the one it is in
// now (a finished token can complete a pending switch), plus any token codes
// that just left the live queue.
function push(counterId, serviceBefore, codes = []) {
  const serviceNow = qs.getCounter(counterId).service_id;
  refresh({
    services: [...new Set([serviceBefore, serviceNow])],
    counters: [counterId],
    tokens: codes,
  });
}

counterRoutes.get("/counters/:id", (req, res) => {
  res.json(counterSnapshot(idParam.parse(req.params.id)));
});

counterRoutes.post("/counters/:id/call-next", (req, res) => {
  const id = idParam.parse(req.params.id);
  const before = qs.getCounter(id).service_id;
  const token = qs.callNext(id);
  push(id, before, [token.code]);
  res.json(counterSnapshot(id));
});

counterRoutes.post("/counters/:id/start", (req, res) => {
  const id = idParam.parse(req.params.id);
  const before = qs.getCounter(id).service_id;
  const token = qs.startService(id);
  push(id, before, [token.code]);
  res.json(counterSnapshot(id));
});

counterRoutes.post("/counters/:id/complete", (req, res) => {
  const id = idParam.parse(req.params.id);
  const before = qs.getCounter(id).service_id;
  const active = qs.activeToken(id);
  qs.completeService(id);
  push(id, before, [active.code]);
  res.json(counterSnapshot(id));
});

counterRoutes.post("/counters/:id/skip", (req, res) => {
  const id = idParam.parse(req.params.id);
  const { reason } = reasonBody.parse(req.body ?? {});
  const before = qs.getCounter(id).service_id;
  const active = qs.activeToken(id);
  qs.skipToken(id, reason ?? null);
  push(id, before, [active.code]);
  res.json(counterSnapshot(id));
});

counterRoutes.post("/counters/:id/hold", (req, res) => {
  const id = idParam.parse(req.params.id);
  const { reason } = reasonBody.parse(req.body ?? {});
  const before = qs.getCounter(id).service_id;
  const active = qs.activeToken(id);
  qs.holdToken(id, reason ?? null);
  push(id, before, [active.code]);
  res.json(counterSnapshot(id));
});

counterRoutes.post("/counters/:id/recall/:tokenId", (req, res) => {
  const id = idParam.parse(req.params.id);
  const tokenId = idParam.parse(req.params.tokenId);
  const before = qs.getCounter(id).service_id;
  const token = qs.recallToken(id, tokenId);
  push(id, before, [token.code]);
  res.json(counterSnapshot(id));
});

// Open, break or close a counter. Waiting customers see the delay notice.
counterRoutes.post("/counters/:id/state", (req, res) => {
  const id = idParam.parse(req.params.id);
  const { state, reason } = stateBody.parse(req.body ?? {});
  const before = qs.getCounter(id).service_id;
  qs.setCounterState(id, state, reason ?? null);
  push(id, before);
  res.json(counterSnapshot(id));
});

// Tick or untick a checklist item on the token at a counter.
counterRoutes.post("/tokens/:id/checklist/:itemId", (req, res) => {
  const tokenId = idParam.parse(req.params.id);
  const itemId = idParam.parse(req.params.itemId);
  const { done } = checkBody.parse(req.body ?? {});

  const token = qs.getTokenById(tokenId);
  if (!token) throw new ServiceError("TOKEN_NOT_FOUND", "Token not found", 404);
  if (!["CALLED", "SERVING"].includes(token.state)) {
    throw new ServiceError("NOT_AT_COUNTER", "Only a token at a counter has a working checklist", 409);
  }

  qs.setChecklistItem(tokenId, itemId, done);
  refresh({ counters: [token.counter_id] });
  res.json(counterSnapshot(token.counter_id));
});