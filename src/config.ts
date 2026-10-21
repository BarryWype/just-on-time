/**
 * All tuning knobs for the combat loop. Every duration is in milliseconds.
 * Tweak these during playtests; nothing else should hold magic timing numbers.
 */
export const CONFIG = {
  /** Global game speed. 0.5 = slow motion (handy to study readability), 2 = double speed. */
  timeScale: 1,
  /** Longest frame step the simulation accepts, so a frozen tab doesn't fast-forward the fight. */
  maxFrameMs: 100,

  hand: {
    /** Cards dealt at the start of the fight. */
    startingSize: 5,
    /** Hard cap on hand size. While full, the draw timer waits and draws as soon as a slot frees up. */
    maxSize: 7,
    /** The leftmost (non-held) card is played automatically every interval. */
    playIntervalMs: 4000,
    /** Floor for the play interval once speed-up effects are applied. */
    minPlayIntervalMs: 1600,
    /** A new card is drawn to the right of the hand every interval. */
    drawIntervalMs: 4000,
  },

  energy: {
    start: 2,
    max: 3,
    /** One energy point is regenerated every interval (paused while at max). */
    regenIntervalMs: 14000,
    /** Energy spent to play a card immediately, skipping the queue. */
    forcePlayCost: 1,
  },

  block: {
    /** Block disappears this long after it was last gained (each gain resets the countdown). */
    durationMs: 8000,
  },

  player: {
    maxHp: 50,
  },

  enemy: {
    /** Time between two enemy actions. The intent for the next action is visible during the whole wait. */
    actionIntervalMs: 5000,
    /** Floor for the enemy interval once speed-up effects are applied. */
    minActionIntervalMs: 2400,
  },

  statuses: {
    /**
     * Re-applying an active status adds its duration instead of stacking its strength.
     * The remaining time is capped at (duration × this multiplier) to prevent runaway extensions.
     */
    extendCapMultiplier: 2,
    /** Player: draw interval is multiplied by this value. */
    flow: { drawIntervalMultiplier: 0.5 },
    /** Player: added to the play interval (negative = faster). */
    haste: { playIntervalBonusMs: -1000 },
    /** Enemy: added to the enemy action interval (positive = slower). */
    frost: { enemyIntervalBonusMs: 1000 },
    /** Enemy: added to the enemy action interval (negative = faster). */
    rage: { enemyIntervalBonusMs: -1000 },
  },

  input: {
    /** Pointer movement before a press turns into a drag. */
    dragThresholdPx: 6,
    /** Two taps on the same card within this window force-play it. */
    doubleTapMs: 300,
    /** Releasing a dragged card this far above the hand force-plays it. */
    forcePlayZonePx: 60,
  },
};
