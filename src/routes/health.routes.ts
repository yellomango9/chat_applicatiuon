import express from "express";
import healthController from "../controllers/health.controller";

const router = express.Router();

/**
 * Health check routes
 */
router.get("/health", healthController.healthCheck);
router.get("/file-check", healthController.fileCheck);
router.get("/time-check", healthController.timeCheck);

export default router;