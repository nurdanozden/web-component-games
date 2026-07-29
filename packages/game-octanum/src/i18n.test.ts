import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import './index';
import type { OctanumGame } from './game';
import {
  LOCALES,
  changeLanguage,
  translations,
  type Locale,
  type MessageKey,
} from '@octapull-games/core';

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
  localStorage.clear();
  changeLanguage('tr');
});

function createGame(): OctanumGame {
  return document.createElement('og-octanum') as OctanumGame;
}

function start(el: OctanumGame) {
  (el.shadowRoot!.querySelector('button.btn-primary') as HTMLButtonElement).click();
}

// ─── Sözlük ─────────────────────────────────────────────────────────────────

describe('octanum çevirileri', () => {
  const keys = (Object.keys(translations.tr) as MessageKey[]).filter((k) => k.startsWith('octanum.'));

  it('oyunun kullandığı bütün anahtarları tanımlar', () => {
    // Sözlük TS arayüzüyle zorunlu kılınır; buradaki sayı, anahtarların
    // yanlışlıkla silinmediğini kaba bir eşikle de olsa doğrular.
    expect(keys.length).toBeGreaterThanOrEqual(45);
  });

  it('beş dilde de boş bırakılmamıştır', () => {
    for (const { code } of LOCALES) {
      for (const key of keys) {
        expect(translations[code as Locale][key], `${code}.${key}`).toBeTruthy();
      }
    }
  });

  it('yer tutucuları her dilde Türkçe kaynakla birebir aynıdır', () => {
    const placeholders = (s: string) => (s.match(/\{(\w+)\}/g) ?? []).sort();
    for (const { code } of LOCALES) {
      for (const key of keys) {
        expect(placeholders(translations[code as Locale][key]), `${code}.${key}`)
          .toEqual(placeholders(translations.tr[key]));
      }
    }
  });
});

// ─── Dil değişimi ───────────────────────────────────────────────────────────

describe('og-octanum dil desteği', () => {
  let el: OctanumGame;
  afterEach(() => el?.remove());

  it('sayfadaki dil seçimini tek çağrıyla uygular', async () => {
    el = createGame();
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('h2')!.textContent).toBe(translations.tr['octanum.title']);

    changeLanguage('es');
    await el.updateComplete;
    expect(el.locale).toBe('es');
    expect(el.shadowRoot!.querySelector('.overlay p')!.textContent).toBe(
      translations.es['octanum.tagline'],
    );
  });

  it('tur ortasında dil değişse de formül bozulmaz', async () => {
    el = createGame();
    el.seed = 4;
    document.body.appendChild(el);
    await el.updateComplete;
    start(el);
    await el.updateComplete;

    const target = el.shadowRoot!.querySelector('.target-value')!.textContent;
    const cards = [...el.shadowRoot!.querySelectorAll('.vial .value')].map((n) => n.textContent);

    changeLanguage('it');
    await el.updateComplete;

    // Sayılar dilden bağımsızdır: kelime oyunlarının aksine tur baştan
    // başlatılmaz, yalnızca metinler çevrilir.
    expect(el.shadowRoot!.querySelector('.target-value')!.textContent).toBe(target);
    expect([...el.shadowRoot!.querySelectorAll('.vial .value')].map((n) => n.textContent)).toEqual(cards);
    expect(el.shadowRoot!.querySelector('.log h3')!.textContent).toBe(
      translations.it['octanum.stepsTitle'],
    );
  });

  it('Arapçada host elemana dir="rtl" yansıtır, diğerlerinde ltr', async () => {
    el = createGame();
    document.body.appendChild(el);
    await el.updateComplete;

    changeLanguage('ar');
    await el.updateComplete;
    expect(el.getAttribute('dir')).toBe('rtl');
    expect(el.getAttribute('lang')).toBe('ar');

    changeLanguage('en');
    await el.updateComplete;
    expect(el.getAttribute('dir')).toBe('ltr');
  });

  it('bileşen tahtasını ve defteri RTL\'de bile soldan sağa sabitler', async () => {
    el = createGame();
    document.body.appendChild(el);
    await el.updateComplete;
    changeLanguage('ar');
    await el.updateComplete;
    start(el);
    await el.updateComplete;

    // .ltr-lock, i18nStyles içinde direction:ltr uygular: "50 × 7 = 350" gibi
    // formüller aynalandığında okunamaz hâle gelirdi.
    expect(el.shadowRoot!.querySelector('.board')!.classList.contains('ltr-lock')).toBe(true);
    expect(el.shadowRoot!.querySelector('.log ol, .log .empty')).not.toBeNull();
  });

  it('"ileri" okunu RTL\'de sola çevirir', () => {
    el = createGame();
    document.body.appendChild(el);
    changeLanguage('ar');
    expect(el.arrow).toBe('←');
    changeLanguage('tr');
    expect(el.arrow).toBe('→');
  });
});
