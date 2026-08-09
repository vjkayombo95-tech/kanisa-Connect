export type EventRegistrationType = "free" | "paid";
export type EventRegistrationStatus =
  | "registered"
  | "payment_pending"
  | "payment_submitted"
  | "confirmed"
  | "cancelled"
  | "refunded";
export type EventPaymentStatus = "not_required" | "pending" | "submitted" | "paid" | "failed" | "refunded";

export type PaidEventConfig = {
  registrationRequired?: boolean | null;
  registrationType?: string | null;
  registrationFee?: number | string | null;
  registrationCurrency?: string | null;
  registrationDeadline?: string | null;
  registrationCapacity?: number | string | null;
  registeredCount?: number | null;
};

export type EventRegistrationState = {
  registrationRequired: boolean;
  registrationType: EventRegistrationType;
  fee: number;
  currency: string;
  deadline: string | null;
  capacity: number | null;
  registeredCount: number;
  isPaid: boolean;
  isDeadlinePassed: boolean;
  isFull: boolean;
  canRegister: boolean;
  reason: "open" | "deadline_passed" | "full";
};

export function normalizePaidEventConfig(config: PaidEventConfig): EventRegistrationState {
  const fee = Math.max(0, Number(config.registrationFee ?? 0) || 0);
  const registrationType: EventRegistrationType = config.registrationType === "paid" && fee > 0 ? "paid" : "free";
  const capacityValue = Number(config.registrationCapacity ?? 0);
  const capacity = Number.isFinite(capacityValue) && capacityValue > 0 ? Math.floor(capacityValue) : null;
  const registeredCount = Math.max(0, Math.floor(Number(config.registeredCount ?? 0) || 0));
  const deadline = config.registrationDeadline || null;
  const deadlineTime = deadline ? new Date(deadline).getTime() : Number.NaN;
  const isDeadlinePassed = Number.isFinite(deadlineTime) ? deadlineTime < Date.now() : false;
  const isFull = capacity !== null && registeredCount >= capacity;
  const registrationRequired = Boolean(config.registrationRequired) || registrationType === "paid";
  const reason = isDeadlinePassed ? "deadline_passed" : isFull ? "full" : "open";

  return {
    registrationRequired,
    registrationType,
    fee: registrationType === "paid" ? fee : 0,
    currency: (config.registrationCurrency || "TZS").trim() || "TZS",
    deadline,
    capacity,
    registeredCount,
    isPaid: registrationType === "paid",
    isDeadlinePassed,
    isFull,
    canRegister: reason === "open",
    reason,
  };
}

export function validatePaidEventConfig(config: Pick<EventRegistrationState, "registrationType" | "fee" | "capacity">) {
  const errors: string[] = [];
  if (config.registrationType === "paid" && config.fee <= 0) {
    errors.push("paid_event_requires_fee");
  }
  if (config.registrationType === "free" && config.fee !== 0) {
    errors.push("free_event_fee_must_be_zero");
  }
  if (config.capacity !== null && config.capacity <= 0) {
    errors.push("capacity_must_be_positive");
  }
  return errors;
}

export function describeRegistrationStatus(status?: string | null, paymentStatus?: string | null) {
  if (status === "cancelled") return "cancelled";
  if (status === "refunded" || paymentStatus === "refunded") return "refunded";
  if (status === "confirmed" || paymentStatus === "paid") return "confirmed";
  if (status === "payment_submitted" || paymentStatus === "submitted") return "payment_submitted";
  if (status === "payment_pending" || paymentStatus === "pending") return "payment_pending";
  return "registered";
}
