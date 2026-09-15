import { NextRequest,NextResponse } from "next/server";
export function proxy(request:NextRequest){const p=request.nextUrl.pathname;if(p.startsWith("/_next")||p.startsWith("/api/auth")||p==="/api/health"||p==="/login"||p==="/setup"||p.includes("."))return NextResponse.next();if(!request.cookies.get("ems_session")){const url=request.nextUrl.clone();url.pathname="/login";return NextResponse.redirect(url);}return NextResponse.next();}
export const config={matcher:["/((?!_next/static|_next/image|favicon.ico).*)"]};
