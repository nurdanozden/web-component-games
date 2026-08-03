import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import './index';
import type { OctahangGame } from './game';
import {
  LOCALES,
  LOCALE_STORAGE_KEY,
  changeLanguage,
  translate,
  translations,
  type Locale,
  type MessageKey,
} from '@octapull-games/core';
import { WORD_POOLS, getWordPool } from './words';

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
  localStorage.clear();
  changeLanguage('tr');
});

function createGame(): OctahangGame {
  return document.createElement('og-octahang') as OctahangGame;
}

function start(el: OctahangGame) {
  (el.shadowRoot!.querySelector('button.btn-primary') as HTMLButtonElement).click();
}

// ─── Sözlük bütünlüğü ───────────────────────────────────────────────────────

describe('çeviri sözlüğü', () => {
  const keys = Object.keys(translations.tr) as MessageKey[];

  it('beş dili de kapsar', () => {
    expect(Object.keys(translations).sort()).toEqual(['ar', 'en', 'es', 'it', 'tr']);
    expect(LOCALES.map((l) => l.code).sort()).toEqual(['ar', 'en', 'es', 'it', 'tr']);
  });

  it('her dilde aynı anahtar kümesini, boşluk bırakmadan taşır', () => {
    for (const locale of Object.keys(translations) as Locale[]) {
      const localeKeys = Object.keys(translations[locale]).sort();
      expect(localeKeys, `${locale} anahtarları`).toEqual([...keys].sort());
      for (const key of keys) {
        expect(translations[locale][key], `${locale}.${key}`).toBeTruthy();
      }
    }
  });

  it('bir dilde çevrilmemiş anahtarı Türkçeye düşürür', () => {
    // Sözlükten eksik bir anahtarı taklit et: kayıtlı olmayan bir dil kodu.
    expect(translate('xx' as Locale, 'common.start')).toBe(translations.tr['common.start']);
  });

  it('{yer tutucu} değerlerini doldurur, bilinmeyeni olduğu gibi bırakır', () => {
    expect(translate('en', 'common.level', { level: 3, total: 8 })).toBe('Level 3/8');
    expect(translate('en', 'common.level', { level: 3 })).toBe('Level 3/{total}');
  });

  it('her dilin yer tutucuları Türkçe kaynakla birebir aynıdır', () => {
    const placeholders = (s: string) => (s.match(/\{(\w+)\}/g) ?? []).sort();
    for (const locale of Object.keys(translations) as Locale[]) {
      for (const key of keys) {
        expect(placeholders(translations[locale][key]), `${locale}.${key}`)
          .toEqual(placeholders(translations.tr[key]));
      }
    }
  });
});

// ─── changeLanguage + kalıcılık ─────────────────────────────────────────────

describe('changeLanguage', () => {
  it('seçimi localStorage\'a yazar', () => {
    changeLanguage('es');
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('es');
  });

  it('belge kökündeki lang ve dir niteliklerini günceller', () => {
    changeLanguage('ar');
    expect(document.documentElement.getAttribute('lang')).toBe('ar');
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');

    changeLanguage('it');
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
  });

  it('tanınmayan bir kodda mevcut dili korur', () => {
    changeLanguage('en');
    changeLanguage('klingon');
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en');
  });

  it('sayfadaki bileşenleri tek çağrıyla çevirir', async () => {
    const el = createGame();
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('h2')!.textContent).toBe('Octahang');

    changeLanguage('ar');
    await el.updateComplete;
    expect(el.locale).toBe('ar');
    expect(el.shadowRoot!.querySelector('h2')!.textContent).toBe(translations.ar['octahang.title']);
    el.remove();
  });
});

// ─── RTL ────────────────────────────────────────────────────────────────────

describe('sağdan sola (RTL) düzen', () => {
  let el: OctahangGame;
  afterEach(() => el?.remove());

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

  it('darağacı çizimini RTL\'de bile soldan sağa sabitler', async () => {
    el = createGame();
    document.body.appendChild(el);
    await el.updateComplete;
    changeLanguage('ar');
    await el.updateComplete;
    start(el);
    await el.updateComplete;
    // .ltr-lock, i18nStyles içinde direction:ltr uygular — SVG ve ızgara
    // geometrisi aynalanmamalı.
    expect(el.shadowRoot!.querySelector('.stage')!.classList.contains('ltr-lock')).toBe(true);
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

// ─── Dile göre kelime havuzları ─────────────────────────────────────────────

describe('kelime havuzları', () => {
  it('her dil için havuz tanımlar', () => {
    for (const { code } of LOCALES) {
      expect(WORD_POOLS[code], `${code} havuzu`).toBeDefined();
      expect(WORD_POOLS[code].words.length, `${code} kelime sayısı`).toBeGreaterThan(0);
    }
  });

  it('her kelime yalnızca kendi dilinin alfabesindeki harflerden oluşur', () => {
    // Havuzda alfabede olmayan bir harf varsa o kelime hiçbir zaman
    // tamamlanamaz: klavyede o tuş yoktur.
    for (const { code } of LOCALES) {
      const { alphabet, words } = WORD_POOLS[code];
      const letters = new Set([...alphabet]);
      for (const { word } of words) {
        const stray = [...word].filter((ch) => !letters.has(ch));
        expect(stray, `${code} · ${word} → alfabe dışı harf`).toEqual([]);
      }
    }
  });

  it('her havuzda dört zorluk katmanı da doludur', () => {
    for (const { code } of LOCALES) {
      for (const tier of [1, 2, 3, 4]) {
        expect(
          WORD_POOLS[code].words.filter((e) => e.tier === tier).length,
          `${code} · katman ${tier}`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('her kelimenin ipucu vardır ve ipucu kelimenin kendisini içermez', () => {
    for (const { code } of LOCALES) {
      const { normalize, words } = WORD_POOLS[code];
      for (const { word, hint } of words) {
        expect(hint.length, `${code} · ${word}`).toBeGreaterThan(0);
        expect(normalize(hint).includes(word), `${code} · ${word} ipucunda geçiyor`).toBe(false);
      }
    }
  });

  it('bilinmeyen dilde Türkçe havuza düşer', () => {
    expect(getWordPool('klingon')).toBe(WORD_POOLS.tr);
  });

  it('Arapça havuzu hemze/tâ-marbûta biçimlerine indirger', () => {
    const { words } = WORD_POOLS.ar;
    const joined = words.map((e) => e.word).join('');
    for (const ch of ['أ', 'إ', 'آ', 'ة', 'ى']) {
      expect(joined.includes(ch), `normalleştirilmemiş ${ch}`).toBe(false);
    }
  });

  it('Arapça girdi normalizasyonu harf biçimlerini eşleştirir', () => {
    const { normalize } = WORD_POOLS.ar;
    expect(normalize('أ')).toBe('ا');
    expect(normalize('ة')).toBe('ه');
    expect(normalize('ى')).toBe('ي');
  });

  it('İspanyolcada Ñ korunur, kalan aksanlar düşer', () => {
    const { normalize } = WORD_POOLS.es;
    expect(normalize('ñ')).toBe('Ñ');
    expect(normalize('montaña')).toBe('MONTAÑA');
    expect(normalize('jardín')).toBe('JARDIN');
  });
});

// ─── Dilin oyuna yansıması ──────────────────────────────────────────────────

describe('oyun içi dil davranışı', () => {
  let el: OctahangGame;
  afterEach(() => el?.remove());

  it('klavyeyi seçili dilin alfabesinden kurar', async () => {
    el = createGame();
    document.body.appendChild(el);
    await el.updateComplete;
    start(el); // tek sefer: sonraki dillerde oyun zaten 'playing' fazında kalır
    await el.updateComplete;

    for (const code of ['tr', 'en', 'it', 'es', 'ar'] as Locale[]) {
      changeLanguage(code);
      await el.updateComplete;

      const keys = [...el.shadowRoot!.querySelectorAll('button.key')]
        .map((b) => b.textContent!.trim())
        .join('');
      expect(keys, `${code} klavyesi`).toBe(WORD_POOLS[code].alphabet);
    }
  });

  it('tur ortasında dil değişirse kelimeyi yeni havuzdan yeniler', async () => {
    el = createGame();
    document.body.appendChild(el);
    await el.updateComplete;
    start(el);
    await el.updateComplete;

    const trWord = (el as unknown as { _entry: { word: string } })._entry.word;
    expect(WORD_POOLS.tr.words.some((e) => e.word === trWord)).toBe(true);

    changeLanguage('ar');
    await el.updateComplete;

    const arWord = (el as unknown as { _entry: { word: string } })._entry.word;
    // Aksi hâlde Türkçe kelime Arapça klavyeyle bulunmaya çalışılırdı.
    expect(WORD_POOLS.ar.words.some((e) => e.word === arWord)).toBe(true);
  });

  it('dil seçici beş seçeneği sunar ve seçim dili değiştirir', async () => {
    el = createGame();
    document.body.appendChild(el);
    await el.updateComplete;

    const select = el.shadowRoot!.querySelector<HTMLSelectElement>('.lang-picker select')!;
    expect(select).toBeTruthy();
    expect([...select.options].map((o) => o.value)).toEqual(['tr', 'en', 'it', 'es', 'ar']);

    // Her seçenek yalnızca dilin kendi adını taşır. Bayrak emojisi eklenirse
    // Windows onu bayrağa çeviremez, kutulu harfler olarak çizer ve kısa kodla
    // birlikte "TR TR" gibi çift görünür — bu yüzden metin tek parça olmalı.
    expect([...select.options].map((o) => o.textContent!.trim()))
      .toEqual(['Türkçe', 'English', 'Italiano', 'Español', 'العربية']);

    select.value = 'es';
    select.dispatchEvent(new Event('change'));
    await el.updateComplete;

    expect(el.locale).toBe('es');
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('es');
  });
});
