import { OctahangGame } from './game';

customElements.define('og-octahang', OctahangGame);

declare global {
  interface HTMLElementTagNameMap {
    'og-octahang': OctahangGame;
  }
}
