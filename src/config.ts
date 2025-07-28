import dotenv from "dotenv";
import { SERVER_CONFIG, getServerUrl, getCorsUrls, DATABASE_CONFIG } from "./config/environment";
dotenv.config();

export const environment = process.env.NODE_ENV;
export const port = SERVER_CONFIG.port;
export const serverUrl = getServerUrl();

export const db = {
  name: DATABASE_CONFIG.name,
  url: DATABASE_CONFIG.url,
  minPoolSize: DATABASE_CONFIG.minPoolSize,
  maxPoolSize: DATABASE_CONFIG.maxPoolSize,
};

// Get CORS URLs from environment configuration
export const corsUrl = getCorsUrls();
console.log('CORS URLs:', corsUrl);

export const cookieValidity = process.env.COOKIE_VALIDITY_SEC || "0";

export const tokenInfo = {
  jwtSecretKey: process.env.JWT_SECRET_KEY || "",
  accessTokenValidity: parseInt(process.env.ACCESS_TOKEN_VALIDITY_SEC || "0"),
  refreshTokenValidity: parseInt(process.env.REFRESH_TOKEN_VALIDITY_SEC || "0"),
  issuer: process.env.TOKEN_ISSUER || "",
  audience: process.env.TOKEN_AUDIENCE || "",
};
