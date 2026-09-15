import { NextRequest,NextResponse } from "next/server";
import { env } from "@/lib/server-env";
import { parsePermissions,sessionUser } from "@/lib/auth";
export async function GET(request:NextRequest){const row=await env.DB.prepare("SELECT COUNT(*) count FROM user_profiles WHERE password_hash IS NOT NULL").first<{count:number}>();const user=await sessionUser(request);return NextResponse.json({needsSetup:!Number(row?.count||0),authenticated:!!user,user:user?{id:user.id,username:user.username,email:user.email,fullName:user.full_name,role:user.role,station:user.station,permissions:parsePermissions(user.permissions)}:null});}
