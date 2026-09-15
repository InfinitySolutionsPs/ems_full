import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/server-env";

export const SESSION_COOKIE = "ems_session";
export type AuthUser = { id:number; username:string|null; email:string|null; full_name:string; role:string; permissions:string; station:string|null; active:number };

export function hashPassword(password:string){const salt=randomBytes(16).toString("hex");return `scrypt$${salt}$${scryptSync(password,salt,64).toString("hex")}`;}
export function verifyPassword(password:string, encoded:string){try{const [,salt,hash]=encoded.split("$");const a=Buffer.from(hash,"hex"),b=scryptSync(password,salt,64);return a.length===b.length&&timingSafeEqual(a,b);}catch{return false;}}
const tokenHash=(token:string)=>createHash("sha256").update(token).digest("hex");
export function parsePermissions(value:unknown):string[]{try{const x=JSON.parse(String(value||"[]"));return Array.isArray(x)?x.map(String):[];}catch{return [];}}
export function hasPermission(user:AuthUser|undefined|null, permission:string){if(!user?.active)return false;const p=parsePermissions(user.permissions);return user.role==="admin"||p.includes("*")||p.includes(permission);}
export async function sessionUser(request:NextRequest){const token=request.cookies.get(SESSION_COOKIE)?.value;if(!token)return null;const user=await env.DB.prepare(`SELECT u.id,u.username,u.email,u.full_name,u.role,u.permissions,u.station,u.active FROM auth_sessions s JOIN user_profiles u ON u.id=s.user_id WHERE s.id=? AND s.expires_at>CURRENT_TIMESTAMP LIMIT 1`).bind(tokenHash(token)).first<AuthUser>();return user||null;}
export async function createSession(userId:number){const token=randomBytes(32).toString("base64url");await env.DB.prepare("DELETE FROM auth_sessions WHERE expires_at<=CURRENT_TIMESTAMP").run();await env.DB.prepare("INSERT INTO auth_sessions (id,user_id,expires_at) VALUES (?,?,CURRENT_TIMESTAMP + INTERVAL '14 days')").bind(tokenHash(token),userId).run();return token;}
export function setSessionCookie(response:NextResponse,token:string){response.cookies.set(SESSION_COOKIE,token,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",maxAge:60*60*24*14});}
export function clearSessionCookie(response:NextResponse){response.cookies.set(SESSION_COOKIE,"",{httpOnly:true,path:"/",maxAge:0});}

