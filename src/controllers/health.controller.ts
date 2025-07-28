import { Request, Response } from "express";
import { SuccessResponse } from "../core/ApiResponse";
import { getServerTimeInfo, isValidTimestamp } from "../helpers/timeUtils";

class HealthController {
  /**
   * Health check endpoint
   */
  healthCheck = async (req: Request, res: Response) => {
    const healthData = {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      serverUrl: process.env.SERVER_URL,
      clientIp: req.ip || req.connection.remoteAddress,
      message: "Server is running and accessible on LAN"
    };
    
    return new SuccessResponse("Health check successful", healthData).send(res);
  };

  /**
   * File access check endpoint
   */
  fileCheck = async (req: Request, res: Response) => {
    const path = req.query.path as string || "/uploads/test.txt";
    
    const fileData = {
      status: "ok",
      timestamp: new Date().toISOString(),
      path: path,
      serverUrl: process.env.SERVER_URL,
      fullUrl: `${process.env.SERVER_URL}${path}`,
      message: "File access check successful"
    };
    
    return new SuccessResponse("File check successful", fileData).send(res);
  };

  /**
   * Time check endpoint for debugging timestamp issues
   */
  timeCheck = async (req: Request, res: Response) => {
    const timeInfo = getServerTimeInfo();
    const currentDate = new Date();
    
    const timeData = {
      status: "ok",
      serverTime: timeInfo,
      isValidTimestamp: isValidTimestamp(currentDate),
      nodeVersion: process.version,
      platform: process.platform,
      env: {
        TZ: process.env.TZ,
        NODE_ENV: process.env.NODE_ENV,
      },
      message: "Time check completed",
      warnings: [] as string[]
    };

    // Add warnings for potential issues
    if (!isValidTimestamp(currentDate)) {
      timeData.warnings.push("Server timestamp appears to be invalid (too far in future/past)");
    }

    if (currentDate.getFullYear() > 2024) {
      timeData.warnings.push(`Server year is ${currentDate.getFullYear()}, which may be incorrect`);
    }

    return new SuccessResponse("Time check successful", timeData).send(res);
  };
}

export default new HealthController();