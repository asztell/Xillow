import { Listing } from "../types";

/**
 * Relevance scoring
 * -----------------
 * Results are ranked by a weighted blend of two signals:
 *
 *   1. Budget proximity  - how close the list price is to the user's
 *      `targetBudget`. 1.0 when the price is exactly on budget, decaying
 *      linearly to 0.0 once the price is off by 100% or more (either above or
 *      below). `max(0, 1 - |price - targetBudget| / targetBudget)`.
 *
 *   2. Recency           - how recently the listing went live, modelled as
 *      exponential decay with a 30-day time constant:
 *      `exp(-ageInDays / 30)`. A listing posted today scores ~1.0; one posted
 *      30 days ago scores ~0.37; older listings decay smoothly toward 0.
 *
 * When `targetBudget` is supplied the final score is the weighted average
 * `0.6 * budget + 0.4 * recency` (weights are configurable). Without a target
 * budget there is nothing to be "close" to, so results are ranked by recency
 * alone.
 *
 * Ties are broken deterministically by `id` then `source`, which keeps ordering
 * - and therefore pagination - stable across requests.
 */

export const DEFAULT_RECENCY_TAU_DAYS = 30;
export const DEFAULT_BUDGET_WEIGHT = 0.6;
export const DEFAULT_RECENCY_WEIGHT = 0.4;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface ScoringOptions {
  targetBudget?: number;
  /** Reference "now" - injectable for deterministic tests. */
  now?: Date;
  recencyTauDays?: number;
  budgetWeight?: number;
  recencyWeight?: number;
}

/** Budget-proximity component, in [0, 1]. */
export function budgetScore(price: number, targetBudget: number): number {
  if (!Number.isFinite(targetBudget) || targetBudget <= 0) {
    return 0;
  }
  const deviation = Math.abs(price - targetBudget) / targetBudget;
  return clamp01(1 - deviation);
}

/** Recency component, in (0, 1], using exponential decay. */
export function recencyScore(
  listedDate: string | Date,
  now: Date,
  tauDays: number = DEFAULT_RECENCY_TAU_DAYS,
): number {
  // `Date.parse` avoids allocating a `Date` per row on the scoring hot path; it
  // returns NaN for an unparseable value, which the guard below turns into 0.
  const listedMs =
    typeof listedDate === "string"
      ? Date.parse(listedDate)
      : listedDate.getTime();
  if (!Number.isFinite(listedMs)) {
    return 0;
  }
  const ageDays = Math.max(0, (now.getTime() - listedMs) / MS_PER_DAY);
  const tau = tauDays > 0 ? tauDays : DEFAULT_RECENCY_TAU_DAYS;
  return clamp01(Math.exp(-ageDays / tau));
}

/**
 * Computes the relevance score for a single listing and attaches it.
 *
 * Generic over the listing shape so any extra annotations on the input (e.g.
 * duplicate metadata) are preserved on the way out.
 */
export function scoreListing<T extends Listing>(
  listing: T,
  options: ScoringOptions = {},
): T & { score: number } {
  const now = options.now ?? new Date();
  const recency = recencyScore(
    listing.listedDate,
    now,
    options.recencyTauDays ?? DEFAULT_RECENCY_TAU_DAYS,
  );

  let score: number;
  if (options.targetBudget !== undefined && options.targetBudget > 0) {
    const budget = budgetScore(listing.price, options.targetBudget);
    const budgetWeight = options.budgetWeight ?? DEFAULT_BUDGET_WEIGHT;
    const recencyWeight = options.recencyWeight ?? DEFAULT_RECENCY_WEIGHT;
    const totalWeight = budgetWeight + recencyWeight;
    score =
      totalWeight > 0
        ? (budget * budgetWeight + recency * recencyWeight) / totalWeight
        : recency;
  } else {
    score = recency;
  }

  return { ...listing, score: clamp01(score) };
}

/** Comparator: score desc, then id asc, then source asc (stable ties). */
export function compareScored(
  a: { score: number; id: string; source: string },
  b: { score: number; id: string; source: string },
): number {
  if (b.score !== a.score) {
    return b.score - a.score;
  }
  if (a.id !== b.id) {
    return a.id < b.id ? -1 : 1;
  }
  if (a.source !== b.source) {
    return a.source < b.source ? -1 : 1;
  }
  return 0;
}

/** Scores and ranks a list of listings (does not paginate). */
export function rankListings<T extends Listing>(
  listings: T[],
  options: ScoringOptions = {},
): (T & { score: number })[] {
  return listings
    .map((listing) => scoreListing(listing, options))
    .sort(compareScored);
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}
