import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/server-env";
import { getAccess, hasPermission } from "@/lib/access";

export const runtime = "nodejs";

async function authorized(request: NextRequest) {
  const access = await getAccess(request);
  return { access, allowed: hasPermission(access.profile, "backup.manage") };
}

async function serviceRequest(path: string, init?: RequestInit) {
  const base = process.env.BACKUP_SERVICE_URL;
  const token = process.env.BACKUP_API_TOKEN;
  if (!base || !token) throw new Error("إعداد خدمة النسخ الاحتياطي غير مكتمل في الخادم");
  return fetch(`${base}${path}`, {
    ...init,
    cache: "no-store",
    headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(path === "/download" ? 120_000 : 10_000),
  });
}

export async function GET(request: NextRequest) {
  const { allowed } = await authorized(request);
  if (!allowed) return NextResponse.json({ error: "لا تملك صلاحية إدارة النسخ الاحتياطية" }, { status: 403 });
  try {
    if (new URL(request.url).searchParams.get("download") === "latest") {
      const response = await serviceRequest("/download");
      if (!response.ok) {
        const data = await response.json().catch(() => ({})) as { error?: string };
        return NextResponse.json({ error: data.error || "لا توجد نسخة جاهزة للتنزيل" }, { status: response.status });
      }
      return new NextResponse(response.body, {
        status: 200,
        headers: {
          "Content-Type": response.headers.get("content-type") || "application/gzip",
          "Content-Disposition": response.headers.get("content-disposition") || "attachment; filename=ems-backup.tar.gz",
          "Cache-Control": "no-store",
        },
      });
    }
    const response = await serviceRequest("/status");
    const status = await response.json();
    return NextResponse.json(status, { status: response.status });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر الاتصال بخدمة النسخ الاحتياطي" }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const { access, allowed } = await authorized(request);
  if (!allowed) return NextResponse.json({ error: "لا تملك صلاحية إنشاء النسخ الاحتياطية" }, { status: 403 });
  try {
    const response = await serviceRequest("/run", { method: "POST" });
    const result = await response.json();
    if (!response.ok) return NextResponse.json(result, { status: response.status });
    const actor = access.profile?.full_name || access.profile?.username || access.email || "مدير النظام";
    await env.DB.prepare("INSERT INTO audit_logs (actor,action,entity_type,entity_id,details) VALUES (?,'backup_manual','backup',NULL,?)")
      .bind(actor, JSON.stringify({ source: "manual" })).run();
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر بدء النسخ الاحتياطي" }, { status: 503 });
  }
}
