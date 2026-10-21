import { CONFIG } from '../config';
import { forcePlay, reorderCard, setHeld } from '../game/engine';
import type { GameState } from '../game/types';
import { slotWidth, type DragView } from './renderer';

interface Press {
  uid: number;
  pointerId: number;
  startX: number;
  startY: number;
  /** Pointer offset inside the card, so the card doesn't jump under the finger. */
  offsetX: number;
  offsetY: number;
  dragging: boolean;
}

/**
 * Pointer handling for the hand (mouse + touch):
 * - pressing a card holds it (it won't be auto-played),
 * - dragging reorders it live,
 * - releasing it above the hand, or double-tapping it, force-plays it.
 */
export function attachHandInput(handEl: HTMLElement, getState: () => GameState) {
  let press: Press | null = null;
  let view: DragView | null = null;
  let lastTap = { uid: -1, time: 0 };

  function release(): void {
    if (press && getState().heldUid === press.uid) setHeld(getState(), null);
    press = null;
    view = null;
  }

  handEl.addEventListener('pointerdown', (e) => {
    const cardEl = (e.target as HTMLElement).closest<HTMLElement>('.card');
    const state = getState();
    if (!cardEl || press || state.phase !== 'running') return;
    const uid = Number(cardEl.dataset.uid);
    if (!state.hand.some((c) => c.uid === uid)) return;
    const rect = cardEl.getBoundingClientRect();
    press = {
      uid,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      dragging: false,
    };
    handEl.setPointerCapture(e.pointerId);
    setHeld(state, uid);
    e.preventDefault();
  });

  handEl.addEventListener('pointermove', (e) => {
    if (!press || e.pointerId !== press.pointerId) return;
    const state = getState();
    if (state.phase !== 'running' || !state.hand.some((c) => c.uid === press!.uid)) {
      release();
      return;
    }
    const moved = Math.hypot(e.clientX - press.startX, e.clientY - press.startY);
    if (!press.dragging && moved < CONFIG.input.dragThresholdPx) return;
    press.dragging = true;

    const handRect = handEl.getBoundingClientRect();
    const x = e.clientX - handRect.left - press.offsetX;
    const y = e.clientY - handRect.top - press.offsetY;
    const slot = slotWidth(handRect.width, state.hand.length);
    reorderCard(state, press.uid, Math.round(x / slot));
    view = {
      uid: press.uid,
      x,
      y,
      overForceZone: e.clientY < handRect.top - CONFIG.input.forcePlayZonePx,
    };
  });

  handEl.addEventListener('pointerup', (e) => {
    if (!press || e.pointerId !== press.pointerId) return;
    const state = getState();
    const uid = press.uid;
    if (press.dragging) {
      if (view?.overForceZone) forcePlay(state, uid);
    } else if (lastTap.uid === uid && e.timeStamp - lastTap.time < CONFIG.input.doubleTapMs) {
      forcePlay(state, uid);
      lastTap = { uid: -1, time: 0 };
    } else {
      lastTap = { uid, time: e.timeStamp };
    }
    release();
  });

  handEl.addEventListener('pointercancel', release);

  return {
    view: () => view,
    release,
  };
}
