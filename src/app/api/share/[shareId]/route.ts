import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Report } from "@/lib/models/Report";
import { Chart } from "@/lib/models/Chart";
import { Dataset } from "@/lib/models/Dataset";
import { User } from "@/lib/models/User";

type Ctx = { params: Promise<{ shareId: string }> };

/** Public, read-only view of a published report. */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { shareId } = await params;
    await connectDB();
    const report = await Report.findOne({ shareId, isPublic: true }).lean();
    if (!report) return NextResponse.json({ error: "This report is not public." }, { status: 404 });
    const [charts, owner] = await Promise.all([
      Chart.find({ reportId: report._id }).sort({ order: 1, createdAt: 1 }).lean(),
      User.findById(report.userId).select("name email").lean(),
    ]);
    const ids = [...new Set([report.datasetId, ...charts.map((c) => c.datasetId)].filter(Boolean).map(String))];
    const datasets = await Dataset.find({ _id: { $in: ids }, userId: report.userId }).lean();
    const dataset = datasets.find((d) => String(d._id) === String(report.datasetId)) ?? null;
    return NextResponse.json({
      report: { ...report, userId: undefined },
      charts,
      dataset,
      datasets,
      owner: owner ? { name: owner.name || owner.email.split("@")[0] } : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
