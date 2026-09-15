import { NextRequest } from "next/server";
import { AuthUser, hasPermission, sessionUser } from "@/lib/auth";

export type AccessProfile = AuthUser;
export async function getAccess(request:NextRequest){const profile=await sessionUser(request);return {externalId:profile?String(profile.id):"",email:profile?.email||profile?.username||"",profile};}
export function canEnter(role?:string){return role==="admin"||role==="central_user"||role==="station_user";}
export { hasPermission };
