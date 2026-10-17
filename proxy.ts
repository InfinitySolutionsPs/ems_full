import { NextRequest,NextResponse } from "next/server";
const freshPage=()=>{const response=NextResponse.next();response.headers.set("Cache-Control","private, no-store, no-cache, max-age=0, must-revalidate");response.headers.set("Pragma","no-cache");response.headers.set("Expires","0");return response;};
export function proxy(request:NextRequest){const p=request.nextUrl.pathname;if(p.startsWith("/_next")||p.startsWith("/api/auth")||p==="/api/health"||p.includes("."))return NextResponse.next();if(p==="/login"||p==="/setup")return freshPage();if(!request.cookies.get("ems_session")){const url=request.nextUrl.clone();url.pathname="/login";return NextResponse.redirect(url);}return freshPage();}
export const config={matcher:["/((?!_next/static|_next/image|favicon.ico).*)"]};
