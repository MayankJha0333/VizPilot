import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { nanoid } from "nanoid";
import { jsonError, requireUser } from "@/lib/auth-server";
import { Report } from "@/lib/models/Report";
import { Chart } from "@/lib/models/Chart";
import { Dataset } from "@/lib/models/Dataset";
import { ReportPatch } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  try {
    const user = await requireUser(req);
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const report = await Report.findOneAndUpdate(
      { _id: id, userId: user._id },
      { $set: { lastOpenedAt: new Date() } },
      { returnDocument: "after" }
    ).lean();
    if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [charts, dataset] = await Promise.all([
      Chart.find({ reportId: report._id }).sort({ order: 1, createdAt: 1 }).lean(),
      report.datasetId ? Dataset.findOne({ _id: report.datasetId, userId: user._id }).lean() : null,
    ]);
    return NextResponse.json({ report, charts, dataset });
  } catch (err) {
    return jsonError(err);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const user = await requireUser(req);
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const parsed = ReportPatch.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid update" }, { status: 400 });

    const { chartOrder, ...rest } = parsed.data;
    const update: Record<string, unknown> = { ...rest };

    if (rest.datasetId) {
      const ds = await Dataset.exists({ _id: rest.datasetId, userId: user._id });
      if (!ds) return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
    }
    if (rest.isPublic === true) {
      const existing = await Report.findOne({ _id: id, userId: user._id }).select("shareId").lean();
      if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (!existing.shareId) update.shareId = nanoid(12);
    }

    const report = await Report.findOneAndUpdate({ _id: id, userId: user._id }, { $set: update }, { returnDocument: "after" }).lean();
    if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (chartOrder && chartOrder.length) {
      await Promise.all(
        chartOrder.map((chartId, index) =>
          mongoose.Types.ObjectId.isValid(chartId)
            ? Chart.updateOne({ _id: chartId, reportId: report._id }, { $set: { order: index } })
            : Promise.resolve()
        )
      );
    }
    return NextResponse.json({ report });
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const user = await requireUser(req);
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const result = await Report.deleteOne({ _id: id, userId: user._id });
    if (result.deletedCount === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await Chart.deleteMany({ reportId: id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
