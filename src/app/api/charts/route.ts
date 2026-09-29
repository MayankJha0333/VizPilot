import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { jsonError, requireUser } from "@/lib/auth-server";
import { Report } from "@/lib/models/Report";
import { Chart } from "@/lib/models/Chart";
import { Dataset } from "@/lib/models/Dataset";
import { ChartInput } from "@/lib/validation";

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const parsed = ChartInput.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid chart" }, { status: 400 });
    }
    const { reportId, datasetId: requested, ...rest } = parsed.data;
    if (!mongoose.Types.ObjectId.isValid(reportId)) return NextResponse.json({ error: "Report not found" }, { status: 404 });
    const report = await Report.findOne({ _id: reportId, userId: user._id }).lean();
    if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });
    // Each widget can use its own data source; default is the report's primary one.
    let datasetId = report.datasetId;
    if (requested) {
      if (!mongoose.Types.ObjectId.isValid(requested) || !(await Dataset.exists({ _id: requested, userId: user._id }))) {
        return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
      }
      datasetId = new mongoose.Types.ObjectId(requested);
    }
    if (!datasetId) return NextResponse.json({ error: "Pick a data source for this widget." }, { status: 400 });
    if (!report.datasetId) await Report.updateOne({ _id: report._id }, { $set: { datasetId } });

    const last = await Chart.findOne({ reportId: report._id }).sort({ order: -1 }).select("order").lean();
    const chart = await Chart.create({
      userId: user._id,
      reportId: report._id,
      datasetId,
      ...rest,
      order: (last?.order ?? -1) + 1,
    });
    await Report.updateOne({ _id: report._id }, { $set: { updatedAt: new Date() } });
    return NextResponse.json({ chart }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
