import { OctanumGame } from './game';

customElements.define('og-octanum', OctanumGame);

declare global {
  interface HTMLElementTagNameMap {
    'og-octanum': OctanumGame;
  }
}
