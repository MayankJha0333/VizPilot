import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { jsonError, requireUser } from "@/lib/auth-server";
import { Dataset } from "@/lib/models/Dataset";
import { ask } from "@/lib/ai/analyst";
import { ChartConfigSchema } from "@/lib/validation";
import type { Column, Row } from "@/lib/charts/types";

const Input = z.object({
  datasetId: z.string().min(1),
  prompt: z.string().trim().min(1).max(800),
  palette: z.string().default("aurora"),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(2000) })).max(12).default([]),
  lastConfig: ChartConfigSchema.nullable().optional(),
});

/**
 * POST /api/ai/ask – the data-analysis assistant. Returns a chart, an answer
 * or insights, plus the steps used to build it. Falls back across providers
 * and finally to the rules engine, so it always answers.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const parsed = Input.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Tell me what you'd like to see." }, { status: 400 });
    const { datasetId, prompt, palette, history, lastConfig } = parsed.data;
    if (!mongoose.Types.ObjectId.isValid(datasetId)) return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
    const dataset = await Dataset.findOne({ _id: datasetId, userId: user._id }).lean();
    if (!dataset) return NextResponse.json({ error: "Dataset not found" }, { status: 404 });

    const started = Date.now();
    const result = await ask({
      datasetName: dataset.name,
      columns: dataset.columns as Column[],
      rows: dataset.rows as Row[],
      prompt,
      palette,
      history,
      lastConfig: lastConfig ?? null,
    });
    return NextResponse.json({ ...result, latencyMs: Date.now() - started });
  } catch (err) {
    return jsonError(err);
  }
}
