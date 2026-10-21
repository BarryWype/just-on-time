import { CONFIG } from '../config';
import { CARDS, STARTING_DECK, type CardEffect } from './cards';
import { ENEMY, type EnemyAction } from './enemy';
import type { StatusId } from './statuses';
import type { CardInstance, Fighter, GameState, Side } from './types';

/**
 * Pure combat simulation: no DOM, no timers. `tick` advances the state by a time step;
 * the other exports are the player actions available to the input layer.
 */

export function createGame(rng: () => number = Math.random): GameState {
  const state: GameState = {
    phase: 'ready',
    elapsedMs: 0,
    player: {
      hp: CONFIG.player.maxHp,
      maxHp: CONFIG.player.maxHp,
      block: 0,
      blockMsLeft: 0,
      energy: CONFIG.energy.start,
      energyTimerMs: 0,
    },
    enemy: {
      name: ENEMY.name,
      hp: ENEMY.maxHp,
      maxHp: ENEMY.maxHp,
      block: 0,
      blockMsLeft: 0,
      actionTimerMs: 0,
      patternIndex: 0,
    },
    hand: [],
    drawPile: [],
    discardPile: [],
    heldUid: null,
    playTimerMs: 0,
    drawTimerMs: 0,
    statuses: {},
    events: [],
    nextUid: 1,
    rng,
  };
  state.drawPile = shuffle(
    STARTING_DECK.map((defId) => ({ uid: state.nextUid++, defId })),
    rng,
  );
  for (let i = 0; i < CONFIG.hand.startingSize; i++) drawCard(state);
  return state;
}

export function tick(state: GameState, dtMs: number): void {
  if (state.phase !== 'running') return;
  state.elapsedMs += dtMs;
  tickStatuses(state, dtMs);
  tickBlock(state.player, dtMs);
  tickBlock(state.enemy, dtMs);
  tickEnergy(state, dtMs);
  tickDraw(state, dtMs);
  tickPlay(state, dtMs);
  tickEnemy(state, dtMs);
}

// --- Player actions ---------------------------------------------------------

export function start(state: GameState): void {
  if (state.phase === 'ready' || state.phase === 'paused') state.phase = 'running';
}

export function togglePause(state: GameState): void {
  if (state.phase === 'running') state.phase = 'paused';
  else if (state.phase === 'paused') state.phase = 'running';
}

export function setHeld(state: GameState, uid: number | null): void {
  state.heldUid = uid;
}

export function reorderCard(state: GameState, uid: number, toIndex: number): void {
  const from = state.hand.findIndex((c) => c.uid === uid);
  if (from === -1) return;
  const [card] = state.hand.splice(from, 1);
  state.hand.splice(Math.max(0, Math.min(toIndex, state.hand.length)), 0, card);
}

/** Spends energy to play a card right away. Returns false if it couldn't be played. */
export function forcePlay(state: GameState, uid: number): boolean {
  if (state.phase !== 'running' || state.player.energy < CONFIG.energy.forcePlayCost) return false;
  const card = state.hand.find((c) => c.uid === uid);
  if (!card) return false;
  state.player.energy -= CONFIG.energy.forcePlayCost;
  playCard(state, card, true);
  return true;
}

// --- Derived timings (also read by the renderer) ----------------------------

export function playInterval(state: GameState): number {
  const bonus = state.statuses.haste ? CONFIG.statuses.haste.playIntervalBonusMs : 0;
  return Math.max(CONFIG.hand.minPlayIntervalMs, CONFIG.hand.playIntervalMs + bonus);
}

export function drawInterval(state: GameState): number {
  const multiplier = state.statuses.flow ? CONFIG.statuses.flow.drawIntervalMultiplier : 1;
  return CONFIG.hand.drawIntervalMs * multiplier;
}

export function enemyInterval(state: GameState): number {
  let bonus = 0;
  if (state.statuses.frost) bonus += CONFIG.statuses.frost.enemyIntervalBonusMs;
  if (state.statuses.rage) bonus += CONFIG.statuses.rage.enemyIntervalBonusMs;
  return Math.max(CONFIG.enemy.minActionIntervalMs, CONFIG.enemy.actionIntervalMs + bonus);
}

export function currentIntent(state: GameState): EnemyAction {
  return ENEMY.pattern[state.enemy.patternIndex];
}

export function nextIntent(state: GameState): EnemyAction {
  return ENEMY.pattern[(state.enemy.patternIndex + 1) % ENEMY.pattern.length];
}

/** The card the automatic play will pick: the leftmost one not held by the player. */
export function nextCardToPlay(state: GameState): CardInstance | undefined {
  return state.hand.find((c) => c.uid !== state.heldUid);
}

// --- Simulation steps -------------------------------------------------------

function tickStatuses(state: GameState, dtMs: number): void {
  for (const id of Object.keys(state.statuses) as StatusId[]) {
    const remaining = state.statuses[id]! - dtMs;
    if (remaining <= 0) delete state.statuses[id];
    else state.statuses[id] = remaining;
  }
}

function tickBlock(fighter: Fighter, dtMs: number): void {
  if (fighter.block === 0) return;
  fighter.blockMsLeft -= dtMs;
  if (fighter.blockMsLeft <= 0) {
    fighter.block = 0;
    fighter.blockMsLeft = 0;
  }
}

function tickEnergy(state: GameState, dtMs: number): void {
  const player = state.player;
  if (player.energy >= CONFIG.energy.max) {
    player.energyTimerMs = 0;
    return;
  }
  player.energyTimerMs += dtMs;
  if (player.energyTimerMs >= CONFIG.energy.regenIntervalMs) {
    player.energyTimerMs = 0;
    player.energy++;
  }
}

function tickDraw(state: GameState, dtMs: number): void {
  const interval = drawInterval(state);
  state.drawTimerMs = Math.min(state.drawTimerMs + dtMs, interval);
  if (state.drawTimerMs < interval || state.hand.length >= CONFIG.hand.maxSize) return;
  if (drawCard(state)) state.drawTimerMs = 0;
}

function tickPlay(state: GameState, dtMs: number): void {
  const interval = playInterval(state);
  state.playTimerMs = Math.min(state.playTimerMs + dtMs, interval);
  if (state.playTimerMs < interval) return;
  const card = nextCardToPlay(state);
  if (!card) return;
  state.playTimerMs = 0;
  playCard(state, card, false);
}

function tickEnemy(state: GameState, dtMs: number): void {
  if (state.phase !== 'running') return;
  const enemy = state.enemy;
  enemy.actionTimerMs += dtMs;
  if (enemy.actionTimerMs < enemyInterval(state)) return;
  enemy.actionTimerMs = 0;
  const action = currentIntent(state);
  enemy.patternIndex = (enemy.patternIndex + 1) % ENEMY.pattern.length;
  state.events.push({ kind: 'enemyAction', action });
  switch (action.kind) {
    case 'attack':
      dealDamage(state, 'player', action.amount);
      break;
    case 'block':
      gainBlock(state, 'enemy', action.amount);
      break;
    case 'status':
      applyStatus(state, action.status, action.durationMs);
      break;
  }
}

// --- Resolution helpers -----------------------------------------------------

function playCard(state: GameState, card: CardInstance, forced: boolean): void {
  state.hand.splice(state.hand.indexOf(card), 1);
  state.discardPile.push(card);
  if (state.heldUid === card.uid) state.heldUid = null;
  state.events.push({ kind: 'cardPlayed', uid: card.uid, defId: card.defId, forced });
  for (const effect of CARDS[card.defId].effects) applyCardEffect(state, effect);
}

function applyCardEffect(state: GameState, effect: CardEffect): void {
  switch (effect.kind) {
    case 'damage':
      for (let i = 0; i < (effect.hits ?? 1); i++) dealDamage(state, 'enemy', effect.amount);
      break;
    case 'block':
      gainBlock(state, 'player', effect.amount);
      break;
    case 'draw':
      for (let i = 0; i < effect.count && state.hand.length < CONFIG.hand.maxSize; i++) drawCard(state);
      break;
    case 'energy':
      state.player.energy = Math.min(CONFIG.energy.max, state.player.energy + effect.amount);
      break;
    case 'delayEnemy':
      state.enemy.actionTimerMs -= effect.ms;
      break;
    case 'status':
      applyStatus(state, effect.status, effect.durationMs);
      break;
  }
}

function dealDamage(state: GameState, target: Side, amount: number): void {
  const fighter = state[target];
  const blocked = Math.min(fighter.block, amount);
  fighter.block -= blocked;
  const damage = amount - blocked;
  fighter.hp = Math.max(0, fighter.hp - damage);
  state.events.push({ kind: 'damage', target, amount: damage, blocked });
  if (fighter.hp === 0 && state.phase === 'running') {
    state.phase = target === 'enemy' ? 'won' : 'lost';
  }
}

function gainBlock(state: GameState, target: Side, amount: number): void {
  const fighter = state[target];
  fighter.block += amount;
  fighter.blockMsLeft = CONFIG.block.durationMs;
  state.events.push({ kind: 'block', target, amount });
}

/** Re-applying an active status extends its duration (capped) instead of stacking its strength. */
export function applyStatus(state: GameState, id: StatusId, durationMs: number): void {
  const cap = durationMs * CONFIG.statuses.extendCapMultiplier;
  state.statuses[id] = Math.min((state.statuses[id] ?? 0) + durationMs, cap);
}

function drawCard(state: GameState): boolean {
  if (state.drawPile.length === 0) {
    state.drawPile = shuffle(state.discardPile, state.rng);
    state.discardPile = [];
  }
  const card = state.drawPile.pop();
  if (!card) return false;
  state.hand.push(card);
  return true;
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
