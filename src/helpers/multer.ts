import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { BadRequestError } from '../core/ApiError';

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, '../../public/uploads');
const avatarDir = path.join(uploadDir, 'avatars');

// Ensure directories exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

if (!fs.existsSync(avatarDir)) {
  fs.mkdirSync(avatarDir, { recursive: true });
}

// Log the directories for debugging
console.log('Upload directory:', uploadDir);
console.log('Avatar directory:', avatarDir);

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Store avatars in a dedicated directory
    if (file.fieldname === 'avatar') {
      cb(null, avatarDir);
    } else {
      cb(null, uploadDir);
    }
  },
  filename: function (req, file, cb) {
    // Clean the original filename (remove spaces, special chars)
    const originalName = file.originalname
      .split(" ")
      .join("-")
      .replace(/[^a-zA-Z0-9-_.]/g, "");
    
    // Generate a unique filename with original name, timestamp and original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(originalName);
    const nameWithoutExt = path.basename(originalName, ext);
    
    // Format: originalname-timestamp-random.ext
    cb(null, `${nameWithoutExt}-${uniqueSuffix}${ext}`);
  }
});

// File filter to only allow certain file types
const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Accept images only
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new BadRequestError('Only image files are allowed!'));
  }
};

// Create multer instance with configuration
export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  }
});

// Helper function to get the URL for an uploaded file
export const getFileUrl = (filename: string, type: 'avatar' | 'attachment' = 'attachment'): string => {
  // For LAN/offline environment, use a relative URL instead of an absolute URL
  // This ensures the URL will work regardless of the server's hostname or IP
  const pathSegment = type === 'avatar' ? 'avatars' : '';
  
  // Return a relative URL without a timestamp to avoid caching issues
  // Note: Files in the public directory are served at the root path, so we remove the '/public' prefix
  return `/uploads/${pathSegment}/${filename}`;
};

// Helper function to get the local file path
export const getLocalFilePath = (filename: string, type: 'avatar' | 'attachment' = 'attachment'): string => {
  const dir = type === 'avatar' ? avatarDir : uploadDir;
  return path.join(dir, filename);
};