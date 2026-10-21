import { STATUS_INFO, type StatusId } from './statuses';
import type { CardType } from './types';

export type CardEffect =
  | { kind: 'damage'; amount: number; hits?: number }
  | { kind: 'block'; amount: number }
  | { kind: 'draw'; count: number }
  | { kind: 'energy'; amount: number }
  /** Pushes the enemy's action timer back. */
  | { kind: 'delayEnemy'; ms: number }
  | { kind: 'status'; status: StatusId; durationMs: number };

export interface CardDef {
  name: string;
  type: CardType;
  effects: CardEffect[];
}

export type CardId =
  | 'strike'
  | 'heavyBlow'
  | 'twinSlash'
  | 'guard'
  | 'bulwark'
  | 'parry'
  | 'quickDraw'
  | 'flow'
  | 'haste'
  | 'frost'
  | 'stagger'
  | 'recharge';

export const CARDS: Record<CardId, CardDef> = {
  strike: { name: 'Strike', type: 'attack', effects: [{ kind: 'damage', amount: 6 }] },
  heavyBlow: { name: 'Heavy Blow', type: 'attack', effects: [{ kind: 'damage', amount: 12 }] },
  twinSlash: { name: 'Twin Slash', type: 'attack', effects: [{ kind: 'damage', amount: 4, hits: 2 }] },
  guard: { name: 'Guard', type: 'defense', effects: [{ kind: 'block', amount: 6 }] },
  bulwark: { name: 'Bulwark', type: 'defense', effects: [{ kind: 'block', amount: 12 }] },
  parry: {
    name: 'Parry',
    type: 'defense',
    effects: [
      { kind: 'block', amount: 4 },
      { kind: 'damage', amount: 4 },
    ],
  },
  quickDraw: { name: 'Quick Draw', type: 'draw', effects: [{ kind: 'draw', count: 2 }] },
  flow: { name: 'Flow', type: 'draw', effects: [{ kind: 'status', status: 'flow', durationMs: 16000 }] },
  haste: { name: 'Haste', type: 'tempo', effects: [{ kind: 'status', status: 'haste', durationMs: 16000 }] },
  frost: { name: 'Frost', type: 'tempo', effects: [{ kind: 'status', status: 'frost', durationMs: 20000 }] },
  stagger: { name: 'Stagger', type: 'tempo', effects: [{ kind: 'delayEnemy', ms: 3000 }] },
  recharge: { name: 'Recharge', type: 'tempo', effects: [{ kind: 'energy', amount: 1 }] },
};

export const STARTING_DECK: CardId[] = [
  'strike',
  'strike',
  'strike',
  'heavyBlow',
  'twinSlash',
  'guard',
  'guard',
  'guard',
  'bulwark',
  'parry',
  'quickDraw',
  'flow',
  'haste',
  'frost',
  'stagger',
  'recharge',
];

function describeEffect(effect: CardEffect): string {
  switch (effect.kind) {
    case 'damage':
      return effect.hits && effect.hits > 1
        ? `Deal ${effect.amount} damage ${effect.hits} times.`
        : `Deal ${effect.amount} damage.`;
    case 'block':
      return `Gain ${effect.amount} block.`;
    case 'draw':
      return `Draw ${effect.count} card${effect.count > 1 ? 's' : ''}.`;
    case 'energy':
      return `Gain ${effect.amount} energy.`;
    case 'delayEnemy':
      return `Delay the enemy's next action by ${effect.ms / 1000}s.`;
    case 'status': {
      const text = STATUS_INFO[effect.status].describe();
      return `For ${effect.durationMs / 1000}s, ${text}.`;
    }
  }
}

export function describeCard(def: CardDef): string {
  return def.effects.map(describeEffect).join(' ');
}
