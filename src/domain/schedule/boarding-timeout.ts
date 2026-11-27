export const DEFAULT_MAX_BOARDING_MINUTES = 20;

export interface BoardingTimeoutStatus {
  overdue: boolean;
  elapsedMinutes: number;
  maxMinutes: number;
}

export function evaluateBoardingTimeout(
  boardingStartedAt: Date | null | undefined,
  now: Date,
  maxMinutes: number = DEFAULT_MAX_BOARDING_MINUTES,
): BoardingTimeoutStatus {
  const limit = maxMinutes > 0 ? maxMinutes : DEFAULT_MAX_BOARDING_MINUTES;
  if (!boardingStartedAt) {
    return {
      overdue: false,
      elapsedMinutes: 0,
      maxMinutes: limit,
    };
  }

  const diffMs = Math.max(0, now.getTime() - boardingStartedAt.getTime());
  const elapsedMinutes = Math.floor(diffMs / 60_000);

  return {
    overdue: diffMs > limit * 60_000,
    elapsedMinutes,
    maxMinutes: limit,
  };
}

export function isBoardingOverdue(
  boardingStartedAt: Date | null | undefined,
  now: Date,
  maxMinutes: number = DEFAULT_MAX_BOARDING_MINUTES,
): boolean {
  return evaluateBoardingTimeout(boardingStartedAt, now, maxMinutes).overdue;
}
