import { actionSpace } from './mdp';
import { assignFingering } from './const';
import { Finger, Fingering, FingeringState, Hand, Note, Part } from './types';

export function fingeringToString(fingering: Fingering): string {
  return fingering.map(entry => `${entry.pitch}:${entry.finger}`).join(',');
}

export function buildStateActionKey(state: Pick<FingeringState, 'index' | 'fingering'>, action: Fingering): string {
  const stateStr = `${state.index}_${fingeringToString(state.fingering)}`;
  return `${stateStr}|${fingeringToString(action)}`;
}

export function getQValueFromTable(
  qTable: Map<string, number>,
  state: Pick<FingeringState, 'index' | 'fingering'>,
  action: Fingering
): number {
  return qTable.get(buildStateActionKey(state, action)) || 0;
}

function getFallbackAction(hand: Hand, notes: Note[]): Fingering {
  const candidates = assignFingering(hand, notes);
  if (candidates.length > 0) {
    return candidates[0];
  }

  return notes.map((note, index) => ({
    pitch: note.pitch,
    finger: Math.min(index + 1, 5) as Finger
  }));
}

export function extractPolicyFromQTable(
  qTable: Map<string, number>,
  hand: Hand,
  allNotes: Note[][],
  part: Part
): Fingering[] {
  const policy: Fingering[] = [];

  let state: FingeringState = {
    index: 0,
    fingering: [],
    nextNotes: allNotes[0],
    part
  };

  while (state.index < allNotes.length) {
    const actions = actionSpace(hand, state, allNotes);

    let bestAction: Fingering;
    if (actions.length === 0) {
      bestAction = getFallbackAction(hand, allNotes[state.index]);
    } else {
      bestAction = actions[0];
      let bestValue = getQValueFromTable(qTable, state, bestAction);

      for (const action of actions) {
        const value = getQValueFromTable(qTable, state, action);
        if (value > bestValue) {
          bestValue = value;
          bestAction = action;
        }
      }
    }

    policy.push(bestAction);
    state = {
      index: state.index + 1,
      fingering: bestAction,
      nextNotes: state.index + 1 < allNotes.length ? allNotes[state.index + 1] : [],
      part
    };
  }

  return policy;
}
