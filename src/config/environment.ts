import dotenv from "dotenv";
dotenv.config();

// Server Configuration - Change this IP to switch environments
export const SERVER_CONFIG = {
  ip: process.env.SERVER_IP || "10.1.0.211",
  port: process.env.PORT || "5000",
  useHttps: process.env.USE_HTTPS === "true",
};

// Computed URLs
export const getServerUrl = () => {
  const protocol = SERVER_CONFIG.useHttps ? "https" : "http";
  return `${protocol}://${SERVER_CONFIG.ip}:${SERVER_CONFIG.port}`;
};

export const getCorsUrls = () => {
  const serverUrl = getServerUrl();
  const defaultUrls = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:8080",
    `${serverUrl}`,
    `http://${SERVER_CONFIG.ip}:5173`,
    `http://${SERVER_CONFIG.ip}:3000`,
    `http://${SERVER_CONFIG.ip}:8080`,
  ];

  const envUrls = process.env.CORS_URL?.split(",") || [];
  return [...new Set([...defaultUrls, ...envUrls])];
};

// Database Configuration
export const DATABASE_CONFIG = {
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || "27017",
  name: process.env.DB_NAME || "lan_chat",
  url:
    process.env.DB_URL ||
    `mongodb://${process.env.DB_HOST || "localhost"}:${
      process.env.DB_PORT || "27017"
    }`,
  minPoolSize: parseInt(process.env.DB_MIN_POOL_SIZE || "2"),
  maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE || "5"),
};

// File Upload Configuration
export const FILE_CONFIG = {
  maxSize: parseInt(process.env.MAX_FILE_SIZE || "52428800"), // 50MB default
  uploadPath: process.env.UPLOAD_PATH || "./public/uploads",
  allowedImageTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
  allowedVideoTypes: ["video/mp4", "video/avi", "video/mov", "video/wmv"],
  allowedDocumentTypes: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
  ],
};

// Development Configuration
export const DEV_CONFIG = {
  isDevelopment: process.env.NODE_ENV === "development",
  enableLogging: process.env.ENABLE_LOGGING !== "false",
  enableDebug: process.env.ENABLE_DEBUG === "true",
};
