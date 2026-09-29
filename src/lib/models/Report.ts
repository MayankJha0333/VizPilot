import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const ReportSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    datasetId: { type: Schema.Types.ObjectId, ref: "Dataset", default: null },
    title: { type: String, required: true, trim: true, default: "Untitled report" },
    description: { type: String, default: "" },
    theme: { type: String, enum: ["light", "dark"], default: "light" },
    palette: { type: String, default: "aurora" },
    layout: { type: String, enum: ["grid", "single"], default: "grid" },
    isPublic: { type: Boolean, default: false },
    shareId: { type: String, index: true, sparse: true },
    lastOpenedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export type ReportDoc = InferSchemaType<typeof ReportSchema> & { _id: mongoose.Types.ObjectId };

export const Report: Model<ReportDoc> =
  (mongoose.models.Report as Model<ReportDoc>) ||
  mongoose.model<ReportDoc>("Report", ReportSchema);
