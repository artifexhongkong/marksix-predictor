import type { Draw } from './supabase';

export const TOTAL_NUMBERS = 49;
export const PICK_COUNT = 6;

// Theoretical baseline from the report: E(X) = 100 * 6/49 ≈ 12.24
export const EXPECTED_PER_100 = (100 * 6) / 49;
// Standard deviation from the report: σ ≈ 3.28 (binomial)
export const STD_DEV = 3.28;

export type EngineParams = {
  window: number; // rolling window size (report recommends >= 100)
  sigmaThreshold: number; // σ multiplier for hot/cold classification (report: 3σ)
  emaRecentWeight: number; // weight for recent 30 draws (report: 0.6)
  emaSpan: number; // boundary between recent and older draws (report: 30)
  momentumWeight: number; // weight for momentum (熱者恆熱) stream
  reversionWeight: number; // weight for mean reversion (物極必反) stream
  transitionWeight: number; // weight for state transition (拐點) stream
  crowdBiasFilter: boolean; // avoid birthday numbers / arithmetic sequences
  seed?: number; // optional RNG seed for reproducibility
};

export const DEFAULT_PARAMS: EngineParams = {
  window: 100,
  sigmaThreshold: 3,
  emaRecentWeight: 0.6,
  emaSpan: 30,
  momentumWeight: 0.4,
  reversionWeight: 0.35,
  transitionWeight: 0.25,
  crowdBiasFilter: true,
};

export type Stream = 'momentum' | 'reversion' | 'transition';

export type NumberStat = {
  number: number;
  count: number; // raw appearances in window
  emaCount: number; // EMA-weighted appearances (time-decayed)
  expected: number; // theoretical expected count for the window
  deviation: number; // (emaCount - expected) / σ — in units of σ
  lastSeen: number; // draws since last appearance (gap / 遺漏值)
  recentGap: number; // gap in the most recent few draws
  priorGap: number; // gap before the recent ones (for transition detection)
  score: number; // composite weighted score
  streams: Stream[]; // which selection streams flagged this number
};

export type Analysis = {
  params: EngineParams;
  drawsUsed: number;
  stats: NumberStat[];
  hot: NumberStat[]; // above +σ threshold (momentum + extreme hot)
  cold: NumberStat[]; // below -σ threshold (mean reversion candidates)
  transitioning: NumberStat[]; // state transition candidates
  baseline: number; // E(X) for the window size
  sigma: number; // σ for the window size
};

// Seeded RNG (mulberry32) for reproducible predictions
function makeRng(seed?: number): () => number {
  if (seed === undefined) return Math.random;
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function analyze(draws: Draw[], params: EngineParams): Analysis {
  const sorted = [...draws].sort((a, b) => a.draw_number - b.draw_number);
  const window = sorted.slice(-Math.max(1, params.window));

  const rawCount = new Array<number>(TOTAL_NUMBERS + 1).fill(0);
  const emaCount = new Array<number>(TOTAL_NUMBERS + 1).fill(0);
  const lastSeenIdx = new Array<number>(TOTAL_NUMBERS + 1).fill(-1);

  // EMA time decay: recent `emaSpan` draws get `emaRecentWeight`,
  // older draws share (1 - emaRecentWeight).
  const recentCount = Math.min(params.emaSpan, window.length);
  const olderCount = Math.max(0, window.length - recentCount);
  const recentWeightPerDraw =
    recentCount > 0 ? params.emaRecentWeight / recentCount : 0;
  const olderWeightPerDraw =
    olderCount > 0 ? (1 - params.emaRecentWeight) / olderCount : 0;

  window.forEach((d, idx) => {
    const isRecent = idx >= window.length - recentCount;
    const w = isRecent ? recentWeightPerDraw : olderWeightPerDraw;
    for (const n of d.numbers) {
      rawCount[n] += 1;
      emaCount[n] += w;
      lastSeenIdx[n] = idx;
    }
  });

  // Scale EMA counts back to be comparable to raw counts (sum of weights = 1,
  // so multiply by window length to restore magnitude)
  const emaScale = window.length;
  const scaledEma = emaCount.map((c) => c * emaScale);

  // Baseline and σ scale to the actual window size
  const baseline = (params.window * 6) / 49;
  const sigma = Math.sqrt(params.window * (6 / 49) * (1 - 6 / 49));

  const stats: NumberStat[] = [];
  for (let n = 1; n <= TOTAL_NUMBERS; n++) {
    const deviation = (scaledEma[n] - baseline) / sigma;
    const lastSeen = lastSeenIdx[n] === -1 ? window.length : window.length - 1 - lastSeenIdx[n];

    // State transition: long cold but recent gap shrinking
    // Compare gap in last 5 draws vs the 5 before that
    const recentSlice = window.slice(-5);
    const priorSlice = window.slice(-10, -5);
    const inRecent = recentSlice.some((d) => d.numbers.includes(n));
    const inPrior = priorSlice.some((d) => d.numbers.includes(n));
    const recentGap = inRecent ? 0 : 5;
    const priorGap = inPrior ? 0 : 5;

    const streams: Stream[] = [];
    // Momentum: hot and recently active (deviation > +1σ and lastSeen small)
    if (deviation > 1 && lastSeen <= 3) streams.push('momentum');
    // Mean reversion: extreme cold (deviation < -threshold)
    if (deviation <= -params.sigmaThreshold) streams.push('reversion');
    // State transition: long cold (lastSeen large) but just appeared recently
    if (lastSeen >= 10 && inRecent) streams.push('transition');

    stats.push({
      number: n,
      count: rawCount[n],
      emaCount: scaledEma[n],
      expected: baseline,
      deviation,
      lastSeen,
      recentGap,
      priorGap,
      score: 0, // filled below
      streams,
    });
  }

  // Composite score from the three streams
  for (const s of stats) {
    let score = 0;
    // Momentum: reward positive deviation + recency
    if (s.streams.includes('momentum')) {
      score += params.momentumWeight * (s.deviation + 2) * (1 / (s.lastSeen + 1));
    }
    // Mean reversion: reward extreme negative deviation (stronger pull)
    if (s.streams.includes('reversion')) {
      score += params.reversionWeight * Math.abs(s.deviation);
    }
    // State transition: reward long gap broken by recent appearance
    if (s.streams.includes('transition')) {
      score += params.transitionWeight * s.lastSeen;
    }
    // Small baseline so every number has nonzero probability
    score += 0.05;
    s.score = Math.max(0.0001, score);
  }

  const hot = [...stats]
    .filter((s) => s.deviation > params.sigmaThreshold)
    .sort((a, b) => b.deviation - a.deviation)
    .slice(0, 10);
  const cold = [...stats]
    .filter((s) => s.deviation < -params.sigmaThreshold)
    .sort((a, b) => a.deviation - b.deviation)
    .slice(0, 10);
  const transitioning = [...stats]
    .filter((s) => s.streams.includes('transition'))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  return {
    params,
    drawsUsed: window.length,
    stats,
    hot,
    cold,
    transitioning,
    baseline,
    sigma,
  };
}

// Crowd bias filter: avoid pure birthday numbers (1-31) and arithmetic sequences
function passesCrowdBiasFilter(numbers: number[]): boolean {
  // Reject if all 6 numbers are in the birthday range 1-31
  const allBirthday = numbers.every((n) => n <= 31);
  if (allBirthday) return false;

  // Reject arithmetic sequences (e.g., 5,10,15,20,25,30)
  const sorted = [...numbers].sort((a, b) => a - b);
  const diffs = sorted.slice(1).map((n, i) => n - sorted[i]);
  const allSameDiff = diffs.every((d) => d === diffs[0]);
  if (allSameDiff) return false;

  // Reject 5+ consecutive numbers
  let consecutive = 1;
  let maxConsecutive = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) {
      consecutive++;
      maxConsecutive = Math.max(maxConsecutive, consecutive);
    } else {
      consecutive = 1;
    }
  }
  if (maxConsecutive >= 5) return false;

  return true;
}

function pickWeighted(
  pool: NumberStat[],
  count: number,
  rng: () => number
): number[] {
  const remaining = [...pool];
  const chosen: number[] = [];
  for (let i = 0; i < count; i++) {
    const total = remaining.reduce((s, st) => s + st.score, 0);
    let r = rng() * total;
    let idx = 0;
    for (let j = 0; j < remaining.length; j++) {
      r -= remaining[j].score;
      if (r <= 0) {
        idx = j;
        break;
      }
      idx = j;
    }
    chosen.push(remaining[idx].number);
    remaining.splice(idx, 1);
  }
  return chosen.sort((a, b) => a - b);
}

export type PredictionResult = {
  numbers: number[];
  specialNumber: number;
  analysis: Analysis;
  streamBreakdown: { stream: Stream; label: string; count: number }[];
};

export function predict(
  draws: Draw[],
  params: EngineParams = DEFAULT_PARAMS
): PredictionResult {
  const analysis = analyze(draws, params);
  const rng = makeRng(params.seed);

  let best: { numbers: number[]; special: number } | null = null;

  for (let attempt = 0; attempt < 300; attempt++) {
    const numbers = pickWeighted(analysis.stats, PICK_COUNT, rng);

    if (params.crowdBiasFilter && !passesCrowdBiasFilter(numbers)) continue;

    const specialPool = analysis.stats.filter(
      (s) => !numbers.includes(s.number)
    );
    const special = pickWeighted(specialPool, 1, rng)[0];

    best = { numbers, special };
    break;
  }

  // Fallback if all candidates failed the crowd bias filter
  if (!best) {
    const numbers = pickWeighted(analysis.stats, PICK_COUNT, rng);
    const specialPool = analysis.stats.filter(
      (s) => !numbers.includes(s.number)
    );
    const special = pickWeighted(specialPool, 1, rng)[0];
    best = { numbers, special };
  }

  // Stream breakdown for the chosen numbers
  const streamCounts: Record<Stream, number> = {
    momentum: 0,
    reversion: 0,
    transition: 0,
  };
  for (const n of best.numbers) {
    const st = analysis.stats.find((s) => s.number === n);
    if (st) for (const stream of st.streams) streamCounts[stream]++;
  }

  const streamBreakdown = [
    { stream: 'momentum' as Stream, label: '動態能量流', count: streamCounts.momentum },
    { stream: 'reversion' as Stream, label: '強效回歸流', count: streamCounts.reversion },
    { stream: 'transition' as Stream, label: '拐點動態流', count: streamCounts.transition },
  ];

  return {
    numbers: best.numbers,
    specialNumber: best.special,
    analysis,
    streamBreakdown,
  };
}

// Mark Six ball color by number range (official color scheme)
export function ballColor(n: number): string {
  if (n <= 9) return 'bg-red-500';
  if (n <= 19) return 'bg-blue-500';
  if (n <= 29) return 'bg-green-500';
  if (n <= 39) return 'bg-amber-500';
  return 'bg-purple-500'; // 40-49 (official Mark Six color, not a design choice)
}
