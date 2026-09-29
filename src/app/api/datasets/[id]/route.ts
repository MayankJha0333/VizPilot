import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { jsonError, requireUser } from "@/lib/auth-server";
import { Dataset } from "@/lib/models/Dataset";
import { Report } from "@/lib/models/Report";
import { Chart } from "@/lib/models/Chart";
import { ColumnSchema, RowSchema } from "@/lib/validation";
import { MAX_ROWS } from "@/lib/data/parse";

type Ctx = { params: Promise<{ id: string }> };

const PatchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  columns: z.array(ColumnSchema).min(1).optional(),
  rows: z.array(RowSchema).max(MAX_ROWS).optional(),
});

function badId(id: string) {
  return !mongoose.Types.ObjectId.isValid(id);
}

export async function GET(req: Request, { params }: Ctx) {
  try {
    const user = await requireUser(req);
    const { id } = await params;
    if (badId(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const dataset = await Dataset.findOne({ _id: id, userId: user._id }).lean();
    if (!dataset) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const usedBy = await Report.find({ userId: user._id, datasetId: dataset._id }).select("title").lean();
    return NextResponse.json({ dataset, usedBy });
  } catch (err) {
    return jsonError(err);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const user = await requireUser(req);
    const { id } = await params;
    if (badId(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const parsed = PatchSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid update" }, { status: 400 });
    const update: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.rows) update.rowCount = parsed.data.rows.length;
    const dataset = await Dataset.findOneAndUpdate({ _id: id, userId: user._id }, { $set: update }, { returnDocument: "after" }).lean();
    if (!dataset) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ dataset });
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const user = await requireUser(req);
    const { id } = await params;
    if (badId(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    // A dataset is in use if it's a report's primary source or feeds any widget.
    const [primary, widgetReports] = await Promise.all([
      Report.find({ userId: user._id, datasetId: id }).distinct("_id"),
      Chart.find({ userId: user._id, datasetId: id }).distinct("reportId"),
    ]);
    const inUse = new Set([...primary, ...widgetReports].map(String)).size;
    if (inUse > 0) {
      return NextResponse.json(
        { error: `This dataset is used by ${inUse} report${inUse > 1 ? "s" : ""}. Remove its widgets or delete those reports first.` },
        { status: 409 }
      );
    }
    await Chart.deleteMany({ userId: user._id, datasetId: id });
    const result = await Dataset.deleteOne({ _id: id, userId: user._id });
    if (result.deletedCount === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
