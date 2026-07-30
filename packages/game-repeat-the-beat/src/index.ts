import { RepeatTheBeat } from './game';

customElements.define('og-repeat-the-beat', RepeatTheBeat);

declare global {
  interface HTMLElementTagNameMap {
    'og-repeat-the-beat': RepeatTheBeat;
  }
}
