import { describe, expect, it } from "vitest";
import { isGameAdmin, isReservedAdminEmail, isScvEmail, normalizeEmail } from "../auth/auth-utils";

describe("email account rules", () => {
  it("normalizes addresses without changing their local identity", () => {
    expect(normalizeEmail("  Lucas.Kerouault@SCV.BZH ")).toBe("lucas.kerouault@scv.bzh");
  });

  it("accepts only addresses ending in the SCV domain", () => {
    expect(isScvEmail("joueur@scv.bzh")).toBe(true);
    expect(isScvEmail("JOUEUR@SCV.BZH")).toBe(true);
    expect(isScvEmail("joueur@scv.bzh.example.org")).toBe(false);
    expect(isScvEmail("joueur@not-scv.bzh")).toBe(false);
  });

  it("reserves exactly the two verified administrator addresses", () => {
    expect(isReservedAdminEmail("Lucas.kerouault@scv.bzh")).toBe(true);
    expect(isReservedAdminEmail("sportzonefr@proton.me")).toBe(true);
    expect(isReservedAdminEmail("someone@scv.bzh")).toBe(false);
    expect(isGameAdmin({ email: "lucas.kerouault@scv.bzh", email_confirmed_at: undefined })).toBe(
      false,
    );
    expect(
      isGameAdmin({ email: "lucas.kerouault@scv.bzh", email_confirmed_at: "2026-01-01T00:00:00Z" }),
    ).toBe(true);
  });
});
