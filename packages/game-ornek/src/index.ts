import { GameOrnek } from './game';

customElements.define('og-ornek', GameOrnek);

declare global {
  interface HTMLElementTagNameMap {
    'og-ornek': GameOrnek;
  }
}
