import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/server-env";
import { getAccess, hasPermission } from "@/lib/access";

export async function GET(request: NextRequest) {
  const access = await getAccess(request);
  if (!hasPermission(access.profile, "audit.view"))
    return NextResponse.json({ error: "سجل التعديلات متاح لمدير النظام فقط" }, { status: 403 });
  const url = new URL(request.url);
  const search = (url.searchParams.get("search") || "").trim();
  const action = url.searchParams.get("action") || "all";
  const args: unknown[] = [];
  let where = "WHERE l.entity_type='incident'";
  if (action !== "all") { where += " AND l.action=?"; args.push(action); }
  if (search) {
    where += " AND (COALESCE(l.actor,'') ILIKE ? OR COALESCE(i.incident_number,'') ILIKE ? OR COALESCE(l.details,'') ILIKE ?)";
    const term = `%${search}%`; args.push(term, term, term);
  }
  const result = await env.DB.prepare(`
    SELECT l.id,l.actor,l.actor_user_id,l.action,l.entity_id,l.details,l.created_at,
           i.incident_number,i.incident_code,i.approval_status
    FROM audit_logs l
    LEFT JOIN incidents i ON i.id::text=l.entity_id
    ${where}
    ORDER BY l.created_at DESC LIMIT 1000
  `).bind(...args).all();
  return NextResponse.json({ logs: result.results });
}
