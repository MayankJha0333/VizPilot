import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const ChartSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    reportId: { type: Schema.Types.ObjectId, ref: "Report", required: true, index: true },
    datasetId: { type: Schema.Types.ObjectId, ref: "Dataset", required: true },
    title: { type: String, default: "Untitled chart", trim: true },
    subtitle: { type: String, default: "" },
    note: { type: String, default: "" },
    // Full chart configuration (type, mapping, style). Kept schemaless so the
    // chart engine can evolve without migrations.
    config: { type: Schema.Types.Mixed, required: true },
    size: { type: String, enum: ["sm", "half", "wide", "full"], default: "half" },
    order: { type: Number, default: 0 },
  },
  { timestamps: true, minimize: false }
);

export type ChartDoc = InferSchemaType<typeof ChartSchema> & { _id: mongoose.Types.ObjectId };

export const Chart: Model<ChartDoc> =
  (mongoose.models.Chart as Model<ChartDoc>) || mongoose.model<ChartDoc>("Chart", ChartSchema);
