import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

describe("Corrélation HTTP (T-US20-06)", () => {
  it("propage un requestId sûr dans la requête et la réponse", () => {
    const request = new NextRequest("http://localhost/api/health", {
      headers: { "x-request-id": "req_proxy-123" },
    });

    const response = middleware(request);

    expect(response.headers.get("x-request-id")).toBe("req_proxy-123");
  });

  it("remplace un requestId invalide", () => {
    const request = new NextRequest("http://localhost/api/health", {
      headers: { "x-request-id": "identifiant non fiable" },
    });

    const response = middleware(request);

    expect(response.headers.get("x-request-id")).toMatch(/^req_[0-9a-f-]{36}$/);
  });
});
