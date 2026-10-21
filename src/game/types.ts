import type { CardId } from './cards';
import type { EnemyAction } from './enemy';
import type { StatusId } from './statuses';

export type Side = 'player' | 'enemy';
export type CardType = 'attack' | 'defense' | 'draw' | 'tempo';
export type Phase = 'ready' | 'running' | 'paused' | 'won' | 'lost';

export interface CardInstance {
  uid: number;
  defId: CardId;
}

export interface Fighter {
  hp: number;
  maxHp: number;
  block: number;
  blockMsLeft: number;
}

export interface Player extends Fighter {
  energy: number;
  energyTimerMs: number;
}

export interface Enemy extends Fighter {
  name: string;
  actionTimerMs: number;
  patternIndex: number;
}

/** Things that happened during a tick, consumed by the renderer for feedback (floaters, shakes...). */
export type GameEvent =
  | { kind: 'cardPlayed'; uid: number; defId: CardId; forced: boolean }
  | { kind: 'damage'; target: Side; amount: number; blocked: number }
  | { kind: 'block'; target: Side; amount: number }
  | { kind: 'enemyAction'; action: EnemyAction };

export interface GameState {
  phase: Phase;
  elapsedMs: number;
  player: Player;
  enemy: Enemy;
  hand: CardInstance[];
  drawPile: CardInstance[];
  discardPile: CardInstance[];
  /** Card currently grabbed by the player; it is skipped by the automatic play. */
  heldUid: number | null;
  playTimerMs: number;
  drawTimerMs: number;
  /** Active temporary effects, as remaining milliseconds. */
  statuses: Partial<Record<StatusId, number>>;
  events: GameEvent[];
  nextUid: number;
  rng: () => number;
}
