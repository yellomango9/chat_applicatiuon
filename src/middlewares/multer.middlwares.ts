import multer from "multer";
import path from "path";
import fs from "fs";

// Create base directory for uploads
const uploadDir = path.join(__dirname, "..", "..", "public", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log(`Created upload directory: ${uploadDir}`);
}

// Create subdirectories for different file types
const imageDir = path.join(uploadDir, "images");
const videoDir = path.join(uploadDir, "videos");
const documentDir = path.join(uploadDir, "documents");
const audioDir = path.join(uploadDir, "audio");
const otherDir = path.join(uploadDir, "other");
const avatarDir = path.join(uploadDir, "avatars");

// Ensure all directories exist
[imageDir, videoDir, documentDir, audioDir, otherDir, avatarDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

// Log the upload directories for debugging
console.log("Upload directories:");
console.log("Base upload directory:", uploadDir);
console.log("Images directory:", imageDir);
console.log("Documents directory:", documentDir);

// Determine file type based on mimetype
const getFileType = (mimetype: string): string => {
  if (mimetype.startsWith('image/')) return 'images';
  if (mimetype.startsWith('video/')) return 'videos';
  if (mimetype.startsWith('audio/')) return 'audio';
  if (mimetype === 'application/pdf' || 
      mimetype.includes('document') || 
      mimetype.includes('text/') ||
      mimetype.includes('application/vnd.')) {
    return 'documents';
  }
  return 'other';
};

// Setup multer storage for storing the files
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const fileType = getFileType(file.mimetype);
    const destinationPath = path.join(uploadDir, fileType);
    
    console.log(`File upload request received: ${file.originalname} (${file.mimetype})`);
    console.log(`Determined file type: ${fileType}`);
    console.log(`Destination path: ${destinationPath}`);
    
    // Ensure the destination directory exists
    if (!fs.existsSync(destinationPath)) {
      fs.mkdirSync(destinationPath, { recursive: true });
      console.log(`Created missing directory: ${destinationPath}`);
    }
    
    cb(null, destinationPath);
  },

  // Store the files with original name + timestamp to avoid conflicts
  filename: function (req, file, cb) {
    // Get file extension
    let fileExtension = "";
    if (file.originalname.split(".").length > 1) {
      fileExtension = file.originalname.substring(
        file.originalname.lastIndexOf(".")
      );
    }

    // Clean the original filename (remove spaces, special chars)
    const filenameWithoutExtension = file.originalname
      .split(" ")
      .join("-")
      .split(".")
      .slice(0, -1)
      .join(".")
      .replace(/[^a-zA-Z0-9-_]/g, "");

    // Create unique filename with original name
    const finalFilename = filenameWithoutExtension +
      "-" +
      Date.now() +
      "-" +
      Math.ceil(Math.random() * 1e3) +
      fileExtension;
      
    console.log(`Generated filename: ${finalFilename}`);
    
    cb(null, finalFilename);
  },
});

export const upload = multer({
  storage,
  limits: {
    fileSize: Infinity, // 50GB limit
  },
});
