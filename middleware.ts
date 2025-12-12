
import { NextResponse } from "next/server";
import { auth } from "@/auth";

export default auth((req) => {
    const isAuth = !!req.auth;
    const isAuthPage = req.nextUrl.pathname.startsWith("/api/auth");
    const isPublicPage = req.nextUrl.pathname === "/";

    // Allow auth routes and public page
    if (isAuthPage) return;
    // If public page and logged in, maybe redirect to dashboard?
    // if (isPublicPage && isAuth) return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
    if (isPublicPage) return;

    if (!isAuth) {
        // Redirect to signin
        return NextResponse.redirect(new URL("/api/auth/signin", req.url));
    }
});

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
