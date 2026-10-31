import { env } from "@/lib/server-env";
import { NextRequest, NextResponse } from "next/server";
import { getAccess,hasPermission } from "@/lib/access";
import fleet from "@/lib/fleet-seed.json";

const reply = (error: string, status = 400) => NextResponse.json({ error }, { status });
const text = (v: unknown) => typeof v === "string" ? v.trim() : "";
const number = (v: unknown) => v === "" || v == null ? null : Number(v);
const validDate = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v);

export async function GET(request: NextRequest) {
  const access = await getAccess(request);
  if (!hasPermission(access.profile,"fleet.view")) return reply("لا توجد صلاحية لعرض الأسطول", 403);
  if (!access.profile) return reply("يرجى تسجيل الدخول",401);
  await env.DB.batch([
    env.DB.prepare("INSERT INTO stations (code,name,governorate) VALUES ('GAZ','محطة غزة','غزة') ON CONFLICT(code) DO NOTHING"),
    env.DB.prepare("INSERT INTO stations (code,name,governorate) VALUES ('JAB','محطة جباليا','شمال غزة') ON CONFLICT(code) DO NOTHING"),
    env.DB.prepare("INSERT INTO stations (code,name,governorate) VALUES ('DEI','محطة دير البلح','الوسطى') ON CONFLICT(code) DO NOTHING"),
  ]);
  const existingFleet=await env.DB.prepare("SELECT plate_number FROM vehicles").all();
  const knownFleet=new Set(existingFleet.results.map((x:any)=>String(x.plate_number).replace(/\s/g,"")));
  const stationRows=await env.DB.prepare("SELECT code,center_id FROM stations").all();
  const centerIds=new Map(stationRows.results.map((x:any)=>[x.code,Number(x.center_id)]));
  const stationCode=(location:string)=>String(location||"").includes("دير")?"DEI":String(location||"").includes("جباليا")?"JAB":"GAZ";
  const pending=fleet.filter((v:any)=>!knownFleet.has(String(v.plate).replace(/\s/g,"")));
  for(let i=0;i<pending.length;i+=40) await env.DB.batch(pending.slice(i,i+40).map((v:any)=>env.DB.prepare("INSERT INTO vehicles (plate_number,manufacturer,model,production_year,chassis_number,fuel_type,mileage_km,ambulance_type,usage_status,work_location,service_status,active,fleet_source_row,center_id) VALUES (?,?,?,?,?,?,?,?,? ,?,'active',1,?,?) ON CONFLICT(plate_number) DO NOTHING").bind(v.plate,v.manufacturer||null,v.model||null,Number(v.productionYear)||null,v.chassis||null,v.fuelType||null,Number(v.mileage)||null,v.ambulanceType||null,v.usage||null,v.location||null,v.sourceRow,centerIds.get(stationCode(v.location))||null)));
  const station = access.profile.role === "station_user" ? access.profile.station : null;
  const query = new URL(request.url).searchParams;
  const from = query.get("from") || "1900-01-01";
  const to = query.get("to") || "2999-12-31";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) return reply("الفترة غير صالحة");
  const vehicles = await env.DB.prepare("SELECT v.*,v.center_id station_id,c.name station_name,c.name center_name FROM vehicles v LEFT JOIN centers c ON c.id=v.center_id ORDER BY v.plate_number").all();
  const scope = station ? await env.DB.prepare(`SELECT id center_id FROM centers WHERE name=?
    UNION ALL SELECT center_id FROM stations WHERE name=? AND center_id IS NOT NULL LIMIT 1`).bind(station,station).first<any>() : null;
  const available = scope?.center_id ? vehicles.results.filter((v: any) => Number(v.center_id) === Number(scope.center_id)) : station ? [] : vehicles.results;
  const ids = new Set(available.map((v: any) => Number(v.id)));
  const detailVehicleId = Number(query.get("vehicleId") || 0);
  if (query.has("vehicleId")) {
    if (!Number.isInteger(detailVehicleId) || detailVehicleId < 1) return reply("رقم المركبة غير صالح");
    const vehicle = available.find((v:any)=>Number(v.id)===detailVehicleId);
    if (!vehicle) return reply("المركبة غير موجودة أو خارج نطاق مركزك",404);
    const canViewIncidents = hasPermission(access.profile,"incidents.view");
    const canViewMaintenance = hasPermission(access.profile,"maintenance.view");
    const [detailIncidents,detailFuel,detailMovements,detailMaintenance] = await Promise.all([
      canViewIncidents ? env.DB.prepare(`SELECT id,incident_number,call_date,call_time,beneficiary_name,case_type,urgency,station,approval_status,incident_status,distance_km
        FROM incidents WHERE vehicle_id=? OR TRIM(vehicle)=TRIM(?) ORDER BY call_date DESC,call_time DESC LIMIT 2000`).bind(detailVehicleId,vehicle.plate_number).all() : Promise.resolve({results:[]}),
      env.DB.prepare(`SELECT f.*,i.incident_number FROM fuel_fillings f LEFT JOIN incidents i ON i.id=f.incident_id
        WHERE f.vehicle_id=? ORDER BY f.filled_at DESC LIMIT 2000`).bind(detailVehicleId).all(),
      env.DB.prepare(`SELECT m.*,i.incident_number FROM vehicle_movements m LEFT JOIN incidents i ON i.id=m.incident_id
        WHERE m.vehicle_id=? ORDER BY m.departed_at DESC LIMIT 2000`).bind(detailVehicleId).all(),
      canViewMaintenance ? env.DB.prepare(`SELECT m.id,m.request_date,m.department,m.odometer_km,m.requested_repair,m.failure_cause,m.driver_name,m.status,m.performed_work,m.received_at,m.received_by,s.name station_name
        FROM vehicle_maintenance m LEFT JOIN stations s ON s.id=m.station_id WHERE m.vehicle_id=? ORDER BY m.request_date DESC,m.id DESC LIMIT 1000`).bind(detailVehicleId).all() : Promise.resolve({results:[]}),
    ]);
    return NextResponse.json({vehicle,incidents:detailIncidents.results,fuel:detailFuel.results,movements:detailMovements.results,maintenance:detailMaintenance.results});
  }
  const [fuel, movements, incidents] = await env.DB.batch([
    env.DB.prepare("SELECT f.*,v.plate_number,i.incident_number FROM fuel_fillings f JOIN vehicles v ON v.id=f.vehicle_id LEFT JOIN incidents i ON i.id=f.incident_id WHERE substr(f.filled_at,1,10) BETWEEN ? AND ? ORDER BY f.filled_at DESC LIMIT 1000").bind(from,to),
    env.DB.prepare("SELECT m.*,v.plate_number,i.incident_number FROM vehicle_movements m JOIN vehicles v ON v.id=m.vehicle_id LEFT JOIN incidents i ON i.id=m.incident_id WHERE substr(m.departed_at,1,10) BETWEEN ? AND ? ORDER BY m.departed_at DESC LIMIT 1000").bind(from,to),
    env.DB.prepare("SELECT i.id,i.incident_number,i.vehicle,i.vehicle_id,i.call_date,i.distance_km,i.fuel_liters,i.station,i.approval_status FROM incidents i WHERE i.call_date BETWEEN ? AND ? ORDER BY i.call_date DESC LIMIT 5000").bind(from,to),
  ]);
  const normalize = (v: unknown) => text(v).replace(/\s/g, "");
  const plates = new Set(available.map((v:any)=>normalize(v.plate_number)));
  const existingPlates = new Set(vehicles.results.map((v:any)=>normalize(v.plate_number)));
  const pendingImportCount = access.profile.role === "admin" ? fleet.filter(v=>v.plate!=="3-2003-55" && v.plate!=="3-0257-55" && !existingPlates.has(normalize(v.plate))).length : 0;
  const allowedStationNames = scope?.center_id ? new Set((await env.DB.prepare("SELECT name FROM stations WHERE center_id=?").bind(scope.center_id).all()).results.map((row:any)=>String(row.name))) : null;
  return NextResponse.json({ vehicles: available, canEditVehicles: hasPermission(access.profile,"fleet.manage"), canDeleteVehicles: hasPermission(access.profile,"fleet.manage"), pendingImportCount, fuel: fuel.results.filter((r:any)=>ids.has(Number(r.vehicle_id))),
    movements: movements.results.filter((r:any)=>ids.has(Number(r.vehicle_id))),
    incidents: incidents.results.filter((r:any)=>(!station || allowedStationNames?.has(String(r.station))) && (ids.has(Number(r.vehicle_id)) || plates.has(normalize(r.vehicle)))),
    importReview: [{plate:"3-2003-55",reason:"وردت مرتين بوقود وحالة مختلفين (صفا 42 و78)"},{plate:"3-0257-55",reason:"مدرجة تحت الصيانة لكن حالتها داخل الخدمة (صف 87)"}] });
}

export async function POST(request: NextRequest) {
  const access = await getAccess(request);
  if (!hasPermission(access.profile,"fleet.manage")) return reply("لا تملك صلاحية إدخال بيانات الأسطول",403);
  if (!access.profile) return reply("يرجى تسجيل الدخول",401);
  const b = await request.json() as Record<string,unknown>;
  if (b.action === "import") {
    if (!hasPermission(access.profile,"fleet.manage")) return reply("استيراد الأسطول غير مسموح",403);
    const [existing,stationList] = await env.DB.batch([env.DB.prepare("SELECT plate_number FROM vehicles"),env.DB.prepare("SELECT code,center_id FROM stations")]);
    const known = new Set(existing.results.map((v:any)=>text(v.plate_number).replace(/\s/g,"")));
    const centerIds = new Map(stationList.results.map((s:any)=>[s.code,Number(s.center_id)]));
    const stationCode = (location:string) => location.includes("دير")?"DEI":location.includes("خانيونس")?"KHA":location.includes("جباليا")?"JAB":location.includes("رفح")?"RAF":location==="غزة"?"GAZ":null;
    const safe = fleet.filter(v=>v.plate !== "3-2003-55" && v.plate !== "3-0257-55" && !known.has(v.plate.replace(/\s/g,"")));
    for (let i=0;i<safe.length;i+=40) {
      await env.DB.batch(safe.slice(i,i+40).map(v=>env.DB.prepare("INSERT OR IGNORE INTO vehicles (plate_number,manufacturer,model,production_year,chassis_number,fuel_type,mileage_km,ambulance_type,usage_status,work_location,service_status,out_of_service_reason,active,fleet_source_row,center_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(v.plate,v.manufacturer||null,v.model||null,Number(v.productionYear)||null,v.chassis||null,v.fuelType||null,Number(v.mileage)||null,v.ambulanceType||null,v.usage||null,v.location||null,"active",v.reason||null,1,v.sourceRow,centerIds.get(stationCode(v.location))||null)));
    }
    await env.DB.prepare("UPDATE incidents SET vehicle_id=(SELECT id FROM vehicles WHERE TRIM(plate_number)=TRIM(incidents.vehicle) LIMIT 1) WHERE vehicle_id IS NULL AND vehicle IS NOT NULL AND EXISTS (SELECT 1 FROM vehicles WHERE TRIM(plate_number)=TRIM(incidents.vehicle))").run();
    return NextResponse.json({ok:true,added:safe.length,skipped:fleet.length-safe.length,review:2});
  }
  if (b.action === "importArchive") {
    if (!hasPermission(access.profile,"fleet.manage")) return reply("استيراد الأرشيف غير مسموح",403);
    const rows = Array.isArray(b.rows) ? b.rows.slice(0,2000) : [];
    let added = 0;
    for (const row of rows as any[]) {
      const plate = text(row.plate); if (!plate) continue;
      const result = await env.DB.prepare("INSERT OR IGNORE INTO vehicles (plate_number,manufacturer,model,fuel_type,work_location,service_status,active) VALUES (?,?,?,?,?,?,?)")
        .bind(plate,text(row.manufacturer)||null,text(row.model)||null,text(row.fuelType)||null,text(row.location)||null,text(row.status).startsWith("خارج")?"out_of_service":"active",text(row.status).startsWith("خارج")?0:1).run();
      if (result.meta.changes) added++;
    }
    return NextResponse.json({ok:true,added});
  }
  const vehicleId = Number(b.vehicleId);
  const vehicle = await env.DB.prepare("SELECT v.*,c.name center_name FROM vehicles v LEFT JOIN centers c ON c.id=v.center_id WHERE v.id=?").bind(vehicleId).first<any>();
  if (!vehicle) return reply("المركبة غير موجودة");
  if (access.profile.role === "station_user") { const own=await env.DB.prepare("SELECT center_id FROM stations WHERE name=? LIMIT 1").bind(access.profile.station).first<any>(); if(!own || Number(vehicle.center_id)!==Number(own.center_id)) return reply("المركبة خارج نطاق مركزك",403); }
  const incidentId = number(b.incidentId);
  if (incidentId != null && (!Number.isInteger(incidentId) || incidentId < 1)) return reply("رقم البلاغ غير صالح");
  if (incidentId != null) {
    const incident = await env.DB.prepare("SELECT vehicle,vehicle_id,station FROM incidents WHERE id=?").bind(incidentId).first<{vehicle:string|null;vehicle_id:number|null;station:string}>();
    if (!incident || (incident.vehicle_id !== vehicleId && text(incident.vehicle).replace(/\s/g,"") !== text(vehicle.plate_number).replace(/\s/g,"")) || (access.profile.role === "station_user" && incident.station !== access.profile.station)) return reply("البلاغ لا يخص هذه المركبة");
  }
  const staffId = number(b.driverStaffId), fillerId = number(b.filledByStaffId);
  for (const id of [staffId,fillerId]) if (id != null && (!Number.isInteger(id) || !(await env.DB.prepare("SELECT id FROM staff WHERE id=?").bind(id).first()))) return reply("الموظف المحدد غير موجود");
  try {
    let result;
    if (b.action === "fill") {
      const liters=number(b.liters), odometer=Number(vehicle.mileage_km||0);
      const fillerStaff = fillerId == null ? null : await env.DB.prepare("SELECT full_name FROM staff WHERE id=?").bind(fillerId).first<{full_name:string}>();
      const filledByName = text(fillerStaff?.full_name) || access.profile.full_name || access.profile.username || access.email || "مستخدم النظام";
      if (!validDate(b.filledAt) || liters==null || !Number.isFinite(liters) || liters<=0 || !["بنزين","سولار"].includes(text(b.fuelType))) return reply("يرجى إدخال تاريخ وكمية صحيحة وتحديد وقود السيارة في الإعدادات");
      if (vehicle.fuel_type && text(b.fuelType)!==vehicle.fuel_type) return reply("نوع الوقود لا يطابق بطاقة المركبة");
      result=await env.DB.prepare("INSERT INTO fuel_fillings (vehicle_id,incident_id,filled_at,liters,fuel_type,odometer_km,driver_staff_id,driver_name,filled_by_staff_id,filled_by_name,source_name,voucher_number,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(vehicleId,incidentId,b.filledAt,liters,text(b.fuelType),odometer,staffId,text(b.driverName)||null,fillerId,filledByName,text(b.sourceName)||null,text(b.voucherNumber)||null,text(b.notes)||null,access.email).run();
    } else if (b.action === "movement") {
      if (!vehicle.active) return reply("المركبة خارج الخدمة؛ لا يمكن تسجيل حركة جديدة");
      const start=Number(vehicle.mileage_km||0),end=number(b.kmEnd);
      if (!validDate(b.departedAt) || (b.returnedAt && (!validDate(b.returnedAt)||String(b.returnedAt)<String(b.departedAt))) || start==null || !Number.isFinite(start) || start<0 || (end!=null && (!Number.isFinite(end)||end<start))) return reply("التاريخ أو قراءة العداد غير صحيحة");
      result=await env.DB.prepare("INSERT INTO vehicle_movements (vehicle_id,incident_id,driver_staff_id,driver_name,departed_at,returned_at,km_start,km_end,destination,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
        .bind(vehicleId,incidentId,staffId,text(b.driverName)||null,b.departedAt,b.returnedAt||null,start,end,text(b.destination)||null,text(b.notes)||null,access.email).run();
      if (end!=null) await env.DB.prepare("UPDATE vehicles SET mileage_km=? WHERE id=?").bind(end,vehicleId).run();
    } else return reply("نوع العملية غير معروف");
    await env.DB.prepare("INSERT INTO audit_logs (actor,action,entity_type,entity_id,details) VALUES (?,?,?,?,?)")
      .bind(access.email,"create",b.action==="fill"?"fuel_filling":"vehicle_movement",String(result.meta.last_row_id),vehicle.plate_number).run();
    return NextResponse.json({ok:true,id:result.meta.last_row_id},{status:201});
  } catch { return reply("تعذر حفظ العملية. يرجى إعادة المحاولة",500); }
}
