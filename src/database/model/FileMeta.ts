import mongoose, { Schema, Document } from 'mongoose';

export interface IFileMeta extends Document {
  fileName: string;
  fileSize: number;
  fileType: string;
  fileUrl: string;
  uploadedBy: mongoose.Types.ObjectId;
  uploadedAt: Date;
}

const FileMetaSchema: Schema = new Schema<IFileMeta>({
  fileName: { type: String, required: true },
  fileSize: { type: Number, required: true },
  fileType: { type: String, required: true },
  fileUrl: { type: String, required: true },
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  uploadedAt: { type: Date, default: Date.now },
});

export default mongoose.model<IFileMeta>('FileMeta', FileMetaSchema);
