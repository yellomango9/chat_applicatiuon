import User from "../database/model/User";
import _ from "lodash";
import fs from "fs";
import colorsUtils from "./colorsUtils";
import { serverUrl } from "../config";

export async function filterUserData(user: User) {
  const data = _.pick(user, ["_id", "username", "roles", "avatarUrl", "bio", "statusMessage", "lastSeen"]);
  return data;
}

export const getStaticFilePath = (fileName: string): string => {
  // Handle null or undefined filenames
  if (!fileName) {
    console.error("getStaticFilePath called with null or undefined filename");
    return `${serverUrl}/uploads/other/file-not-found`;
  }
  
  // Log the incoming filename for debugging
  console.log(`getStaticFilePath called with: ${fileName}`);
  
  // Clean up any double slashes in the path
  const cleanFileName = fileName.replace(/\/\//g, '/');
  
  // Extract file type from the path if it exists
  const filePathParts = cleanFileName.split('/');
  const fileType = filePathParts.length > 1 ? filePathParts[0] : getFileTypeFromName(cleanFileName);
  
  // If the filename already includes a path, use it directly
  if (cleanFileName.includes('/')) {
    // Make sure we don't have public/ in the URL
    const path = cleanFileName.replace(/^public\//, '');
    const url = `${serverUrl}/uploads/${path}`;
    console.log(`Generated URL (with path): ${url}`);
    return url;
  }
  
  // Generate URL with file type directory
  const url = `${serverUrl}/uploads/${fileType}/${cleanFileName}`;
  console.log(`Generated URL (with type): ${url}`);
  return url;
};

export const getLocalFilePath = (fileName: string): string => {
  // Handle null or undefined filenames
  if (!fileName) {
    console.error("getLocalFilePath called with null or undefined filename");
    return `public/uploads/other/file-not-found`;
  }
  
  // Log the incoming filename for debugging
  console.log(`getLocalFilePath called with: ${fileName}`);
  
  // Clean up any double slashes in the path
  const cleanFileName = fileName.replace(/\/\//g, '/');
  
  // Extract file type from the path if it exists
  const filePathParts = cleanFileName.split('/');
  const fileType = filePathParts.length > 1 ? filePathParts[0] : getFileTypeFromName(cleanFileName);
  
  // If the filename already includes a path, use it directly
  if (cleanFileName.includes('/')) {
    // Make sure we don't have public/ in the path twice
    const path = cleanFileName.replace(/^public\//, '');
    const localPath = `public/uploads/${path}`;
    console.log(`Generated local path (with path): ${localPath}`);
    return localPath;
  }
  
  // Generate local path with file type directory
  const localPath = `public/uploads/${fileType}/${cleanFileName}`;
  console.log(`Generated local path (with type): ${localPath}`);
  return localPath;
};

// Helper function to determine file type based on file extension
function getFileTypeFromName(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();
  
  if (!extension) return 'other';
  
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
  const videoExtensions = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'];
  const audioExtensions = ['mp3', 'wav', 'ogg', 'aac', 'flac'];
  const documentExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv'];
  
  if (imageExtensions.includes(extension)) return 'images';
  if (videoExtensions.includes(extension)) return 'videos';
  if (audioExtensions.includes(extension)) return 'audio';
  if (documentExtensions.includes(extension)) return 'documents';
  
  return 'other';
};

// function to remove the local attachment files from the server
export const removeLocalFile = (path: string) => {
  fs.unlink(path, (err) => {
    if (err) colorsUtils.log("error", "failed to remove file - path : " + path);
    colorsUtils.log("success", "file removed path: " + path);
  });
};
