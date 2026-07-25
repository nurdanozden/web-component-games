import { OctafortGame } from './game';

customElements.define('og-octafort', OctafortGame);

declare global {
  interface HTMLElementTagNameMap {
    'og-octafort': OctafortGame;
  }
}
