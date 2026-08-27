import { describe, expect, it } from "vitest";

import {
  isEmailIdentifier,
  isValidUsername,
  normalizeUsername,
  sanitizeCallbackPath,
} from "@/lib/auth/constants";

describe("account authentication rules", () => {
  it("normalizes usernames for case-insensitive comparison", () => {
    expect(normalizeUsername("  Kim.Possible_1  ")).toBe("kim.possible_1");
  });

  it("accepts the username characters defined by the account flow", () => {
    expect(isValidUsername("Kim.Possible_1")).toBe(true);
  });

  it.each(["ab", "user@example", "bad-name", " user ", "admin"])(
    "rejects the invalid or reserved username %s",
    (username) => {
      expect(isValidUsername(username)).toBe(false);
    },
  );

  it("distinguishes email identifiers from usernames", () => {
    expect(isEmailIdentifier("player@example.com")).toBe(true);
    expect(isEmailIdentifier("player.name")).toBe(false);
  });

  it("keeps only internal callback paths", () => {
    expect(sanitizeCallbackPath("/campaign")).toBe("/campaign");
    expect(sanitizeCallbackPath("//malicious.example")).toBe("/");
    expect(sanitizeCallbackPath("https://malicious.example")).toBe("/");
  });

  it.each([
    "/\\malicious.example",
    "/%2f%2fmalicious.example",
    "/%5cmalicious.example",
    "/campaign\n",
  ])("rejects the ambiguous callback path %s", (callbackPath) => {
    expect(sanitizeCallbackPath(callbackPath)).toBe("/");
  });

  it("keeps safe query strings on internal callback paths", () => {
    expect(sanitizeCallbackPath("/login?verified=1")).toBe("/login?verified=1");
  });
});
