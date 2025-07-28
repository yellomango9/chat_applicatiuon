import express from 'express';
import { FileMetadataController } from '../controllers/fileMetadata.controller';
import { verifyJWT } from '../middlewares/auth.middlewares';
import { validate } from '../validators/validate';
import { body, param, query } from 'express-validator';

const router = express.Router();

// Apply authentication to all routes
router.use(verifyJWT);

// Validation schemas
const fileIdValidation = [
  param('fileId').isMongoId().withMessage('Invalid file ID format'),
];

const messageIdValidation = [
  param('messageId').isMongoId().withMessage('Invalid message ID format'),
];

const chatIdValidation = [
  param('chatId').isMongoId().withMessage('Invalid chat ID format'),
];

const userIdValidation = [
  param('userId').isMongoId().withMessage('Invalid user ID format'),
];

const paginationValidation = [
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('skip').optional().isInt({ min: 0 }).withMessage('Skip must be a non-negative integer'),
];

const myFilesValidation = [
  ...paginationValidation,
  query('showAll').optional().isIn(['true', 'false']).withMessage('showAll must be either "true" or "false"'),
];

const updateFileValidation = [
  body('originalName').optional().isString().trim().isLength({ min: 1 }).withMessage('Original name must be a non-empty string'),
  body('thumbnailUrl').optional().isURL().withMessage('Thumbnail URL must be a valid URL'),
  body('duration').optional().isInt({ min: 0 }).withMessage('Duration must be a non-negative integer'),
  body('dimensions.width').optional().isInt({ min: 0 }).withMessage('Width must be a non-negative integer'),
  body('dimensions.height').optional().isInt({ min: 0 }).withMessage('Height must be a non-negative integer'),
];

const searchValidation = [
  query('searchTerm').optional().isString().trim().isLength({ min: 1 }).withMessage('Search term must be a non-empty string'),
  query('fileType').optional().isString().trim().withMessage('File type must be a string'),
  query('chatId').optional().isMongoId().withMessage('Invalid chat ID format'),
  query('uploadedBy').optional().isMongoId().withMessage('Invalid user ID format'),
  query('dateFrom').optional().isISO8601().withMessage('Date from must be a valid ISO date'),
  query('dateTo').optional().isISO8601().withMessage('Date to must be a valid ISO date'),
  ...paginationValidation,
];

const attachmentMetadataValidation = [
  body('attachmentIds').isArray({ min: 1 }).withMessage('Attachment IDs must be a non-empty array'),
  body('attachmentIds.*').isMongoId().withMessage('Each attachment ID must be a valid MongoDB ID'),
];

// Routes

/**
 * @route GET /api/files/my-files
 * @desc Get current user's files or all files (based on showAll query parameter)
 * @query showAll - Set to 'false' to show only current user's files, 'true' (default) to show all files
 * @access Private
 */
router.get(
  '/my-files',
  myFilesValidation,
  validate,
  FileMetadataController.getCurrentUserFiles
);

/**
 * @route GET /api/files/stats
 * @desc Get file statistics
 * @access Private
 */
router.get(
  '/stats',
  query('userId').optional().isMongoId().withMessage('Invalid user ID format'),
  validate,
  FileMetadataController.getFileStatistics
);

/**
 * @route GET /api/files/search
 * @desc Search files
 * @access Private
 */
router.get(
  '/search',
  searchValidation,
  validate,
  FileMetadataController.searchFiles
);

/**
 * @route GET /api/files/message/:messageId
 * @desc Get files by message ID
 * @access Private
 */
router.get(
  '/message/:messageId',
  messageIdValidation,
  paginationValidation,
  validate,
  FileMetadataController.getFilesByMessage
);

/**
 * @route GET /api/files/chat/:chatId
 * @desc Get files by chat ID
 * @access Private
 */
router.get(
  '/chat/:chatId',
  chatIdValidation,
  paginationValidation,
  validate,
  FileMetadataController.getFilesByChat
);

/**
 * @route GET /api/files/user/:userId
 * @desc Get files by user ID
 * @access Private
 */
router.get(
  '/user/:userId',
  userIdValidation,
  paginationValidation,
  validate,
  FileMetadataController.getFilesByUser
);

/**
 * @route GET /api/files/:fileId
 * @desc Get file metadata by ID
 * @access Private
 */
router.get(
  '/:fileId',
  fileIdValidation,
  validate,
  FileMetadataController.getFileMetadata
);

/**
 * @route PUT /api/files/:fileId
 * @desc Update file metadata
 * @access Private
 */
router.put(
  '/:fileId',
  fileIdValidation,
  updateFileValidation,
  validate,
  FileMetadataController.updateFileMetadata
);

/**
 * @route DELETE /api/files/:fileId
 * @desc Delete file metadata (soft delete)
 * @access Private
 */
router.delete(
  '/:fileId',
  fileIdValidation,
  validate,
  FileMetadataController.deleteFileMetadata
);

/**
 * @route POST /api/files/attachments/metadata
 * @desc Get attachment metadata for multiple files
 * @access Private
 */
router.post(
  '/attachments/metadata',
  attachmentMetadataValidation,
  validate,
  FileMetadataController.getAttachmentMetadata
);

/**
 * @route POST /api/files/cleanup/orphaned
 * @desc Clean up orphaned files (admin only)
 * @access Private
 */
router.post(
  '/cleanup/orphaned',
  // TODO: Add admin role check middleware
  FileMetadataController.cleanupOrphanedFiles
);

export default router;