import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middlewares";
import path from "path";
import fs from "fs";
import { Request, Response } from "express";
import { BadRequestError, NotFoundError, ApiError } from "../core/ApiError";
import { BadRequestResponse, NotFoundResponse } from "../core/ApiResponse";
import { uploadFile, getFileInfo, deleteFile } from "../controllers/fileUpload.controller";

const router = Router();

// File upload routes
router.post("/upload", verifyJWT, uploadFile);
router.get("/info/:filename", verifyJWT, getFileInfo);
router.delete("/:filename", verifyJWT, deleteFile);

// File download route with authentication
router.get("/download/*", verifyJWT, (req: Request, res: Response) => {
  try {
    // Get the file path from the URL
    const filePath = req.params[0]; // This captures everything after /download/
    
    if (!filePath) {
      throw new BadRequestError("No file path provided");
    }

    console.log(`📁 File download request: ${filePath}`);

    // Construct the full file path
    const fullPath = path.join(__dirname, "..", "..", "public", "uploads", filePath);
    const normalizedPath = path.normalize(fullPath);
    
    console.log(`📁 Looking for file at: ${normalizedPath}`);

    // Security check - ensure the file is within the uploads directory
    const uploadsDir = path.join(__dirname, "..", "..", "public", "uploads");
    if (!normalizedPath.startsWith(uploadsDir)) {
      throw new BadRequestError("Invalid file path");
    }

    // Check if file exists
    if (!fs.existsSync(normalizedPath)) {
      console.log(`❌ File not found: ${normalizedPath}`);
      
      // Try to find the file in subdirectories
      const fileName = path.basename(filePath);
      const possibleDirs = ['images', 'documents', 'videos', 'audio', 'other', 'files'];
      
      for (const dir of possibleDirs) {
        const possiblePath = path.join(uploadsDir, dir, fileName);
        if (fs.existsSync(possiblePath)) {
          console.log(`✅ File found in ${dir} directory: ${possiblePath}`);
          return res.sendFile(possiblePath);
        }
      }
      
      throw new NotFoundError("File not found");
    }

    // Get file stats for headers
    const stats = fs.statSync(normalizedPath);
    const fileName = path.basename(normalizedPath);
    
    // Set appropriate headers
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    
    // Set content type based on file extension
    const ext = path.extname(fileName).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.mp4': 'video/mp4',
      '.mp3': 'audio/mpeg',
      '.txt': 'text/plain',
      '.zip': 'application/zip',
    };
    
    if (mimeTypes[ext]) {
      res.setHeader('Content-Type', mimeTypes[ext]);
    }

    console.log(`✅ Serving file: ${fileName} (${stats.size} bytes)`);
    
    // Send the file
    res.sendFile(normalizedPath);
    
  } catch (error) {
    console.error(`❌ File download error:`, error);
    
    if (error instanceof BadRequestError) {
      return new BadRequestResponse(error.message).send(res);
    } else if (error instanceof NotFoundError) {
      return new NotFoundResponse(error.message).send(res);
    } else {
      return res.status(500).json({ error: "Internal server error" });
    }
  }
});

// File info route (check if file exists and get metadata)
router.get("/info/*", verifyJWT, (req: Request, res: Response) => {
  try {
    const filePath = req.params[0];
    
    if (!filePath) {
      throw new BadRequestError("No file path provided");
    }

    // Construct the full file path
    const fullPath = path.join(__dirname, "..", "..", "public", "uploads", filePath);
    const normalizedPath = path.normalize(fullPath);
    
    // Security check
    const uploadsDir = path.join(__dirname, "..", "..", "public", "uploads");
    if (!normalizedPath.startsWith(uploadsDir)) {
      throw new BadRequestError("Invalid file path");
    }

    let fileExists = false;
    let fileStats = null;
    let actualPath = normalizedPath;

    // Check if file exists
    if (fs.existsSync(normalizedPath)) {
      fileExists = true;
      fileStats = fs.statSync(normalizedPath);
    } else {
      // Try to find the file in subdirectories
      const fileName = path.basename(filePath);
      const possibleDirs = ['images', 'documents', 'videos', 'audio', 'other'];
      
      for (const dir of possibleDirs) {
        const possiblePath = path.join(uploadsDir, dir, fileName);
        if (fs.existsSync(possiblePath)) {
          fileExists = true;
          fileStats = fs.statSync(possiblePath);
          actualPath = possiblePath;
          break;
        }
      }
    }

    res.json({
      exists: fileExists,
      path: filePath,
      actualPath: fileExists ? path.relative(uploadsDir, actualPath) : null,
      size: fileStats ? fileStats.size : null,
      lastModified: fileStats ? fileStats.mtime : null,
      isFile: fileStats ? fileStats.isFile() : false,
    });
    
  } catch (error) {
    console.error(`❌ File info error:`, error);
    
    if (error instanceof BadRequestError) {
      return new BadRequestResponse(error.message).send(res);
    } else {
      return res.status(500).json({ error: "Internal server error" });
    }
  }
});

export default router;