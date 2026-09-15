import { NextRequest,NextResponse } from "next/server";
import { clearSessionCookie,SESSION_COOKIE } from "@/lib/auth";
import { createHash } from "node:crypto";
import { env } from "@/lib/server-env";
export async function POST(request:NextRequest){const token=request.cookies.get(SESSION_COOKIE)?.value;if(token)await env.DB.prepare("DELETE FROM auth_sessions WHERE id=?").bind(createHash("sha256").update(token).digest("hex")).run();const response=NextResponse.json({ok:true});clearSessionCookie(response);return response;}
