import {
  css,
  html,
  nothing,
  type ReactiveController,
  type ReactiveControllerHost,
  type TemplateResult,
} from 'lit';
import { renderLanguagePicker, translate, type Locale } from './i18n';

/**
 * Paylaşılan ayarlar menüsü (üç nokta / kebab).
 *
 * Dil seçimi, tema, mod ve ses düğmeleri eskiden üst barda yan yana dururdu;
 * oyun alanının üstünü kalabalıklaştırıyorlardı. Artık hepsi sağ üst köşedeki
 * tek bir düğmenin altındaki açılır panelde toplanır. Panel her zaman DOM'da
 * durur, kapalıyken `display:none` ile gizlenir — böylece hem sekme sırasından
 * ve erişilebilirlik ağacından düşer hem de açılış/kapanış tek sınıf değişimi
 * olur.
 *
 * Mod/ses gibi host sayfaya ait düğmeler `host-controls` slot'uyla panele
 * girer: oyunlar bu düğmeleri tanımaz, yalnızca yerlerini verir.
 *
 * Kullanım (her oyunda aynı):
 *   private _settings = new SettingsMenuController(this);
 *   static styles = [i18nStyles, settingsMenuStyles, css`…`];
 *   ${renderSettingsMenu({ locale, theme, open, onTrigger, onThemeToggle })}
 */

// ─── Açık/kapalı durumu ─────────────────────────────────────────────────────

/**
 * Menünün açık/kapalı durumunu ve "dışarı tıklayınca kapan" davranışını taşır.
 *
 * Dinleyiciler yalnızca menü açıkken belgeye bağlanır: kapalıyken sayfadaki her
 * tıklamayı dinlemenin anlamı yok. Yakalama (capture) evresinde dinleriz, çünkü
 * oyun tahtaları kendi pointer olaylarını durdurabiliyor — menü yine de kapanır.
 */
export class SettingsMenuController implements ReactiveController {
  open = false;

  constructor(private readonly host: ReactiveControllerHost & HTMLElement) {
    host.addController(this);
  }

  hostDisconnected() {
    this._unbind();
    this.open = false;
  }

  toggle = () => {
    if (this.open) this.close({ restoreFocus: true });
    else this.show();
  };

  show() {
    if (this.open) return;
    this.open = true;
    document.addEventListener('pointerdown', this._onDocumentPointerDown, true);
    document.addEventListener('keydown', this._onDocumentKeyDown, true);
    this.host.requestUpdate();
  }

  close({ restoreFocus = false }: { restoreFocus?: boolean } = {}) {
    if (!this.open) return;
    this.open = false;
    this._unbind();
    this.host.requestUpdate();
    if (restoreFocus) {
      // Klavyeyle kapatan oyuncu odağı kaybetmesin: panel gizlenince odak
      // gövdeye düşerdi, geri üç nokta düğmesine alıyoruz.
      void this.host.updateComplete.then(() => {
        this.host.shadowRoot
          ?.querySelector<HTMLElement>('.settings-trigger')
          ?.focus();
      });
    }
  }

  private _unbind() {
    document.removeEventListener('pointerdown', this._onDocumentPointerDown, true);
    document.removeEventListener('keydown', this._onDocumentKeyDown, true);
  }

  /** Gölge DOM sınırını aşan yol üzerinden "menünün içine mi tıklandı" sorusu. */
  private _onDocumentPointerDown = (e: Event) => {
    const menu = this.host.shadowRoot?.querySelector('.settings');
    if (menu && e.composedPath().includes(menu)) return;
    this.close();
  };

  private _onDocumentKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.stopPropagation(); // Esc önce menüyü kapatsın, oyuna ulaşmasın.
    this.close({ restoreFocus: true });
  };
}

// ─── Stiller ────────────────────────────────────────────────────────────────

/**
 * Oyunlar bunu i18n stillerinden sonra dizer:
 *   static styles = [i18nStyles, settingsMenuStyles, css`…`]
 *
 * Renkler oyunların kendi tema değişkenlerinden okunur (`--_fill`, `--_line`,
 * `--_shadow` …). Tanımlamayan oyunda `color-mix(currentColor)` yedeği devreye
 * girer, yani panel her oyunda ve her iki temada da uyumlu durur.
 */
export const settingsMenuStyles = css`
  .settings {
    position: relative;
    flex: none;
    display: inline-flex;
  }

  .settings-trigger {
    cursor: pointer;
    border: none;
    border-radius: 999px;
    width: 30px;
    height: 30px;
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    color: inherit;
    background: var(--_fill, color-mix(in srgb, currentColor 10%, transparent));
    transition: background .15s, transform .15s;
  }
  .settings-trigger:hover {
    background: var(--_fill-strong, color-mix(in srgb, currentColor 18%, transparent));
  }
  .settings-trigger:active { transform: scale(.92); }
  .settings-trigger:focus-visible {
    outline: 3px solid var(--og-accent, var(--_accent, #ff5f00));
    outline-offset: 2px;
  }
  .settings.is-open .settings-trigger {
    background: var(--_fill-strong, color-mix(in srgb, currentColor 18%, transparent));
  }
  /* Üç nokta emoji değil kendi SVG'miz: her platformda aynı hizada ve aynı
     büyüklükte çizilir, metin rengini de doğrudan alır. */
  .settings-trigger svg {
    width: 16px;
    height: 16px;
    fill: currentColor;
    pointer-events: none;
  }

  .settings-panel {
    display: none;
    position: absolute;
    top: calc(100% + .4rem);
    /* Mantıksal özellik: RTL'de menü kendiliğinden diğer kenara yaslanır. */
    inset-inline-end: 0;
    z-index: 60;
    min-width: 208px;
    max-width: min(260px, calc(100vw - 2rem));
    flex-direction: column;
    gap: .5rem;
    padding: .6rem;
    text-align: start;
    border-radius: 12px;
    background: var(--og-surface, var(--_surface, var(--og-bg, #111d2f)));
    border: 1px solid var(--_line, color-mix(in srgb, currentColor 14%, transparent));
    box-shadow: var(--_shadow, 0 18px 40px rgba(0, 0, 0, .35));
    animation: settings-pop .16s ease both;
  }
  .settings.is-open .settings-panel { display: flex; }

  @keyframes settings-pop {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .settings-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: .6rem;
  }
  .settings-label {
    font-size: .75rem;
    font-weight: 600;
    letter-spacing: .01em;
    opacity: .7;
    white-space: nowrap;
  }

  .settings-sep {
    height: 1px;
    background: var(--_line, color-mix(in srgb, currentColor 14%, transparent));
  }

  /* Host sayfanın düğmeleri (mod, ses …) panelde alt alta, tam genişlikte
     dizilir — üst barda yan yana dururken kullandıkları satır düzeni burada
     taşardı. */
  .settings-slot {
    display: flex;
    flex-direction: column;
    gap: .35rem;
  }
  .settings-slot ::slotted(*) {
    flex: 1 1 auto;
    width: 100%;
  }

  @media (prefers-reduced-motion: reduce) {
    .settings-panel { animation: none; }
    .settings-trigger { transition: none; }
  }
`;

// ─── Görünüm ────────────────────────────────────────────────────────────────

export interface SettingsMenuOptions {
  /** Geçerli dil — etiketler ve dil seçicisi bundan beslenir. */
  locale: Locale;
  /** Panel açık mı (bkz. `SettingsMenuController.open`). */
  open: boolean;
  /** Üç nokta düğmesine tıklandığında — genelde `controller.toggle`. */
  onTrigger: () => void;
  /** Tema satırı yalnızca bu geri çağırma verilirse çizilir. */
  theme?: 'dark' | 'light';
  onThemeToggle?: () => void;
}

/**
 * Üç nokta düğmesi + açılır ayar paneli.
 *
 * Panel kapalıyken de çizilir (CSS ile gizlenir): açılışta yeniden kurulan bir
 * ağaç olmadığı için `<select>` gibi yerli denetimler durumlarını korur.
 */
export function renderSettingsMenu(opts: SettingsMenuOptions): TemplateResult {
  const { locale, open, onTrigger, theme = 'dark', onThemeToggle } = opts;
  const triggerLabel = translate(locale, open ? 'common.settingsClose' : 'common.settingsOpen');
  const isLight = theme === 'light';

  return html`
    <div class="settings ${open ? 'is-open' : ''}" part="settings">
      <button
        class="settings-trigger"
        part="settings-trigger"
        type="button"
        aria-haspopup="true"
        aria-expanded=${open ? 'true' : 'false'}
        aria-label=${triggerLabel}
        title=${triggerLabel}
        @click=${onTrigger}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <circle cx="8" cy="3" r="1.5"></circle>
          <circle cx="8" cy="8" r="1.5"></circle>
          <circle cx="8" cy="13" r="1.5"></circle>
        </svg>
      </button>

      <div
        class="settings-panel"
        part="settings-panel"
        role="group"
        aria-label=${translate(locale, 'common.settings')}
      >
        <div class="settings-row">
          <span class="settings-label">${translate(locale, 'common.language')}</span>
          ${renderLanguagePicker(locale)}
        </div>

        ${onThemeToggle
          ? html`
              <div class="settings-row">
                <span class="settings-label">${translate(locale, 'common.theme')}</span>
                <button
                  class="theme-toggle"
                  part="theme-toggle"
                  type="button"
                  @click=${onThemeToggle}
                  aria-pressed=${isLight.toString()}
                  aria-label=${translate(locale, isLight ? 'common.switchToDark' : 'common.switchToLight')}
                  title=${translate(locale, isLight ? 'common.themeDarkTitle' : 'common.themeLightTitle')}
                >
                  ${isLight ? '☀️' : '🌙'}
                  ${translate(locale, isLight ? 'common.themeLightShort' : 'common.themeDarkShort')}
                </button>
              </div>
            `
          : nothing}

        <div class="settings-sep"></div>
        <div class="settings-slot">
          <slot name="host-controls"></slot>
        </div>
      </div>
    </div>
  `;
}
