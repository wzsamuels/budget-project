
import NextAuth from "next-auth";
import authConfig from "./auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
    const isAuth = !!req.auth;
    const isAuthPage = req.nextUrl.pathname.startsWith("/api/auth");
    const isPublicPage = req.nextUrl.pathname === "/";

    if (isAuthPage) return;
    if (isPublicPage) return;

    if (!isAuth) {
        return NextResponse.redirect(new URL("/api/auth/signin", req.url));
    }
});

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
