import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { defaultLocale } from "./src/lib/locale";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // If there's no NEXT_LOCALE cookie, set the default
  if (!request.cookies.get("NEXT_LOCALE")) {
    response.cookies.set("NEXT_LOCALE", defaultLocale, {
      path: "/",
      sameSite: "lax",
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
