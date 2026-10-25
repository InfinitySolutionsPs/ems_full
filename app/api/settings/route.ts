/* eslint-disable @typescript-eslint/no-explicit-any */
import { env } from "@/lib/server-env";
import { NextRequest, NextResponse } from "next/server";
import { getAccess,hasPermission } from "@/lib/access";
import { strFromU8, unzipSync } from "fflate";

const employeeNameKey = (value: unknown) =>
  String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
const centerArabic: Record<string,string> = {
  "gaza":"غزة", "north gaza":"شمال غزة", "middle area":"الوسطى",
  "khan yunis":"خانيونس", "rafah":"رفح", "ديرالبلح":"الوسطى", "دير البلح":"الوسطى",
};
const professionArabic: Record<string,string> = {
  "D":"سائق إسعاف", "P":"مسعف", "D/P":"سائق ومسعف", "DIS":"مُرحّل",
};
const excelCellText = (value: unknown) => {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0,10);
  if (typeof value === "object") {
    const cell = value as Record<string,unknown>;
    if (cell.text != null) return String(cell.text).trim();
    if (cell.result != null) return String(cell.result).trim();
  }
  return String(value).trim().replace(/\.0$/, "");
};
const excelHeaderKey = (value: unknown) => excelCellText(value).replace(/\s+/g," ").toLowerCase();
const xmlText = (value:string) => value
  .replace(/<[^>]+>/g,"")
  .replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">")
  .replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)));
const xlsxRows = (buffer:ArrayBuffer) => {
  const files=unzipSync(new Uint8Array(buffer));
  const read=(path:string)=>files[path]?strFromU8(files[path]):"";
  const sharedXml=read("xl/sharedStrings.xml");
  const shared=[...sharedXml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(match=>
    [...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(part=>xmlText(part[1])).join(""));
  const workbookXml=read("xl/workbook.xml"), relationsXml=read("xl/_rels/workbook.xml.rels");
  const relationId=workbookXml.match(/<sheet\b[^>]*r:id="([^"]+)"/)?.[1];
  const target=relationId ? [...relationsXml.matchAll(/<Relationship\b([^>]+)\/?\s*>/g)]
    .find(match=>new RegExp(`Id="${relationId}"`).test(match[1]))?.[1].match(/Target="([^"]+)"/)?.[1] : undefined;
  const sheetPath=target ? `xl/${target.replace(/^\//,"").replace(/^xl\//,"")}` : "xl/worksheets/sheet1.xml";
  const sheetXml=read(sheetPath);
  if (!sheetXml) throw new Error("missing worksheet");
  const rows:{number:number;cells:Map<number,string>}[]=[];
  for (const rowMatch of sheetXml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const rowNumber=Number(rowMatch[1].match(/r="(\d+)"/)?.[1]||rows.length+1);
    const cells=new Map<number,string>();
    for (const cellMatch of rowMatch[2].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const ref=cellMatch[1].match(/r="([A-Z]+)\d+"/)?.[1]; if(!ref)continue;
      const column=[...ref].reduce((sum,char)=>sum*26+char.charCodeAt(0)-64,0);
      const type=cellMatch[1].match(/t="([^"]+)"/)?.[1]||"n";
      const raw=cellMatch[2].match(/<v>([\s\S]*?)<\/v>/)?.[1]||"";
      const inline=[...cellMatch[2].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(part=>xmlText(part[1])).join("");
      cells.set(column,type==="s"?shared[Number(raw)]||"":type==="inlineStr"?inline:xmlText(raw));
    }
    rows.push({number:rowNumber,cells});
  }
  return rows;
};
const excelDateText = (value:string) => {
  if (!/^\d+(\.\d+)?$/.test(value)) return value;
  const serial=Number(value); if(serial<20000||serial>80000)return value;
  return new Date(Date.UTC(1899,11,30)+Math.floor(serial)*86400000).toISOString().slice(0,10);
};

export async function GET(request:NextRequest) {
  const access=await getAccess(request);if(!access.profile)return NextResponse.json({error:"يرجى تسجيل الدخول"},{status:401});
  await env.DB.batch([
    env.DB.prepare(
      "INSERT OR IGNORE INTO stations (code,name,governorate) VALUES (?,?,?)",
    ).bind("JAB", "محطة جباليا", "شمال غزة"),
    env.DB.prepare(
      "INSERT OR IGNORE INTO stations (code,name,governorate) VALUES (?,?,?)",
    ).bind("GAZ", "محطة غزة", "غزة"),
    env.DB.prepare(
      "INSERT OR IGNORE INTO stations (code,name,governorate) VALUES (?,?,?)",
    ).bind("DEI", "محطة دير البلح", "الوسطى"),
    env.DB.prepare(
      "INSERT OR IGNORE INTO stations (code,name,governorate) VALUES (?,?,?)",
    ).bind("KHA", "محطة خانيونس", "خانيونس"),
    env.DB.prepare(
      "INSERT OR IGNORE INTO stations (code,name,governorate) VALUES (?,?,?)",
    ).bind("RAF", "محطة رفح", "رفح"),
  ]);
  const referenceDefaults = [
    ["hospital_public_shifa","مجمع الشفاء الطبي","مجمع الشفاء الطبي","hospital_public"],
    ["hospital_public_aqsa","مستشفى شهداء الأقصى","مستشفى شهداء الأقصى","hospital_public"],
    ["hospital_public_nasser","مستشفى ناصر الطبي","مستشفى ناصر الطبي","hospital_public"],
    ["hospital_private_ahli","مستشفى الأهلي العربي","مستشفى الأهلي العربي","hospital_private"],
    ["hospital_private_awda","مستشفى العودة","مستشفى العودة","hospital_private"],
    ["hospital_field_jordan","المستشفى الميداني الأردني","المستشفى الميداني الأردني","hospital_field"],
    ["hospital_field_emirates","المستشفى الميداني الإماراتي","المستشفى الميداني الإماراتي","hospital_field"],
    ["complaint_breathing","ضيق في التنفس","ضيق في التنفس","chief_complaint"],
    ["complaint_chest","ألم في الصدر","ألم في الصدر","chief_complaint"],
    ["complaint_bleeding","نزيف","نزيف","chief_complaint"],
    ["complaint_trauma","إصابة / رضوض","إصابة / رضوض","chief_complaint"],
    ["complaint_unconscious","فقدان الوعي","فقدان الوعي","chief_complaint"],
    ["complaint_labor","آلام ولادة","آلام ولادة","chief_complaint"],
  ];
  await env.DB.batch(referenceDefaults.map(([key,value,label,category])=>env.DB.prepare("INSERT INTO system_settings (key,value,label,category,updated_by) SELECT ?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM system_settings WHERE key=?) ON CONFLICT(key) DO NOTHING").bind(key,value,label,category,"system",`deleted__${key}`)));
  // Employee imports are explicit administrator actions. Never recreate deleted
  // employees while merely loading the settings screen.
  await env.DB.prepare("INSERT INTO centers (name,governorate) SELECT DISTINCT governorate,governorate FROM stations WHERE governorate IS NOT NULL AND trim(governorate)<>'' ON CONFLICT(name) DO NOTHING").run();
  await env.DB.prepare("UPDATE stations SET center_id=(SELECT id FROM centers WHERE centers.name=stations.governorate LIMIT 1) WHERE center_id IS NULL").run();
  const centerRows = await env.DB.prepare("SELECT id,name FROM centers").all();
  const centerByName = new Map((centerRows.results as any[]).map((c:any)=>[employeeNameKey(c.name),Number(c.id)]));
  const staffToLink = await env.DB.prepare("SELECT id,detail,center_id FROM staff").all();
  for (const person of staffToLink.results as any[]) {
    let detail:any={}; try { detail=JSON.parse(person.detail||"{}"); } catch {}
    const translated = centerArabic[employeeNameKey(detail.station)] || String(detail.station||"").trim();
    const centerId = centerByName.get(employeeNameKey(translated));
    if (translated && (detail.station!==translated || (!person.center_id && centerId))) {
      detail.station=translated;
      await env.DB.prepare("UPDATE staff SET detail=?,center_id=COALESCE(center_id,?) WHERE id=?").bind(JSON.stringify(detail),centerId||null,person.id).run();
    }
  }
  const [centers, stations, vehicles, staff, settings] = await env.DB.batch([
    env.DB.prepare("SELECT * FROM centers ORDER BY name"),
    env.DB.prepare("SELECT s.*,c.name center_name FROM stations s LEFT JOIN centers c ON c.id=s.center_id ORDER BY s.name"),
    env.DB.prepare("SELECT v.*,c.name center_name FROM vehicles v LEFT JOIN centers c ON c.id=v.center_id ORDER BY v.plate_number"),
    env.DB.prepare("SELECT s.*,c.name center_name FROM staff s LEFT JOIN centers c ON c.id=s.center_id ORDER BY s.full_name"),
    env.DB.prepare("SELECT * FROM system_settings ORDER BY category,key"),
  ]);
  return NextResponse.json({
    centers: centers.results,
    stations: stations.results,
    vehicles: vehicles.results,
    staff: staff.results,
    settings: settings.results,
  });
}

export async function PATCH(request: NextRequest) {
  const access = await getAccess(request);
  if (!hasPermission(access.profile,"settings.manage"))
    return NextResponse.json(
      { error: "تعديل الموظفين متاح لمدير النظام فقط" },
      { status: 403 },
    );
  const b = (await request.json()) as Record<string, any>;
  if (!b.id || !["staff", "center", "station", "vehicle"].includes(b.entity))
    return NextResponse.json(
      { error: "بيانات الموظف غير مكتملة" },
      { status: 400 },
    );
  if (b.entity === "staff")
    await env.DB.prepare(
      "UPDATE staff SET full_name=?,cadre_type=?,job_title=?,detail=?,employment_status=?,active=?,center_id=? WHERE id=?",
    )
      .bind(
        b.fullName,
        b.cadreType,
        b.jobTitle,
        b.detail || null,
        b.employmentStatus || "on_duty",
        ["on_duty"].includes(b.employmentStatus || "on_duty") ? 1 : 0,
        b.centerId || b.stationId ? Number(b.centerId || b.stationId) : null,
        b.id,
      )
      .run();
  else if (b.entity === "center")
    await env.DB.prepare("UPDATE centers SET code=?,name=?,governorate=?,active=? WHERE id=?")
      .bind(b.code || null, b.name, b.governorate || null, b.active === false ? 0 : 1, b.id).run();
  else if (b.entity === "station")
    await env.DB.prepare(
      "UPDATE stations SET code=?,name=?,governorate=?,center_id=? WHERE id=?",
    )
      .bind(b.code, b.name, b.governorate, b.centerId ? Number(b.centerId) : null, b.id)
      .run();
  else {
    const requestedMileage = Number(b.mileageKm || 0);
    if (!Number.isFinite(requestedMileage) || requestedMileage < 0)
      return NextResponse.json({ error: "قراءة عداد المركبة غير صالحة" }, { status: 400 });
    const openMaintenance = await env.DB.prepare("SELECT id FROM vehicle_maintenance WHERE vehicle_id=? AND status='open' LIMIT 1").bind(b.id).first();
    if (openMaintenance && b.serviceStatus !== "maintenance")
      return NextResponse.json({ error: "هذه المركبة قيد الصيانة؛ لا تُعاد للخدمة إلا بإغلاق طلب الصيانة" }, { status: 409 });
    await env.DB.prepare(
      "UPDATE vehicles SET plate_number=?,manufacturer=?,model=?,ambulance_type=?,fuel_type=?,work_location=?,service_status=?,out_of_service_reason=?,active=?,center_id=?,station_id=NULL,mileage_km=? WHERE id=?",
    )
      .bind(
        b.plateNumber,
        b.manufacturer || null,
        b.model || null,
        b.ambulanceType || null,
        b.fuelType || null,
        b.workLocation || null,
        openMaintenance ? "maintenance" : b.serviceStatus === "out_of_service" ? "out_of_service" : "active",
        openMaintenance ? "طلب صيانة مفتوح" : b.outOfServiceReason || null,
        openMaintenance || b.serviceStatus === "out_of_service" ? 0 : 1,
        b.centerId || b.stationId ? Number(b.centerId || b.stationId) : null,
        Math.max(requestedMileage, Number((await env.DB.prepare("SELECT mileage_km FROM vehicles WHERE id=?").bind(b.id).first<any>())?.mileage_km || 0)),
        b.id,
      )
      .run();
  }
  return NextResponse.json({ ok: true });
}
export async function POST(request: NextRequest) {
  const access = await getAccess(request);
  if (!hasPermission(access.profile,"settings.manage"))
    return NextResponse.json(
      { error: "الإعدادات متاحة لمدير النظام فقط" },
      { status: 403 },
    );
  if ((request.headers.get("content-type")||"").includes("multipart/form-data")) {
    const form = await request.formData();
    if (form.get("entity") !== "importStaffSpreadsheet")
      return NextResponse.json({ error: "نوع الاستيراد غير معروف" }, { status: 400 });
    const file = form.get("file");
    if (!(file instanceof File) || !file.size || file.size > 8*1024*1024 || !file.name.toLowerCase().endsWith(".xlsx"))
      return NextResponse.json({ error: "اختاري ملف Excel بصيغة XLSX وبحجم لا يتجاوز 8 ميغابايت" }, { status: 400 });
    try {
      const workbookRows=xlsxRows(await file.arrayBuffer());
      if (!workbookRows.length) return NextResponse.json({ error: "ملف Excel لا يحتوي على ورقة بيانات" }, { status: 400 });
      let headerRow = 0;
      const columns = new Map<string,number>();
      for (const row of workbookRows.filter(row=>row.number<=12)) {
        const candidate = new Map<string,number>();
        row.cells.forEach((cell,column)=>candidate.set(excelHeaderKey(cell),column));
        if (candidate.has("الاسم") && candidate.has("نوع الكادر") && candidate.has("مكان العمل")) {
          headerRow=row.number; candidate.forEach((column,key)=>columns.set(key,column)); break;
        }
      }
      if (!headerRow) return NextResponse.json({ error: "لم يتم العثور على عناوين الاسم ونوع الكادر ومكان العمل في الملف" }, { status: 400 });
      const value = (row:{cells:Map<number,string>},...names:string[]) => {
        const column = names.map(name=>columns.get(excelHeaderKey(name))).find(Boolean);
        return column ? excelCellText(row.cells.get(column)) : "";
      };
      const source:any[]=[];
      for (const row of workbookRows.filter(row=>row.number>headerRow&&row.number<=headerRow+3000)) {
        const fullName=value(row,"الاسم").replace(/\s+/g," ").trim();
        if (!fullName) continue;
        let mobile=value(row,"MOBILE NO.","mobile no","الجوال");
        if (/^5\d{8}$/.test(mobile)) mobile=`0${mobile}`;
        source.push({
          sourceRow:String(row.number), fullName, englishName:value(row,"Name"),
          nationalId:value(row,"ID NO.","id no","رقم الهوية"), mobile,
          gender:value(row,"الجنس"), profession:value(row,"المهنة Driver/ Paramedic"),
          employeeNumber:value(row,"الرقم الوظيفي"), cadreType:value(row,"نوع الكادر"),
          workLocation:value(row,"مكان العمل"), familyCount:value(row,"عدد افراد العائلة"),
          birthDate:excelDateText(value(row,"تاريخ الميلاد")), notes:value(row,"ملاحظات"),
        });
      }
      if (!source.length) return NextResponse.json({ error: "لم يتم العثور على موظفين صالحين داخل الملف" }, { status: 400 });
      const [staffRows, centerRows, deletedRows] = await env.DB.batch([
        env.DB.prepare("SELECT id,full_name FROM staff ORDER BY id"),
        env.DB.prepare("SELECT id,name FROM centers"),
        env.DB.prepare("SELECT normalized_name FROM deleted_staff_records"),
      ]);
      const existing = new Map((staffRows.results as any[]).map((row:any)=>[employeeNameKey(row.full_name),Number(row.id)]));
      const centers = new Map((centerRows.results as any[]).map((row:any)=>[employeeNameKey(row.name),Number(row.id)]));
      const deleted = new Set((deletedRows.results as any[]).map((row:any)=>String(row.normalized_name)));
      const unique = new Map<string,any>(); source.forEach(row=>unique.set(employeeNameKey(row.fullName),row));
      const importRows=[...unique.entries()];
      const skippedDeleted=importRows.filter(([name])=>deleted.has(name)).length;
      const addedCount=importRows.filter(([name])=>!deleted.has(name)&&!existing.has(name)).length;
      const updatedCount=importRows.filter(([name])=>!deleted.has(name)&&existing.has(name)).length;
      if (form.get("dryRun") === "true")
        return NextResponse.json({ total:source.length,unique:importRows.length,added:addedCount,updated:updatedCount,skippedDeleted });
      let added=0,updated=0; const statements:any[]=[];
      for (const [nameKey,row] of importRows) {
        if (deleted.has(nameKey)) continue;
        const location=String(row.workLocation||"").trim();
        const translatedCenter=centerArabic[employeeNameKey(location)]||location;
        const centerId=centers.get(employeeNameKey(translatedCenter))||null;
        const note=`${row.notes||""} ${location}`;
        const employmentStatus=note.includes("معتقل")?"detained":note.includes("مسافر")?"abroad":"on_duty";
        const jobTitle=professionArabic[String(row.profession||"").trim()]||String(row.profession||"غير محدد").trim();
        const gender=row.gender==="M"?"Male":row.gender==="F"?"Female":"";
        const detail=JSON.stringify({source:file.name,sourceRow:row.sourceRow,englishName:row.englishName,nationalId:row.nationalId,mobile:row.mobile,gender,professionCode:row.profession,employeeNumber:row.employeeNumber,station:translatedCenter||location,workLocation:location,familyCount:row.familyCount,birthDate:row.birthDate,birthYear:String(row.birthDate||"").slice(0,4),category:row.cadreType,emtLevel:jobTitle,notes:row.notes});
        const id=existing.get(nameKey);
        if (id) { statements.push(env.DB.prepare("UPDATE staff SET cadre_type=?,job_title=?,detail=?,center_id=COALESCE(?,center_id),employment_status=?,active=? WHERE id=?").bind(row.cadreType||"غير محدد",jobTitle,detail,centerId,employmentStatus,employmentStatus==="on_duty"?1:0,id)); updated++; }
        else { statements.push(env.DB.prepare("INSERT INTO staff (full_name,cadre_type,job_title,detail,center_id,employment_status,active) VALUES (?,?,?,?,?,?,?)").bind(row.fullName,row.cadreType||"غير محدد",jobTitle,detail,centerId,employmentStatus,employmentStatus==="on_duty"?1:0)); added++; }
      }
      for (let i=0;i<statements.length;i+=35) await env.DB.batch(statements.slice(i,i+35));
      await env.DB.prepare("INSERT INTO audit_logs (actor,action,entity_type,entity_id,details) VALUES (?,?,?,?,?)").bind(access.email,"import","staff",file.name,JSON.stringify({added,updated,skippedDeleted})).run();
      return NextResponse.json({ok:true,added,updated,skippedDeleted,total:source.length});
    } catch {
      return NextResponse.json({ error: "تعذر قراءة ملف Excel. تأكدي من أن الملف غير تالف وأن عناوين الأعمدة صحيحة" }, { status: 400 });
    }
  }
  const b = (await request.json()) as Record<string, any>;
  if (b.entity === "deduplicateStaff") {
    const all = await env.DB.prepare("SELECT * FROM staff ORDER BY id").all();
    const seen = new Map<string, number>();
    const duplicates: { keep: number; remove: number }[] = [];
    for (const row of all.results as any[]) {
      const key = employeeNameKey(row.full_name);
      const keep = seen.get(key);
      if (keep !== undefined) duplicates.push({ keep, remove: row.id });
      else seen.set(key, row.id);
    }
    if (b.dryRun === true)
      return NextResponse.json({ duplicates: duplicates.length, total: all.results.length });
    // Each D1 batch is atomic: relink operational and fleet history before removal.
    for (let i = 0; i < duplicates.length; i += 20) {
      const statements = duplicates.slice(i, i + 20).flatMap(({ keep, remove }) => [
        env.DB.prepare("UPDATE operational_assignments SET staff_id=? WHERE staff_id=?").bind(keep, remove),
        env.DB.prepare("UPDATE vehicle_movements SET driver_staff_id=? WHERE driver_staff_id=?").bind(keep, remove),
        env.DB.prepare("UPDATE fuel_fillings SET driver_staff_id=? WHERE driver_staff_id=?").bind(keep, remove),
        env.DB.prepare("UPDATE fuel_fillings SET filled_by_staff_id=? WHERE filled_by_staff_id=?").bind(keep, remove),
        env.DB.prepare("DELETE FROM staff WHERE id=?").bind(remove),
      ]);
      await env.DB.batch(statements);
    }
    return NextResponse.json({ ok: true, removed: duplicates.length, remaining: all.results.length - duplicates.length });
  }
  if (b.entity === "center")
    await env.DB.prepare("INSERT INTO centers (code,name,governorate) VALUES (?,?,?)")
      .bind(b.code || null, b.name, b.governorate || null).run();
  else if (b.entity === "station")
    await env.DB.prepare(
      "INSERT INTO stations (code,name,governorate,center_id) VALUES (?,?,?,?)",
    )
      .bind(b.code, b.name, b.governorate, b.centerId ? Number(b.centerId) : null)
      .run();
  else if (b.entity === "vehicle") {
    const requestedMileage = Number(b.mileageKm || 0);
    if (!Number.isFinite(requestedMileage) || requestedMileage < 0)
      return NextResponse.json({ error: "قراءة عداد المركبة غير صالحة" }, { status: 400 });
    await env.DB.prepare(
      "INSERT INTO vehicles (plate_number,manufacturer,model,ambulance_type,fuel_type,work_location,service_status,out_of_service_reason,active,center_id,mileage_km) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
    )
      .bind(
        b.plateNumber,
        b.manufacturer || null,
        b.model || null,
        b.ambulanceType || null,
        b.fuelType || null,
        b.workLocation || null,
        b.serviceStatus === "out_of_service" ? "out_of_service" : "active",
        b.outOfServiceReason || null,
        b.serviceStatus === "out_of_service" ? 0 : 1,
        b.centerId || b.stationId ? Number(b.centerId || b.stationId) : null,
        requestedMileage,
      )
      .run();
  }
  else if (b.entity === "staff")
    await env.DB.batch([
      env.DB.prepare("DELETE FROM deleted_staff_records WHERE normalized_name=?").bind(employeeNameKey(b.fullName)),
      env.DB.prepare("INSERT INTO staff (full_name,cadre_type,job_title,detail,center_id,employment_status,active) VALUES (?,?,?,?,?,?,?)")
        .bind(b.fullName, b.cadreType, b.jobTitle, b.detail || null, b.centerId ? Number(b.centerId) : null, b.employmentStatus || "on_duty", (b.employmentStatus || "on_duty") === "on_duty" ? 1 : 0),
    ]);
  else if (b.entity === "setting")
    await env.DB.prepare(
      "INSERT INTO system_settings (key,value,label,category,updated_by) VALUES (?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP",
    )
      .bind(b.key, b.value, b.label, b.category || "general", access.email)
      .run();
  else
    return NextResponse.json(
      { error: "نوع الإعداد غير معروف" },
      { status: 400 },
    );
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const access = await getAccess(request);
  if (!hasPermission(access.profile, "settings.manage"))
    return NextResponse.json({ error: "الحذف متاح لمدير النظام فقط" }, { status: 403 });

  const { entity, id, key } = (await request.json()) as Record<string, any>;
  try {
    if (entity === "setting") {
      if (!key) return NextResponse.json({ error: "الإعداد غير محدد" }, { status: 400 });
      await env.DB.batch([
        env.DB.prepare("DELETE FROM system_settings WHERE key=?").bind(key),
        env.DB.prepare("INSERT INTO system_settings (key,value,label,category,updated_by) VALUES (?,?,?,?,?) ON CONFLICT(key) DO NOTHING").bind(`deleted__${key}`, "1", "عنصر محذوف", "_deleted", access.email),
      ]);
    } else if (entity === "center") {
      if (!id) return NextResponse.json({ error: "المركز غير محدد" }, { status: 400 });
      const used = await env.DB.prepare("SELECT 1 FROM stations WHERE center_id=? UNION ALL SELECT 1 FROM staff WHERE center_id=? UNION ALL SELECT 1 FROM vehicles WHERE center_id=? LIMIT 1").bind(id, id, id).first();
      if (used) return NextResponse.json({ error: "لا يمكن حذف المركز قبل حذف أو نقل المحطات والموظفين والمركبات التابعة له." }, { status: 409 });
      await env.DB.prepare("DELETE FROM centers WHERE id=?").bind(id).run();
    } else if (entity === "station") {
      if (!id) return NextResponse.json({ error: "المحطة غير محددة" }, { status: 400 });
      const used = await env.DB.prepare("SELECT 1 FROM operational_assignments WHERE station_id=? UNION ALL SELECT 1 FROM vehicle_maintenance WHERE station_id=? LIMIT 1").bind(id, id).first();
      if (used) return NextResponse.json({ error: "لا يمكن حذف المحطة لأنها مرتبطة بسجلات تشغيلية أو صيانة. يمكن تعديلها بدلًا من ذلك." }, { status: 409 });
      await env.DB.prepare("DELETE FROM stations WHERE id=?").bind(id).run();
    } else if (entity === "vehicle") {
      if (!id) return NextResponse.json({ error: "المركبة غير محددة" }, { status: 400 });
      const used = await env.DB.prepare("SELECT 1 FROM incidents WHERE vehicle_id=? UNION ALL SELECT 1 FROM fuel_fillings WHERE vehicle_id=? UNION ALL SELECT 1 FROM vehicle_movements WHERE vehicle_id=? UNION ALL SELECT 1 FROM vehicle_maintenance WHERE vehicle_id=? LIMIT 1").bind(id, id, id, id).first();
      if (used) return NextResponse.json({ error: "لا يمكن حذف المركبة لأنها مرتبطة ببلاغات أو حركة أو وقود أو صيانة. أخرجيها من الخدمة بدلًا من الحذف." }, { status: 409 });
      await env.DB.prepare("DELETE FROM vehicles WHERE id=?").bind(id).run();
    } else if (entity === "staff") {
      if (!id) return NextResponse.json({ error: "الموظف غير محدد" }, { status: 400 });
      const employee = await env.DB.prepare("SELECT full_name FROM staff WHERE id=?").bind(id).first<any>();
      if (!employee) return NextResponse.json({ error: "الموظف غير موجود أو حُذف مسبقًا" }, { status: 404 });
      const used = await env.DB.prepare("SELECT 1 FROM operational_assignments WHERE staff_id=? UNION ALL SELECT 1 FROM vehicle_movements WHERE driver_staff_id=? UNION ALL SELECT 1 FROM fuel_fillings WHERE driver_staff_id=? OR filled_by_staff_id=? LIMIT 1").bind(id, id, id, id).first();
      if (used) return NextResponse.json({ error: "لا يمكن حذف الموظف لوجود سجلات تشغيلية مرتبطة به. غيّري حالته الوظيفية بدلًا من الحذف." }, { status: 409 });
      await env.DB.batch([
        env.DB.prepare("DELETE FROM staff WHERE id=?").bind(id),
        env.DB.prepare("INSERT INTO deleted_staff_records (normalized_name,full_name,deleted_by) VALUES (?,?,?) ON CONFLICT(normalized_name) DO UPDATE SET full_name=excluded.full_name,deleted_by=excluded.deleted_by,deleted_at=CURRENT_TIMESTAMP")
          .bind(employeeNameKey(employee.full_name),employee.full_name,access.email),
      ]);
    } else {
      return NextResponse.json({ error: "نوع الإعداد غير معروف" }, { status: 400 });
    }
    await env.DB.prepare("INSERT INTO audit_logs (actor,action,entity_type,entity_id,details) VALUES (?,?,?,?,?)")
      .bind(access.email, "delete", entity, String(id || key || ""), "حذف من الإعدادات").run();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "تعذر الحذف لوجود بيانات مرتبطة بهذا العنصر" }, { status: 409 });
  }
}
