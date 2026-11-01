import { env } from "@/lib/server-env";
import { NextRequest, NextResponse } from "next/server";
import { getAccess, hasPermission } from "@/lib/access";

export async function GET(request: NextRequest) {
  const access = await getAccess(request);
  if (!hasPermission(access.profile, "training.view")) return NextResponse.json({ error: "لا توجد صلاحية لعرض التدريبات" }, { status: 403 });
  const trainings = await env.DB.prepare(`SELECT t.*, COUNT(ta.id) AS attendees_count,
    COALESCE((SELECT SUM(CASE WHEN td.attended=1 THEN 1 ELSE 0 END) FROM training_attendance td WHERE td.training_id=t.id),0) AS present_count
    FROM trainings t LEFT JOIN training_attendees ta ON ta.training_id=t.id GROUP BY t.id ORDER BY t.training_date DESC,t.id DESC`).all();
  const attendees = await env.DB.prepare(`SELECT ta.training_id,ta.staff_id,ta.attended,s.full_name FROM training_attendees ta JOIN staff s ON s.id=ta.staff_id ORDER BY ta.training_id DESC,s.full_name`).all();
  const daily = await env.DB.prepare(`SELECT td.training_id,td.staff_id,td.training_day,td.attended,s.full_name FROM training_attendance td JOIN staff s ON s.id=td.staff_id ORDER BY td.training_id DESC,td.training_day, s.full_name`).all();
  return NextResponse.json({ trainings: trainings.results, attendees: attendees.results, dailyAttendance: daily.results });
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
  let dailyAttendance: { staffId: number; day: number; attended: boolean }[] = [];
  try { const value = typeof body.attendees === "string" ? JSON.parse(body.attendees) : body.attendees; if (Array.isArray(value)) attendees = value.map((row:any)=>({staffId:Number(row.staffId),attended:Boolean(row.attended)})).filter(row=>Number.isInteger(row.staffId)&&row.staffId>0); } catch { return NextResponse.json({ error: "بيانات المشاركين غير صالحة" }, { status: 400 }); }
  try { const value = typeof body.dailyAttendance === "string" ? JSON.parse(body.dailyAttendance) : body.dailyAttendance; if (Array.isArray(value)) dailyAttendance = value.map((row:any)=>({staffId:Number(row.staffId),day:Number(row.day),attended:Boolean(row.attended)})).filter(row=>Number.isInteger(row.staffId)&&row.staffId>0&&Number.isInteger(row.day)&&row.day>0); } catch { return NextResponse.json({ error: "بيانات الحضور اليومية غير صالحة" }, { status: 400 }); }
  if (type === "staff" && !attendees.length) return NextResponse.json({ error: "يرجى اختيار موظف واحد على الأقل لتدريب طاقم العمل" }, { status: 400 });
  const actor = access.profile?.full_name || access.profile?.username || access.email || "مستخدم النظام";
  const trainingDays = type === "staff" ? Math.max(1, Number(body.trainingDays || 0)) : Math.max(0, Number(body.trainingDays || 0));
  const result = await env.DB.prepare(`INSERT INTO trainings (training_type,training_name,training_date,training_agency,funder,trainer_name,trainee_count,location,training_days,training_hours,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(type,name,date,body.trainingAgency||null,body.funder||null,body.trainerName||null,type === "staff" ? attendees.length : Math.max(0,Number(body.traineeCount||0)),body.location||null,trainingDays,Math.max(0,Number(body.trainingHours||0)),actor).run();
  const trainingId = Number(result.meta.last_row_id);
  if (type === "staff") for (const attendee of attendees) await env.DB.prepare("INSERT INTO training_attendees (training_id,staff_id,attended) VALUES (?,?,?) ON CONFLICT (training_id,staff_id) DO UPDATE SET attended=EXCLUDED.attended").bind(trainingId,attendee.staffId,attendee.attended?1:0).run();
  if (type === "staff") for (const attendance of dailyAttendance.filter(row=>row.day<=trainingDays)) await env.DB.prepare("INSERT INTO training_attendance (training_id,staff_id,training_day,attended) VALUES (?,?,?,?) ON CONFLICT (training_id,staff_id,training_day) DO UPDATE SET attended=EXCLUDED.attended").bind(trainingId,attendance.staffId,attendance.day,attendance.attended?1:0).run();
  await env.DB.prepare("INSERT INTO audit_logs (actor,action,entity_type,entity_id,details) VALUES (?,'create','training',?,?)").bind(actor,String(trainingId),JSON.stringify({trainingName:name,trainingType:type})).run();
  return NextResponse.json({ ok: true, id: trainingId }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const access = await getAccess(request);
  if (!hasPermission(access.profile, "training.manage")) return NextResponse.json({ error: "لا تملك صلاحية حذف التدريبات" }, { status: 403 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "رقم التدريب غير صالح" }, { status: 400 });
  const existing = await env.DB.prepare("SELECT id,training_name FROM trainings WHERE id=?").bind(id).first<any>();
  if (!existing) return NextResponse.json({ error: "التدريب غير موجود" }, { status: 404 });
  const actor = access.profile?.full_name || access.profile?.username || access.email || "مستخدم النظام";
  await env.DB.prepare("DELETE FROM trainings WHERE id=?").bind(id).run();
  await env.DB.prepare("INSERT INTO audit_logs (actor,action,entity_type,entity_id,details) VALUES (?,'delete','training',?,?)").bind(actor,String(id),JSON.stringify({trainingName:existing.training_name})).run();
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: NextRequest) {
  const access = await getAccess(request);
  if (!hasPermission(access.profile, "training.manage")) return NextResponse.json({ error: "لا تملك صلاحية تعديل التدريبات" }, { status: 403 });
  const body = await request.json() as Record<string, unknown>;
  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "رقم التدريب غير صالح" }, { status: 400 });
  const name = String(body.trainingName || "").trim();
  const date = String(body.trainingDate || "").trim();
  if (!name || !date) return NextResponse.json({ error: "يرجى استكمال اسم التدريب والتاريخ" }, { status: 400 });
  const days = Math.max(0, Number(body.trainingDays || 0));
  const attendees = Array.isArray(body.attendees) ? body.attendees.map((row:any)=>({staffId:Number(row.staffId),attended:Boolean(row.attended)})).filter((row:any)=>Number.isInteger(row.staffId)&&row.staffId>0) : [];
  const daily = Array.isArray(body.dailyAttendance) ? body.dailyAttendance.map((row:any)=>({staffId:Number(row.staffId),day:Number(row.day),attended:Boolean(row.attended)})).filter((row:any)=>Number.isInteger(row.staffId)&&row.staffId>0&&Number.isInteger(row.day)&&row.day>0&&row.day<=days) : [];
  await env.DB.prepare("UPDATE trainings SET training_name=?,training_date=?,training_agency=?,funder=?,trainer_name=?,trainee_count=?,location=?,training_days=?,training_hours=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(name,date,body.trainingAgency||null,body.funder||null,body.trainerName||null,body.trainingType==="staff"?attendees.length:Math.max(0,Number(body.traineeCount||0)),body.location||null,days,Math.max(0,Number(body.trainingHours||0)),id).run();
  if (body.trainingType === "staff") {
    for (const row of attendees) await env.DB.prepare("UPDATE training_attendees SET attended=? WHERE training_id=? AND staff_id=?").bind(row.attended?1:0,id,row.staffId).run();
    for (const row of daily) await env.DB.prepare("INSERT INTO training_attendance (training_id,staff_id,training_day,attended) VALUES (?,?,?,?) ON CONFLICT (training_id,staff_id,training_day) DO UPDATE SET attended=EXCLUDED.attended").bind(id,row.staffId,row.day,row.attended?1:0).run();
  }
  const actor = access.profile?.full_name || access.profile?.username || access.email || "مستخدم النظام";
  await env.DB.prepare("INSERT INTO audit_logs (actor,action,entity_type,entity_id,details) VALUES (?,'update','training',?,?)").bind(actor,String(id),JSON.stringify({trainingName:name})).run();
  return NextResponse.json({ ok: true });
}
