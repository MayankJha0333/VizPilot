import { NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/auth-server";
import { Dataset } from "@/lib/models/Dataset";
import { DatasetInput } from "@/lib/validation";

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const datasets = await Dataset.find({ userId: user._id })
      .select("-rows")
      .sort({ updatedAt: -1 })
      .lean();
    return NextResponse.json({ datasets });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const parsed = DatasetInput.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid dataset" }, { status: 400 });
    }
    const { name, source, columns, rows } = parsed.data;
    const dataset = await Dataset.create({
      userId: user._id,
      name,
      source,
      columns,
      rows,
      rowCount: rows.length,
    });
    return NextResponse.json({ dataset }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
