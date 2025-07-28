import { FileMetadataModel, IFileMetadata } from '../database/model/FileMetadata';
import { getServerUrl } from '../config/environment';
import path from 'path';
import fs from 'fs/promises';

export class FileMetadataService {
  /**
   * Create file metadata record
   */
  static async createFileMetadata(data: {
    originalName: string;
    fileName: string;
    filePath: string;
    mimeType: string;
    fileSize: number;
    uploadedBy: string;
    messageId?: string;
    chatId?: string;
    thumbnailUrl?: string;
    duration?: number;
    dimensions?: { width: number; height: number };
    metadata?: any;
  }): Promise<IFileMetadata> {
    const fileExtension = path.extname(data.originalName).toLowerCase().substring(1);
    const fileUrl = `${getServerUrl()}/uploads/${data.filePath}`;

    const fileMetadata = new FileMetadataModel({
      ...data,
      fileUrl,
      fileExtension,
    });

    return await fileMetadata.save();
  }

  /**
   * Get file metadata by ID
   */
  static async getFileMetadata(fileId: string): Promise<IFileMetadata | null> {
    return await FileMetadataModel.findById(fileId).populate('uploadedBy', 'username email');
  }

  /**
   * Get file metadata by message ID
   */
  static async getFilesByMessageId(messageId: string): Promise<IFileMetadata[]> {
    return await FileMetadataModel.find({ messageId, isDeleted: false })
      .populate('uploadedBy', 'username email')
      .sort({ uploadedAt: 1 });
  }

  /**
   * Get file metadata by chat ID
   */
  static async getFilesByChatId(chatId: string, limit: number = 50, skip: number = 0): Promise<IFileMetadata[]> {
    return await FileMetadataModel.find({ chatId, isDeleted: false })
      .populate('uploadedBy', 'username email')
      .sort({ uploadedAt: -1 })
      .limit(limit)
      .skip(skip);
  }

  /**
   * Get files by user ID
   */
  static async getFilesByUserId(userId: string, limit: number = 50, skip: number = 0): Promise<IFileMetadata[]> {
    return await FileMetadataModel.find({ uploadedBy: userId, isDeleted: false })
      .populate('uploadedBy', 'username email')
      .sort({ uploadedAt: -1 })
      .limit(limit)
      .skip(skip);
  }

  /**
   * Get all files in the system (not user-specific)
   */
  static async getAllFiles(limit: number = 50, skip: number = 0): Promise<IFileMetadata[]> {
    return await FileMetadataModel.find({ isDeleted: false })
      .populate('uploadedBy', 'username email')
      .sort({ uploadedAt: -1 })
      .limit(limit)
      .skip(skip);
  }

  /**
   * Update file metadata
   */
  static async updateFileMetadata(fileId: string, updates: Partial<IFileMetadata>): Promise<IFileMetadata | null> {
    return await FileMetadataModel.findByIdAndUpdate(
      fileId,
      { ...updates, updatedAt: new Date() },
      { new: true }
    ).populate('uploadedBy', 'username email');
  }

  /**
   * Soft delete file metadata
   */
  static async deleteFileMetadata(fileId: string): Promise<boolean> {
    const result = await FileMetadataModel.findByIdAndUpdate(
      fileId,
      { isDeleted: true, deletedAt: new Date() },
      { new: true }
    );
    return !!result;
  }

  /**
   * Hard delete file metadata and file
   */
  static async permanentDeleteFile(fileId: string): Promise<boolean> {
    try {
      const fileMetadata = await FileMetadataModel.findById(fileId);
      if (!fileMetadata) return false;

      // Delete physical file
      try {
        await fs.unlink(fileMetadata.filePath);
        if (fileMetadata.thumbnailUrl) {
          const thumbnailPath = fileMetadata.thumbnailUrl.replace(getServerUrl(), './public');
          await fs.unlink(thumbnailPath);
        }
      } catch (error) {
        console.error('Error deleting physical file:', error);
      }

      // Delete metadata record
      await FileMetadataModel.findByIdAndDelete(fileId);
      return true;
    } catch (error) {
      console.error('Error permanently deleting file:', error);
      return false;
    }
  }

  /**
   * Get file statistics
   */
  static async getFileStatistics(userId?: string) {
    return await FileMetadataModel.getFileStats(userId);
  }

  /**
   * Search files
   */
  static async searchFiles(query: {
    searchTerm?: string;
    fileType?: string;
    chatId?: string;
    uploadedBy?: string;
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
    skip?: number;
  }): Promise<IFileMetadata[]> {
    const filter: any = { isDeleted: false };

    if (query.searchTerm) {
      filter.$or = [
        { originalName: { $regex: query.searchTerm, $options: 'i' } },
        { fileExtension: { $regex: query.searchTerm, $options: 'i' } },
      ];
    }

    if (query.fileType && query.fileType !== 'all') {
      // Handle file type filtering by category
      switch (query.fileType) {
        case 'image':
          filter.mimeType = { $regex: '^image/', $options: 'i' };
          break;
        case 'video':
          filter.mimeType = { $regex: '^video/', $options: 'i' };
          break;
        case 'audio':
          filter.mimeType = { $regex: '^audio/', $options: 'i' };
          break;
        case 'document':
          filter.$or = [
            { mimeType: { $regex: 'pdf', $options: 'i' } },
            { mimeType: { $regex: 'document', $options: 'i' } },
            { mimeType: { $regex: 'text', $options: 'i' } },
            { mimeType: { $regex: 'spreadsheet', $options: 'i' } },
            { mimeType: { $regex: 'presentation', $options: 'i' } },
            { mimeType: { $regex: 'word', $options: 'i' } },
            { mimeType: { $regex: 'excel', $options: 'i' } },
            { mimeType: { $regex: 'powerpoint', $options: 'i' } }
          ];
          break;
        default:
          // For 'other' or any specific MIME type
          filter.mimeType = { $regex: `^${query.fileType}/`, $options: 'i' };
      }
    }

    if (query.chatId) {
      filter.chatId = query.chatId;
    }

    if (query.uploadedBy) {
      filter.uploadedBy = query.uploadedBy;
    }

    if (query.dateFrom || query.dateTo) {
      filter.uploadedAt = {};
      if (query.dateFrom) filter.uploadedAt.$gte = query.dateFrom;
      if (query.dateTo) filter.uploadedAt.$lte = query.dateTo;
    }

    return await FileMetadataModel.find(filter)
      .populate('uploadedBy', 'username email')
      .sort({ uploadedAt: -1 })
      .limit(query.limit || 50)
      .skip(query.skip || 0);
  }

  /**
   * Get file metadata for message attachments
   */
  static async getAttachmentMetadata(attachmentIds: string[]): Promise<IFileMetadata[]> {
    return await FileMetadataModel.find({ 
      _id: { $in: attachmentIds }, 
      isDeleted: false 
    }).populate('uploadedBy', 'username email');
  }

  /**
   * Clean up orphaned files (files without associated messages)
   */
  static async cleanupOrphanedFiles(): Promise<number> {
    const orphanedFiles = await FileMetadataModel.find({
      messageId: { $exists: false },
      uploadedAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Older than 24 hours
      isDeleted: false,
    });

    let deletedCount = 0;
    for (const file of orphanedFiles) {
      const success = await this.permanentDeleteFile(file._id);
      if (success) deletedCount++;
    }

    return deletedCount;
  }
}