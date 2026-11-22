/** ABUSE-01: evaluate trusted timestamps; persistence and atomic counting belong to infrastructure. */
const limit = 5;
const windowMilliseconds = 15 * 60 * 1000;

export type AbuseDecision = { readonly allowed: true } | {
  readonly allowed: false;
  readonly status: 429;
  readonly retryAfterSeconds: number;
};

function waitSeconds(attempts: readonly Date[], now: Date): number {
  const instant = now.getTime();
  const relevant = attempts.map(value => value.getTime())
    .filter(value => Number.isFinite(value) && value > instant - windowMilliseconds && value <= instant)
    .sort((left, right) => left - right);
  if (relevant.length < limit) return 0;
  const oldestOfLastFive = relevant[relevant.length - limit];
  return Math.max(1, Math.ceil((oldestOfLastFive + windowMilliseconds - instant) / 1000));
}

function decision(wait: number): AbuseDecision {
  return wait === 0 ? { allowed: true } : { allowed: false, status: 429, retryAfterSeconds: wait };
}

/** Account and IP are independent budgets, including for nonexistent accounts. */
export function assessLoginLimit(accountFailures: readonly Date[], ipFailures: readonly Date[], now: Date): AbuseDecision {
  return decision(Math.max(waitSeconds(accountFailures, now), waitSeconds(ipFailures, now)));
}

export function assessRegistrationLimit(ipAttempts: readonly Date[], now: Date): AbuseDecision {
  return decision(waitSeconds(ipAttempts, now));
}
