import { CONFIG } from '../config';
import { CARDS, describeCard } from '../game/cards';
import { HEAVY_ATTACK_THRESHOLD, type EnemyAction } from '../game/enemy';
import {
  currentIntent,
  drawInterval,
  enemyInterval,
  nextCardToPlay,
  nextIntent,
  playInterval,
} from '../game/engine';
import { STATUS_INFO, type StatusId } from '../game/statuses';
import type { CardInstance, CardType, Fighter, GameState, Phase, Side } from '../game/types';
import { icon, type IconName } from './icons';

/** Position of the dragged card, in hand-local pixels (top-left corner). */
export interface DragView {
  uid: number;
  x: number;
  y: number;
  overForceZone: boolean;
}

const CARD_GAP = 8;
const MAX_SLOT_WIDTH = 132;
const LEAVE_ANIMATION_MS = 350;

/** Horizontal space per card. Shared with the input layer to map pointer x to a hand index. */
export function slotWidth(handWidth: number, cardCount: number): number {
  return Math.min(MAX_SLOT_WIDTH, handWidth / Math.max(cardCount, CONFIG.hand.startingSize));
}

interface CardView {
  el: HTMLElement;
  timer: HTMLElement;
  x: number;
}

function $(id: string): HTMLElement {
  return document.getElementById(id)!;
}

const CARD_TYPE_ICON: Record<CardType, IconName> = {
  attack: 'sword',
  defense: 'shield',
  draw: 'cards',
  tempo: 'hourglass',
};

const STATUS_ICON: Record<StatusId, IconName> = {
  flow: 'wave',
  haste: 'haste',
  frost: 'snowflake',
  rage: 'flame',
};

function setText(el: HTMLElement, text: string): void {
  if (el.textContent !== text) el.textContent = text;
}

const lastHtml = new WeakMap<HTMLElement, string>();

function setHtml(el: HTMLElement, html: string): void {
  if (lastHtml.get(el) === html) return;
  lastHtml.set(el, html);
  el.innerHTML = html;
}

function seconds(ms: number): string {
  return `${(Math.max(0, ms) / 1000).toFixed(1)}s`;
}

function intentLabel(action: EnemyAction): { icon: IconName; value: string; text: string } {
  switch (action.kind) {
    case 'attack':
      return action.amount >= HEAVY_ATTACK_THRESHOLD
        ? { icon: 'skull', value: String(action.amount), text: 'Heavy attack' }
        : { icon: 'sword', value: String(action.amount), text: 'Attack' };
    case 'block':
      return { icon: 'shield', value: String(action.amount), text: 'Block' };
    case 'status':
      return { icon: STATUS_ICON[action.status], value: '', text: STATUS_INFO[action.status].label };
  }
}

/** What the incoming hit will do, given the block that will still be up when it lands. */
function hitPreview(action: EnemyAction, player: Fighter, msUntilHit: number): string {
  if (action.kind !== 'attack') return '';
  const block = player.blockMsLeft > msUntilHit ? player.block : 0;
  const damage = Math.max(0, action.amount - block);
  return damage === 0 ? 'Fully blocked' : `You take ${damage}`;
}

function spawnFloater(parent: HTMLElement, html: string, className: string): void {
  const el = document.createElement('div');
  el.className = `floater ${className}`;
  el.innerHTML = html;
  el.addEventListener('animationend', () => el.remove());
  parent.appendChild(el);
}

function retrigger(el: HTMLElement, className: string): void {
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
}

const OVERLAY_CONTENT: Record<Exclude<Phase, 'running'>, { title: string; button: string }> = {
  ready: { title: 'Just On Time', button: 'Start' },
  paused: { title: 'Paused', button: 'Resume' },
  won: { title: 'Victory', button: 'Play again' },
  lost: { title: 'Defeated', button: 'Try again' },
};

function rulesHtml(): string {
  const play = CONFIG.hand.playIntervalMs / 1000;
  const draw = CONFIG.hand.drawIntervalMs / 1000;
  return `<ul class="rules">
    <li>Your <b>leftmost</b> card plays automatically every ${play}s. A new card is drawn every ${draw}s.</li>
    <li><b>Drag</b> cards to reorder your hand. A card you're holding is never auto-played: the next one goes instead.</li>
    <li>Drag a card <b>up</b> (or double-tap it) to play it now for ${icon('bolt')}${CONFIG.energy.forcePlayCost} energy.</li>
    <li>Watch the enemy's <b>intent</b> and its timer, and block or delay before big hits.</li>
  </ul>`;
}

export function createRenderer() {
  const els = {
    clock: $('clock'),
    pauseBtn: $('pause-btn'),
    enemyPanel: $('enemy'),
    enemyName: $('enemy-name'),
    enemyBlock: $('enemy-block'),
    enemyHpFill: $('enemy-hp-fill'),
    enemyHpText: $('enemy-hp-text'),
    enemyStatuses: $('enemy-statuses'),
    intent: $('intent'),
    intentIcon: $('intent-icon'),
    intentValue: $('intent-value'),
    intentText: $('intent-text'),
    intentOutcome: $('intent-outcome'),
    intentCountdown: $('intent-countdown'),
    intentTimer: $('intent-timer'),
    intentNext: $('intent-next'),
    forceZone: $('force-zone'),
    forceZoneText: $('force-zone-text'),
    playerPanel: $('player'),
    guard: $('guard'),
    guardValue: $('guard-value'),
    guardTimer: $('guard-timer'),
    guardCountdown: $('guard-countdown'),
    playerHpFill: $('player-hp-fill'),
    playerHpText: $('player-hp-text'),
    playerStatuses: $('player-statuses'),
    energy: $('energy'),
    energyTimer: $('energy-timer'),
    playCountdown: $('play-countdown'),
    drawTimer: $('draw-timer'),
    pileCount: $('pile-count'),
    hand: $('hand'),
    overlay: $('overlay'),
    overlayTitle: $('overlay-title'),
    overlayBody: $('overlay-body'),
    overlayBtn: $('overlay-btn'),
  };

  $('enemy-sprite').innerHTML = icon('golem');
  els.energy.innerHTML = icon('bolt');
  $('guard-icon').innerHTML = icon('shield');

  const pips = Array.from({ length: CONFIG.energy.max }, () => {
    const pip = document.createElement('span');
    pip.className = 'pip';
    els.energy.appendChild(pip);
    return pip;
  });

  const cardViews = new Map<number, CardView>();
  const statusHtml: Record<Side, string> = { player: '', enemy: '' };
  let lastPhase: Phase | null = null;

  function renderFighter(f: Fighter, fill: HTMLElement, text: HTMLElement): void {
    fill.style.width = `${(f.hp / f.maxHp) * 100}%`;
    setText(text, `${f.hp} / ${f.maxHp}`);
  }

  function renderGuard(state: GameState): void {
    const { block, blockMsLeft } = state.player;
    setText(els.guardValue, String(block));
    els.guard.classList.toggle('empty', block === 0);
    els.guardTimer.style.transform = `scaleX(${block ? blockMsLeft / CONFIG.block.durationMs : 0})`;
    setText(els.guardCountdown, block ? seconds(blockMsLeft) : '—');
  }

  function renderStatuses(state: GameState): void {
    const html: Record<Side, string> = { player: '', enemy: '' };
    for (const id of Object.keys(state.statuses) as StatusId[]) {
      const info = STATUS_INFO[id];
      html[info.side] += `<span class="status-chip" title="${info.describe()}">${icon(STATUS_ICON[id])}${info.label} ${seconds(state.statuses[id]!)}</span>`;
    }
    for (const side of ['player', 'enemy'] as const) {
      if (html[side] === statusHtml[side]) continue;
      statusHtml[side] = html[side];
      (side === 'player' ? els.playerStatuses : els.enemyStatuses).innerHTML = html[side];
    }
  }

  function renderIntent(state: GameState): void {
    const action = currentIntent(state);
    const label = intentLabel(action);
    const interval = enemyInterval(state);
    const msUntilHit = interval - state.enemy.actionTimerMs;
    setHtml(els.intentIcon, icon(label.icon));
    setText(els.intentValue, label.value);
    setText(els.intentText, label.text);
    setText(els.intentCountdown, seconds(msUntilHit));
    setText(els.intentOutcome, hitPreview(action, state.player, msUntilHit));
    els.intent.dataset.kind = action.kind === 'attack' && action.amount >= HEAVY_ATTACK_THRESHOLD ? 'heavy' : action.kind;
    const progress = Math.max(0, state.enemy.actionTimerMs) / interval;
    els.intentTimer.style.transform = `scaleX(${Math.min(1, progress)})`;
    const next = intentLabel(nextIntent(state));
    setHtml(els.intentNext, `Then ${icon(next.icon)}${next.text} ${next.value}`);
  }

  function createCardView(card: CardInstance, handWidth: number): CardView {
    const def = CARDS[card.defId];
    const el = document.createElement('div');
    el.className = `card type-${def.type}`;
    el.dataset.uid = String(card.uid);
    el.innerHTML = `
      <div class="card-head"><span class="card-icon">${icon(CARD_TYPE_ICON[def.type])}</span><span class="card-name">${def.name}</span></div>
      <div class="card-text">${describeCard(def)}</div>
      <div class="card-timer"></div>`;
    el.style.transform = `translate(${handWidth}px, 0)`;
    els.hand.appendChild(el);
    void el.offsetWidth;
    return { el, timer: el.querySelector('.card-timer')!, x: handWidth };
  }

  function renderHand(state: GameState, drag: DragView | null): void {
    const handWidth = els.hand.clientWidth;
    const slot = slotWidth(handWidth, state.hand.length);
    const next = nextCardToPlay(state);
    const playProgress = state.playTimerMs / playInterval(state);
    const inHand = new Set<number>();

    state.hand.forEach((card, index) => {
      inHand.add(card.uid);
      let view = cardViews.get(card.uid);
      if (!view) {
        view = createCardView(card, handWidth);
        cardViews.set(card.uid, view);
      }
      const dragging = drag?.uid === card.uid;
      view.x = dragging ? drag.x : index * slot;
      view.el.style.width = `${slot - CARD_GAP}px`;
      view.el.style.transform = dragging
        ? `translate(${drag.x}px, ${drag.y}px)`
        : `translate(${view.x}px, 0)`;
      view.el.classList.toggle('dragging', dragging);
      view.el.classList.toggle('held', card.uid === state.heldUid);
      view.el.classList.toggle('next', card.uid === next?.uid);
      view.timer.style.transform = `scaleX(${card.uid === next?.uid ? playProgress : 0})`;
    });

    for (const [uid, view] of cardViews) {
      if (inHand.has(uid)) continue;
      cardViews.delete(uid);
      view.el.classList.add('leaving');
      view.el.style.transform = `translate(${view.x}px, -140px)`;
      setTimeout(() => view.el.remove(), LEAVE_ANIMATION_MS);
    }

    setText(els.playCountdown, next ? seconds(playInterval(state) - state.playTimerMs) : '—');
    const handFull = state.hand.length >= CONFIG.hand.maxSize;
    els.drawTimer.style.transform = `scaleX(${handFull ? 1 : state.drawTimerMs / drawInterval(state)})`;
    els.drawTimer.classList.toggle('waiting', handFull);
    setText(els.pileCount, `${state.drawPile.length} left`);
  }

  function renderForceZone(state: GameState, drag: DragView | null): void {
    const canAfford = state.player.energy >= CONFIG.energy.forcePlayCost;
    els.forceZone.classList.toggle('active', drag !== null);
    els.forceZone.classList.toggle('over', drag?.overForceZone ?? false);
    els.forceZone.classList.toggle('no-energy', !canAfford);
    const cost = `${icon('bolt')}${CONFIG.energy.forcePlayCost}`;
    let text = '';
    if (drag && !canAfford) text = 'Not enough energy';
    else if (drag?.overForceZone) text = `Release to play now · ${cost}`;
    else if (drag) text = `Drag up here to play now · ${cost}`;
    setHtml(els.forceZoneText, text);
  }

  function renderEvents(state: GameState): void {
    for (const event of state.events) {
      switch (event.kind) {
        case 'cardPlayed': {
          const name = CARDS[event.defId].name;
          spawnFloater(els.forceZone, event.forced ? `${icon('bolt')}${name}` : name, 'play');
          break;
        }
        case 'damage': {
          const panel = event.target === 'enemy' ? els.enemyPanel : els.playerPanel;
          let text = `-${event.amount}`;
          if (event.amount === 0) text = `Blocked ${event.blocked}`;
          else if (event.blocked > 0) text += ` <small>${icon('shield')}${event.blocked}</small>`;
          spawnFloater(panel, text, 'damage');
          if (event.amount > 0) retrigger(panel, 'shake');
          break;
        }
        case 'block': {
          const panel = event.target === 'enemy' ? els.enemyPanel : els.playerPanel;
          spawnFloater(panel, `${icon('shield')}+${event.amount}`, 'block');
          if (event.target === 'player') retrigger(els.guard, 'flash');
          break;
        }
        case 'enemyAction':
          retrigger(els.intent, 'flash');
          break;
      }
    }
  }

  function renderOverlay(state: GameState): void {
    if (state.phase === lastPhase) return;
    lastPhase = state.phase;
    els.overlay.hidden = state.phase === 'running';
    setHtml(els.pauseBtn, icon(state.phase === 'paused' ? 'play' : 'pause'));
    if (state.phase === 'running') return;
    const content = OVERLAY_CONTENT[state.phase];
    setText(els.overlayTitle, content.title);
    setText(els.overlayBtn, content.button);
    const time = formatClock(state.elapsedMs);
    els.overlayBody.innerHTML =
      state.phase === 'won'
        ? `<p>You beat the ${state.enemy.name} in ${time} with ${state.player.hp} HP left.</p>`
        : state.phase === 'lost'
          ? `<p>The ${state.enemy.name} had ${state.enemy.hp} HP left (${time}).</p>`
          : rulesHtml();
  }

  function render(state: GameState, drag: DragView | null): void {
    setText(els.clock, formatClock(state.elapsedMs));
    setText(els.enemyName, state.enemy.name);
    renderFighter(state.enemy, els.enemyHpFill, els.enemyHpText);
    renderFighter(state.player, els.playerHpFill, els.playerHpText);
    els.enemyBlock.hidden = state.enemy.block === 0;
    setHtml(els.enemyBlock, `${icon('shield')}${state.enemy.block} <small>${seconds(state.enemy.blockMsLeft)}</small>`);
    renderGuard(state);
    pips.forEach((pip, i) => pip.classList.toggle('full', i < state.player.energy));
    const energyFull = state.player.energy >= CONFIG.energy.max;
    els.energyTimer.style.transform = `scaleX(${energyFull ? 1 : state.player.energyTimerMs / CONFIG.energy.regenIntervalMs})`;
    renderStatuses(state);
    renderIntent(state);
    renderHand(state, drag);
    renderForceZone(state, drag);
    renderEvents(state);
    renderOverlay(state);
  }

  function reset(): void {
    for (const view of cardViews.values()) view.el.remove();
    cardViews.clear();
    lastPhase = null;
  }

  return { render, reset, overlayButton: els.overlayBtn, pauseButton: els.pauseBtn, hand: els.hand };
}

function formatClock(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
