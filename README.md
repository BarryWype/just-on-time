# Just On Time

**▶ Play it in your browser: https://barrywype.github.io/just-on-time/**

Works on desktop and mobile. No install, no account.

A real-time card combat prototype. The leftmost card of your hand plays itself on a timer; you win by reordering the hand, holding cards back at the last moment, and spending energy to jump the queue.

This is a proof of concept with one goal: **is the timing + live reordering mechanic readable and fun?** One fight, no meta-game. Feedback welcome — open an issue.

## How to play

- Your **leftmost** card plays automatically every few seconds, and a new card is drawn on the right.
- In the middle of the screen, the **red** icon is what the enemy will do next (with a countdown); the **white** shield is your current block.
- Reorder your hand so the right card plays at the right time — block before big hits, attack while the enemy defends.
- Beat the Iron Golem before it beats you.

| Action | Mouse / touch |
| --- | --- |
| Reorder | Drag a card left/right in the hand |
| Save a card from being played | Press and hold it — the next card is played instead |
| Play a card now (costs 1 energy) | Drag it up into the middle of the screen and release, or double-tap it |
| Pause | Pause button, or <kbd>Space</kbd> (also auto-pauses when the tab is hidden) |

## Run locally

```bash
npm install
npm run dev        # local dev server
npm test           # engine unit tests
npm run build      # typecheck + production build into dist/
```

## Project structure

```
src/
  config.ts          All tuning constants (timings, energy, HP, caps) — the file to edit during playtests
  main.ts            Bootstrap: creates the game, wires the loop (requestAnimationFrame), buttons and keys
  game/              Pure logic, no DOM — testable in Node
    types.ts         GameState, CardInstance, GameEvent...
    engine.ts        tick(state, dt) + player actions (reorderCard, setHeld, forcePlay, start, togglePause)
    cards.ts         Card definitions (data-driven effects), starting deck, auto-generated descriptions
    enemy.ts         Enemy stats and its looping action pattern
    statuses.ts      Temporary effects (Flow, Haste, Frost, Rage): labels, side, descriptions
  render/            DOM layer — reads state, never changes game rules
    renderer.ts      Draws the state each frame and plays feedback for GameEvents
    input.ts         Pointer handling (drag/hold/double-tap) → calls engine actions
  styles.css
tests/engine.test.ts
```

Data flow per frame: `input` → engine actions → `tick(state, dt)` → `renderer.render(state)` → `state.events` cleared.
The engine pushes `GameEvent`s (card played, damage, block, enemy action) so the renderer can animate without knowing the rules.

## Timing constants (`src/config.ts`)

All durations are in milliseconds.

| Constant | Default | Meaning |
| --- | --- | --- |
| `timeScale` | 1 | Global speed. Try 0.5 to study readability in slow motion |
| `hand.startingSize` | 5 | Cards dealt at the start |
| `hand.maxSize` | 7 | Hand cap. When full, the draw waits and fires as soon as a slot frees |
| `hand.playIntervalMs` | 4000 | Leftmost card auto-plays every interval |
| `hand.minPlayIntervalMs` | 1600 | Floor after speed-ups (Haste) |
| `hand.drawIntervalMs` | 4000 | A card is drawn to the right every interval |
| `energy.start` / `energy.max` | 2 / 3 | Energy points |
| `energy.regenIntervalMs` | 14000 | +1 energy every interval (paused at max) |
| `energy.forcePlayCost` | 1 | Cost to play a card immediately |
| `block.durationMs` | 8000 | Block vanishes this long after it was last gained |
| `enemy.actionIntervalMs` | 5000 | Enemy acts every interval; its intent is shown the whole time |
| `enemy.minActionIntervalMs` | 2400 | Floor after enemy speed-ups (Rage) |
| `statuses.extendCapMultiplier` | 2 | Re-applying a status adds its duration, capped at duration × this |
| `statuses.flow.drawIntervalMultiplier` | 0.5 | Flow: draw twice as fast |
| `statuses.haste.playIntervalBonusMs` | -1000 | Haste: cards play 1s faster |
| `statuses.frost.enemyIntervalBonusMs` | +1000 | Frost: enemy acts 1s slower |
| `statuses.rage.enemyIntervalBonusMs` | -1000 | Rage (enemy buff): enemy acts 1s faster |
| `input.dragThresholdPx` | 6 | Movement before a press becomes a drag |
| `input.doubleTapMs` | 300 | Double-tap window for force-play |
| `input.forcePlayZonePx` | 60 | How far above the hand a release force-plays |

Card values (damage, block, effect durations) live in `src/game/cards.ts`; enemy HP and pattern in `src/game/enemy.ts`. Card text is generated from the effect data, so it stays in sync when you tweak numbers.

### Rules worth knowing when tuning

- Draw is resolved before play in the same tick, so with equal intervals the hand stays at 5.
- A held (pressed/dragged) card is skipped by the auto-play; the next card goes instead. If only the held card is left, the play waits until it's released.
- Statuses never stack in strength: re-applying extends the remaining time (up to the cap).
- Stagger pushes the enemy timer back (it can go below zero, i.e. more than one full interval away).

## Cards

| Card | Type | Effect |
| --- | --- | --- |
| Strike ×3 | Attack | 6 damage |
| Heavy Blow | Attack | 12 damage |
| Twin Slash | Attack | 4 damage ×2 |
| Guard ×3 | Defense | 6 block |
| Bulwark | Defense | 12 block |
| Parry | Defense | 4 block + 4 damage |
| Quick Draw | Draw | Draw 2 |
| Flow | Draw | Draw 2× faster for 16s |
| Haste | Tempo | Cards play 1s faster for 16s |
| Frost | Tempo | Enemy acts 1s slower for 20s |
| Stagger | Tempo | Delay the enemy's next action by 3s |
| Recharge | Tempo | +1 energy |

Enemy (Iron Golem, 90 HP) loops: Attack 5 → Attack 5 → Block 10 → Heavy 14 → Rage 16s → Attack 6.

## Deploy (GitHub Pages)

The game is published at https://barrywype.github.io/just-on-time/.

`.github/workflows/deploy.yml` runs the tests, builds and publishes `dist/` on every push to `main` (or manually from the Actions tab).
One-time setup: in the repo, **Settings → Pages → Source: GitHub Actions**. `vite.config.ts` uses a relative `base`, so it works under `/<repo>/` without changes.
