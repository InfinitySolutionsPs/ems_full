import { env } from "@/lib/server-env";
import { NextRequest, NextResponse } from "next/server";
import { getAccess,hasPermission } from "@/lib/access";

export async function GET(request: NextRequest) {
  const access=await getAccess(request);if(!hasPermission(access.profile,"capacity.view"))return NextResponse.json({error:"لا توجد صلاحية لعرض القدرة التشغيلية"},{status:403});
  // Archived assignments are imported explicitly during data migration. Loading
  // the table must never recreate a row that an administrator has deleted.
  const date = request.nextUrl.searchParams.get("date");
  const from =
    request.nextUrl.searchParams.get("from") ||
    date ||
    new Date().toISOString().slice(0, 10);
  const to = request.nextUrl.searchParams.get("to") || date || from;
  const result = await env.DB.prepare(
    `SELECT oa.*, s.full_name, s.cadre_type, s.job_title,
    st.name station_name, st.center_id, c.name center_name, v.plate_number vehicle_number
    FROM operational_assignments oa JOIN staff s ON s.id=oa.staff_id
    JOIN stations st ON st.id=oa.station_id LEFT JOIN centers c ON c.id=st.center_id LEFT JOIN vehicles v ON v.id=oa.vehicle_id
    WHERE oa.work_date BETWEEN ? AND ? ORDER BY oa.work_date DESC, st.name, oa.shift, s.full_name`,
  )
    .bind(from, to)
    .all();
  return NextResponse.json({ assignments: result.results });
}

export async function PATCH(request: NextRequest) {
  const access = await getAccess(request);
  if (
    !hasPermission(access.profile,"capacity.manage")
  )
    return NextResponse.json(
      { error: "لا توجد صلاحية لتعديل جدول الدوام" },
      { status: 403 },
    );
  const b = (await request.json()) as Record<string, string | number | null>;
  if (!b.id || !b.workDate || !b.staffId || !b.stationId || !b.shift)
    return NextResponse.json(
      { error: "يرجى استكمال البيانات الإلزامية" },
      { status: 400 },
    );
  const links = await env.DB.prepare("SELECT s.center_id staff_center,st.center_id station_center FROM staff s CROSS JOIN stations st WHERE s.id=? AND st.id=?").bind(b.staffId,b.stationId).first<any>();
  if (!links || !links.staff_center || links.staff_center!==links.station_center) return NextResponse.json({error:"الموظف لا يتبع المركز المرتبط بالمحطة المختارة"},{status:400});
  if (b.vehicleId) { const vehicle=await env.DB.prepare("SELECT center_id FROM vehicles WHERE id=? AND active=1").bind(b.vehicleId).first<any>(); if(!vehicle||vehicle.center_id!==links.station_center) return NextResponse.json({error:"المركبة لا تتبع المركز المختار أو أنها خارج الخدمة"},{status:400}); }
  await env.DB.prepare(
    `UPDATE operational_assignments SET work_date=?,staff_id=?,station_id=?,shift=?,duty_type=?,vehicle_id=?,work_location=?,attendance_status=?,notes=? WHERE id=?`,
  )
    .bind(
      b.workDate,
      b.staffId,
      b.stationId,
      b.shift,
      b.dutyType || "دوام مركز",
      b.vehicleId || null,
      b.workLocation || null,
      b.attendanceStatus || "حاضر",
      b.notes || null,
      b.id,
    )
    .run();
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const access = await getAccess(request);
  if (!hasPermission(access.profile,"capacity.manage"))
    return NextResponse.json(
      { error: "حذف التكليف متاح لمدير النظام فقط" },
      { status: 403 },
    );
  const id = request.nextUrl.searchParams.get("id");
  if (!id)
    return NextResponse.json({ error: "السجل غير محدد" }, { status: 400 });
  const assignment = await env.DB.prepare(
    "SELECT id FROM operational_assignments WHERE id=?",
  ).bind(id).first();
  if (!assignment)
    return NextResponse.json(
      { error: "التكليف غير موجود أو حُذف مسبقًا" },
      { status: 404 },
    );
  await env.DB.prepare("DELETE FROM operational_assignments WHERE id=?").bind(id).run();
  await env.DB.prepare(
    "INSERT INTO audit_logs (actor,action,entity_type,entity_id,details) VALUES (?,?,?,?,?)",
  ).bind(access.email, "delete", "operational_assignment", id, "حذف تكليف من جدول القدرة التشغيلية").run();
  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  const access = await getAccess(request);
  if (
    !hasPermission(access.profile,"capacity.manage")
  )
    return NextResponse.json(
      { error: "لا توجد صلاحية لإدخال القدرة التشغيلية" },
      { status: 403 },
    );
  const b = (await request.json()) as Record<string, string | number | null>;
  if (!b.workDate || !b.staffId || !b.stationId || !b.shift)
    return NextResponse.json(
      { error: "يرجى استكمال الموظف والمركز والتاريخ والوردية" },
      { status: 400 },
    );
  const links = await env.DB.prepare("SELECT s.center_id staff_center,st.center_id station_center FROM staff s CROSS JOIN stations st WHERE s.id=? AND st.id=?").bind(b.staffId,b.stationId).first<any>();
  if (!links || !links.staff_center || links.staff_center!==links.station_center) return NextResponse.json({error:"الموظف لا يتبع المركز المرتبط بالمحطة المختارة"},{status:400});
  if (b.vehicleId) { const vehicle=await env.DB.prepare("SELECT center_id FROM vehicles WHERE id=? AND active=1").bind(b.vehicleId).first<any>(); if(!vehicle||vehicle.center_id!==links.station_center) return NextResponse.json({error:"المركبة لا تتبع المركز المختار أو أنها خارج الخدمة"},{status:400}); }
  const duplicate = await env.DB.prepare(
    "SELECT id FROM operational_assignments WHERE work_date=? AND staff_id=? AND shift=? LIMIT 1",
  )
    .bind(b.workDate, b.staffId, b.shift)
    .first();
  if (duplicate)
    return NextResponse.json(
      { error: "الموظف مسجل مسبقًا في هذه الوردية" },
      { status: 409 },
    );
  const result = await env.DB.prepare(
    `INSERT INTO operational_assignments
    (work_date,staff_id,station_id,shift,duty_type,vehicle_id,work_location,attendance_status,notes,created_by)
    VALUES (?,?,?,?,?,?,?,?,?,?)`,
  )
    .bind(
      b.workDate,
      b.staffId,
      b.stationId,
      b.shift,
      b.dutyType || "دوام مركز",
      b.vehicleId || null,
      b.workLocation || null,
      b.attendanceStatus || "حاضر",
      b.notes || null,
      access.email,
    )
    .run();
  return NextResponse.json(
    { ok: true, id: result.meta.last_row_id },
    { status: 201 },
  );
}
