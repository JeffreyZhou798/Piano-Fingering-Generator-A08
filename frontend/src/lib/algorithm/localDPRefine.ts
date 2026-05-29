import { assignFingering } from './const';
import { actionSpace, rewardFunction } from './mdp';
import { buildStateActionKey, fingeringToString } from './policy';
import { Finger, Fingering, FingeringState, Hand, Note, Part } from './types';

export interface RefineOptions {
  enabled: boolean;
  maxWindows: number;
  windowRadii: number[];
  baseThreshold: number;
  highDiffThreshold: number;
  superGainThreshold: number;
  conservativeDiffThreshold: number;
  maxPathDiff: number;
  varianceWeight: number;
  rewardWeight: number;
  minVariance: number;
}

export interface RefineCandidate {
  index: number;
  start: number;
  end: number;
  refinedPath: Fingering[];
  originalScore: number;
  refinedScore: number;
  gainRatio: number;
  pathDiff: number;
  variance: number;
  radius: number;
}

export interface EnsembleAnalysis {
  avgQTable: Map<string, number>;
  varianceQTable: Map<string, number>;
}

export interface RefineStats {
  riskCount: number;
  candidateCount: number;
  acceptedCount: number;
  skippedConflictCount: number;
  appliedRanges: Array<{ start: number; end: number; gainRatio: number; radius: number }>;
}

export const DEFAULT_REFINE_OPTIONS: RefineOptions = {
  enabled: true,
  maxWindows: 5,
  windowRadii: [2, 3],
  baseThreshold: 0.05,
  highDiffThreshold: 0.07,
  superGainThreshold: 0.08,
  conservativeDiffThreshold: 0.6,
  maxPathDiff: 0.85,
  varianceWeight: 1,
  rewardWeight: 1,
  minVariance: 0
};

export function analyzeEnsemble(qTables: Map<string, number>[]): EnsembleAnalysis {
  const avgQTable = new Map<string, number>();
  const varianceQTable = new Map<string, number>();
  const allKeys = new Set<string>();

  for (const qTable of qTables) {
    for (const key of qTable.keys()) {
      allKeys.add(key);
    }
  }

  for (const key of allKeys) {
    const values = qTables.map(qTable => qTable.get(key) || 0);
    const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;

    avgQTable.set(key, avg);
    varianceQTable.set(key, variance);
  }

  return { avgQTable, varianceQTable };
}

export function localDPRefineSync(
  notes: Note[][],
  hand: Hand,
  part: Part,
  initialPolicy: Fingering[],
  varianceQTable: Map<string, number>,
  options?: Partial<RefineOptions>
): { policy: Fingering[]; stats: RefineStats } {
  const opts = { ...DEFAULT_REFINE_OPTIONS, ...options };
  const policy = initialPolicy.map(cloneFingering);
  const emptyStats: RefineStats = {
    riskCount: 0,
    candidateCount: 0,
    acceptedCount: 0,
    skippedConflictCount: 0,
    appliedRanges: []
  };

  if (!opts.enabled || initialPolicy.length === 0) {
    return { policy, stats: emptyStats };
  }

  const risks = detectRisks(notes, hand, part, initialPolicy, varianceQTable, opts);
  const candidates: RefineCandidate[] = [];

  for (const risk of risks) {
    let bestCandidate: RefineCandidate | null = null;

    for (const radius of opts.windowRadii) {
      const candidate = createCandidate(
        notes,
        hand,
        part,
        initialPolicy,
        varianceQTable,
        risk.index,
        radius
      );

      if (!candidate) {
        continue;
      }

      if (!bestCandidate || candidate.gainRatio > bestCandidate.gainRatio) {
        bestCandidate = candidate;
      }

      if (shouldAccept(candidate.gainRatio, candidate.pathDiff, opts)) {
        break;
      }
    }

    if (bestCandidate) {
      candidates.push(bestCandidate);
    }
  }

  const validCandidates = candidates
    .filter(candidate => candidate.variance >= opts.minVariance)
    .filter(candidate => candidate.pathDiff <= opts.maxPathDiff)
    .filter(candidate => shouldAccept(candidate.gainRatio, candidate.pathDiff, opts))
    .sort((a, b) => b.gainRatio - a.gainRatio);

  const occupied = new Set<number>();
  let skippedConflictCount = 0;
  const appliedRanges: RefineStats['appliedRanges'] = [];

  for (const candidate of validCandidates) {
    const conflicts = hasRangeConflict(candidate.start, candidate.end, occupied);
    if (conflicts) {
      skippedConflictCount += 1;
      continue;
    }

    for (let offset = 0; offset < candidate.refinedPath.length; offset += 1) {
      policy[candidate.start + offset] = cloneFingering(candidate.refinedPath[offset]);
    }

    for (let position = candidate.start; position < candidate.end; position += 1) {
      occupied.add(position);
    }

    appliedRanges.push({
      start: candidate.start,
      end: candidate.end,
      gainRatio: candidate.gainRatio,
      radius: candidate.radius
    });
  }

  return {
    policy,
    stats: {
      riskCount: risks.length,
      candidateCount: candidates.length,
      acceptedCount: appliedRanges.length,
      skippedConflictCount,
      appliedRanges
    }
  };
}

function detectRisks(
  notes: Note[][],
  hand: Hand,
  part: Part,
  initialPolicy: Fingering[],
  varianceQTable: Map<string, number>,
  options: RefineOptions
): Array<{ index: number; risk: number; variance: number }> {
  const rewardSeries = initialPolicy.map((action, index) => {
    const state = buildState(notes, initialPolicy, part, index, initialPolicy[index - 1] || []);
    return rewardFunction(hand, state, action);
  });

  const rewardMin = rewardSeries.length > 0 ? Math.min(...rewardSeries) : 0;
  const rewardMax = rewardSeries.length > 0 ? Math.max(...rewardSeries) : 0;

  const risks = initialPolicy.map((action, index) => {
    const previous = index > 0 ? initialPolicy[index - 1] : [];
    const state = buildState(notes, initialPolicy, part, index, previous);
    const key = buildStateActionKey(state, action);
    const variance = varianceQTable.get(key) || 0;
    const reward = rewardSeries[index];
    const normalizedReward = normalize(reward, rewardMin, rewardMax);
    const risk = options.varianceWeight * variance + options.rewardWeight * (1 - normalizedReward);

    return { index, risk, variance };
  });

  return risks
    .sort((a, b) => b.risk - a.risk)
    .slice(0, options.maxWindows);
}

function createCandidate(
  notes: Note[][],
  hand: Hand,
  part: Part,
  initialPolicy: Fingering[],
  varianceQTable: Map<string, number>,
  centerIndex: number,
  radius: number
): RefineCandidate | null {
  const start = Math.max(0, centerIndex - radius);
  const end = Math.min(notes.length, centerIndex + radius + 1);

  if (start >= end) {
    return null;
  }

  const refinedResult = runViterbiWindow(notes, hand, part, initialPolicy, start, end);
  if (!refinedResult) {
    return null;
  }

  const originalWindow = initialPolicy.slice(start, end);
  const originalScore = scoreWindowWithBoundaries(notes, hand, part, initialPolicy, start, end, originalWindow);
  const gainRatio = (refinedResult.score - originalScore) / Math.max(Math.abs(originalScore), 1);
  const windowSize = end - start;
  const pathDiff = hammingDistance(originalWindow, refinedResult.path) / Math.max(windowSize, 1);
  const variance = getWindowVariance(notes, part, initialPolicy, varianceQTable, start, end);

  return {
    index: centerIndex,
    start,
    end,
    refinedPath: refinedResult.path,
    originalScore,
    refinedScore: refinedResult.score,
    gainRatio,
    pathDiff,
    variance,
    radius
  };
}

function runViterbiWindow(
  notes: Note[][],
  hand: Hand,
  part: Part,
  policy: Fingering[],
  start: number,
  end: number
): { path: Fingering[]; score: number } | null {
  const layers: Array<Map<string, { fingering: Fingering; score: number; prevKey: string | null }>> = [];
  const leftBoundary = start > 0 ? policy[start - 1] : [];

  for (let index = start; index < end; index += 1) {
    const layer = new Map<string, { fingering: Fingering; score: number; prevKey: string | null }>();

    if (index === start) {
      const state = buildState(notes, policy, part, index, leftBoundary);
      const actions = getCandidateActions(notes, hand, state);

      for (const action of actions) {
        const score = rewardFunction(hand, state, action);
        const key = fingeringToString(action);
        const existing = layer.get(key);
        if (!existing || score > existing.score) {
          layer.set(key, { fingering: cloneFingering(action), score, prevKey: null });
        }
      }
    } else {
      const previousLayer = layers[layers.length - 1];

      for (const [prevKey, prevNode] of previousLayer.entries()) {
        const state = buildState(notes, policy, part, index, prevNode.fingering);
        const actions = getCandidateActions(notes, hand, state);

        for (const action of actions) {
          const transitionScore = rewardFunction(hand, state, action);
          const score = prevNode.score + transitionScore;
          const key = fingeringToString(action);
          const existing = layer.get(key);

          if (!existing || score > existing.score) {
            layer.set(key, { fingering: cloneFingering(action), score, prevKey });
          }
        }
      }
    }

    if (layer.size === 0) {
      return null;
    }

    layers.push(layer);
  }

  const rightBoundary = end < policy.length ? policy[end] : null;
  const finalLayer = layers[layers.length - 1];
  let bestKey: string | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const [key, node] of finalLayer.entries()) {
    let totalScore = node.score;

    if (rightBoundary) {
      const boundaryState = buildState(notes, policy, part, end, node.fingering);
      totalScore += rewardFunction(hand, boundaryState, rightBoundary);
    }

    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestKey = key;
    }
  }

  if (!bestKey) {
    return null;
  }

  const path = reconstructPath(layers, bestKey);
  return { path, score: bestScore };
}

function reconstructPath(
  layers: Array<Map<string, { fingering: Fingering; score: number; prevKey: string | null }>>,
  bestKey: string
): Fingering[] {
  const path = new Array<Fingering>(layers.length);
  let currentKey: string | null = bestKey;

  for (let index = layers.length - 1; index >= 0; index -= 1) {
    const node: { fingering: Fingering; score: number; prevKey: string | null } | undefined =
      currentKey ? layers[index].get(currentKey) : undefined;
    if (!node) {
      throw new Error('Failed to reconstruct refined fingering path');
    }

    path[index] = cloneFingering(node.fingering);
    currentKey = node.prevKey;
  }

  return path;
}

function scoreWindowWithBoundaries(
  notes: Note[][],
  hand: Hand,
  part: Part,
  initialPolicy: Fingering[],
  start: number,
  end: number,
  windowPath: Fingering[]
): number {
  let score = 0;
  let previous = start > 0 ? initialPolicy[start - 1] : [];

  for (let index = start; index < end; index += 1) {
    const action = windowPath[index - start];
    const state = buildState(notes, initialPolicy, part, index, previous);
    score += rewardFunction(hand, state, action);
    previous = action;
  }

  if (end < initialPolicy.length) {
    const rightBoundaryState = buildState(notes, initialPolicy, part, end, previous);
    score += rewardFunction(hand, rightBoundaryState, initialPolicy[end]);
  }

  return score;
}

function getWindowVariance(
  notes: Note[][],
  part: Part,
  initialPolicy: Fingering[],
  varianceQTable: Map<string, number>,
  start: number,
  end: number
): number {
  let total = 0;
  let count = 0;

  for (let index = start; index < end; index += 1) {
    const previous = index > 0 ? initialPolicy[index - 1] : [];
    const state = buildState(notes, initialPolicy, part, index, previous);
    const key = buildStateActionKey(state, initialPolicy[index]);
    total += varianceQTable.get(key) || 0;
    count += 1;
  }

  return count > 0 ? total / count : 0;
}

function getCandidateActions(notes: Note[][], hand: Hand, state: FingeringState): Fingering[] {
  const actions = actionSpace(hand, state, notes);
  if (actions.length > 0) {
    return actions;
  }

  const fallback = assignFingering(hand, notes[state.index]);
  if (fallback.length > 0) {
    return fallback;
  }

  return [
    notes[state.index].map((note, index) => ({
      pitch: note.pitch,
      finger: Math.min(index + 1, 5) as Finger
    }))
  ];
}

function buildState(
  notes: Note[][],
  initialPolicy: Fingering[],
  part: Part,
  index: number,
  previous: Fingering
): FingeringState {
  return {
    index,
    fingering: previous,
    nextNotes: index < notes.length ? notes[index] : [],
    part: resolvePartForIndex(part, index, notes.length, initialPolicy)
  };
}

function resolvePartForIndex(
  part: Part,
  index: number,
  totalLength: number,
  initialPolicy: Fingering[]
): Part {
  if (part === Part.WholePart) {
    return part;
  }

  if (index === 0) {
    return part;
  }

  if (index === totalLength - 1) {
    return part;
  }

  if (initialPolicy.length === 1) {
    return Part.WholePart;
  }

  return part;
}

function shouldAccept(gain: number, diff: number, options: RefineOptions): boolean {
  if (gain > options.superGainThreshold) {
    return true;
  }

  if (gain > options.baseThreshold && diff <= options.conservativeDiffThreshold) {
    return true;
  }

  if (diff > options.conservativeDiffThreshold && gain > options.highDiffThreshold) {
    return true;
  }

  return false;
}

function hammingDistance(a: Fingering[], b: Fingering[]): number {
  let diff = 0;

  for (let index = 0; index < a.length; index += 1) {
    const left = a[index];
    const right = b[index];

    if (left.length !== right.length) {
      diff += 1;
      continue;
    }

    let same = true;
    for (let fingerIndex = 0; fingerIndex < left.length; fingerIndex += 1) {
      const lf = left[fingerIndex];
      const rf = right[fingerIndex];
      if (lf.pitch !== rf.pitch || lf.finger !== rf.finger) {
        same = false;
        break;
      }
    }

    if (!same) {
      diff += 1;
    }
  }

  return diff;
}

function hasRangeConflict(start: number, end: number, occupied: Set<number>): boolean {
  for (let index = start; index < end; index += 1) {
    if (occupied.has(index)) {
      return true;
    }
  }

  return false;
}

function normalize(value: number, min: number, max: number): number {
  if (min === max) {
    return 1;
  }

  return (value - min) / (max - min);
}

function cloneFingering(fingering: Fingering): Fingering {
  return fingering.map(entry => ({ ...entry }));
}
