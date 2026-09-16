import seed from "./datasheet-seed.json";

const ARCHIVE_BATCH = "Data Sheet Sep 2026";
const fields: [string, string][] = [
  ["incidentNumber","incident_number"],["incidentCode","incident_code"],["beneficiaryName","beneficiary_name"],["gender","gender"],["contact","contact"],["age","age"],
  ["urgency","urgency"],["category","category"],["caseType","case_type"],["pickupType","pickup_type"],["pickupLocation","pickup_location"],
  ["pickupGovernorate","pickup_governorate"],["pickupMunicipality","pickup_municipality"],["pickupNeighborhood","pickup_neighborhood"],
  ["dropoffType","dropoff_type"],["dropoffLocation","dropoff_location"],["shift","shift"],["station","station"],["vehicle","vehicle"],
  ["kmStart","km_start"],["kmEnd","km_end"],["distanceKm","distance_km"],["callDate","call_date"],["callTime","call_time"],
  ["dispatchDate","dispatch_date"],["dispatchTime","dispatch_time"],["onSceneDate","on_scene_date"],["arrivalTime","arrival_time"],
  ["hospitalDate","hospital_date"],["hospitalTime","hospital_time"],["availableDate","available_date"],["clearTime","clear_time"],
  ["dispatcherPrimary","dispatcher_primary"],["dispatcherSecondary","dispatcher_secondary"],["emtDriver","emt_driver"],["emtLead","emt_lead"],["emtAssist","emt_assist"],
  ["fuelLiters","fuel_liters"],["cancelled","cancelled"],["notes","notes"],["patientDeceased","patient_deceased"],["conflictRelated","conflict_related"],
  ["chiefComplaint","chief_complaint"],["oxygen","oxygen"],["bvm","bvm"],["airway","airway"],["cpr","cpr"],["aed","aed"],["drugs","drugs"],
  ["woundCare","wound_care"],["tourniquet","tourniquet"],["immobilization","immobilization"],["cervicalCollar","cervical_collar"],
  ["glucoseCheck","glucose_check"],["splinting","splinting"],["delivery","delivery"],["sourceImportKey","source_import_key"],
  ["sourceIncidentNumber","source_incident_number"],["sourceIncidentCode","source_incident_code"],["importBatch","import_batch"],
  ["dataQualityStatus","data_quality_status"],["dataQualityNotes","data_quality_notes"],["approvalStatus","approval_status"],
];

type ImportResult = { imported:number; existing:number; failed:number; total:number; errors:string[] };

function safeIncidentNumber(record:any,used:Set<string>) {
  const original=String(record.incidentNumber||"").trim();
  if(original&&!used.has(original)) return original;
  const source=String(record.sourceIncidentCode||record.incidentCode||record.sourceImportKey||"incident").trim().replace(/[^\p{L}\p{N}._-]+/gu,"-");
  const base=`ARCH-${source||"incident"}`;
  let candidate=base,suffix=2;
  while(used.has(candidate)) candidate=`${base}-${suffix++}`;
  return candidate;
}

export async function ensureDataSheetImported(db:any):Promise<ImportResult> {
  const current=await db.prepare("SELECT incident_number,source_import_key FROM incidents").all();
  const usedNumbers=new Set<string>(current.results.map((row:any)=>String(row.incident_number)));
  const importedKeys=new Set<string>(current.results.map((row:any)=>row.source_import_key).filter(Boolean).map(String));
  const pending:any[]=[];
  for(const source of seed as any[]) {
    if(importedKeys.has(String(source.sourceImportKey))) continue;
    const record={...source,incidentNumber:safeIncidentNumber(source,usedNumbers),importBatch:ARCHIVE_BATCH};
    usedNumbers.add(record.incidentNumber);
    pending.push(record);
  }

  const sql=`INSERT OR IGNORE INTO incidents (${fields.map(([,column])=>column).join(",")},created_by) VALUES (${fields.map(()=>"?").join(",")},?)`;
  let imported=0;
  const errors:string[]=[];
  for(let i=0;i<pending.length;i+=30) {
    const chunk=pending.slice(i,i+30);
    const statements=chunk.map((record:any)=>db.prepare(sql).bind(
      ...fields.map(([key])=>{const value=record[key];return typeof value==="boolean"?(value?1:0):value??null;}),"excel-import",
    ));
    try {
      const results=await db.batch(statements);
      imported+=results.reduce((sum:number,result:any)=>sum+Number(result.meta?.changes||0),0);
    } catch {
      for(let index=0;index<statements.length;index++) {
        try {const result=await statements[index].run();imported+=Number(result.meta?.changes||0);}
        catch(error) {if(errors.length<10){const row=chunk[index];errors.push(`${row.sourceImportKey}: ${error instanceof Error?error.message:String(error)}`);}}
      }
    }
  }
  return {imported,existing:seed.length-pending.length,failed:pending.length-imported,total:seed.length,errors};
}
