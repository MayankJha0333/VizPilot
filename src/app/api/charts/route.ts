import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { jsonError, requireUser } from "@/lib/auth-server";
import { Report } from "@/lib/models/Report";
import { Chart } from "@/lib/models/Chart";
import { ChartInput } from "@/lib/validation";

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const parsed = ChartInput.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid chart" }, { status: 400 });
    }
    const { reportId, ...rest } = parsed.data;
    if (!mongoose.Types.ObjectId.isValid(reportId)) return NextResponse.json({ error: "Report not found" }, { status: 404 });
    const report = await Report.findOne({ _id: reportId, userId: user._id }).lean();
    if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });
    if (!report.datasetId) return NextResponse.json({ error: "Add data to this report before creating charts." }, { status: 400 });

    const last = await Chart.findOne({ reportId: report._id }).sort({ order: -1 }).select("order").lean();
    const chart = await Chart.create({
      userId: user._id,
      reportId: report._id,
      datasetId: report.datasetId,
      ...rest,
      order: (last?.order ?? -1) + 1,
    });
    await Report.updateOne({ _id: report._id }, { $set: { updatedAt: new Date() } });
    return NextResponse.json({ chart }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
