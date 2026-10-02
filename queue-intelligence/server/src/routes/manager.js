import { Router } from "express";
import { managerSnapshot } from "../core/managerSnapshot.js";

export const managerRoutes = Router();

managerRoutes.get("/manager/overview", (req, res) => {
  res.json(managerSnapshot());
});