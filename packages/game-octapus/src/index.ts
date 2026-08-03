import { OctapusGame } from './game';

customElements.define('og-octapus', OctapusGame);

declare global {
  interface HTMLElementTagNameMap {
    'og-octapus': OctapusGame;
  }
}
