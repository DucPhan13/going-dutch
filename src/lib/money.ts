export const VND_INPUT_MULTIPLIER = 1_000;

/**
 * Parses a user-entered VND amount into its persisted integer value.
 *
 * Whole values below 1,000 represent thousands in the UI: `30` becomes
 * `30,000`, while already-expanded values such as `30,000` stay unchanged.
 */
export function parseVndAmount(input: unknown): number | null {
  const amount = parsePositiveInteger(input);
  if (amount === null) return null;

  const persistedAmount = amount < VND_INPUT_MULTIPLIER
    ? amount * VND_INPUT_MULTIPLIER
    : amount;

  return Number.isSafeInteger(persistedAmount) ? persistedAmount : null;
}

/** Returns whether a value is a positive, safe whole-number VND amount. */
export function isVndAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function parsePositiveInteger(input: unknown): number | null {
  if (typeof input === "number") {
    return Number.isSafeInteger(input) && input > 0 ? input : null;
  }

  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!/^\d+$/.test(trimmed)) return null;

  const amount = Number(trimmed);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}
