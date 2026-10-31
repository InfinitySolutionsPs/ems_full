import { env } from "@/lib/server-env";
import { NextRequest, NextResponse } from "next/server";
import { getAccess,hasPermission } from "@/lib/access";

const error = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
const str = (value: FormDataEntryValue | null) => typeof value === "string" ? value.trim() : "";
const date = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
type Store = { put: (key: string, bytes: ArrayBuffer, options: object) => Promise<unknown>; get: (key: string) => Promise<{ body: Uint8Array; httpEtag: string } | null>; delete: (key: string) => Promise<void> };
const bucket = () => (env as unknown as { BUCKET: Store }).BUCKET;
async function accessFor(request: NextRequest) {
  const access = await getAccess(request);
  return access.profile?.active ? access : null;
}

export async function GET(request: NextRequest) {
  const access = await accessFor(request);
  if (!access || !hasPermission(access.profile,"maintenance.view")) return error("لا توجد صلاحية لعرض الصيانة", 403);
  const query = new URL(request.url).searchParams;
  const fileKind = query.has("invoice") ? "invoice" : "attachment";
  const attachmentId = Number(query.get(fileKind));
  if (query.has(fileKind)) {
    if (!Number.isInteger(attachmentId) || attachmentId < 1) return error("رقم الطلب غير صالح");
    const row = await env.DB.prepare(`SELECT m.attachment_key,m.attachment_name,m.attachment_type,m.invoice_key,m.invoice_name,m.invoice_type,s.name station_name FROM vehicle_maintenance m JOIN stations s ON s.id=m.station_id WHERE m.id=?`).bind(attachmentId).first<any>();
    if (!row) return error("المرفق غير موجود", 404);
    if (access.profile?.role === "station_user" && row.station_name !== access.profile.station) return error("خارج نطاق المحطة", 403);
    const key = fileKind === "invoice" ? row.invoice_key : row.attachment_key;
    const name = fileKind === "invoice" ? row.invoice_name : row.attachment_name;
    const type = fileKind === "invoice" ? row.invoice_type : row.attachment_type;
    if (!key) return error(fileKind === "invoice" ? "لم تُرفق فاتورة لهذا الطلب" : "المرفق غير موجود", 404);
    const object = await bucket().get(key);
    if (!object) return error("ملف الطلب غير متاح", 404);
    const filename = encodeURIComponent(String(name).replace(/[\r\n]/g, ""));
    return new Response(new Uint8Array(object.body), { headers: {
      "Content-Type": type,
      "Content-Disposition": `inline; filename*=UTF-8''${filename}`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    } });
  }
  const from = query.get("from") || "1900-01-01";
  const to = query.get("to") || "2999-12-31";
  if (!date(from) || !date(to) || from > to) return error("فترة التواريخ غير صالحة");
  const vehicleId = Number(query.get("vehicleId") || 0);
  const stationId = Number(query.get("stationId") || 0);
  if (!Number.isInteger(vehicleId) || !Number.isInteger(stationId) || vehicleId < 0 || stationId < 0) return error("الفلاتر غير صالحة");
  const [vehicles, stations, requests] = await env.DB.batch([
    env.DB.prepare("SELECT v.id,v.plate_number,v.active,v.service_status,v.center_id,c.name center_name FROM vehicles v LEFT JOIN centers c ON c.id=v.center_id ORDER BY v.plate_number"),
    env.DB.prepare("SELECT id,name,governorate,center_id FROM stations ORDER BY name"),
    env.DB.prepare(`SELECT m.*,v.plate_number,v.manufacturer,v.model,s.name station_name
      FROM vehicle_maintenance m JOIN vehicles v ON v.id=m.vehicle_id JOIN stations s ON s.id=m.station_id
      WHERE m.request_date BETWEEN ? AND ? AND (?=0 OR m.vehicle_id=?) AND (?=0 OR m.station_id=?)
      ORDER BY m.request_date DESC,m.id DESC LIMIT 2000`).bind(from,to,vehicleId,vehicleId,stationId,stationId),
  ]);
  const scoped = (rows: any[]) => access.profile?.role === "station_user" ? rows.filter((x) => x.station_name === access.profile?.station || x.name === access.profile?.station) : rows;
  return NextResponse.json({ vehicles: scoped(vehicles.results), stations: access.profile?.role === "station_user" ? stations.results.filter((s: any) => s.name === access.profile?.station) : stations.results, requests: scoped(requests.results).map(({ attachment_key, invoice_key, ...row }: any) => row), canClose: hasPermission(access.profile,"maintenance.manage"), canDelete: hasPermission(access.profile,"maintenance.manage") });
}

export async function POST(request: NextRequest) {
  const access = await accessFor(request);
  if (!access || !hasPermission(access.profile,"maintenance.manage")) return error("لا تملكين صلاحية إضافة طلب صيانة", 403);
  const form = await request.formData();
  if (str(form.get("signedConfirmed")) !== "yes") return error("يجب تأكيد إرفاق الطلب الورقي الموقّع");
  const file = form.get("signedRequest");
  if (!(file instanceof File) || !file.size || file.size > 10 * 1024 * 1024 || !["application/pdf", "image/jpeg", "image/png"].includes(file.type)) return error("أرفقي طلب الصيانة الورقي الموقع بصيغة PDF أو صورة JPG/PNG وبحجم لا يتجاوز 10 ميغابايت");
  const bytes = await file.arrayBuffer();
  const header = new Uint8Array(bytes.slice(0, 8));
  const validFile = file.type === "application/pdf" ? String.fromCharCode(...header.slice(0, 5)) === "%PDF-"
    : file.type === "image/jpeg" ? header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff
      : [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => header[index] === byte);
  if (!validFile) return error("محتوى الملف لا يطابق نوع PDF أو الصورة المحددة");
  const vehicleId = Number(str(form.get("vehicleId")));
  const stationId = Number(str(form.get("stationId")));
  const odometer = Number(str(form.get("odometerKm")));
  const requestDate = str(form.get("requestDate"));
  const department = str(form.get("department"));
  const requestedRepair = str(form.get("requestedRepair"));
  const driverName = str(form.get("driverName"));
  if (!Number.isInteger(vehicleId) || vehicleId < 1 || !Number.isInteger(stationId) || stationId < 1 || !Number.isFinite(odometer) || odometer < 0 || !date(requestDate) || !department || !requestedRepair || !driverName) return error("أكملي بيانات الطلب والعداد والتاريخ");
  const vehicle = await env.DB.prepare("SELECT v.id,v.active,v.service_status,v.center_id,c.name center_name FROM vehicles v LEFT JOIN centers c ON c.id=v.center_id WHERE v.id=?").bind(vehicleId).first<any>();
  const station = await env.DB.prepare("SELECT id,name,center_id FROM stations WHERE id=?").bind(stationId).first<any>();
  if (!vehicle || !station) return error("المركبة أو المركز غير موجود");
  if (vehicle.center_id && Number(vehicle.center_id) !== Number(station.center_id)) return error("المحطة لا تتبع المركز المسجل للمركبة");
  if (access.profile?.role === "station_user" && station.name !== access.profile.station) return error("المركبة خارج نطاق محطتك", 403);
  if (!vehicle.active || vehicle.service_status !== "active") return error("المركبة خارج الخدمة أو لديها طلب صيانة مفتوح");
  const key = `maintenance/${crypto.randomUUID()}`;
  try {
    await bucket().put(key, bytes, { httpMetadata: { contentType: file.type } });
    const [insert] = await env.DB.batch([
      env.DB.prepare(`INSERT INTO vehicle_maintenance
        (vehicle_id,station_id,request_date,department,odometer_km,requested_repair,failure_cause,driver_name,center_manager_name,circle_manager_name,attachment_key,attachment_name,attachment_type,created_by)
        SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM vehicles WHERE id=? AND active=1 AND service_status='active')
        AND NOT EXISTS (SELECT 1 FROM vehicle_maintenance WHERE vehicle_id=? AND status='open')`).bind(vehicleId,stationId,requestDate,department,odometer,requestedRepair,str(form.get("failureCause"))||null,driverName,str(form.get("centerManagerName"))||null,str(form.get("circleManagerName"))||null,key,file.name,file.type,access.email,vehicleId,vehicleId),
      env.DB.prepare("UPDATE vehicles SET active=0,service_status='maintenance',out_of_service_reason='طلب صيانة مفتوح' WHERE id=? AND EXISTS (SELECT 1 FROM vehicle_maintenance WHERE attachment_key=? AND status='open')").bind(vehicleId,key),
    ]);
    if (!insert.meta.changes) { await bucket().delete(key); return error("فُتح طلب صيانة لهذه المركبة بالفعل؛ حدّثي القائمة"); }
    const sourceIncidentCode = str(form.get("sourceIncidentCode"));
    if (sourceIncidentCode) await env.DB.prepare("UPDATE incidents SET maintenance_request_id=? WHERE incident_code=?").bind(insert.meta.last_row_id,sourceIncidentCode).run();
    return NextResponse.json({ ok: true, id: insert.meta.last_row_id }, { status: 201 });
  } catch {
    await bucket().delete(key).catch(() => undefined);
    return error("تعذر حفظ الطلب أو المرفق، ولم تتغير حالة المركبة", 500);
  }
}

export async function PATCH(request: NextRequest) {
  const access = await accessFor(request);
  if (!access || !hasPermission(access.profile,"maintenance.manage")) return error("إغلاق طلب الصيانة غير مسموح", 403);
  const form = await request.formData();
  const id = Number(str(form.get("id")));
  const performed = str(form.get("performedWork"));
  const receiver = str(form.get("receivedBy"));
  const receivedAt = str(form.get("receivedAt"));
  const workshopName = str(form.get("workshopName"));
  const workshopAddress = str(form.get("workshopAddress"));
  const repairCost = Number(str(form.get("repairCostIls")));
  const invoice = form.get("invoice");
  if (!Number.isInteger(id) || id < 1 || !performed || !receiver || !date(receivedAt) || !workshopName || !workshopAddress || !Number.isFinite(repairCost) || repairCost < 0) return error("أكملي إجراءات الصيانة والتكلفة وبيانات الورشة والاستلام");
  const invoiceFile = invoice instanceof File && invoice.size > 0 ? invoice : null;
  if (invoiceFile && (invoiceFile.size > 10 * 1024 * 1024 || !["application/pdf", "image/jpeg", "image/png"].includes(invoiceFile.type))) return error("يجب أن تكون الفاتورة بصيغة PDF أو صورة JPG/PNG وبحجم لا يتجاوز 10 ميغابايت");
  const invoiceBytes = invoiceFile ? await invoiceFile.arrayBuffer() : null;
  if (invoiceFile && invoiceBytes) {
    const invoiceHeader = new Uint8Array(invoiceBytes.slice(0, 8));
    const validInvoice = invoiceFile.type === "application/pdf" ? String.fromCharCode(...invoiceHeader.slice(0, 5)) === "%PDF-"
      : invoiceFile.type === "image/jpeg" ? invoiceHeader[0] === 0xff && invoiceHeader[1] === 0xd8 && invoiceHeader[2] === 0xff
        : [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => invoiceHeader[index] === byte);
    if (!validInvoice) return error("محتوى ملف الفاتورة لا يطابق نوع الملف المحدد");
  }
  const current = await env.DB.prepare("SELECT m.vehicle_id,m.status,s.name station_name FROM vehicle_maintenance m JOIN stations s ON s.id=m.station_id WHERE m.id=?").bind(id).first<any>();
  if (!current || current.status !== "open") return error("الطلب غير موجود أو مغلق بالفعل", 409);
  if (access.profile?.role === "station_user" && current.station_name !== access.profile.station) return error("الطلب خارج نطاق محطتك", 403);
  const invoiceKey = invoiceFile ? `maintenance-invoices/${crypto.randomUUID()}` : null;
  try {
    if (invoiceKey && invoiceBytes && invoiceFile) await bucket().put(invoiceKey, invoiceBytes, { httpMetadata: { contentType: invoiceFile.type } });
    const [closed] = await env.DB.batch([
      env.DB.prepare(`UPDATE vehicle_maintenance SET status='closed',performed_work=?,repair_cost_ils=?,workshop_name=?,workshop_address=?,invoice_key=?,invoice_name=?,invoice_type=?,received_at=?,received_by=?,maintenance_recommendation=?,manager_recommendation=?,finance_recommendation=?,administrative_recommendation=?,closed_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='open'`)
        .bind(performed,repairCost,workshopName,workshopAddress,invoiceKey,invoiceFile?.name||null,invoiceFile?.type||null,receivedAt,receiver,str(form.get("maintenanceRecommendation"))||null,str(form.get("managerRecommendation"))||null,str(form.get("financeRecommendation"))||null,str(form.get("administrativeRecommendation"))||null,access.email,id),
      env.DB.prepare(`UPDATE vehicles SET active=1,service_status='active',out_of_service_reason=NULL WHERE id=? AND NOT EXISTS (SELECT 1 FROM vehicle_maintenance WHERE vehicle_id=? AND status='open')`).bind(current.vehicle_id,current.vehicle_id),
      env.DB.prepare("INSERT INTO audit_logs (actor,action,entity_type,entity_id,details) VALUES (?,'close','maintenance',?,?)").bind(access.email,String(id),JSON.stringify({ repairCostIls: repairCost, workshopName })),
    ]);
    if (!closed.meta.changes) { if (invoiceKey) await bucket().delete(invoiceKey); return error("الطلب مغلق بالفعل", 409); }
    return NextResponse.json({ ok: true });
  } catch { if (invoiceKey) await bucket().delete(invoiceKey).catch(() => undefined); return error("تعذر إغلاق الطلب؛ حالة المركبة لم تتغير", 500); }
}

export async function PUT(request: NextRequest) {
  const access = await accessFor(request);
  if (!access || !hasPermission(access.profile,"maintenance.manage")) return error("تعديل بيانات إغلاق طلب الصيانة غير مسموح", 403);
  const form = await request.formData();
  const id = Number(str(form.get("id")));
  const performed = str(form.get("performedWork"));
  const receiver = str(form.get("receivedBy"));
  const receivedAt = str(form.get("receivedAt"));
  const workshopName = str(form.get("workshopName"));
  const workshopAddress = str(form.get("workshopAddress"));
  const repairCost = Number(str(form.get("repairCostIls")));
  if (!Number.isInteger(id) || id < 1 || !performed || !receiver || !date(receivedAt) || !workshopName || !workshopAddress || !Number.isFinite(repairCost) || repairCost < 0) return error("أكملي إجراءات الصيانة والتكلفة وبيانات الورشة والاستلام");
  const invoice = form.get("invoice");
  const invoiceFile = invoice instanceof File && invoice.size > 0 ? invoice : null;
  if (invoiceFile && (invoiceFile.size > 10 * 1024 * 1024 || !["application/pdf", "image/jpeg", "image/png"].includes(invoiceFile.type))) return error("يجب أن تكون الفاتورة بصيغة PDF أو صورة JPG/PNG وبحجم لا يتجاوز 10 ميغابايت");
  const invoiceBytes = invoiceFile ? await invoiceFile.arrayBuffer() : null;
  if (invoiceFile && invoiceBytes) {
    const header = new Uint8Array(invoiceBytes.slice(0, 8));
    const valid = invoiceFile.type === "application/pdf" ? String.fromCharCode(...header.slice(0, 5)) === "%PDF-"
      : invoiceFile.type === "image/jpeg" ? header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff
        : [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => header[index] === byte);
    if (!valid) return error("محتوى ملف الفاتورة لا يطابق نوع الملف المحدد");
  }
  const current = await env.DB.prepare("SELECT m.status,m.invoice_key,s.name station_name FROM vehicle_maintenance m JOIN stations s ON s.id=m.station_id WHERE m.id=?").bind(id).first<any>();
  if (!current || current.status !== "closed") return error("الطلب غير موجود أو لم يُغلق بعد", 409);
  if (access.profile?.role === "station_user" && current.station_name !== access.profile.station) return error("الطلب خارج نطاق محطتك", 403);
  const newInvoiceKey = invoiceFile ? `maintenance-invoices/${crypto.randomUUID()}` : null;
  try {
    if (newInvoiceKey && invoiceBytes && invoiceFile) await bucket().put(newInvoiceKey, invoiceBytes, { httpMetadata: { contentType: invoiceFile.type } });
    const [updated] = await env.DB.batch([
      env.DB.prepare(`UPDATE vehicle_maintenance SET performed_work=?,repair_cost_ils=?,workshop_name=?,workshop_address=?,invoice_key=COALESCE(?,invoice_key),invoice_name=COALESCE(?,invoice_name),invoice_type=COALESCE(?,invoice_type),received_at=?,received_by=?,maintenance_recommendation=?,manager_recommendation=?,finance_recommendation=?,administrative_recommendation=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='closed'`)
        .bind(performed,repairCost,workshopName,workshopAddress,newInvoiceKey,invoiceFile?.name||null,invoiceFile?.type||null,receivedAt,receiver,str(form.get("maintenanceRecommendation"))||null,str(form.get("managerRecommendation"))||null,str(form.get("financeRecommendation"))||null,str(form.get("administrativeRecommendation"))||null,id),
      env.DB.prepare("INSERT INTO audit_logs (actor,action,entity_type,entity_id,details) VALUES (?,'update_close','maintenance',?,?)").bind(access.email,String(id),JSON.stringify({ repairCostIls: repairCost, workshopName, invoiceReplaced: Boolean(invoiceFile) })),
    ]);
    if (!updated.meta.changes) { if (newInvoiceKey) await bucket().delete(newInvoiceKey); return error("تعذر تحديث الطلب", 409); }
    if (newInvoiceKey && current.invoice_key && current.invoice_key !== newInvoiceKey) await bucket().delete(String(current.invoice_key));
    return NextResponse.json({ ok: true });
  } catch {
    if (newInvoiceKey) await bucket().delete(newInvoiceKey).catch(() => undefined);
    return error("تعذر تحديث بيانات إغلاق الطلب", 500);
  }
}

export async function DELETE(request: NextRequest) {
  const access = await accessFor(request);
  if (!access || !hasPermission(access.profile,"maintenance.manage")) return error("حذف طلب الصيانة غير مسموح", 403);
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const id = Number(body.id);
  if (!Number.isInteger(id) || id < 1) return error("رقم الطلب غير صالح");
  const current = await env.DB.prepare("SELECT m.id,m.vehicle_id,m.status,m.attachment_key,m.invoice_key,s.name station_name FROM vehicle_maintenance m JOIN stations s ON s.id=m.station_id WHERE m.id=?").bind(id).first<any>();
  if (!current) return error("طلب الصيانة غير موجود", 404);
  if (access.profile?.role === "station_user" && current.station_name !== access.profile.station) return error("الطلب خارج نطاق محطتك", 403);
  try {
    const [, deleted] = await env.DB.batch([
      env.DB.prepare("UPDATE incidents SET maintenance_request_id=NULL WHERE maintenance_request_id=?").bind(id),
      env.DB.prepare("DELETE FROM vehicle_maintenance WHERE id=?").bind(id),
      env.DB.prepare(`UPDATE vehicles SET active=1,service_status='active',out_of_service_reason=NULL WHERE id=? AND ?='open' AND NOT EXISTS (SELECT 1 FROM vehicle_maintenance WHERE vehicle_id=? AND status='open')`).bind(current.vehicle_id,current.status,current.vehicle_id),
      env.DB.prepare("INSERT INTO audit_logs (actor,action,entity_type,entity_id,details) VALUES (?,'delete','maintenance',?,?)").bind(access.email,String(id),JSON.stringify({ status: current.status, vehicleId: current.vehicle_id })),
    ]);
    if (!deleted.meta.changes) return error("طلب الصيانة غير موجود", 404);
    await Promise.all([current.attachment_key, current.invoice_key].filter(Boolean).map((key) => bucket().delete(String(key))));
    return NextResponse.json({ ok: true });
  } catch { return error("تعذر حذف طلب الصيانة", 500); }
}
