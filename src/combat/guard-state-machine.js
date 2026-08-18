import {
  LONGSWORD_GUARD_BASE,
  LONGSWORD_GUARD_AUTHORING_STATE,
} from './longsword-guard-metadata.js';

export const GUARD_STATE_AUTHORITY_NOTE =
  'Presentation state only. Authoritative combat simulation confirms block, parry and counter outcomes.';

export const GUARD_STATES = Object.freeze({
  NEUTRAL: 'neutral',
  ENTER: 'guard_enter',
  HOLD: 'guard_hold',
  BLOCK_HIT: 'guard_block_hit',
  PARRY: 'guard_parry',
  COUNTER: 'guard_counter',
  RECOVER: 'guard_recover',
  EXIT: 'guard_exit',
});

export const GUARD_EVENTS = Object.freeze({
  GUARD_PRESS: 'guard_press',
  GUARD_RELEASE: 'guard_release',
  ENTER_COMPLETE: 'enter_complete',
  BLOCK_CONFIRMED: 'block_confirmed',
  PARRY_CONFIRMED: 'parry_confirmed',
  COUNTER_CONFIRMED: 'counter_confirmed',
  REACTION_COMPLETE: 'reaction_complete',
  COUNTER_COMPLETE: 'counter_complete',
  RECOVER_COMPLETE: 'recover_complete',
  EXIT_COMPLETE: 'exit_complete',
  RESET: 'reset',
});

export const GUARD_EVENT_AUTHORITY = Object.freeze({
  [GUARD_EVENTS.GUARD_PRESS]: 'local-intent',
  [GUARD_EVENTS.GUARD_RELEASE]: 'local-intent',
  [GUARD_EVENTS.ENTER_COMPLETE]: 'presentation',
  [GUARD_EVENTS.BLOCK_CONFIRMED]: 'authoritative-combat',
  [GUARD_EVENTS.PARRY_CONFIRMED]: 'authoritative-combat',
  [GUARD_EVENTS.COUNTER_CONFIRMED]: 'authoritative-combat',
  [GUARD_EVENTS.REACTION_COMPLETE]: 'presentation',
  [GUARD_EVENTS.COUNTER_COMPLETE]: 'presentation',
  [GUARD_EVENTS.RECOVER_COMPLETE]: 'presentation',
  [GUARD_EVENTS.EXIT_COMPLETE]: 'presentation',
  [GUARD_EVENTS.RESET]: 'system',
});

const UNAUTHORED_PRESENTATION = Object.freeze({
  clipId: null,
  authored: false,
  inPlace: true,
  loop: false,
});

export const LONGSWORD_GUARD_PRESENTATION = Object.freeze({
  [GUARD_STATES.NEUTRAL]: Object.freeze({
    role: 'neutral',
    clipId: null,
    authored: false,
    inPlace: true,
    loop: true,
  }),
  [GUARD_STATES.ENTER]: Object.freeze({
    role: 'guard-enter',
    ...UNAUTHORED_PRESENTATION,
    plannedStage: 'G3.2',
  }),
  [GUARD_STATES.HOLD]: Object.freeze({
    role: 'guard-hold',
    clipId: LONGSWORD_GUARD_BASE.clipId,
    correctionLayerId: LONGSWORD_GUARD_BASE.correctionLayerId,
    correctionAuthoredStage: LONGSWORD_GUARD_AUTHORING_STATE.authoredStage,
    authored: LONGSWORD_GUARD_AUTHORING_STATE.authored === true,
    inPlace: true,
    loop: true,
  }),
  [GUARD_STATES.BLOCK_HIT]: Object.freeze({
    role: 'block-hit',
    ...UNAUTHORED_PRESENTATION,
    plannedStage: 'G3.3',
  }),
  [GUARD_STATES.PARRY]: Object.freeze({
    role: 'parry-reaction',
    ...UNAUTHORED_PRESENTATION,
    plannedStage: 'G3.3',
  }),
  [GUARD_STATES.COUNTER]: Object.freeze({
    role: 'guard-counter',
    ...UNAUTHORED_PRESENTATION,
    plannedStage: 'G3.4',
  }),
  [GUARD_STATES.RECOVER]: Object.freeze({
    role: 'guard-recover',
    ...UNAUTHORED_PRESENTATION,
    plannedStage: 'G3.2',
  }),
  [GUARD_STATES.EXIT]: Object.freeze({
    role: 'guard-exit',
    ...UNAUTHORED_PRESENTATION,
    plannedStage: 'G3.2',
  }),
});

export const GUARD_TRANSITION_GRAPH = Object.freeze({
  [GUARD_STATES.NEUTRAL]: Object.freeze({
    [GUARD_EVENTS.GUARD_PRESS]: GUARD_STATES.ENTER,
  }),
  [GUARD_STATES.ENTER]: Object.freeze({
    [GUARD_EVENTS.GUARD_RELEASE]: GUARD_STATES.EXIT,
    [GUARD_EVENTS.ENTER_COMPLETE]: GUARD_STATES.HOLD,
  }),
  [GUARD_STATES.HOLD]: Object.freeze({
    [GUARD_EVENTS.GUARD_RELEASE]: GUARD_STATES.EXIT,
    [GUARD_EVENTS.BLOCK_CONFIRMED]: GUARD_STATES.BLOCK_HIT,
    [GUARD_EVENTS.PARRY_CONFIRMED]: GUARD_STATES.PARRY,
  }),
  [GUARD_STATES.BLOCK_HIT]: Object.freeze({
    [GUARD_EVENTS.COUNTER_CONFIRMED]: GUARD_STATES.COUNTER,
    [GUARD_EVENTS.REACTION_COMPLETE]: GUARD_STATES.RECOVER,
  }),
  [GUARD_STATES.PARRY]: Object.freeze({
    [GUARD_EVENTS.COUNTER_CONFIRMED]: GUARD_STATES.COUNTER,
    [GUARD_EVENTS.REACTION_COMPLETE]: GUARD_STATES.RECOVER,
  }),
  [GUARD_STATES.COUNTER]: Object.freeze({
    [GUARD_EVENTS.COUNTER_COMPLETE]: GUARD_STATES.RECOVER,
  }),
  [GUARD_STATES.RECOVER]: Object.freeze({
    [GUARD_EVENTS.RECOVER_COMPLETE]: GUARD_STATES.HOLD,
  }),
  [GUARD_STATES.EXIT]: Object.freeze({
    [GUARD_EVENTS.GUARD_PRESS]: GUARD_STATES.ENTER,
    [GUARD_EVENTS.EXIT_COMPLETE]: GUARD_STATES.NEUTRAL,
  }),
});

function frozenPayload(payload) {
  if (!payload || typeof payload !== 'object') return Object.freeze({});
  return Object.freeze({ ...payload });
}

function resolveDynamicTarget(state, event, guardHeld) {
  if (state === GUARD_STATES.ENTER && event === GUARD_EVENTS.ENTER_COMPLETE) {
    return guardHeld ? GUARD_STATES.HOLD : GUARD_STATES.EXIT;
  }
  if (state === GUARD_STATES.RECOVER && event === GUARD_EVENTS.RECOVER_COMPLETE) {
    return guardHeld ? GUARD_STATES.HOLD : GUARD_STATES.EXIT;
  }
  if (state === GUARD_STATES.EXIT && event === GUARD_EVENTS.EXIT_COMPLETE) {
    return guardHeld ? GUARD_STATES.ENTER : GUARD_STATES.NEUTRAL;
  }
  return GUARD_TRANSITION_GRAPH[state]?.[event] || null;
}

export function getGuardPresentation(state) {
  return LONGSWORD_GUARD_PRESENTATION[state] || LONGSWORD_GUARD_PRESENTATION[GUARD_STATES.NEUTRAL];
}

export function createGuardStateMachine(options = {}) {
  let state = Object.values(GUARD_STATES).includes(options.initialState)
    ? options.initialState
    : GUARD_STATES.NEUTRAL;
  let guardHeld = Boolean(options.guardHeld);
  let elapsedMs = 0;
  let sequence = 0;
  let lastOutcome = null;
  let lastTransition = null;
  const listeners = new Set();

  function snapshot() {
    return Object.freeze({
      state,
      guardHeld,
      elapsedMs,
      sequence,
      lastOutcome,
      lastTransition,
      presentation: getGuardPresentation(state),
      authority: GUARD_STATE_AUTHORITY_NOTE,
    });
  }

  function emit() {
    const value = snapshot();
    for (const listener of listeners) listener(value);
    return value;
  }

  function transition(event, target, payload) {
    const from = state;
    state = target;
    elapsedMs = 0;
    sequence += 1;
    lastTransition = Object.freeze({
      sequence,
      event,
      authority: GUARD_EVENT_AUTHORITY[event] || 'unknown',
      from,
      to: target,
      payload: frozenPayload(payload),
    });
    return emit();
  }

  function send(event, payload = {}) {
    if (!Object.values(GUARD_EVENTS).includes(event)) {
      return Object.freeze({ accepted: false, transitioned: false, reason: 'unknown-event', snapshot: snapshot() });
    }

    if (event === GUARD_EVENTS.RESET) {
      guardHeld = false;
      lastOutcome = null;
      const value = transition(event, GUARD_STATES.NEUTRAL, payload);
      return Object.freeze({ accepted: true, transitioned: true, snapshot: value });
    }

    if (event === GUARD_EVENTS.GUARD_PRESS) guardHeld = true;
    if (event === GUARD_EVENTS.GUARD_RELEASE) guardHeld = false;
    if (event === GUARD_EVENTS.BLOCK_CONFIRMED) lastOutcome = 'block';
    if (event === GUARD_EVENTS.PARRY_CONFIRMED) lastOutcome = 'parry';
    if (event === GUARD_EVENTS.COUNTER_CONFIRMED) lastOutcome = 'counter';

    const target = resolveDynamicTarget(state, event, guardHeld);
    if (target) {
      const value = transition(event, target, payload);
      return Object.freeze({ accepted: true, transitioned: true, snapshot: value });
    }

    const intentOnly = (event === GUARD_EVENTS.GUARD_PRESS || event === GUARD_EVENTS.GUARD_RELEASE)
      && [GUARD_STATES.BLOCK_HIT, GUARD_STATES.PARRY, GUARD_STATES.COUNTER, GUARD_STATES.RECOVER].includes(state);
    if (intentOnly) {
      const value = emit();
      return Object.freeze({ accepted: true, transitioned: false, reason: 'intent-latched-until-recovery', snapshot: value });
    }

    return Object.freeze({ accepted: false, transitioned: false, reason: 'event-not-valid-for-state', snapshot: snapshot() });
  }

  return Object.freeze({
    get state() { return state; },
    get guardHeld() { return guardHeld; },
    get snapshot() { return snapshot(); },
    can(event) {
      if (!Object.values(GUARD_EVENTS).includes(event)) return false;
      if (event === GUARD_EVENTS.RESET) return true;
      if ((event === GUARD_EVENTS.GUARD_PRESS || event === GUARD_EVENTS.GUARD_RELEASE)
        && [GUARD_STATES.BLOCK_HIT, GUARD_STATES.PARRY, GUARD_STATES.COUNTER, GUARD_STATES.RECOVER].includes(state)) return true;
      const simulatedHeld = event === GUARD_EVENTS.GUARD_PRESS
        ? true
        : event === GUARD_EVENTS.GUARD_RELEASE
          ? false
          : guardHeld;
      return Boolean(resolveDynamicTarget(state, event, simulatedHeld));
    },
    send,
    update(deltaMs) {
      elapsedMs += Math.max(0, Number(deltaMs) || 0);
      return snapshot();
    },
    subscribe(listener) {
      if (typeof listener !== 'function') return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
}
