import { Request, Response } from 'express';
import { FileMetadataService } from '../services/FileMetadataService';
import asyncHandler from '../helpers/asyncHandler';
import { BadRequestError, NotFoundError } from '../core/ApiError';
import { SuccessResponse } from '../core/ApiResponse';
import { ProtectedRequest } from '../types/app-request';

export class FileMetadataController {
  /**
   * Get file metadata by ID
   */
  static getFileMetadata = asyncHandler(async (req: Request, res: Response) => {
    const { fileId } = req.params;
    
    if (!fileId) {
      throw new BadRequestError('File ID is required');
    }

    const fileMetadata = await FileMetadataService.getFileMetadata(fileId);
    
    if (!fileMetadata) {
      throw new NotFoundError('File not found');
    }

    new SuccessResponse('File metadata retrieved successfully', fileMetadata).send(res);
  });

  /**
   * Get files by message ID
   */
  static getFilesByMessage = asyncHandler(async (req: Request, res: Response) => {
    const { messageId } = req.params;
    
    if (!messageId) {
      throw new BadRequestError('Message ID is required');
    }

    const files = await FileMetadataService.getFilesByMessageId(messageId);
    
    new SuccessResponse('Files retrieved successfully', files).send(res);
  });

  /**
   * Get files by chat ID
   */
  static getFilesByChat = asyncHandler(async (req: Request, res: Response) => {
    const { chatId } = req.params;
    const { limit = 50, skip = 0 } = req.query;
    
    if (!chatId) {
      throw new BadRequestError('Chat ID is required');
    }

    const files = await FileMetadataService.getFilesByChatId(
      chatId,
      parseInt(limit as string),
      parseInt(skip as string)
    );
    
    new SuccessResponse('Files retrieved successfully', files).send(res);
  });

  /**
   * Get files by user ID
   */
  static getFilesByUser = asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;
    const { limit = 50, skip = 0 } = req.query;
    
    if (!userId) {
      throw new BadRequestError('User ID is required');
    }

    const files = await FileMetadataService.getFilesByUserId(
      userId,
      parseInt(limit as string),
      parseInt(skip as string)
    );
    
    new SuccessResponse('Files retrieved successfully', files).send(res);
  });

  /**
   * Get current user's files (or all files if showAll=true)
   */
  static getCurrentUserFiles = asyncHandler(async (req: ProtectedRequest, res: Response) => {
    const { limit = 50, skip = 0, showAll = 'true' } = req.query;
    const currentUserId = req.user?._id.toString();
    
    if (!currentUserId) {
      throw new BadRequestError('User authentication required');
    }

    // Check if we should show all files or just user-specific files
    const shouldShowAll = String(showAll) === 'true';
    
    const files = shouldShowAll 
      ? await FileMetadataService.getAllFiles(
          parseInt(limit as string),
          parseInt(skip as string)
        )
      : await FileMetadataService.getFilesByUserId(
          currentUserId,
          parseInt(limit as string),
          parseInt(skip as string)
        );
    
    new SuccessResponse('Files retrieved successfully', {
      files,
      totalCount: files.length,
      userId: currentUserId,
      showingAllFiles: shouldShowAll
    }).send(res);
  });

  /**
   * Update file metadata
   */
  static updateFileMetadata = asyncHandler(async (req: Request, res: Response) => {
    const { fileId } = req.params;
    const updates = req.body;
    
    if (!fileId) {
      throw new BadRequestError('File ID is required');
    }

    const updatedFile = await FileMetadataService.updateFileMetadata(fileId, updates);
    
    if (!updatedFile) {
      throw new NotFoundError('File not found');
    }

    new SuccessResponse('File metadata updated successfully', updatedFile).send(res);
  });

  /**
   * Delete file metadata (soft delete)
   */
  static deleteFileMetadata = asyncHandler(async (req: Request, res: Response) => {
    const { fileId } = req.params;
    
    if (!fileId) {
      throw new BadRequestError('File ID is required');
    }

    const success = await FileMetadataService.deleteFileMetadata(fileId);
    
    if (!success) {
      throw new NotFoundError('File not found');
    }

    new SuccessResponse('File deleted successfully', { success: true }).send(res);
  });

  /**
   * Get file statistics
   */
  static getFileStatistics = asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.query;
    
    const stats = await FileMetadataService.getFileStatistics(userId as string);
    
    new SuccessResponse('File statistics retrieved successfully', stats).send(res);
  });

  /**
   * Search files
   */
  static searchFiles = asyncHandler(async (req: Request, res: Response) => {
    const {
      searchTerm,
      fileType,
      chatId,
      uploadedBy,
      dateFrom,
      dateTo,
      limit = 50,
      skip = 0
    } = req.query;

    const searchQuery = {
      searchTerm: searchTerm as string,
      fileType: fileType as string,
      chatId: chatId as string,
      uploadedBy: uploadedBy as string,
      dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
      dateTo: dateTo ? new Date(dateTo as string) : undefined,
      limit: parseInt(limit as string),
      skip: parseInt(skip as string),
    };

    const files = await FileMetadataService.searchFiles(searchQuery);
    
    new SuccessResponse('Files searched successfully', files).send(res);
  });

  /**
   * Get attachment metadata for multiple files
   */
  static getAttachmentMetadata = asyncHandler(async (req: Request, res: Response) => {
    const { attachmentIds } = req.body;
    
    if (!attachmentIds || !Array.isArray(attachmentIds)) {
      throw new BadRequestError('Attachment IDs array is required');
    }

    const files = await FileMetadataService.getAttachmentMetadata(attachmentIds);
    
    new SuccessResponse('Attachment metadata retrieved successfully', files).send(res);
  });

  /**
   * Clean up orphaned files
   */
  static cleanupOrphanedFiles = asyncHandler(async (req: Request, res: Response) => {
    const deletedCount = await FileMetadataService.cleanupOrphanedFiles();
    
    new SuccessResponse('Orphaned files cleaned up successfully', { deletedCount }).send(res);
  });
}