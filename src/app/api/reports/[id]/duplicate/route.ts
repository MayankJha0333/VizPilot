import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { jsonError, requireUser } from "@/lib/auth-server";
import { Report } from "@/lib/models/Report";
import { Chart } from "@/lib/models/Chart";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  try {
    const user = await requireUser(req);
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const source = await Report.findOne({ _id: id, userId: user._id }).lean();
    if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const copy = await Report.create({
      userId: user._id,
      datasetId: source.datasetId,
      title: `${source.title} (copy)`,
      description: source.description,
      theme: source.theme,
      palette: source.palette,
      layout: source.layout,
      isPublic: false,
    });
    const charts = await Chart.find({ reportId: source._id }).lean();
    if (charts.length) {
      await Chart.insertMany(
        charts.map((c) => ({
          userId: user._id,
          reportId: copy._id,
          datasetId: c.datasetId,
          title: c.title,
          subtitle: c.subtitle,
          note: c.note,
          config: c.config,
          size: c.size,
          order: c.order,
        }))
      );
    }
    return NextResponse.json({ report: copy }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
