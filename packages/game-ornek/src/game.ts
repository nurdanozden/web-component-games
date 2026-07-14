import { LitElement, html, css } from 'lit';
import { property, state } from 'lit/decorators.js';
import { GameState } from '@octapull-games/core';

export class GameOrnek extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: var(--og-font, system-ui, sans-serif);
      background-color: var(--og-surface, #f4f7fb);
      color: var(--og-text, #333333);
      padding: 1rem;
      border-radius: var(--og-radius, 8px);
    }
    .board {
      padding: 1rem;
      background: var(--og-bg, #ffffff);
      border-radius: inherit;
      border: 1px solid #ddd;
    }
    button {
      cursor: pointer;
      background-color: var(--og-primary, #0066cc);
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      margin-top: 1rem;
    }
  `;

  @property({ type: String }) mode: 'levels' | 'random' = 'levels';
  @property({ type: Number }) levelCount = 10;
  @property({ type: Object }) gameState: GameState | null = null;
  @property({ type: Boolean }) muted = false;
  @property({ type: Number }) seed?: number;

  @state() private currentLevel = 1;

  connectedCallback() {
    super.connectedCallback();
    if (this.gameState) {
      this.currentLevel = this.gameState.currentLevel;
    }
    
    // Dispatch ready event
    this.dispatchEvent(
      new CustomEvent('og-ready', {
        bubbles: true,
        composed: true,
        detail: { gameId: 'game-ornek' },
      })
    );
  }

  private handleStart() {
    this.dispatchEvent(
      new CustomEvent('og-level-start', {
        bubbles: true,
        composed: true,
        detail: {
          gameId: 'game-ornek',
          level: this.currentLevel,
          startedAt: performance.now(),
        },
      })
    );
  }

  private handleComplete() {
    const durationMs = 5000; // Example duration
    this.dispatchEvent(
      new CustomEvent('og-level-complete', {
        bubbles: true,
        composed: true,
        detail: {
          gameId: 'game-ornek',
          level: this.currentLevel,
          durationMs,
          isBest: false,
        },
      })
    );

    // Update state example
    const newState: GameState = {
      version: 1,
      gameId: 'game-ornek',
      currentLevel: this.currentLevel + 1,
      completedLevels: this.gameState?.completedLevels || [],
      bestTimes: this.gameState?.bestTimes || {},
      totalPlayMs: (this.gameState?.totalPlayMs || 0) + durationMs,
    };

    newState.completedLevels.push({
      level: this.currentLevel,
      durationMs,
      completedAt: new Date().toISOString(),
    });

    this.dispatchEvent(
      new CustomEvent('og-state-change', {
        bubbles: true,
        composed: true,
        detail: {
          gameId: 'game-ornek',
          state: newState,
        },
      })
    );

    this.currentLevel++;
  }

  render() {
    return html`
      <div class="board" part="board">
        <h2>Örnek Oyun</h2>
        <p>Mod: ${this.mode}</p>
        <p>Seviye: ${this.currentLevel} / ${this.mode === 'levels' ? this.levelCount : '∞'}</p>
        <button @click=${this.handleStart}>Başla</button>
        <button @click=${this.handleComplete}>Seviyeyi Tamamla</button>
      </div>
    `;
  }
}
