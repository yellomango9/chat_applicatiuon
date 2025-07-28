import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { corsUrl, environment } from "./config";
import userRoutes from "./routes/user.routes";
import authRoutes from "./routes/auth.routes";
import chatRoutes from "./routes/chat.routes";
import messageRoutes from "./routes/message.routes";
import healthRoutes from "./routes/health.routes";
import testRoutes from "./routes/test.routes";
import fileRoutes from "./routes/file.routes";
import fileMetadataRoutes from "./routes/fileMetadata.routes";

import "./database"; // initialize database
import {
  ApiError,
  ErrorType,
  InternalError,
  RateLimitError,
} from "./core/ApiError";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { createServer, Server as HttpServer } from "http";
import { Server as SocketServer } from "socket.io";
import { initSocketIo, emitSocketEvent } from "./socket";
import path from "path";
import fs from "fs";
import { RateLimitRequestHandler, rateLimit } from "express-rate-limit";
import requestIp from "request-ip";

// Set timezone to UTC (consistent across all environments)
process.env.TZ = "UTC";

const app = express();

// creation of http server
const httpServer = createServer(app);

// CORS configuration helper
const corsOriginHandler = (
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void
) => {
  // Allow requests with no origin (like mobile apps or curl requests)
  if (!origin) return callback(null, true);

  // Allow specific origins and any localhost port for development
  const allowedOrigins = [
    "http://10.1.0.211:5173",
    "http://10.1.0.211:8080",
    "http://10.1.0.211:3000",
    "http://localhost:5173",
    "http://localhost:8080",
    "http://localhost:3000",
    "http://localhost:3000", // Flutter web dev server
    "http://127.0.0.1:8080",
    "http://127.0.0.1:3000",
  ];

  // Allow any localhost port for Flutter web development
  const isLocalhost = origin.match(/^http:\/\/localhost:\d+$/);

  // Allow any private network IP addresses (LAN access)
  const isPrivateNetwork = origin.match(
    /^http:\/\/(10\.\d+\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+):\d+$/
  );

  if (allowedOrigins.includes(origin) || isLocalhost || isPrivateNetwork) {
    return callback(null, true);
  }

  return callback(new Error("Not allowed by CORS"));
};

// Apply CORS middleware first, before any other middleware
// This ensures CORS headers are set for all responses, including error responses
app.use(
  cors({
    origin: corsOriginHandler,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

// Handle OPTIONS requests explicitly for preflight
app.options(
  "*",
  cors({
    origin: corsOriginHandler,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

// middleware to get the ip of client from the request
app.use(requestIp.mw());

// Adding a rate limiter to the server
const limiter: RateLimitRequestHandler = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000, // Increased limit to 1000 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request, _: Response): string => {
    return requestIp.getClientIp(req) || ""; // Return the IP address of the client
  },
  handler: (req: Request, res: Response, next: NextFunction, options) => {
    next(
      new RateLimitError(
        `You exceeded the request limit. Allowed ${options.max} requests per ${
          options.windowMs / 60000
        } minute.`
      )
    );
  },
});

// Apply the rate limiter to all routes
app.use(limiter);

// express app middlewares
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(morgan("dev"));
app.use(cookieParser());

// HEALTH CHECK ROUTE
app.get("/health", (req, res) => {
  res.send("healthy running");
});

// Special route for handling missing avatar files
app.get(
  "/uploads/avatars/:filename",
  (req: Request, res: Response, next: NextFunction) => {
    const filename = req.params.filename;
    const avatarPath = path.join(
      __dirname,
      "..",
      "public",
      "uploads",
      "avatars",
      filename
    );

    console.log(`Avatar request for: ${filename}`);
    console.log(`Looking at path: ${avatarPath}`);

    if (fs.existsSync(avatarPath)) {
      console.log(`Avatar found, serving: ${avatarPath}`);
      // Set proper caching headers for avatars
      res.setHeader("Cache-Control", "public, max-age=3600"); // Cache for 1 hour
      res.setHeader(
        "ETag",
        require("crypto").createHash("md5").update(filename).digest("hex")
      );

      // If it's the default avatar (which contains an SVG data URL), serve it properly
      if (filename === "default-avatar.txt") {
        const content = fs.readFileSync(avatarPath, "utf8");
        if (content.startsWith("data:image/svg+xml;base64,")) {
          const base64Data = content.replace("data:image/svg+xml;base64,", "");
          const svgData = Buffer.from(base64Data, "base64");
          res.setHeader("Content-Type", "image/svg+xml");
          return res.send(svgData);
        }
      }

      return res.sendFile(avatarPath);
    } else {
      console.log(`Avatar not found, serving default`);
      const defaultAvatarPath = path.join(
        __dirname,
        "..",
        "public",
        "uploads",
        "avatars",
        "default-avatar.txt"
      );

      if (fs.existsSync(defaultAvatarPath)) {
        // Set proper caching headers for the default avatar
        res.setHeader("Cache-Control", "public, max-age=86400"); // Cache default avatar for 24 hours
        res.setHeader("ETag", "default-avatar");
        res.header("Access-Control-Allow-Origin", req.headers.origin || ""); // Dynamic origin
        res.header("Access-Control-Allow-Credentials", "true");

        // Handle default avatar SVG data URL
        const content = fs.readFileSync(defaultAvatarPath, "utf8");
        if (content.startsWith("data:image/svg+xml;base64,")) {
          const base64Data = content.replace("data:image/svg+xml;base64,", "");
          const svgData = Buffer.from(base64Data, "base64");
          res.setHeader("Content-Type", "image/svg+xml");
          return res.send(svgData);
        }

        return res.sendFile(defaultAvatarPath);
      } else {
        console.log(`Default avatar not found either`);
        next(); // Continue to 404 handler
      }
    }
  }
);

// FILE DIAGNOSTIC ROUTE
app.get("/file-check", (req: Request, res: Response) => {
  const filePath = req.query.path;

  if (!filePath || typeof filePath !== "string") {
    return res.status(400).json({
      error: "Missing or invalid file path parameter",
      usage: "/file-check?path=/uploads/documents/example.pdf",
    });
  }

  // Clean up the path
  const cleanPath = filePath.replace(/^\/+/, ""); // Remove leading slashes

  // Check different possible locations
  const possiblePaths = [
    path.join(__dirname, "..", "public", cleanPath),
    path.join(__dirname, "..", cleanPath),
    path.join(__dirname, "..", "public", "uploads", cleanPath),
  ];

  const results = possiblePaths.map((p) => ({
    path: p,
    exists: fs.existsSync(p),
    isFile: fs.existsSync(p) ? fs.statSync(p).isFile() : false,
    size:
      fs.existsSync(p) && fs.statSync(p).isFile() ? fs.statSync(p).size : null,
  }));

  // List files in the directory if the path doesn't exist
  let nearbyFiles: string[] = [];
  try {
    const dirPath = path.dirname(possiblePaths[0]);
    if (fs.existsSync(dirPath)) {
      nearbyFiles = fs.readdirSync(dirPath).slice(0, 10); // List up to 10 files
    }
  } catch (err) {
    console.error("Error listing directory:", err);
  }

  res.json({
    requestedPath: filePath,
    cleanPath,
    results,
    nearbyFiles,
    serverUrl: require("./config").serverUrl,
  });
});

// Routes
app.use("/auth", authRoutes); // Add auth routes at /auth path
app.use("/api/users", userRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/chat", chatRoutes); // Alternative route for client compatibility
app.use("/api/messages", messageRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/file-metadata", fileMetadataRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/test", testRoutes);

// Create static routes to serve uploaded files
// Serve files from the public directory at multiple paths for compatibility
app.use("/public", express.static(path.join(__dirname, "..", "public")));
app.use("/", express.static(path.join(__dirname, "..", "public")));

// Explicitly serve the uploads directory to ensure files are accessible
app.use(
  "/uploads",
  express.static(path.join(__dirname, "..", "public", "uploads"), {
    setHeaders: (res, path) => {
      // Set Cache-Control header to prevent caching issues
      res.setHeader("Cache-Control", "no-cache");
      // Log when a file is successfully served
      console.log(`Serving file: ${path}`);
    },
  })
);

// Serve client assets directly for development
app.use(
  "/assets",
  express.static(path.join(__dirname, "..", "..", "client", "src", "assets"))
);

// Add a route to check if files exist and log access attempts for debugging
app.use("/uploads/*", (req: Request, res: Response, next: NextFunction) => {
  // Clean up the path to remove any leading slashes
  const cleanPath = req.path.replace(/^\/+/, "");

  // Try multiple possible file paths
  const possiblePaths = [
    path.join(__dirname, "..", "public", cleanPath),
    path.join(__dirname, "..", "public", "uploads", path.basename(cleanPath)),
    path.join(__dirname, "..", "public", req.path),
  ];

  console.log(`File access attempt: ${req.path}`);
  console.log(`Clean path: ${cleanPath}`);

  // Check all possible paths
  let fileExists = false;
  let foundPath = "";

  for (const testPath of possiblePaths) {
    console.log(`Checking path: ${testPath}`);
    if (fs.existsSync(testPath)) {
      fileExists = true;
      foundPath = testPath;
      console.log(`File found at: ${testPath}`);
      break;
    }
  }

  if (!fileExists) {
    console.error(`File not found in any location. Tried:`);
    possiblePaths.forEach((p) => console.error(`- ${p}`));

    // List files in the avatars directory for debugging
    const avatarsDir = path.join(
      __dirname,
      "..",
      "public",
      "uploads",
      "avatars"
    );
    if (fs.existsSync(avatarsDir)) {
      console.log(`Files in avatars directory:`);
      fs.readdirSync(avatarsDir).forEach((file) => {
        console.log(`- ${file}`);
      });
    }

    // If the file is not found, we'll still call next() to let Express handle the 404
  } else {
    // If we found the file, we can optionally serve it directly
    // This is just for debugging - the static middleware should handle this normally
    // res.sendFile(foundPath);
    // return;
  }

  next();
});

// Log the static file paths for debugging
console.log("Static file paths:");
console.log("Public directory:", path.join(__dirname, "..", "public"));
console.log(
  "Uploads directory:",
  path.join(__dirname, "..", "public", "uploads")
);

// Create directories if they don't exist
const publicDir = path.join(__dirname, "..", "public");
const uploadsDir = path.join(publicDir, "uploads");
const dirs = [
  uploadsDir,
  path.join(uploadsDir, "images"),
  path.join(uploadsDir, "videos"),
  path.join(uploadsDir, "documents"),
  path.join(uploadsDir, "audio"),
  path.join(uploadsDir, "other"),
  path.join(uploadsDir, "avatars"),
];

// Ensure all directories exist
dirs.forEach((dir) => {
  if (!require("fs").existsSync(dir)) {
    require("fs").mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

// creating a socket server
const io = new SocketServer(httpServer, {
  pingTimeout: 60000,
  pingInterval: 25000,
  cors: {
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void
    ) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      // Allow specific origins for LAN and localhost development
      const allowedOrigins = [
        "http://10.1.0.211:5173",
        "http://10.1.0.211:8080",
        "http://10.1.0.211:3000",
        "http://localhost:5173",
        "http://localhost:8080",
        "http://localhost:3000",
      ];

      // Allow any localhost port for Flutter web development
      const isLocalhost = origin.match(/^http:\/\/localhost:\d+$/);

      // Allow any private network IP addresses (LAN access)
      const isPrivateNetwork = origin.match(
        /^http:\/\/(10\.\d+\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+):\d+$/
      );

      if (allowedOrigins.includes(origin) || isLocalhost || isPrivateNetwork) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  },
  allowEIO3: true,
  path: "/socket.io",
  transports: ["polling", "websocket"],
  connectTimeout: 45000,
  maxHttpBufferSize: 1e8,
});

// initialize the socket server
initSocketIo(io);

app.set("io", io); // using set method to mount 'io' instance on app

// middleware error handlers
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  // Ensure CORS headers are set for error responses with dynamic origin
  const origin = req.headers.origin;
  if (origin) {
    const allowedOrigins = ["http://10.1.0.211:5173", "http://localhost:5173"];

    // Allow any localhost port for Flutter web development
    const isLocalhost = origin.match(/^http:\/\/localhost:\d+$/);

    if (allowedOrigins.includes(origin) || isLocalhost) {
      res.header("Access-Control-Allow-Origin", origin);
    }
  }
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With"
  );

  if (err instanceof ApiError) {
    ApiError.handle(err, res);
    if (err.type === ErrorType.INTERNAL)
      console.error(
        `500 - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}` +
          "\n" +
          `Error Stack: ${err.stack}`
      );
  } else {
    console.error(
      `500 - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}` +
        "\n" +
        `Error Stack: ${err.stack}`
    );
    if (environment === "development") {
      return res.status(500).send(err.stack);
    }
    ApiError.handle(new InternalError(), res);
  }
});

export default httpServer;
