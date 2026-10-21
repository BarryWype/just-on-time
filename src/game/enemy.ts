import type { StatusId } from './statuses';

export type EnemyAction =
  | { kind: 'attack'; amount: number }
  | { kind: 'block'; amount: number }
  | { kind: 'status'; status: StatusId; durationMs: number };

/** Attacks at or above this value are shown as a heavy attack. */
export const HEAVY_ATTACK_THRESHOLD = 10;

export const ENEMY = {
  name: 'Iron Golem',
  maxHp: 90,
  /** Actions are performed in order and loop. One action per CONFIG.enemy.actionIntervalMs. */
  pattern: [
    { kind: 'attack', amount: 5 },
    { kind: 'attack', amount: 5 },
    { kind: 'block', amount: 10 },
    { kind: 'attack', amount: 14 },
    { kind: 'status', status: 'rage', durationMs: 16000 },
    { kind: 'attack', amount: 6 },
  ] as EnemyAction[],
};
