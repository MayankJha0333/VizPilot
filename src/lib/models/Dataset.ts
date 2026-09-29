import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const ColumnSchema = new Schema(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ["number", "string", "date", "boolean"], default: "string" },
  },
  { _id: false }
);

const DatasetSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    source: {
      type: String,
      enum: ["csv", "excel", "paste", "manual", "sample", "ai"],
      default: "manual",
    },
    columns: { type: [ColumnSchema], default: [] },
    rows: { type: [Schema.Types.Mixed], default: [] },
    rowCount: { type: Number, default: 0 },
  },
  { timestamps: true, minimize: false }
);

export type DatasetDoc = InferSchemaType<typeof DatasetSchema> & { _id: mongoose.Types.ObjectId };

export const Dataset: Model<DatasetDoc> =
  (mongoose.models.Dataset as Model<DatasetDoc>) ||
  mongoose.model<DatasetDoc>("Dataset", DatasetSchema);
