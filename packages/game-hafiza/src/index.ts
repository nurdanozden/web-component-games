import { HafizaGame } from './game';

customElements.define('og-hafiza', HafizaGame);

declare global {
  interface HTMLElementTagNameMap {
    'og-hafiza': HafizaGame;
  }
}
