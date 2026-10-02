import { Router } from "express";
import { z } from "zod";
import * as assist from "../core/assist.js";
import { refresh } from "../realtime/recompute.js";
import { emitAssist } from "../realtime/broadcaster.js";

export const assistRoutes = Router();

const idParam = z.coerce.number().int().positive();
const createBody = z.object({
  counterId: z.coerce.number().int().positive(),
  tokenCode: z.string().min(1).max(20).optional(),
  reason: z.enum(assist.REASONS),
  note: z.string().max(200).optional(),
});
const acceptBody = z.object({ counterId: z.coerce.number().int().positive() });

// Every request that is not resolved yet, oldest first (for the manager's list).
assistRoutes.get("/assist", (req, res) => {
  res.json(assist.listUnresolved());
});

// A counter asks for help.
assistRoutes.post("/assist", (req, res) => {
  const b = createBody.parse(req.body ?? {});
  const id = assist.createAssist(
    b.counterId,
    b.reason,
    b.note ?? null,
    b.tokenCode ? b.tokenCode.toUpperCase() : null
  );
  const snap = assist.assistSnapshot(id);
  refresh(); // the manager overview shows the new count
  emitAssist("assist:new", snap);
  res.status(201).json(snap);
});

// Another counter says "I'll help": { counterId } is the helper's counter.
assistRoutes.post("/assist/:id/accept", (req, res) => {
  const id = idParam.parse(req.params.id);
  const { counterId } = acceptBody.parse(req.body ?? {});
  assist.acceptAssist(id, counterId);
  const snap = assist.assistSnapshot(id);
  refresh();
  emitAssist("assist:update", snap);
  res.json(snap);
});

// The problem is sorted out.
assistRoutes.post("/assist/:id/resolve", (req, res) => {
  const id = idParam.parse(req.params.id);
  assist.resolveAssist(id);
  const snap = assist.assistSnapshot(id);
  refresh();
  emitAssist("assist:update", snap);
  res.json(snap);
});