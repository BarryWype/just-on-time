import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import {
  applyStatus,
  createGame,
  enemyInterval,
  forcePlay,
  reorderCard,
  setHeld,
  start,
  tick,
} from '../src/game/engine';
import type { GameState } from '../src/game/types';

function runningGame(): GameState {
  let seed = 1;
  const state = createGame(() => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646);
  start(state);
  return state;
}

describe('hand timing', () => {
  it('plays the leftmost card when the play timer elapses', () => {
    const state = runningGame();
    const first = state.hand[0].uid;
    tick(state, CONFIG.hand.playIntervalMs - 1);
    expect(state.hand.some((c) => c.uid === first)).toBe(true);
    tick(state, 1);
    expect(state.discardPile.map((c) => c.uid)).toContain(first);
  });

  it('skips the held card and plays the next one', () => {
    const state = runningGame();
    const [held, second] = state.hand;
    setHeld(state, held.uid);
    tick(state, CONFIG.hand.playIntervalMs);
    expect(state.hand[0].uid).toBe(held.uid);
    expect(state.discardPile.map((c) => c.uid)).toContain(second.uid);
  });

  it('keeps the hand at its starting size when draw and play intervals match', () => {
    const state = runningGame();
    tick(state, CONFIG.hand.playIntervalMs);
    expect(state.hand).toHaveLength(CONFIG.hand.startingSize);
  });

  it('reorders cards within the hand', () => {
    const state = runningGame();
    const last = state.hand[state.hand.length - 1].uid;
    reorderCard(state, last, 0);
    expect(state.hand[0].uid).toBe(last);
  });
});

describe('energy', () => {
  it('force-plays a card for energy', () => {
    const state = runningGame();
    const uid = state.hand[3].uid;
    expect(forcePlay(state, uid)).toBe(true);
    expect(state.player.energy).toBe(CONFIG.energy.start - CONFIG.energy.forcePlayCost);
    expect(state.hand.some((c) => c.uid === uid)).toBe(false);
  });

  it('refuses to force-play without energy', () => {
    const state = runningGame();
    state.player.energy = 0;
    expect(forcePlay(state, state.hand[0].uid)).toBe(false);
  });

  it('regenerates energy up to the max', () => {
    const state = runningGame();
    state.player.energy = CONFIG.energy.max - 1;
    for (let t = 0; t < CONFIG.energy.regenIntervalMs * 3; t += 50) {
      tick(state, 50);
      state.player.hp = CONFIG.player.maxHp;
    }
    expect(state.player.energy).toBe(CONFIG.energy.max);
  });
});

describe('statuses', () => {
  it('extends duration instead of stacking strength', () => {
    const state = runningGame();
    applyStatus(state, 'frost', 10000);
    const slowed = enemyInterval(state);
    applyStatus(state, 'frost', 10000);
    expect(enemyInterval(state)).toBe(slowed);
    expect(state.statuses.frost).toBe(20000);
  });

  it('caps extended duration', () => {
    const state = runningGame();
    for (let i = 0; i < 5; i++) applyStatus(state, 'frost', 10000);
    expect(state.statuses.frost).toBe(10000 * CONFIG.statuses.extendCapMultiplier);
  });
});

describe('enemy', () => {
  it('attacks through block', () => {
    const state = runningGame();
    state.hand = [];
    state.drawPile = [];
    state.discardPile = [];
    state.player.block = 3;
    state.player.blockMsLeft = 10000;
    tick(state, CONFIG.enemy.actionIntervalMs);
    expect(state.player.block).toBe(0);
    expect(state.player.hp).toBe(CONFIG.player.maxHp - 2);
  });

  it('ends the fight when the player dies', () => {
    const state = runningGame();
    state.hand = [];
    state.drawPile = [];
    state.discardPile = [];
    state.player.hp = 1;
    tick(state, CONFIG.enemy.actionIntervalMs);
    expect(state.phase).toBe('lost');
  });
});
