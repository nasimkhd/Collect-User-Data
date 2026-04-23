import { NextRequest, NextResponse } from "next/server";

// Safety rule for Cloudflare Tunnel (see DEPLOY.md):
//   - Public paths like "/" and "/api/submit" are always allowed.
//   - Admin paths ("/admin/*", "/api/login", "/api/export",
//     "/api/send-photos") must NOT be reachable from the public
//     internet when the app is exposed via a tunnel.
//
// Every request that comes through Cloudflare's edge carries a
// "cf-connecting-ip" (and "cf-ray") header. Direct requests from the
// laptop itself or other devices on the same Wi-Fi do not. So if one
// of those headers is present on a protected path, the request came
// from the tunnel and we hide the route by returning 404.
//
// To intentionally expose admin through the tunnel (don't!), set
// ADMIN_ALLOW_TUNNEL=1 in the environment.

export function middleware(req: NextRequest) {
  const viaCloudflare =
    req.headers.has("cf-connecting-ip") || req.headers.has("cf-ray");

  if (viaCloudflare && process.env.ADMIN_ALLOW_TUNNEL !== "1") {
    return new NextResponse("Not found", { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/login/:path*",
    "/api/export/:path*",
    "/api/send-photos/:path*",
  ],
};
