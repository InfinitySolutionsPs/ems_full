import { env } from "@/lib/server-env";
import { NextRequest, NextResponse } from "next/server";
import { getAccess, hasPermission } from "@/lib/access";

const clean = (v: unknown) => (typeof v === "string" ? v.trim() : v);
const minutesBetween = (a?: string, b?: string) => {
  if (!a || !b) return 0;
  const [ah, am] = a.split(":").map(Number),
    [bh, bm] = b.split(":").map(Number);
  const value = bh * 60 + bm - (ah * 60 + am);
  return value < 0 ? value + 1440 : value;
};
const minutesBetweenDates = (ad?: unknown, at?: unknown, bd?: unknown, bt?: unknown) => {
  if (!at || !bt) return 0;
  const start = new Date(`${String(ad || "2000-01-01")}T${String(at)}`);
  const end = new Date(`${String(bd || ad || "2000-01-01")}T${String(bt)}`);
  const value = Math.round((end.getTime() - start.getTime()) / 60000);
  return Number.isFinite(value) && value >= 0 ? value : minutesBetween(String(at), String(bt));
};

async function nextIncidentCode() {
  const row = await env.DB.prepare(
    "SELECT 'EMS-' || TO_CHAR(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Hebron','YYYY') || '-' || LPAD(nextval('incident_code_seq')::text,6,'0') code",
  ).first<{ code: string }>();
  if (!row?.code) throw new Error("failed to generate incident code");
  return row.code;
}

export async function GET(request: NextRequest) {
  const access = await getAccess(request);
  const url = new URL(request.url);
  if (url.searchParams.get("mode") === "next-code") {
    if (!hasPermission(access.profile, "incidents.create"))
      return NextResponse.json({ error: "لا توجد صلاحية لإنشاء البلاغات" }, { status: 403 });
    try {
      return NextResponse.json({ code: await nextIncidentCode() });
    } catch (error) {
      console.error("incident code generation failed", error);
      return NextResponse.json({ error: "تعذر إنشاء كود البلاغ" }, { status: 500 });
    }
  }
  if (!hasPermission(access.profile,"incidents.view")) return NextResponse.json({ error: "لا توجد صلاحية لعرض البلاغات" }, { status: 403 });
  const from = url.searchParams.get("from") || "1900-01-01";
  const to = url.searchParams.get("to") || "2999-12-31";
  const governorate = url.searchParams.get("governorate") || "all";
  const category = url.searchParams.get("category") || "all";
  let sql = "SELECT * FROM incidents WHERE call_date BETWEEN ? AND ?";
  const args: unknown[] = [from, to];
  if (governorate !== "all") {
    sql += " AND pickup_governorate = ?";
    args.push(governorate);
  }
  if (category !== "all") {
    sql += " AND category = ?";
    args.push(category);
  }
  if (access.profile?.role === "station_user") {
    sql += " AND station = ?";
    args.push(access.profile.station);
  }
  sql += " ORDER BY call_date DESC, call_time DESC LIMIT 1000";
  try {
    const result = await env.DB.prepare(sql)
      .bind(...args)
      .all();
    return NextResponse.json(
      { incidents: result.results },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("incidents list query failed", error);
    return NextResponse.json(
      { error: "تعذر تحميل سجل البلاغات من قاعدة البيانات" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>;
  const access = await getAccess(request);
  const submissionAction = body.submissionAction === "approve" ? "approve" : "draft";
  const isDraft = submissionAction === "draft";
  if (
    !hasPermission(access.profile,"incidents.create")
  )
    return NextResponse.json(
      { error: "لا تملك صلاحية إدخال البلاغات" },
      { status: 403 },
    );
  if (access.profile?.role === "station_user") {
    if (body.station && body.station !== access.profile.station)
      return NextResponse.json({ error: "يمكنك الإدخال للمحطة المحددة في حسابك فقط" }, { status: 403 });
    body.station = access.profile.station || "";
  }
  const incidentStatus = String(body.incidentStatus || "completed");
  if (!["cancelled_before_dispatch", "cancelled_after_dispatch", "completed"].includes(incidentStatus))
    return NextResponse.json({ error: "حالة البلاغ غير صالحة" }, { status: 400 });
  const requiresMovement = incidentStatus !== "cancelled_before_dispatch";
  const requiresDelivery = incidentStatus === "completed";
  const required = [
    "gender",
    "urgency",
    "category",
    "caseType",
    "shift",
    "station",
    "callDate",
    "callTime",
  ];
  if (incidentStatus === "completed") required.push("pickupGovernorate");
  if (requiresMovement) required.push("vehicle");
  if (incidentStatus === "cancelled_after_dispatch")
    required.push("dispatchTime", "returnTime", "returnLocation", "kmEnd");
  if (
    requiresDelivery &&
    String(body.dropoffType || "").startsWith("Hospital")
  )
    required.push("dropoffLocation");
  const missing = isDraft ? [] : required.filter((key) => !clean(body[key]));
  if (missing.length)
    return NextResponse.json(
      { error: "يرجى استكمال الحقول الإلزامية", fields: missing },
      { status: 400 },
    );
  let additionalBeneficiaries: Record<string, unknown>[] = [];
  try {
    const value = typeof body.additionalBeneficiaries === "string" ? JSON.parse(body.additionalBeneficiaries) : body.additionalBeneficiaries;
    if (Array.isArray(value)) additionalBeneficiaries = value.filter((row): row is Record<string,unknown> => Boolean(row && typeof row === "object"));
  } catch {
    return NextResponse.json({ error: "بيانات المستفيدين الإضافيين غير صالحة" }, { status: 400 });
  }
  if (!isDraft) {
    const invalidBeneficiary = additionalBeneficiaries.find((row) => !clean(row.gender) || !clean(row.urgency) || !clean(row.category) || !clean(row.caseType));
    if (invalidBeneficiary) return NextResponse.json({ error: "يرجى استكمال الحقول الإلزامية لكل مستفيد إضافي" }, { status: 400 });
  }
  let kmStart = 0;
  const kmEnd = !requiresMovement || body.kmEnd === "" || body.kmEnd == null ? null : Number(body.kmEnd);
  const responseMinutes = minutesBetweenDates(body.callDate, body.dispatchTime || body.callTime, body.callDate, body.arrivalTime);
  const serviceMinutes = minutesBetweenDates(body.callDate, body.callTime, body.callDate, body.clearTime);
  const actor = access.profile?.full_name || access.profile?.username || access.email || "مستخدم النظام";
  try {
    const incidentCode = String(clean(body.incidentCode) || await nextIncidentCode());
    const incidentNumber = String(clean(body.incidentNumber) || incidentCode);
    const chosenVehicle = requiresMovement && body.vehicle ? await env.DB.prepare("SELECT v.id,v.mileage_km FROM vehicles v JOIN stations s ON s.id=v.station_id WHERE v.plate_number=? AND v.active=1 AND s.name=?").bind(body.vehicle,body.station).first<{id:number;mileage_km:number|null}>() : null;
    if (!isDraft && requiresMovement && body.vehicle && !chosenVehicle) return NextResponse.json({error:"المركبة لا تتبع المحطة المختارة أو أنها خارج الخدمة"},{status:400});
    kmStart=chosenVehicle?Number(chosenVehicle.mileage_km||0):0;
    if (!isDraft && kmEnd!=null && (!Number.isFinite(kmEnd) || kmEnd<kmStart)) return NextResponse.json({error:"عداد النهاية يجب أن يساوي أو يزيد عن عداد المركبة الحالي"},{status:400});
    const distanceKm=kmEnd==null?0:kmEnd-kmStart;
    const beneficiaries = [{...body}, ...additionalBeneficiaries];
    const groupCode = beneficiaries.length > 1 ? incidentCode : null;
    const created: {id:number;code:string;number:string}[] = [];
    for (let index=0; index<beneficiaries.length; index+=1) {
      const beneficiary = beneficiaries[index];
      const code = index===0 ? incidentCode : await nextIncidentCode();
      const number = index===0 ? incidentNumber : code;
      const complaint = beneficiary.chiefComplaint === "__other" ? beneficiary.chiefComplaintOther : beneficiary.chiefComplaint;
      const entries: [string, unknown][] = [
        ["incident_number",number],["incident_code",code],["incident_group_code",groupCode],["beneficiary_sequence",index+1],["incident_status",incidentStatus],["beneficiary_name",beneficiary.beneficiaryName],["gender",beneficiary.gender||""],["contact",beneficiary.contact],["age",beneficiary.age?Number(beneficiary.age):null],
        ["urgency",beneficiary.urgency||""],["category",beneficiary.category||""],["case_type",beneficiary.caseType||""],["pickup_type",requiresDelivery?body.pickupType:null],["pickup_location",requiresDelivery?body.pickupLocation:null],["pickup_governorate",requiresDelivery?(body.pickupGovernorate||""):""],
        ["pickup_municipality",requiresDelivery?body.pickupMunicipality:null],["pickup_neighborhood",requiresDelivery?body.pickupNeighborhood:null],["dropoff_type",requiresDelivery?body.dropoffType:null],["dropoff_location",requiresDelivery?body.dropoffLocation:null],
        ["shift",body.shift],["station",body.station],["vehicle",requiresMovement?body.vehicle:null],["vehicle_id",chosenVehicle?.id||null],["km_start",requiresMovement?(kmStart||null):null],["km_end",requiresMovement?kmEnd:null],["distance_km",index===0&&requiresMovement?distanceKm:0],
        ["call_date",body.callDate||new Date().toISOString().slice(0,10)],["call_time",body.callTime||""],["entry_time",body.entryTime||""],["dispatch_date",requiresMovement&&body.dispatchTime?body.callDate:null],["dispatch_time",requiresMovement?body.dispatchTime:null],["on_scene_date",requiresMovement&&body.arrivalTime?body.callDate:null],["arrival_time",requiresMovement?body.arrivalTime:null],
        ["hospital_date",requiresDelivery&&body.hospitalTime?body.callDate:null],["hospital_time",requiresDelivery?body.hospitalTime:null],["available_date",requiresMovement&&body.clearTime?body.callDate:null],["clear_time",requiresMovement?body.clearTime:null],["return_time",requiresMovement?body.returnTime:null],["return_location",incidentStatus==="cancelled_after_dispatch"?body.returnLocation:null],["response_minutes",responseMinutes],["service_minutes",serviceMinutes],
        ["dispatcher_primary",body.dispatcherPrimary],["dispatcher_secondary",body.dispatcherSecondary],["emt_driver",body.emtDriver],["emt_lead",body.emtLead],["emt_assist",body.emtAssist],
        ["crew",body.crew],["interventions",requiresDelivery?(beneficiary.interventions||body.interventions):null],["chief_complaint",requiresDelivery?complaint:null],["fuel_liters",index===0?Number(body.fuelLiters||0):0],["notes",body.notes],
        ["emergency_event_type",body.emergencyEventType||null],["emergency_event_notes",body.emergencyEventNotes||null],["cancelled",incidentStatus==="completed"?0:1],
        ...["patientDeceased","conflictRelated","oxygen","bvm","airway","cpr","aed","drugs","woundCare","tourniquet","immobilization","cervicalCollar","glucoseCheck","splinting","delivery"].map((k)=>[k.replace(/[A-Z]/g,m=>`_${m.toLowerCase()}`), (k==="patientDeceased"&&beneficiary.category==="Martyr")||(k==="delivery"&&beneficiary.category==="Delivery")||beneficiary[k]||body[k]?1:0] as [string,unknown]),
        ["approval_status",isDraft?"draft":"approved"],["approved_by",isDraft?null:actor],["approved_at",isDraft?null:new Date().toISOString()],["data_quality_status","ok"],["created_by",actor],["created_by_user_id",access.profile?.id||null],
      ];
      const result = await env.DB.prepare(`INSERT INTO incidents (${entries.map(([k])=>k).join(",")}) VALUES (${entries.map(()=>"?").join(",")})`).bind(...entries.map(([,v])=>clean(v))).run();
      created.push({id:Number(result.meta.last_row_id),code,number});
      await env.DB.prepare("INSERT INTO audit_logs (actor, actor_user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, 'incident', ?, ?)")
        .bind(actor, access.profile?.id||null, isDraft?"draft_create":"approve_create", String(result.meta.last_row_id), JSON.stringify({incidentNumber:number,status:isDraft?"draft":"approved",groupCode,beneficiarySequence:index+1})).run();
    }
    const incidentId = created[0].id;
    if (body.previousIncidentCode) await env.DB.prepare("UPDATE incidents SET followup_incident_code=? WHERE incident_code=?").bind(incidentCode,body.previousIncidentCode).run();
    if (!isDraft && chosenVehicle && kmEnd!=null) await env.DB.prepare("UPDATE vehicles SET mileage_km=? WHERE id=?").bind(kmEnd,chosenVehicle.id).run();
    if (!isDraft && requiresMovement && chosenVehicle && body.dispatchTime) await env.DB.prepare(`INSERT INTO vehicle_movements (vehicle_id,incident_id,driver_name,departed_at,returned_at,km_start,km_end,destination,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT (incident_id) WHERE incident_id IS NOT NULL DO UPDATE SET vehicle_id=EXCLUDED.vehicle_id,driver_name=EXCLUDED.driver_name,departed_at=EXCLUDED.departed_at,returned_at=EXCLUDED.returned_at,km_start=EXCLUDED.km_start,km_end=EXCLUDED.km_end,destination=EXCLUDED.destination,notes=EXCLUDED.notes,created_by=EXCLUDED.created_by`)
      .bind(chosenVehicle.id,incidentId,body.emtDriver||null,`${body.callDate}T${body.dispatchTime}`,body.returnTime?`${body.callDate}T${body.returnTime}`:null,kmStart,kmEnd,incidentStatus==="cancelled_after_dispatch"?body.returnLocation:(body.dropoffLocation||body.pickupLocation||null),incidentStatus==="cancelled_after_dispatch"?"حركة بلاغ ملغي بعد تحرك المركبة":"حركة مرتبطة ببلاغ",actor).run();
    return NextResponse.json(
      {
        ok: true,
        id: incidentId,
        incidentCode,
        incidentNumber,
        incidentCodes: created.map(row=>row.code),
        createdCount: created.length,
        distanceKm,
        responseMinutes,
        serviceMinutes,
        approvalStatus: isDraft ? "draft" : "approved",
      },
      { status: 201 },
    );
  } catch (error) {
    if (String(error).includes("UNIQUE"))
      return NextResponse.json(
        { error: "كود البلاغ مستخدم مسبقًا" },
        { status: 409 },
      );
    return NextResponse.json({ error: "تعذر حفظ البلاغ" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>;
  const access = await getAccess(request);
  const submissionAction = body.submissionAction === "approve" ? "approve" : "draft";
  const nextApprovalStatus = submissionAction === "approve" ? "approved" : "draft";
  if (!access.profile) return NextResponse.json({ error: "يرجى تسجيل الدخول" }, { status: 401 });
  const current = await env.DB.prepare(
    "SELECT * FROM incidents WHERE id=?",
  )
    .bind(body.id)
    .first<Record<string, unknown>>();
  if (!current)
    return NextResponse.json({ error: "البلاغ غير موجود" }, { status: 404 });
  const ownsDraft = current.approval_status === "draft" && Number(current.created_by_user_id) === access.profile.id;
  const canEditApproved = hasPermission(access.profile,"incidents.edit_approved");
  const canEditOther = hasPermission(access.profile,"incidents.edit");
  if (current.approval_status === "approved" ? !canEditApproved : !(ownsDraft || canEditOther))
    return NextResponse.json({ error: "البلاغ المعتمد مقفل، وتعديله يحتاج صلاحية خاصة" }, { status: 403 });
  if (access.profile.role === "station_user") {
    if ((current.station && current.station !== access.profile.station) || (body.station && body.station !== access.profile.station))
      return NextResponse.json({ error: "يمكنك تعديل بلاغات محطتك فقط" }, { status: 403 });
    body.station = access.profile.station || "";
  }
  const responseMinutes = minutesBetweenDates(body.callDate, body.dispatchTime || body.callTime, body.callDate, body.arrivalTime);
  const serviceMinutes = minutesBetweenDates(body.callDate, body.callTime, body.callDate, body.clearTime);
  const incidentStatus = String(body.incidentStatus || current.incident_status || "completed");
  const requiresMovement = incidentStatus !== "cancelled_before_dispatch";
  const requiresDelivery = incidentStatus === "completed";
  if (submissionAction === "approve") {
    const required = ["gender","urgency","category","caseType","shift","station","callDate","callTime"];
    if (incidentStatus === "completed") required.push("pickupGovernorate");
    if (requiresMovement) required.push("vehicle");
    if (incidentStatus === "cancelled_after_dispatch") required.push("dispatchTime","returnTime","returnLocation","kmEnd");
    if (requiresDelivery && String(body.dropoffType||"").startsWith("Hospital")) required.push("dropoffLocation");
    const missing = required.filter((key)=>!clean(body[key]));
    if (missing.length) return NextResponse.json({error:"يرجى استكمال الحقول الإلزامية قبل اعتماد البلاغ",fields:missing},{status:400});
  }
  let kmStart = 0;
  const kmEnd = body.kmEnd === "" || body.kmEnd == null ? null : Number(body.kmEnd);
  const chosenVehicle = requiresMovement && body.vehicle ? await env.DB.prepare("SELECT v.id,v.mileage_km FROM vehicles v JOIN stations s ON s.id=v.station_id WHERE v.plate_number=? AND s.name=?").bind(body.vehicle,body.station).first<{id:number;mileage_km:number|null}>() : null;
  if (submissionAction === "approve" && requiresMovement && body.vehicle && !chosenVehicle) return NextResponse.json({error:"المركبة لا تتبع المحطة المختارة"},{status:400});
  kmStart=chosenVehicle?Number(chosenVehicle.mileage_km||0):0;
  if (submissionAction === "approve" && kmEnd!=null && (!Number.isFinite(kmEnd) || kmEnd<kmStart)) return NextResponse.json({error:"عداد النهاية يجب أن يساوي أو يزيد عن عداد المركبة الحالي"},{status:400});
  const updates: [string,unknown][] = [
    ["incident_status",incidentStatus],["beneficiary_name",body.beneficiaryName],["gender",body.gender||""],["contact",body.contact],["age",body.age?Number(body.age):null],["urgency",body.urgency||""],["category",body.category||""],["case_type",body.caseType||""],
    ["pickup_type",requiresDelivery?body.pickupType:null],["pickup_location",requiresDelivery?body.pickupLocation:null],["pickup_governorate",requiresDelivery?(body.pickupGovernorate||""):""],["pickup_municipality",requiresDelivery?body.pickupMunicipality:null],["pickup_neighborhood",requiresDelivery?body.pickupNeighborhood:null],
    ["dropoff_type",requiresDelivery?body.dropoffType:null],["dropoff_location",requiresDelivery?body.dropoffLocation:null],["station",body.station],["shift",body.shift],["vehicle",requiresMovement?body.vehicle:null],["vehicle_id",requiresMovement?(chosenVehicle?.id||null):null],
    ["call_date",body.callDate],["call_time",body.callTime],["entry_time",body.entryTime||current.entry_time],["dispatch_date",requiresMovement&&body.dispatchTime?body.callDate:null],["dispatch_time",requiresMovement?body.dispatchTime:null],["on_scene_date",requiresMovement&&body.arrivalTime?body.callDate:null],["arrival_time",requiresMovement?body.arrivalTime:null],
    ["hospital_date",requiresDelivery&&body.hospitalTime?body.callDate:null],["hospital_time",requiresDelivery?body.hospitalTime:null],["available_date",requiresMovement&&body.clearTime?body.callDate:null],["clear_time",requiresMovement?body.clearTime:null],["return_time",requiresMovement?body.returnTime:null],["return_location",incidentStatus==="cancelled_after_dispatch"?body.returnLocation:null],
    ["km_start",chosenVehicle?kmStart:null],["km_end",kmEnd],["distance_km",kmEnd==null?0:kmEnd-kmStart],["response_minutes",responseMinutes],["service_minutes",serviceMinutes],
    ["dispatcher_primary",body.dispatcherPrimary],["dispatcher_secondary",body.dispatcherSecondary],["emt_driver",body.emtDriver],["emt_lead",body.emtLead],["emt_assist",body.emtAssist],
    ["interventions",requiresDelivery?body.interventions:null],["chief_complaint",requiresDelivery?body.chiefComplaint:null],["fuel_liters",Number(body.fuelLiters||0)],["notes",body.notes],
    ...["cancelled","patientDeceased","conflictRelated","oxygen","bvm","airway","cpr","aed","drugs","woundCare","tourniquet","immobilization","cervicalCollar","glucoseCheck","splinting","delivery"].map((k)=>[k.replace(/[A-Z]/g,m=>`_${m.toLowerCase()}`), (k==="patientDeceased"&&body.category==="Martyr")||(k==="delivery"&&body.category==="Delivery")||body[k]?1:0] as [string,unknown]),
  ];
  const actor = access.profile.full_name || access.profile.username || access.email || "مستخدم النظام";
  const changes = Object.fromEntries(updates.filter(([key,value])=>String(current[key]??"")!==String(clean(value)??"")).map(([key,value])=>[key,{before:current[key]??null,after:clean(value)??null}]));
  await env.DB.prepare(`UPDATE incidents SET ${updates.map(([k])=>`${k}=?`).join(",")},approval_status=?,approved_by=?,approved_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .bind(...updates.map(([,v])=>clean(v)),nextApprovalStatus,nextApprovalStatus==="approved"?actor:null,nextApprovalStatus==="approved"?new Date().toISOString():null,body.id).run();
  if (submissionAction === "approve" && chosenVehicle && kmEnd!=null) await env.DB.prepare("UPDATE vehicles SET mileage_km=? WHERE id=?").bind(kmEnd,chosenVehicle.id).run();
  if (submissionAction === "approve" && !requiresMovement) await env.DB.prepare("DELETE FROM vehicle_movements WHERE incident_id=?").bind(body.id).run();
  else if (submissionAction === "approve" && chosenVehicle && body.dispatchTime) await env.DB.prepare(`INSERT INTO vehicle_movements (vehicle_id,incident_id,driver_name,departed_at,returned_at,km_start,km_end,destination,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT (incident_id) WHERE incident_id IS NOT NULL DO UPDATE SET vehicle_id=EXCLUDED.vehicle_id,driver_name=EXCLUDED.driver_name,departed_at=EXCLUDED.departed_at,returned_at=EXCLUDED.returned_at,km_start=EXCLUDED.km_start,km_end=EXCLUDED.km_end,destination=EXCLUDED.destination,notes=EXCLUDED.notes,created_by=EXCLUDED.created_by`)
    .bind(chosenVehicle.id,body.id,body.emtDriver||null,`${body.callDate}T${body.dispatchTime}`,body.returnTime?`${body.callDate}T${body.returnTime}`:null,kmStart,kmEnd,incidentStatus==="cancelled_after_dispatch"?body.returnLocation:(body.dropoffLocation||body.pickupLocation||null),incidentStatus==="cancelled_after_dispatch"?"حركة بلاغ ملغي بعد تحرك المركبة":"حركة مرتبطة ببلاغ",actor).run();
  await env.DB.prepare(
    "INSERT INTO audit_logs (actor,actor_user_id,action,entity_type,entity_id,details) VALUES (?,?,?,'incident',?,?)",
  )
    .bind(actor,access.profile.id,nextApprovalStatus==="approved"?"update_approved":"update_draft",String(body.id),JSON.stringify({incidentNumber:current.incident_number,changes}))
    .run();
  return NextResponse.json({ ok: true, approvalStatus: nextApprovalStatus });
}

export async function DELETE(request: NextRequest) {
  const access = await getAccess(request);
  if (!hasPermission(access.profile,"incidents.delete"))
    return NextResponse.json({ error: "حذف البلاغات متاح لمدير النظام فقط" }, { status: 403 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: "رقم البلاغ غير صالح" }, { status: 400 });
  const current = await env.DB.prepare("SELECT incident_number FROM incidents WHERE id=?").bind(id).first<{incident_number:string}>();
  if (!current) return NextResponse.json({ error: "البلاغ غير موجود" }, { status: 404 });
  await env.DB.prepare("DELETE FROM incidents WHERE id=?").bind(id).run();
  await env.DB.prepare("INSERT INTO audit_logs (actor,action,entity_type,entity_id,details) VALUES (?,'delete','incident',?,?)")
    .bind(access.email, String(id), `حذف البلاغ ${current.incident_number}`).run();
  return NextResponse.json({ ok: true });
}
