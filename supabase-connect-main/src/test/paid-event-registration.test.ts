import { describe, expect, it, vi } from "vitest";

import {
  describeRegistrationStatus,
  normalizePaidEventConfig,
  validatePaidEventConfig,
} from "@/lib/events/paid-registration";

describe("RC-2.9.0 paid event registration rules", () => {
  it("treats paid events as registration-required and payment-gated", () => {
    const state = normalizePaidEventConfig({
      registrationType: "paid",
      registrationFee: "5000",
      registrationCapacity: "30",
      registeredCount: 12,
    });

    expect(state.registrationRequired).toBe(true);
    expect(state.isPaid).toBe(true);
    expect(state.fee).toBe(5000);
    expect(state.capacity).toBe(30);
    expect(state.canRegister).toBe(true);
  });

  it("blocks registration when deadline has passed", () => {
    vi.setSystemTime(new Date("2026-07-05T12:00:00Z"));

    const state = normalizePaidEventConfig({
      registrationRequired: true,
      registrationDeadline: "2026-07-05T10:00:00Z",
    });

    expect(state.canRegister).toBe(false);
    expect(state.reason).toBe("deadline_passed");

    vi.useRealTimers();
  });

  it("blocks registration when capacity is full", () => {
    const state = normalizePaidEventConfig({
      registrationRequired: true,
      registrationCapacity: 2,
      registeredCount: 2,
    });

    expect(state.canRegister).toBe(false);
    expect(state.reason).toBe("full");
  });

  it("keeps free events free and rejects invalid paid/free fee combinations", () => {
    expect(validatePaidEventConfig({ registrationType: "paid", fee: 0, capacity: null })).toContain("paid_event_requires_fee");
    expect(validatePaidEventConfig({ registrationType: "free", fee: 100, capacity: null })).toContain("free_event_fee_must_be_zero");
    expect(validatePaidEventConfig({ registrationType: "free", fee: 0, capacity: null })).toEqual([]);
  });

  it("maps attendance payment states into stable display states", () => {
    expect(describeRegistrationStatus("payment_pending", "pending")).toBe("payment_pending");
    expect(describeRegistrationStatus("payment_submitted", "submitted")).toBe("payment_submitted");
    expect(describeRegistrationStatus("confirmed", "paid")).toBe("confirmed");
    expect(describeRegistrationStatus("cancelled", "pending")).toBe("cancelled");
  });
});
