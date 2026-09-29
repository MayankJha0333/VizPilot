import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { jsonError, requireUser } from "@/lib/auth-server";
import { Report } from "@/lib/models/Report";
import { Chart } from "@/lib/models/Chart";
import { Dataset } from "@/lib/models/Dataset";
import { ReportInput } from "@/lib/validation";
import { suggestCharts } from "@/lib/charts/suggest";
import type { Column, Row } from "@/lib/charts/types";

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();
    const sort: Record<string, 1 | -1> = url.searchParams.get("sort") === "title" ? { title: 1 } : { updatedAt: -1 };

    const filter: Record<string, unknown> = { userId: user._id };
    if (q) filter.title = { $regex: escapeRegex(q), $options: "i" };

    const reports = await Report.find(filter).sort(sort).lean();
    const ids = reports.map((r) => r._id);
    // One pass over the charts: count per report + first chart (thumbnail).
    const allCharts = await Chart.find({ reportId: { $in: ids } }).sort({ order: 1, createdAt: 1 }).lean();
    const countMap = new Map<string, number>();
    const previewMap = new Map<string, (typeof allCharts)[number]>();
    for (const c of allCharts) {
      const key = c.reportId.toString();
      countMap.set(key, (countMap.get(key) ?? 0) + 1);
      // Thumbnail: prefer a real chart over a KPI / text / table block.
      const prev = previewMap.get(key);
      const visual = (t: string) => !["kpi", "text", "table"].includes(t);
      if (!prev || (!visual(prev.config.type) && visual(c.config.type))) previewMap.set(key, c);
    }
    const datasetIds = reports.map((r) => r.datasetId).filter((d): d is mongoose.Types.ObjectId => Boolean(d));
    const datasets = await Dataset.find({ _id: { $in: datasetIds } }).select("name rowCount").lean();
    const dsMap = new Map(datasets.map((d) => [d._id.toString(), d]));

    return NextResponse.json({
      reports: reports.map((r) => ({
        ...r,
        chartCount: countMap.get(r._id.toString()) ?? 0,
        dataset: r.datasetId ? dsMap.get(r.datasetId.toString()) ?? null : null,
        preview: previewMap.get(r._id.toString()) ?? null,
      })),
    });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const parsed = ReportInput.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid report" }, { status: 400 });
    }
    const { title, description, datasetId, autoCharts, palette } = parsed.data;

    let dataset = null;
    if (datasetId) {
      if (!mongoose.Types.ObjectId.isValid(datasetId)) {
        return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
      }
      dataset = await Dataset.findOne({ _id: datasetId, userId: user._id });
      if (!dataset) return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
    }

    const report = await Report.create({
      userId: user._id,
      title,
      description,
      datasetId: dataset?._id ?? null,
      palette,
    });

    let created = 0;
    if (autoCharts && dataset) {
      const raw = suggestCharts(dataset.columns as Column[], dataset.rows as Row[], palette);
      // Layout like a dashboard: headline KPI top-left (4 cols) next to the
      // trend chart (8 cols), then the rest in halves.
      const kpis = raw.filter((s) => s.config.type === "kpi");
      const rest = raw.filter((s) => s.config.type !== "kpi");
      const suggestions = [...kpis, ...rest];
      await Chart.insertMany(
        suggestions.map((s, i) => ({
          userId: user._id,
          reportId: report._id,
          datasetId: dataset!._id,
          title: s.title,
          subtitle: s.subtitle,
          note: "",
          config: s.config,
          size: s.config.type === "kpi" ? "sm" : i === kpis.length && kpis.length === 1 ? "wide" : kpis.length === 0 && i === 0 ? "full" : "half",
          order: i,
        }))
      );
      created = suggestions.length;
    }

    return NextResponse.json({ report, chartsCreated: created }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
