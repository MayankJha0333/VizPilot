import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { jsonError, requireUser } from "@/lib/auth-server";
import { Chart } from "@/lib/models/Chart";
import { Report } from "@/lib/models/Report";
import { Dataset } from "@/lib/models/Dataset";
import { ChartPatch } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const user = await requireUser(req);
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const parsed = ChartPatch.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid update" }, { status: 400 });
    if (parsed.data.datasetId && !(mongoose.Types.ObjectId.isValid(parsed.data.datasetId) && (await Dataset.exists({ _id: parsed.data.datasetId, userId: user._id })))) {
      return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
    }
    const chart = await Chart.findOneAndUpdate({ _id: id, userId: user._id }, { $set: parsed.data }, { returnDocument: "after" }).lean();
    if (!chart) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await Report.updateOne({ _id: chart.reportId }, { $set: { updatedAt: new Date() } });
    return NextResponse.json({ chart });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request, { params }: Ctx) {
  // POST /api/charts/:id  → duplicate
  try {
    const user = await requireUser(req);
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const source = await Chart.findOne({ _id: id, userId: user._id }).lean();
    if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const last = await Chart.findOne({ reportId: source.reportId }).sort({ order: -1 }).select("order").lean();
    const chart = await Chart.create({
      userId: user._id,
      reportId: source.reportId,
      datasetId: source.datasetId,
      title: `${source.title} (copy)`,
      subtitle: source.subtitle,
      note: source.note,
      config: source.config,
      size: source.size,
      // Same footprint, placed below; the client grid compacts it into place.
      layout: source.layout ? { ...(source.layout as object), y: 9999 } : null,
      order: (last?.order ?? -1) + 1,
    });
    return NextResponse.json({ chart }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const user = await requireUser(req);
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const result = await Chart.deleteOne({ _id: id, userId: user._id });
    if (result.deletedCount === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
