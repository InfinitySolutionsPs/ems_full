import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/server-env";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (value: string) =>
  datePattern.test(value) &&
  !Number.isNaN(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;

function authorized(request: NextRequest) {
  const expected = process.env.PRC_STATISTICS_INTEGRATION_TOKEN || "";
  const provided = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] || "";
  if (!expected || !provided) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(provided);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const url = new URL(request.url);
  const today = new Date().toISOString().slice(0, 10);
  const from = url.searchParams.get("from") || today;
  const to = url.searchParams.get("to") || today;
  if (!isDate(from) || !isDate(to) || from > to || to > today) {
    return NextResponse.json({ error: "الفترة الزمنية غير صالحة" }, { status: 400 });
  }

  const result = await env.DB.prepare(`
    SELECT
      call_date AS date,
      station,
      pickup_governorate AS governorate,
      COUNT(*) FILTER (WHERE category = 'Accident')::int AS accidents,
      COUNT(*) FILTER (WHERE category = 'Delivery')::int AS births,
      COUNT(*) FILTER (WHERE category = 'Trauma')::int AS injuries,
      COUNT(*) FILTER (WHERE category = 'Martyr' OR patient_deceased = 1)::int AS martyrs,
      COUNT(*) FILTER (WHERE category = 'Medical')::int AS medical_cases,
      COUNT(*) FILTER (WHERE category = 'Other')::int AS other_cases,
      COUNT(*)::int AS total
    FROM incidents
    WHERE approval_status = 'approved'
      AND cancelled = 0
      AND call_date BETWEEN ? AND ?
    GROUP BY call_date, station, pickup_governorate
    ORDER BY call_date, station
  `).bind(from, to).all<{
    date: string;
    station: string;
    governorate: string;
    accidents: number;
    births: number;
    injuries: number;
    martyrs: number;
    medical_cases: number;
    other_cases: number;
    total: number;
  }>();

  return NextResponse.json(
    {
      schema: "prcs-ems-summary-v1",
      from,
      to,
      generatedAt: new Date().toISOString(),
      rows: result.results,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
