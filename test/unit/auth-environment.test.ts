import { afterEach, describe, expect, it } from "vitest";

import { getApplicationOrigin, getBetterAuthSecret } from "@/lib/auth/environment";

const initialAuthSecret = process.env.BETTER_AUTH_SECRET;
const initialAuthUrl = process.env.BETTER_AUTH_URL;

afterEach(() => {
  if (initialAuthSecret === undefined) {
    delete process.env.BETTER_AUTH_SECRET;
  } else {
    process.env.BETTER_AUTH_SECRET = initialAuthSecret;
  }

  if (initialAuthUrl === undefined) {
    delete process.env.BETTER_AUTH_URL;
  } else {
    process.env.BETTER_AUTH_URL = initialAuthUrl;
  }
});

describe("auth environment", () => {
  it("accepts a Better Auth secret of at least 32 characters", () => {
    process.env.BETTER_AUTH_SECRET = "a".repeat(32);
    expect(getBetterAuthSecret()).toBe("a".repeat(32));
  });

  it("rejects a missing or short Better Auth secret", () => {
    delete process.env.BETTER_AUTH_SECRET;
    expect(() => getBetterAuthSecret()).toThrow("BETTER_AUTH_SECRET_MISSING");

    process.env.BETTER_AUTH_SECRET = "too-short";
    expect(() => getBetterAuthSecret()).toThrow("BETTER_AUTH_SECRET_TOO_SHORT");
  });

  it.each(["http://localhost:3000", "http://127.0.0.1:3000", "https://heig-odyssey.online"])(
    "accepts the trusted application origin %s",
    (applicationUrl) => {
      process.env.BETTER_AUTH_URL = applicationUrl;
      expect(getApplicationOrigin()).toBe(applicationUrl);
    },
  );

  it.each([
    "http://heig-odyssey.online",
    "https://user:password@heig-odyssey.online",
    "https://heig-odyssey.online/login",
    "not-a-url",
  ])("rejects the unsafe application URL %s", (applicationUrl) => {
    process.env.BETTER_AUTH_URL = applicationUrl;
    expect(() => getApplicationOrigin()).toThrow();
  });
});
