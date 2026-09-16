import { env } from "@/lib/server-env";
import { NextRequest,NextResponse } from "next/server";
import { getAccess,hasPermission } from "@/lib/access";

async function rows(sql:string,args:unknown[]=[]){try{return (await env.DB.prepare(sql).bind(...args).all()).results as any[];}catch(error){console.error("dashboard query failed",error);return [];}}
async function one(sql:string,args:unknown[]=[]){return (await rows(sql,args))[0]||{};}

export async function GET(request:NextRequest){
  const access=await getAccess(request);
  if(!hasPermission(access.profile,"dashboard.view")) return NextResponse.json({error:"لا توجد صلاحية لعرض المؤشرات"},{status:403});
  const url=new URL(request.url);
  const from=url.searchParams.get("from")||"1900-01-01",to=url.searchParams.get("to")||"2999-12-31";
  const governorate=url.searchParams.get("governorate")||"all",category=url.searchParams.get("category")||"all";
  let where="approval_status='approved' AND call_date BETWEEN ? AND ?";
  const args:unknown[]=[from,to];
  if(governorate!=="all"){where+=" AND pickup_governorate=?";args.push(governorate);}
  if(category!=="all"){where+=" AND category=?";args.push(category);}
  if(access.profile?.role==="station_user"){where+=" AND station=?";args.push(access.profile.station);}

  const [incidents,assets,coordination,crew,governorates,categories,timeline,cases,stations]=await Promise.all([
    one(`SELECT COUNT(*)::int total,COUNT(*) FILTER (WHERE cancelled=0)::int transferred,COUNT(*) FILTER (WHERE patient_deceased=1)::int martyrs,COUNT(*) FILTER (WHERE category IN ('Trauma','إصابات','اصابات'))::int injuries,COUNT(DISTINCT NULLIF(beneficiary_name,''))::int beneficiaries,COALESCE(ROUND(AVG(NULLIF(response_minutes,0))::numeric,1),0) "avgResponse",COALESCE(ROUND(SUM(distance_km)::numeric,1),0) distance,COUNT(*) FILTER (WHERE urgency IN ('Red','حمراء'))::int "redCases" FROM incidents WHERE ${where}`,args),
    one("SELECT COUNT(*) FILTER (WHERE active=1 AND service_status='active')::int \"workingVehicles\",COUNT(*) FILTER (WHERE active=0 OR service_status<>'active')::int \"outVehicles\",(SELECT COUNT(*)::int FROM stations WHERE active=1) centers,(SELECT COUNT(*)::int FROM staff WHERE active=1) \"activeCrew\" FROM vehicles"),
    one("SELECT COUNT(*)::int total FROM coordinations WHERE coordination_date BETWEEN ? AND ?",[from,to]),
    rows("SELECT COALESCE(NULLIF(job_title,''),NULLIF(cadre_type,''),'غير مصنف') name,COUNT(*)::int value FROM staff WHERE active=1 GROUP BY 1 ORDER BY value DESC,name LIMIT 8"),
    rows(`SELECT pickup_governorate name,COUNT(*)::int value FROM incidents WHERE ${where} GROUP BY pickup_governorate ORDER BY value DESC`,args),
    rows(`SELECT category name,COUNT(*)::int value FROM incidents WHERE ${where} GROUP BY category ORDER BY value DESC`,args),
    rows(`SELECT substr(call_date,1,7) month,COUNT(*)::int value FROM incidents WHERE ${where} GROUP BY substr(call_date,1,7) ORDER BY substr(call_date,1,7)`,args),
    rows(`SELECT case_type name,COUNT(*)::int value FROM incidents WHERE ${where} GROUP BY case_type ORDER BY value DESC LIMIT 7`,args),
    rows(`SELECT station name,COUNT(*)::int incidents,COALESCE(ROUND(SUM(distance_km)::numeric,1),0) distance,COALESCE(ROUND(AVG(NULLIF(response_minutes,0))::numeric,1),0) response FROM incidents WHERE ${where} GROUP BY station ORDER BY incidents DESC`,args),
  ]);
  const summary={...incidents,...assets,coordinations:Number(coordination.total||0)};
  return NextResponse.json({summary,governorates,categories,timeline,cases,stations,crew,vehicleStatus:[{name:"عاملة",value:Number(summary.workingVehicles||0)},{name:"خارج الخدمة",value:Number(summary.outVehicles||0)}]});
}
