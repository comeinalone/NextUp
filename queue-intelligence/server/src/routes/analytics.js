import { Router } from "express";
import { z } from "zod";
import { todayAnalytics, timeline } from "../core/analytics.js";

export const analyticsRoutes = Router();

const timelineQuery = z.object({
  minutes: z.coerce.number().int().min(10).max(720).optional(),
  step: z.coerce.number().int().min(1).max(60).optional(),
});

analyticsRoutes.get("/analytics/today", (req, res) => {
  res.json(todayAnalytics());
});

// Queue load over time for the chart. Defaults: last 120 minutes, every 5.
analyticsRoutes.get("/analytics/timeline", (req, res) => {
  const { minutes, step } = timelineQuery.parse(req.query);
  res.json(timeline(minutes ?? 120, step ?? 5));
});