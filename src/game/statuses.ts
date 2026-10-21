import { CONFIG } from '../config';
import type { Side } from './types';

export type StatusId = 'flow' | 'haste' | 'frost' | 'rage';

interface StatusInfo {
  label: string;
  /** Which fighter panel displays the status. */
  side: Side;
  describe: () => string;
}

const S = CONFIG.statuses;

export const STATUS_INFO: Record<StatusId, StatusInfo> = {
  flow: {
    label: 'Flow',
    side: 'player',
    describe: () => `draw ${1 / S.flow.drawIntervalMultiplier}× faster`,
  },
  haste: {
    label: 'Haste',
    side: 'player',
    describe: () => `your cards play ${-S.haste.playIntervalBonusMs / 1000}s faster`,
  },
  frost: {
    label: 'Frost',
    side: 'enemy',
    describe: () => `enemy acts ${S.frost.enemyIntervalBonusMs / 1000}s slower`,
  },
  rage: {
    label: 'Rage',
    side: 'enemy',
    describe: () => `enemy acts ${-S.rage.enemyIntervalBonusMs / 1000}s faster`,
  },
};
