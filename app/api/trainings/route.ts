import { env } from "@/lib/server-env";
import { NextRequest, NextResponse } from "next/server";
import { getAccess, hasPermission } from "@/lib/access";

export async function GET(request: NextRequest) {
  const access = await getAccess(request);
  if (!hasPermission(access.profile, "training.view")) return NextResponse.json({ error: "لا توجد صلاحية لعرض التدريبات" }, { status: 403 });
  const trainings = await env.DB.prepare(`SELECT t.*, COUNT(ta.id) AS attendees_count, COALESCE(SUM(CASE WHEN ta.attended=1 THEN 1 ELSE 0 END),0) AS present_count
    FROM trainings t LEFT JOIN training_attendees ta ON ta.training_id=t.id GROUP BY t.id ORDER BY t.training_date DESC,t.id DESC`).all();
  const attendees = await env.DB.prepare(`SELECT ta.training_id,ta.staff_id,ta.attended,s.full_name FROM training_attendees ta JOIN staff s ON s.id=ta.staff_id ORDER BY ta.training_id DESC,s.full_name`).all();
  return NextResponse.json({ trainings: trainings.results, attendees: attendees.results });
}

export async function POST(request: NextRequest) {
  const access = await getAccess(request);
  if (!hasPermission(access.profile, "training.manage")) return NextResponse.json({ error: "لا تملك صلاحية إضافة التدريبات" }, { status: 403 });
  const body = await request.json() as Record<string, unknown>;
  const type = String(body.trainingType || "");
  const name = String(body.trainingName || "").trim();
  const date = String(body.trainingDate || "").trim();
  if (!["community", "staff"].includes(type) || !name || !date) return NextResponse.json({ error: "يرجى استكمال نوع التدريب واسم التدريب والتاريخ" }, { status: 400 });
  let attendees: { staffId: number; attended: boolean }[] = [];
  try { const value = typeof body.attendees === "string" ? JSON.parse(body.attendees) : body.attendees; if (Array.isArray(value)) attendees = value.map((row:any)=>({staffId:Number(row.staffId),attended:Boolean(row.attended)})).filter(row=>Number.isInteger(row.staffId)&&row.staffId>0); } catch { return NextResponse.json({ error: "بيانات المشاركين غير صالحة" }, { status: 400 }); }
  if (type === "staff" && !attendees.length) return NextResponse.json({ error: "يرجى اختيار موظف واحد على الأقل لتدريب طاقم العمل" }, { status: 400 });
  const actor = access.profile?.full_name || access.profile?.username || access.email || "مستخدم النظام";
  const result = await env.DB.prepare(`INSERT INTO trainings (training_type,training_name,training_date,training_agency,funder,trainer_name,trainee_count,location,training_days,training_hours,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(type,name,date,body.trainingAgency||null,body.funder||null,body.trainerName||null,type === "staff" ? attendees.length : Math.max(0,Number(body.traineeCount||0)),body.location||null,Math.max(0,Number(body.trainingDays||0)),Math.max(0,Number(body.trainingHours||0)),actor).run();
  const trainingId = Number(result.meta.last_row_id);
  if (type === "staff") for (const attendee of attendees) await env.DB.prepare("INSERT INTO training_attendees (training_id,staff_id,attended) VALUES (?,?,?) ON CONFLICT (training_id,staff_id) DO UPDATE SET attended=EXCLUDED.attended").bind(trainingId,attendee.staffId,attendee.attended?1:0).run();
  await env.DB.prepare("INSERT INTO audit_logs (actor,action,entity_type,entity_id,details) VALUES (?,'create','training',?,?)").bind(actor,String(trainingId),JSON.stringify({trainingName:name,trainingType:type})).run();
  return NextResponse.json({ ok: true, id: trainingId }, { status: 201 });
}
