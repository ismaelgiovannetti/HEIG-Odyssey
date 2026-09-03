import { NextResponse, type NextRequest } from "next/server";

const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;

export function middleware(request: NextRequest) {
  const forwarded = request.headers.get("x-request-id")?.trim();
  const requestId =
    forwarded && SAFE_REQUEST_ID.test(forwarded)
      ? forwarded
      : `req_${crypto.randomUUID()}`;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
