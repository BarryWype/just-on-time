import './styles.css';
import { CONFIG } from './config';
import { createGame, start, tick, togglePause } from './game/engine';
import { attachHandInput } from './render/input';
import { createRenderer } from './render/renderer';

let state = createGame();
const renderer = createRenderer();
const input = attachHandInput(renderer.hand, () => state);

renderer.overlayButton.addEventListener('click', () => {
  if (state.phase === 'won' || state.phase === 'lost') {
    input.release();
    renderer.reset();
    state = createGame();
  }
  start(state);
  renderer.overlayButton.blur();
});

renderer.pauseButton.addEventListener('click', () => {
  togglePause(state);
  renderer.pauseButton.blur();
});

window.addEventListener('keydown', (e) => {
  if (e.code !== 'Space') return;
  e.preventDefault();
  if (state.phase === 'running' || state.phase === 'paused') togglePause(state);
  else renderer.overlayButton.click();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.phase === 'running') togglePause(state);
});

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(now - last, CONFIG.maxFrameMs) * CONFIG.timeScale;
  last = now;
  tick(state, dt);
  renderer.render(state, input.view());
  state.events.length = 0;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
