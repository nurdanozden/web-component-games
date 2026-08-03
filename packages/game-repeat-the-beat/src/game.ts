import { LitElement, html, css } from 'lit';
import { property, state } from 'lit/decorators.js';
import { GameState } from '@octapull-games/core';
type PadColor = 'blue' | 'green' | 'red' | 'yellow';
type GameStatus =
  | 'idle'
  | 'watching'
  | 'playerTurn'
  | 'success'
  | 'gameOver';

export class RepeatTheBeat extends LitElement {
 static styles = css`
/* ==========================================================
   HOST
========================================================== */
  :host {
    display: block;
    font-family: var(--og-font, system-ui, sans-serif);
    background-color: var(--og-surface, #f4f7fb);
    color: var(--og-text, #333333);
    padding: 1rem;
    border-radius: var(--og-radius, 8px);
  }

/* ==========================================================
   LAYOUT
========================================================== */
  .game-container {
    max-width: 520px;
    margin: 0 auto;
    text-align: center;
  }

  h1 {
    margin-bottom: 24px;
    font-size: 2rem;
    font-weight: 700;
  }
  .top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}

/* ==========================================================
   SCORE
========================================================== */
.best-score,
.current-score {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 90px;
}

.best-score span,
.current-score span {
  font-size: 0.9rem;
  color: #777;
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.best-score strong,
.current-score strong {
  font-size: 2rem;
  font-weight: bold;
  color: #222;
}

/* ==========================================================
   GAME BOARD
 ========================================================== */
.game-board {
  width: 420px;
  height: 420px;
  margin: 30px auto;

  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 6px; 

  position: relative;

  border:10px solid #202020;
  border-radius:50%;
  overflow:hidden;

  box-shadow:
  0 12px 30px rgba(0,0,0,.25);
}

/* ==========================================================
   COLOR PADS
========================================================== */
.color-pad {
  border: none;
  cursor: pointer;

  width: 100%;
  height: 100%;

  transition: transform 0.2s ease, filter 0.2s ease;
  will-change: transform, filter;
}

.color-pad.blue{
    background:linear-gradient(
        145deg,
        #4dc7ff,
        #1f8fd2
    );

    border-top-left-radius:100%;
}

.color-pad.green{
    background:linear-gradient(
        145deg,
        #99eb58,
        #6ecb32
    );

    border-top-right-radius:100%;
}

.color-pad.red{
    background:linear-gradient(
        145deg,
        #ff7d79,
        #ff5252
    );

    border-bottom-right-radius:100%;
}

.color-pad.yellow{
    background:linear-gradient(
        145deg,
        #ffe27d,
        #ffbf26
    );

    border-bottom-left-radius:100%;
}

/* ==========================================================
   CENTER DISPLAY
========================================================== */
.center-display{
  position:absolute;
  left:50%;
  top:50%;
  z-index:5;

  width:150px; 
  height:150px;

  display:flex;
  flex-direction:column;
  justify-content:center;
  align-items:center;

  transform:translate(-50%,-50%);

  transition: all 0.2s ease;

  border-radius:50%;

  background:#1d1d1d;
  color:white;

  box-shadow:0 0 15px rgba(0,0,0,.35);
}

.center-display span { 
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 2px;
  text-transform: uppercase;
}

.center-display strong { 
  font-size: 2.5rem;
  font-weight: 700;
  margin-top: 8px;
}

/* ==========================================================
   STATUS
========================================================== */
.status {
  width: 220px;
  margin: 24px auto;

  padding: 12px;

  border-radius: 12px;

  background: #2a2a2a;

  color: white;

  font-size: 1rem;

  font-weight: 600;

  letter-spacing: 1px;

  text-align: center;

  box-shadow: 0 6px 14px rgba(0,0,0,.15);
}

/* ==========================================================
   BUTTONS
========================================================== */

.start-button {

  margin-top: 10px;
  padding: 14px 28px;
  border:none;
  border-radius:12px;

  cursor:pointer;

  background:linear-gradient(
      135deg,
      #35c84a,
      #28a63a
  );

  color:white;
  font-size:1rem;
  font-weight:700;

  transition:all .2s ease;
}

.start-button:hover{

    transform:translateY(-2px);

    box-shadow:
    0 10px 20px rgba(0,0,0,.25);

}

/* ==========================================================
   GAME OVER MODAL
========================================================== */

.game-over-overlay {
  position: fixed;
  inset: 0;

  display: flex;
  justify-content: center;
  align-items: center;

  background: rgba(0, 0, 0, 0.45);

  z-index: 999;
}

.game-over-card {
  width: 320px;

  background: white;

  border-radius: 20px;

  padding: 32px;

  text-align: center;

  box-shadow: 0 20px 50px rgba(0,0,0,.25);

  animation: popup .25s ease;
}

.game-over-card h2 {
  margin: 0 0 24px;

  font-size: 2rem;

  color: #ff5252;
}

.game-over-card p {
  margin: 10px 0 6px;

  color: #666;

  text-transform: uppercase;

  letter-spacing: 1px;

  font-size: .9rem;
}

.game-over-card strong {
  display: block;

  font-size: 2rem;

  margin-bottom: 18px;

  color: #222;
}

.game-over-card .start-button {
  margin-top: 10px;
  width: 100%;
}

/* ==========================================================
   GAME OVER ACTIONS
========================================================== */

.game-over-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.game-over-actions .start-button {
  flex: 1;
  margin-top: 0;
}

.secondary-button {
  flex: 1;

  padding: 14px;

  border: none;

  border-radius: 12px;

  cursor: pointer;

  background: #e5e7eb;

  color: #333;

  font-size: 1rem;

  font-weight: 600;

  transition: all .2s ease;
}

.secondary-button:hover {
  background: #d1d5db;
}

/* ==========================================================
   ANIMATIONS
========================================================== */
@keyframes flash {

  0%{
    transform:scale(1);
    filter:brightness(1);
  }

  50%{

    transform:scale(1.06);

    filter:brightness(1.45);

  }

  100%{

    transform:scale(1);

    filter:brightness(1);

  }
}
  .color-pad.flash{

    animation:flash .45s ease;

}

@keyframes popup {

  from {
    transform: scale(.8);
    opacity: 0;
  }

  to {
    transform: scale(1);
    opacity: 1;
  }

}
`;

// ==========================================================
// Component Properties
// ==========================================================

  @property({ type: String }) mode: 'levels' | 'random' = 'levels';
  @property({ type: Number }) levelCount = 10;
  @property({ type: Object }) gameState: GameState | null = null;
  @property({ type: Boolean }) muted = false;
  @property({ type: Number }) seed?: number;

// ==========================================================
// Component State
// ==========================================================

  @state() private score = 0;
  @state() private bestScore = 0;
  
  @state() private status: GameStatus = 'idle';
  
  @state() private sequence: PadColor[] = [];

  @state() private playerIndex = 0;

  @state() private isPlayerTurn = false;
  @state() private level = 1;

  private readonly flashTimeouts = new Map<HTMLElement, number>();

// ==========================================================
// Game Configuration
// ==========================================================

private readonly FLASH_DURATION = 650;

private readonly FLASH_GAP = 350;

private readonly START_DELAY = 500;

private readonly BEST_SCORE_KEY = 'repeat-the-beat-best-score';

private readonly COLORS: readonly PadColor[] = [
  'blue',
  'green',
  'red',
  'yellow',
];

// ==========================================================
// Lifecycle Methods
// ==========================================================

  connectedCallback() {
    super.connectedCallback();

    if (this.gameState) {
      this.level = this.gameState.currentLevel;
    }

    const savedBestScore = localStorage.getItem(this.BEST_SCORE_KEY);

    if (savedBestScore !== null) {
      this.bestScore = Number(savedBestScore);
    }
    
    // Dispatch ready event
    this.dispatchEvent(
      new CustomEvent('og-ready', {
        bubbles: true,
        composed: true,
        detail: { gameId: 'game-repeat-the-beat' },
      })
    );
  }

// ==========================================================
// Game Logic
// ==========================================================

private resetGame() {

  this.level = 1;

  this.score = 0;

  this.playerIndex = 0;

  this.sequence = [];

  this.isPlayerTurn = false;

  this.status = 'idle';

}

private async startGame() {
  
  this.resetGame();

  this.status = 'watching';

  this.generateSequence(this.getSequenceLength());

  await this.wait(this.START_DELAY);

  await this.showSequence();

}

private generateSequence(length: number) {

  const rand = () => {
    try {
      if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
        const arr = new Uint32Array(1);
        (crypto as any).getRandomValues(arr);
        return arr[0] / 0xffffffff;
      }
    } catch (_) {
        // Fallback to Math.random()
    }
    return Math.random();
  };

  const result: PadColor[] = [];
  const maxConsecutive = 3;

  while (result.length < length) {
    const last = result[result.length - 1] ?? null;
    let lastRun = 0;
    for (let i = result.length - 1; i >= 0; i--) {
      if (result[i] === last) lastRun++; else break;
    }

    const validColors = this.COLORS.filter(
      c => !(c === last && lastRun >= maxConsecutive)
    );
    const chosenColor = validColors[Math.floor(rand() * validColors.length)];

    result.push(chosenColor);
  }

  this.sequence = result;

}

private getSequenceLength(): number {

  return this.level;

}

private flashPad(color: PadColor) {

  const button = this.renderRoot.querySelector<HTMLButtonElement>(
    `.color-pad.${color}`
  );

  if (!button) return;

  const prevTimeout = this.flashTimeouts.get(button);
  if (prevTimeout) {
    window.clearTimeout(prevTimeout);
  }

  button.classList.remove('flash');
  void button.offsetWidth;
  button.classList.add('flash');

  const timeoutId = window.setTimeout(() => {
    button.classList.remove('flash');
    this.flashTimeouts.delete(button);
  }, this.FLASH_DURATION);

  this.flashTimeouts.set(button, timeoutId);

}

private wait(ms: number): Promise<void> {

  return new Promise(resolve => {

    setTimeout(resolve, ms);

  });

}

private getStatusText(): string {

  switch (this.status) {

    case 'idle':
      return 'Press Start';

    case 'watching':
      return 'Watch Carefully';

    case 'playerTurn':
      return 'Your Turn';

    case 'success':
      return 'Well Done!';

    case 'gameOver':
      return 'Game Over';
  }
}

private async showSequence() {

  this.isPlayerTurn = false;

  this.playerIndex = 0;

  this.status = 'watching';

  await this.wait(this.START_DELAY);


  for (const color of this.sequence) {

    this.flashPad(color);

    await this.wait(this.FLASH_DURATION + this.FLASH_GAP);

  }

  this.status = 'playerTurn';
  this.isPlayerTurn = true;
}
  
private async handlePadClick(color: PadColor) {

  if (!this.isPlayerTurn) {
    return;
  }

  this.flashPad(color);

  // Guard: if playerIndex is out of bounds, ignore extra clicks
  if (this.playerIndex >= this.sequence.length) return;

  // Yanlış renk seçildiyse
  if (color !== this.sequence[this.playerIndex]) {

    this.status = 'gameOver';
    this.isPlayerTurn = false;

    return;
  }

  // Doğru renk seçildiyse
  this.playerIndex++;

  // Tüm diziyi doğru tamamladıysa
  if (this.playerIndex === this.sequence.length) {

    this.status = 'success';

    this.score++;

    if (this.score > this.bestScore) {
      this.bestScore = this.score;

      localStorage.setItem(
        this.BEST_SCORE_KEY,
        this.bestScore.toString()
    );

}

    this.isPlayerTurn = false;

    this.level++;

    // Build a fresh sequence for the new level
    this.sequence = [];
    this.generateSequence(this.getSequenceLength());

    await this.wait(this.START_DELAY);

    await this.showSequence();
  }
}

// ==========================================================
// Render
// ==========================================================

  render() {
  return html`
  <div class="game-container">

   <h1>Repeat the Beat</h1>

   <div class="top-bar">

    <div class="best-score">
      <span>Best</span>
      <strong>${this.bestScore}</strong>
    </div>

    <div class="current-score">
      <span>Score</span>
      <strong>${this.score}</strong>
    </div>

  </div>

  <div class="game-board">

    <button
      class="color-pad blue"
      ?disabled=${!this.isPlayerTurn}
      @click=${() => this.handlePadClick('blue')}
></button>
    <button
      class="color-pad green"
      ?disabled=${!this.isPlayerTurn}
      @click=${() => this.handlePadClick('green')}
></button>

    <div class="center-display">

      <span>SCORE</span>
      <strong>${this.score}</strong>

    </div>

    <button
      class="color-pad yellow"
      ?disabled=${!this.isPlayerTurn}
      @click=${() => this.handlePadClick('yellow')}
></button>
    <button
      class="color-pad red"
      ?disabled=${!this.isPlayerTurn}
      @click=${() => this.handlePadClick('red')}
></button>

  </div>

  <div class="status">
  <strong>Status</strong>
  <p>${this.getStatusText()}</p>
</div>

${this.status === 'idle'
  ? html`
      <button
        class="start-button"
        @click=${this.startGame}
      >
        Start Game
      </button>
    `
  : null}

${this.status === 'gameOver'
  ? html`
      <div class="game-over-overlay">

        <div class="game-over-card">

          <h2>Game Over</h2>

          <p>Final Score</p>
          <strong>${this.score}</strong>

          <p>Best Score</p>
          <strong>${this.bestScore}</strong>

          <div class="game-over-actions">

            <button
              class="secondary-button"
              @click=${this.resetGame}
            >
              Back to Start
            </button>

            <button
              class="start-button"
              @click=${this.startGame}
            >
              Play Again
            </button>

          </div>

        </div>

      </div>
    `
  : null}

</div>
  `;
}
}