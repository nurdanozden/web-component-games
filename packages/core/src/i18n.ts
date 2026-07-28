import { LitElement, css, html, type TemplateResult } from 'lit';

/**
 * Paylaşılan i18n katmanı.
 *
 * Üç oyun da (octapus, octafort, octahang) aynı sözlüğü ve aynı `Localized`
 * karışımını (mixin) kullanır; böylece dil seçimi tek yerden yönetilir ve
 * sayfadaki bütün bileşenler aynı anda çevrilir.
 *
 * Akış:
 *   changeLanguage('ar')
 *     → localStorage'a yazılır (sayfa yenilenince korunur)
 *     → <html lang/dir> güncellenir
 *     → window üzerinde 'og-language-change' yayınlanır
 *     → Localized karışımını kullanan her bileşen kendini yeniden çizer
 */

// ─── Diller ─────────────────────────────────────────────────────────────────

export type Locale = 'tr' | 'en' | 'it' | 'es' | 'ar';
export type Direction = 'ltr' | 'rtl';

export const DEFAULT_LOCALE: Locale = 'tr';

/** localStorage anahtarı — üç oyun da aynısını paylaşır. */
export const LOCALE_STORAGE_KEY = 'og-lang';

/** Dil değişince window üzerinde yayınlanan olayın adı. */
export const LANGUAGE_CHANGE_EVENT = 'og-language-change';

export interface LocaleMeta {
  code: Locale;
  /** Dilin kendi dilindeki adı (endonym) — seçicide tam ad olarak gösterilir. */
  label: string;
  /** Kısa kod rozeti (dar alanlarda). */
  short: string;
  dir: Direction;
}

/**
 * Dil seçicide bu sırayla listelenir.
 *
 * Bayrak emojisi bilerek yok: 🇹🇷 tek bir karakter değil, iki "bölgesel
 * gösterge" harfinin (🇹 + 🇷) çiftidir ve Windows bunları bayrağa
 * dönüştürmez — kutulu "TR" harfleri olarak çizer. Yanına kısa kodu da
 * koyunca ekranda "TR TR" görünüyordu. Bayrak yerine dilin kendi adı
 * kullanılır: her platformda aynı görünür ve okunması da daha kolaydır.
 */
export const LOCALES: readonly LocaleMeta[] = [
  { code: 'tr', label: 'Türkçe', short: 'TR', dir: 'ltr' },
  { code: 'en', label: 'English', short: 'EN', dir: 'ltr' },
  { code: 'it', label: 'Italiano', short: 'IT', dir: 'ltr' },
  { code: 'es', label: 'Español', short: 'ES', dir: 'ltr' },
  { code: 'ar', label: 'العربية', short: 'AR', dir: 'rtl' },
];

const LOCALE_CODES = LOCALES.map((l) => l.code);

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALE_CODES as string[]).includes(value);
}

export function directionOf(locale: Locale): Direction {
  return LOCALES.find((l) => l.code === locale)?.dir ?? 'ltr';
}

/** RTL'de yönü ters çevrilmesi gereken "ileri" oku. */
export function forwardArrow(locale: Locale): string {
  return directionOf(locale) === 'rtl' ? '←' : '→';
}

// ─── Sözlük ─────────────────────────────────────────────────────────────────

/**
 * `{isim}` yer tutucuları çalışma anında doldurulur (bkz. `translate`).
 * Yapı düz bir "namespace.key" haritasıdır: aramayı ucuzlatır ve eksik
 * anahtarları gözle taramayı kolaylaştırır.
 */
export interface Messages {
  // ── Ortak ────────────────────────────────────────────────────────────────
  'common.language': string;
  'common.languageAria': string;
  'common.themeLight': string;
  'common.themeDark': string;
  'common.switchToDark': string;
  'common.switchToLight': string;
  'common.themeDarkTitle': string;
  'common.themeLightTitle': string;
  'common.start': string;
  'common.startAria': string;
  'common.level': string;
  'common.freeMode': string;
  'common.time': string;
  'common.moves': string;
  'common.newRecord': string;
  'common.congrats': string;
  'common.playAgain': string;
  'common.continue': string;
  'common.newBoard': string;
  'common.levelDone': string;
  'common.announceLevelDone': string;
  'common.announceAllDone': string;

  // ── Octapus ──────────────────────────────────────────────────────────────
  'octapus.title': string;
  'octapus.tagline': string;
  'octapus.progress': string;
  'octapus.boardAria': string;

  // ── Octafort ─────────────────────────────────────────────────────────────
  'octafort.title': string;
  'octafort.tagline': string;
  'octafort.legendTower': string;
  'octafort.legendWall': string;
  'octafort.tapCycle': string;
  'octafort.reset': string;
  'octafort.resetAria': string;
  'octafort.progress': string;
  'octafort.boardAria': string;
  'octafort.cellPos': string;
  'octafort.cellTower': string;
  'octafort.cellTowerConflict': string;
  'octafort.cellMark': string;
  'octafort.cellEmpty': string;
  'octafort.safe': string;
  'octafort.announceWin': string;

  // ── Octahang ─────────────────────────────────────────────────────────────
  'octahang.title': string;
  'octahang.tagline': string;
  'octahang.taglineSub': string;
  'octahang.idleFigureAria': string;
  'octahang.hintLabel': string;
  'octahang.tier1': string;
  'octahang.tier2': string;
  'octahang.tier3': string;
  'octahang.tier4': string;
  'octahang.difficultyAria': string;
  'octahang.livesAria': string;
  'octahang.progress': string;
  'octahang.stageEmpty': string;
  'octahang.stageDrawn': string;
  'octahang.wordAria': string;
  'octahang.blank': string;
  'octahang.keyboardAria': string;
  'octahang.keyAria': string;
  'octahang.keyAriaCorrect': string;
  'octahang.keyAriaWrong': string;
  'octahang.resultAria': string;
  'octahang.won': string;
  'octahang.lost': string;
  'octahang.allDone': string;
  'octahang.answer': string;
  'octahang.score': string;
  'octahang.livesLeft': string;
  'octahang.restart': string;
  'octahang.nextWord': string;
  'octahang.nextLevel': string;
  'octahang.announceNewWord': string;
  'octahang.announceCorrect': string;
  'octahang.announceWrong': string;
  'octahang.announceFound': string;
  'octahang.announceOutOfLives': string;
}

export type MessageKey = keyof Messages;

export const translations: Record<Locale, Messages> = {
  // ── Türkçe ───────────────────────────────────────────────────────────────
  tr: {
    'common.language': 'Dil',
    'common.languageAria': 'Oyun dilini seç',
    'common.themeLight': 'Tema: Açık',
    'common.themeDark': 'Tema: Koyu',
    'common.switchToDark': 'Koyu temaya geç',
    'common.switchToLight': 'Açık temaya geç',
    'common.themeDarkTitle': 'Koyu tema',
    'common.themeLightTitle': 'Açık tema',
    'common.start': 'Başla',
    'common.startAria': 'Oyunu başlat',
    'common.level': 'Seviye {level}/{total}',
    'common.freeMode': 'Serbest Mod',
    'common.time': 'Süre',
    'common.moves': 'Hamle',
    'common.newRecord': 'Yeni Rekor!',
    'common.congrats': 'Tebrikler!',
    'common.playAgain': 'Tekrar Oyna',
    'common.continue': 'Devam',
    'common.newBoard': 'Yeni Bölüm',
    'common.levelDone': 'Seviye Tamam!',
    'common.announceLevelDone': 'Seviye tamamlandı!',
    'common.announceAllDone': 'Tüm seviyeler tamamlandı!',

    'octapus.title': 'Octapus',
    'octapus.tagline': 'Ahtapotu kaçış giderine ulaştır. Bir yola tıkla, ahtapot süzülsün.',
    'octapus.progress': 'Kapıya ilerleme',
    'octapus.boardAria':
      'Octapus tahtası. Kapıya ilerleme yüzde {pct}. Bir hücreye tıklayarak ya da ok tuşları/WASD ile hareket et.',

    'octafort.title': 'Octafort',
    'octafort.tagline':
      'Her satıra, sütuna ve renkli güvenlik bölgelerine tam olarak bir Kale yerleştir. Kaleler sınır komşusu olamaz (çapraz bile!).',
    'octafort.legendTower': 'Kule',
    'octafort.legendWall': 'Sur (eleme)',
    'octafort.tapCycle': 'Dokun: Sur → Kule → Boş',
    'octafort.reset': 'Sıfırla',
    'octafort.resetAria': 'Tahtayı temizle',
    'octafort.progress': 'Yerleştirilen kuleler',
    'octafort.boardAria':
      'Octafort tahtası, {n} çarpı {n}. Bir hücreye dokunmak sırayla sur, kule ve boş durumları arasında geçiş yaptırır. Ok tuşlarıyla gezinip Boşluk ile değiştir.',
    'octafort.cellPos': 'Satır {row}, sütun {col}, sektör {region}.',
    'octafort.cellTower': 'Kule.',
    'octafort.cellTowerConflict': 'Kule — kural ihlali.',
    'octafort.cellMark': 'Sur işareti.',
    'octafort.cellEmpty': 'Boş.',
    'octafort.safe': 'Güvende!',
    'octafort.announceWin': 'Tüm kuleler yerleştirildi, güvende!',

    'octahang.title': 'Octahang',
    'octahang.tagline':
      'İpucundan yola çıkıp gizli kelimeyi harf harf bul. Her yanlış harf adamın bir parçasını çizer; altı hatada tur biter.',
    'octahang.taglineSub': 'Seviyeler modunda kolaydan zora doğru alıştırma yapabilirsiniz.',
    'octahang.idleFigureAria': 'Darağacında asılı çöp adam figürü',
    'octahang.hintLabel': 'İpucu:',
    'octahang.tier1': 'Kolay',
    'octahang.tier2': 'Orta',
    'octahang.tier3': 'Zor',
    'octahang.tier4': 'Çok Zor',
    'octahang.difficultyAria': 'Zorluk: {tier}',
    'octahang.livesAria': 'Kalan hak {n}',
    'octahang.progress': 'Bulunan harfler',
    'octahang.stageEmpty': 'Darağacı boş, henüz hata yok.',
    'octahang.stageDrawn': '{wrong} hata: adamın {wrong} parçası çizildi. Kalan hak {lives}.',
    'octahang.wordAria': '{n} harfli kelime: {spoken}',
    'octahang.blank': 'boş',
    'octahang.keyboardAria': 'Harf klavyesi',
    'octahang.keyAria': '{letter} harfini tahmin et',
    'octahang.keyAriaCorrect': ', doğru',
    'octahang.keyAriaWrong': ', yanlış',
    'octahang.resultAria': 'Tur sonucu',
    'octahang.won': 'Tebrikler!',
    'octahang.lost': 'Kaybettin!',
    'octahang.allDone': 'Tüm seviyeler bitti!',
    'octahang.answer': 'Kelime:',
    'octahang.score': 'Puan',
    'octahang.livesLeft': 'Kalan Hak',
    'octahang.restart': 'Yeniden Başla',
    'octahang.nextWord': 'Yeni Kelime',
    'octahang.nextLevel': 'Sonraki Seviye',
    'octahang.announceNewWord': 'Yeni kelime: {len} harf. İpucu: {hint}',
    'octahang.announceCorrect': '{letter} doğru. Kalan harf: {n}.',
    'octahang.announceWrong': '{letter} yanlış. Kalan hak: {n}.',
    'octahang.announceFound': 'Kelime bulundu!',
    'octahang.announceOutOfLives': 'Haklar bitti. Doğru kelime: {word}.',
  },

  // ── English ──────────────────────────────────────────────────────────────
  en: {
    'common.language': 'Language',
    'common.languageAria': 'Choose game language',
    'common.themeLight': 'Theme: Light',
    'common.themeDark': 'Theme: Dark',
    'common.switchToDark': 'Switch to dark theme',
    'common.switchToLight': 'Switch to light theme',
    'common.themeDarkTitle': 'Dark theme',
    'common.themeLightTitle': 'Light theme',
    'common.start': 'Start',
    'common.startAria': 'Start the game',
    'common.level': 'Level {level}/{total}',
    'common.freeMode': 'Free Mode',
    'common.time': 'Time',
    'common.moves': 'Moves',
    'common.newRecord': 'New Record!',
    'common.congrats': 'Congratulations!',
    'common.playAgain': 'Play Again',
    'common.continue': 'Continue',
    'common.newBoard': 'New Board',
    'common.levelDone': 'Level Complete!',
    'common.announceLevelDone': 'Level completed!',
    'common.announceAllDone': 'All levels completed!',

    'octapus.title': 'Octapus',
    'octapus.tagline': 'Guide the octopus to the escape drain. Click a corridor and it glides along.',
    'octapus.progress': 'Progress to the drain',
    'octapus.boardAria':
      'Octapus board. Progress to the drain {pct} percent. Move by clicking a cell or using the arrow keys / WASD.',

    'octafort.title': 'Octafort',
    'octafort.tagline':
      'Place exactly one Fortress in every row, every column and every coloured security sector. Fortresses may not touch — not even diagonally!',
    'octafort.legendTower': 'Tower',
    'octafort.legendWall': 'Wall (eliminated)',
    'octafort.tapCycle': 'Tap: Wall → Tower → Empty',
    'octafort.reset': 'Reset',
    'octafort.resetAria': 'Clear the board',
    'octafort.progress': 'Towers placed',
    'octafort.boardAria':
      'Octafort board, {n} by {n}. Tapping a cell cycles it through wall, tower and empty. Navigate with the arrow keys and toggle with Space.',
    'octafort.cellPos': 'Row {row}, column {col}, sector {region}.',
    'octafort.cellTower': 'Tower.',
    'octafort.cellTowerConflict': 'Tower — rule violation.',
    'octafort.cellMark': 'Wall marker.',
    'octafort.cellEmpty': 'Empty.',
    'octafort.safe': 'Secured!',
    'octafort.announceWin': 'All towers placed, the fort is secure!',

    'octahang.title': 'Octahang',
    'octahang.tagline':
      'Start from the hint and uncover the hidden word letter by letter. Every wrong letter draws another body part; six mistakes end the round.',
    'octahang.taglineSub': 'Levels mode walks you from easy to hard, one step at a time.',
    'octahang.idleFigureAria': 'Stick figure hanging from a gallows',
    'octahang.hintLabel': 'Hint:',
    'octahang.tier1': 'Easy',
    'octahang.tier2': 'Medium',
    'octahang.tier3': 'Hard',
    'octahang.tier4': 'Very Hard',
    'octahang.difficultyAria': 'Difficulty: {tier}',
    'octahang.livesAria': '{n} lives remaining',
    'octahang.progress': 'Letters found',
    'octahang.stageEmpty': 'The gallows is empty, no mistakes yet.',
    'octahang.stageDrawn': '{wrong} mistakes: {wrong} body parts drawn. {lives} lives remaining.',
    'octahang.wordAria': '{n}-letter word: {spoken}',
    'octahang.blank': 'blank',
    'octahang.keyboardAria': 'Letter keyboard',
    'octahang.keyAria': 'Guess the letter {letter}',
    'octahang.keyAriaCorrect': ', correct',
    'octahang.keyAriaWrong': ', wrong',
    'octahang.resultAria': 'Round result',
    'octahang.won': 'Congratulations!',
    'octahang.lost': 'You lost!',
    'octahang.allDone': 'All levels finished!',
    'octahang.answer': 'Word:',
    'octahang.score': 'Score',
    'octahang.livesLeft': 'Lives Left',
    'octahang.restart': 'Restart',
    'octahang.nextWord': 'New Word',
    'octahang.nextLevel': 'Next Level',
    'octahang.announceNewWord': 'New word: {len} letters. Hint: {hint}',
    'octahang.announceCorrect': '{letter} is correct. {n} letters remaining.',
    'octahang.announceWrong': '{letter} is wrong. {n} lives remaining.',
    'octahang.announceFound': 'Word found!',
    'octahang.announceOutOfLives': 'Out of lives. The word was {word}.',
  },

  // ── Italiano ─────────────────────────────────────────────────────────────
  it: {
    'common.language': 'Lingua',
    'common.languageAria': 'Scegli la lingua del gioco',
    'common.themeLight': 'Tema: Chiaro',
    'common.themeDark': 'Tema: Scuro',
    'common.switchToDark': 'Passa al tema scuro',
    'common.switchToLight': 'Passa al tema chiaro',
    'common.themeDarkTitle': 'Tema scuro',
    'common.themeLightTitle': 'Tema chiaro',
    'common.start': 'Inizia',
    'common.startAria': 'Avvia il gioco',
    'common.level': 'Livello {level}/{total}',
    'common.freeMode': 'Modalità Libera',
    'common.time': 'Tempo',
    'common.moves': 'Mosse',
    'common.newRecord': 'Nuovo Record!',
    'common.congrats': 'Complimenti!',
    'common.playAgain': 'Gioca Ancora',
    'common.continue': 'Continua',
    'common.newBoard': 'Nuovo Schema',
    'common.levelDone': 'Livello Completato!',
    'common.announceLevelDone': 'Livello completato!',
    'common.announceAllDone': 'Tutti i livelli completati!',

    'octapus.title': 'Octapus',
    'octapus.tagline': 'Guida il polpo verso lo scarico di fuga. Clicca un corridoio e il polpo scivola.',
    'octapus.progress': 'Avanzamento verso lo scarico',
    'octapus.boardAria':
      'Tabellone Octapus. Avanzamento verso lo scarico {pct} per cento. Muoviti cliccando una cella oppure con i tasti freccia / WASD.',

    'octafort.title': 'Octafort',
    'octafort.tagline':
      'Posiziona esattamente una Fortezza in ogni riga, colonna e settore di sicurezza colorato. Le fortezze non possono toccarsi, nemmeno in diagonale!',
    'octafort.legendTower': 'Torre',
    'octafort.legendWall': 'Muro (esclusa)',
    'octafort.tapCycle': 'Tocca: Muro → Torre → Vuoto',
    'octafort.reset': 'Azzera',
    'octafort.resetAria': 'Svuota il tabellone',
    'octafort.progress': 'Torri posizionate',
    'octafort.boardAria':
      'Tabellone Octafort, {n} per {n}. Toccando una cella si passa tra muro, torre e vuoto. Naviga con i tasti freccia e cambia con la barra spaziatrice.',
    'octafort.cellPos': 'Riga {row}, colonna {col}, settore {region}.',
    'octafort.cellTower': 'Torre.',
    'octafort.cellTowerConflict': 'Torre — violazione della regola.',
    'octafort.cellMark': 'Segnale di muro.',
    'octafort.cellEmpty': 'Vuota.',
    'octafort.safe': 'Al sicuro!',
    'octafort.announceWin': 'Tutte le torri posizionate, la fortezza è al sicuro!',

    'octahang.title': 'Octahang',
    'octahang.tagline':
      "Parti dall'indizio e scopri la parola nascosta lettera per lettera. Ogni lettera sbagliata disegna una parte del corpo; dopo sei errori il turno finisce.",
    'octahang.taglineSub': 'La modalità Livelli ti accompagna dal facile al difficile, un passo alla volta.',
    'octahang.idleFigureAria': 'Omino stilizzato appeso alla forca',
    'octahang.hintLabel': 'Indizio:',
    'octahang.tier1': 'Facile',
    'octahang.tier2': 'Medio',
    'octahang.tier3': 'Difficile',
    'octahang.tier4': 'Molto Difficile',
    'octahang.difficultyAria': 'Difficoltà: {tier}',
    'octahang.livesAria': '{n} vite rimaste',
    'octahang.progress': 'Lettere trovate',
    'octahang.stageEmpty': 'La forca è vuota, ancora nessun errore.',
    'octahang.stageDrawn': '{wrong} errori: disegnate {wrong} parti del corpo. {lives} vite rimaste.',
    'octahang.wordAria': 'Parola di {n} lettere: {spoken}',
    'octahang.blank': 'vuoto',
    'octahang.keyboardAria': 'Tastiera delle lettere',
    'octahang.keyAria': 'Indovina la lettera {letter}',
    'octahang.keyAriaCorrect': ', corretta',
    'octahang.keyAriaWrong': ', sbagliata',
    'octahang.resultAria': 'Risultato del turno',
    'octahang.won': 'Complimenti!',
    'octahang.lost': 'Hai perso!',
    'octahang.allDone': 'Tutti i livelli completati!',
    'octahang.answer': 'Parola:',
    'octahang.score': 'Punti',
    'octahang.livesLeft': 'Vite Rimaste',
    'octahang.restart': 'Ricomincia',
    'octahang.nextWord': 'Nuova Parola',
    'octahang.nextLevel': 'Livello Successivo',
    'octahang.announceNewWord': 'Nuova parola: {len} lettere. Indizio: {hint}',
    'octahang.announceCorrect': '{letter} è corretta. {n} lettere rimaste.',
    'octahang.announceWrong': '{letter} è sbagliata. {n} vite rimaste.',
    'octahang.announceFound': 'Parola trovata!',
    'octahang.announceOutOfLives': 'Vite esaurite. La parola era {word}.',
  },

  // ── Español ──────────────────────────────────────────────────────────────
  es: {
    'common.language': 'Idioma',
    'common.languageAria': 'Elige el idioma del juego',
    'common.themeLight': 'Tema: Claro',
    'common.themeDark': 'Tema: Oscuro',
    'common.switchToDark': 'Cambiar al tema oscuro',
    'common.switchToLight': 'Cambiar al tema claro',
    'common.themeDarkTitle': 'Tema oscuro',
    'common.themeLightTitle': 'Tema claro',
    'common.start': 'Empezar',
    'common.startAria': 'Iniciar el juego',
    'common.level': 'Nivel {level}/{total}',
    'common.freeMode': 'Modo Libre',
    'common.time': 'Tiempo',
    'common.moves': 'Movimientos',
    'common.newRecord': '¡Nuevo Récord!',
    'common.congrats': '¡Enhorabuena!',
    'common.playAgain': 'Jugar de Nuevo',
    'common.continue': 'Continuar',
    'common.newBoard': 'Nuevo Tablero',
    'common.levelDone': '¡Nivel Completado!',
    'common.announceLevelDone': '¡Nivel completado!',
    'common.announceAllDone': '¡Todos los niveles completados!',

    'octapus.title': 'Octapus',
    'octapus.tagline': 'Lleva al pulpo hasta el desagüe de escape. Haz clic en un pasillo y el pulpo se desliza.',
    'octapus.progress': 'Progreso hacia el desagüe',
    'octapus.boardAria':
      'Tablero de Octapus. Progreso hacia el desagüe {pct} por ciento. Muévete haciendo clic en una casilla o con las teclas de flecha / WASD.',

    'octafort.title': 'Octafort',
    'octafort.tagline':
      'Coloca exactamente una Fortaleza en cada fila, cada columna y cada sector de seguridad de color. Las fortalezas no pueden tocarse, ¡ni siquiera en diagonal!',
    'octafort.legendTower': 'Torre',
    'octafort.legendWall': 'Muro (descartada)',
    'octafort.tapCycle': 'Toca: Muro → Torre → Vacío',
    'octafort.reset': 'Reiniciar',
    'octafort.resetAria': 'Limpiar el tablero',
    'octafort.progress': 'Torres colocadas',
    'octafort.boardAria':
      'Tablero de Octafort, {n} por {n}. Al tocar una casilla se alterna entre muro, torre y vacío. Navega con las teclas de flecha y alterna con la barra espaciadora.',
    'octafort.cellPos': 'Fila {row}, columna {col}, sector {region}.',
    'octafort.cellTower': 'Torre.',
    'octafort.cellTowerConflict': 'Torre — infracción de regla.',
    'octafort.cellMark': 'Marca de muro.',
    'octafort.cellEmpty': 'Vacía.',
    'octafort.safe': '¡A salvo!',
    'octafort.announceWin': '¡Todas las torres colocadas, la fortaleza está a salvo!',

    'octahang.title': 'Octahang',
    'octahang.tagline':
      'Parte de la pista y descubre la palabra oculta letra a letra. Cada letra incorrecta dibuja una parte del cuerpo; a los seis fallos termina la ronda.',
    'octahang.taglineSub': 'El modo Niveles te lleva de lo fácil a lo difícil, paso a paso.',
    'octahang.idleFigureAria': 'Monigote colgado de la horca',
    'octahang.hintLabel': 'Pista:',
    'octahang.tier1': 'Fácil',
    'octahang.tier2': 'Medio',
    'octahang.tier3': 'Difícil',
    'octahang.tier4': 'Muy Difícil',
    'octahang.difficultyAria': 'Dificultad: {tier}',
    'octahang.livesAria': '{n} vidas restantes',
    'octahang.progress': 'Letras encontradas',
    'octahang.stageEmpty': 'La horca está vacía, aún sin fallos.',
    'octahang.stageDrawn': '{wrong} fallos: {wrong} partes del cuerpo dibujadas. {lives} vidas restantes.',
    'octahang.wordAria': 'Palabra de {n} letras: {spoken}',
    'octahang.blank': 'vacío',
    'octahang.keyboardAria': 'Teclado de letras',
    'octahang.keyAria': 'Adivina la letra {letter}',
    'octahang.keyAriaCorrect': ', correcta',
    'octahang.keyAriaWrong': ', incorrecta',
    'octahang.resultAria': 'Resultado de la ronda',
    'octahang.won': '¡Enhorabuena!',
    'octahang.lost': '¡Has perdido!',
    'octahang.allDone': '¡Todos los niveles terminados!',
    'octahang.answer': 'Palabra:',
    'octahang.score': 'Puntos',
    'octahang.livesLeft': 'Vidas Restantes',
    'octahang.restart': 'Reiniciar',
    'octahang.nextWord': 'Nueva Palabra',
    'octahang.nextLevel': 'Siguiente Nivel',
    'octahang.announceNewWord': 'Nueva palabra: {len} letras. Pista: {hint}',
    'octahang.announceCorrect': '{letter} es correcta. Quedan {n} letras.',
    'octahang.announceWrong': '{letter} es incorrecta. Quedan {n} vidas.',
    'octahang.announceFound': '¡Palabra encontrada!',
    'octahang.announceOutOfLives': 'Sin vidas. La palabra era {word}.',
  },

  // ── العربية ──────────────────────────────────────────────────────────────
  ar: {
    'common.language': 'اللغة',
    'common.languageAria': 'اختر لغة اللعبة',
    'common.themeLight': 'السمة: فاتحة',
    'common.themeDark': 'السمة: داكنة',
    'common.switchToDark': 'التبديل إلى السمة الداكنة',
    'common.switchToLight': 'التبديل إلى السمة الفاتحة',
    'common.themeDarkTitle': 'سمة داكنة',
    'common.themeLightTitle': 'سمة فاتحة',
    'common.start': 'ابدأ',
    'common.startAria': 'ابدأ اللعبة',
    'common.level': 'المستوى {level}/{total}',
    'common.freeMode': 'الوضع الحر',
    'common.time': 'الوقت',
    'common.moves': 'الحركات',
    'common.newRecord': 'رقم قياسي جديد!',
    'common.congrats': 'تهانينا!',
    'common.playAgain': 'العب مرة أخرى',
    'common.continue': 'متابعة',
    'common.newBoard': 'لوحة جديدة',
    'common.levelDone': 'اكتمل المستوى!',
    'common.announceLevelDone': 'تم إكمال المستوى!',
    'common.announceAllDone': 'تم إكمال جميع المستويات!',

    'octapus.title': 'أوكتابوس',
    'octapus.tagline': 'أوصِل الأخطبوط إلى فتحة التصريف. انقر على ممر ليندفع الأخطبوط على طوله.',
    'octapus.progress': 'التقدّم نحو المخرج',
    'octapus.boardAria':
      'لوحة أوكتابوس. التقدّم نحو المخرج {pct} بالمئة. تحرّك بالنقر على خلية أو بمفاتيح الأسهم أو WASD.',

    'octafort.title': 'أوكتافورت',
    'octafort.tagline':
      'ضع قلعة واحدة بالضبط في كل صف وكل عمود وكل قطاع أمني ملوّن. لا يجوز أن تتلامس القلاع، ولا حتى قُطريًا!',
    'octafort.legendTower': 'برج',
    'octafort.legendWall': 'سور (مستبعدة)',
    'octafort.tapCycle': 'انقر: سور ← برج ← فارغ',
    'octafort.reset': 'إعادة تعيين',
    'octafort.resetAria': 'امسح اللوحة',
    'octafort.progress': 'الأبراج الموضوعة',
    'octafort.boardAria':
      'لوحة أوكتافورت، {n} في {n}. النقر على خلية يبدّل بين سور وبرج وفارغ. تنقّل بمفاتيح الأسهم وبدّل بمفتاح المسافة.',
    'octafort.cellPos': 'الصف {row}، العمود {col}، القطاع {region}.',
    'octafort.cellTower': 'برج.',
    'octafort.cellTowerConflict': 'برج — مخالفة للقاعدة.',
    'octafort.cellMark': 'علامة سور.',
    'octafort.cellEmpty': 'فارغة.',
    'octafort.safe': 'آمن!',
    'octafort.announceWin': 'تم وضع كل الأبراج، القلعة آمنة!',

    'octahang.title': 'أوكتاهانغ',
    'octahang.tagline':
      'انطلق من التلميح واكتشف الكلمة المخفيّة حرفًا بحرف. كل حرف خاطئ يرسم جزءًا من الرجل؛ وبعد ستة أخطاء تنتهي الجولة.',
    'octahang.taglineSub': 'وضع المستويات يأخذك من السهل إلى الصعب خطوة بخطوة.',
    'octahang.idleFigureAria': 'رسم لرجل معلّق على المشنقة',
    'octahang.hintLabel': 'تلميح:',
    'octahang.tier1': 'سهل',
    'octahang.tier2': 'متوسط',
    'octahang.tier3': 'صعب',
    'octahang.tier4': 'صعب جدًا',
    'octahang.difficultyAria': 'الصعوبة: {tier}',
    'octahang.livesAria': 'المحاولات المتبقية {n}',
    'octahang.progress': 'الحروف المكتشفة',
    'octahang.stageEmpty': 'المشنقة فارغة، لا أخطاء بعد.',
    'octahang.stageDrawn': '{wrong} أخطاء: رُسمت {wrong} أجزاء من الرجل. المحاولات المتبقية {lives}.',
    'octahang.wordAria': 'كلمة من {n} حروف: {spoken}',
    'octahang.blank': 'فراغ',
    'octahang.keyboardAria': 'لوحة الحروف',
    'octahang.keyAria': 'خمّن الحرف {letter}',
    'octahang.keyAriaCorrect': '، صحيح',
    'octahang.keyAriaWrong': '، خاطئ',
    'octahang.resultAria': 'نتيجة الجولة',
    'octahang.won': 'تهانينا!',
    'octahang.lost': 'لقد خسرت!',
    'octahang.allDone': 'انتهت جميع المستويات!',
    'octahang.answer': 'الكلمة:',
    'octahang.score': 'النقاط',
    'octahang.livesLeft': 'المحاولات المتبقية',
    'octahang.restart': 'ابدأ من جديد',
    'octahang.nextWord': 'كلمة جديدة',
    'octahang.nextLevel': 'المستوى التالي',
    'octahang.announceNewWord': 'كلمة جديدة: {len} حروف. تلميح: {hint}',
    'octahang.announceCorrect': '{letter} صحيح. الحروف المتبقية: {n}.',
    'octahang.announceWrong': '{letter} خاطئ. المحاولات المتبقية: {n}.',
    'octahang.announceFound': 'تم إيجاد الكلمة!',
    'octahang.announceOutOfLives': 'نفدت المحاولات. الكلمة الصحيحة: {word}.',
  },
};

// ─── Çeviri ─────────────────────────────────────────────────────────────────

/**
 * Anahtarı çevirir ve `{isim}` yer tutucularını doldurur. Anahtar seçili dilde
 * yoksa varsayılan dile (TR) düşer; orada da yoksa anahtarın kendisi döner —
 * böylece eksik çeviri boş metin yerine gözle görülür bir iz bırakır.
 */
export function translate(
  locale: Locale,
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  const raw = translations[locale]?.[key] ?? translations[DEFAULT_LOCALE][key] ?? key;
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

// ─── Geçerli dil + kalıcılık ────────────────────────────────────────────────

function readStoredLocale(): Locale | null {
  try {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(saved) ? saved : null;
  } catch {
    return null; // private mode / storage kapalı
  }
}

/**
 * Tarayıcı dilinden ('en-GB' → 'en') desteklenen bir dil çıkarmayı dener.
 *
 * Bilinçli olarak varsayılan akışın dışında bırakıldı: oyunların varsayılanı
 * Türkçedir ve tarayıcı dili bunu sessizce ezmemelidir. Host sayfa bu davranışı
 * isterse tek satırla açar:
 *   changeLanguage(detectBrowserLocale() ?? DEFAULT_LOCALE)
 * — ama yalnızca kayıtlı bir seçim yoksa çağırmaya dikkat edin.
 */
export function detectBrowserLocale(): Locale | null {
  if (typeof navigator === 'undefined') return null;
  for (const tag of navigator.languages ?? [navigator.language]) {
    const base = tag?.toLowerCase().split('-')[0];
    if (isLocale(base)) return base;
  }
  return null;
}

/** Öncelik: oyuncunun kayıtlı seçimi → varsayılan dil. */
export function resolveInitialLocale(): Locale {
  return readStoredLocale() ?? DEFAULT_LOCALE;
}

let currentLocale: Locale = resolveInitialLocale();

export function getLanguage(): Locale {
  return currentLocale;
}

export interface LanguageChangeDetail {
  lang: Locale;
  dir: Direction;
}

declare global {
  interface WindowEventMap {
    'og-language-change': CustomEvent<LanguageChangeDetail>;
  }
}

/**
 * Dili değiştirir: seçimi localStorage'a yazar, belge kökündeki `lang`/`dir`
 * niteliklerini günceller ve window üzerinde `og-language-change` yayınlar.
 * `Localized` karışımını kullanan her bileşen bu olayı dinlediği için sayfadaki
 * bütün oyunlar tek çağrıyla çevrilir.
 *
 * Argümansız çağrılırsa yalnızca kayıtlı/algılanan dili uygular — sayfa ilk
 * açılışında `<html dir>` değerini kurmak için kullanışlıdır.
 */
export function changeLanguage(next?: string | null): Locale {
  const locale = isLocale(next) ? next : currentLocale;
  currentLocale = locale;
  const dir = directionOf(locale);

  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* storage kapalıysa sessizce geç — dil yine de bu oturumda çalışır */
  }

  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.setAttribute('lang', locale);
    root.setAttribute('dir', dir);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<LanguageChangeDetail>(LANGUAGE_CHANGE_EVENT, { detail: { lang: locale, dir } }),
    );
  }

  return locale;
}

/** Dil değişimini dinler; aboneliği iptal eden fonksiyonu döner. */
export function onLanguageChange(handler: (detail: LanguageChangeDetail) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<LanguageChangeDetail>).detail);
  window.addEventListener(LANGUAGE_CHANGE_EVENT, listener);
  return () => window.removeEventListener(LANGUAGE_CHANGE_EVENT, listener);
}

/**
 * Modül tarafında derlenmemiş host sayfaların (düz `<script>`) da dili
 * değiştirebilmesi için küçük bir global köprü.
 *   window.ogI18n.changeLanguage('ar')
 */
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).ogI18n = {
    changeLanguage,
    getLanguage,
    onLanguageChange,
    translate,
    LOCALES,
  };
}

// ─── Lit karışımı (mixin) ───────────────────────────────────────────────────

type Constructor<T> = new (...args: any[]) => T;

export declare class LocalizedInterface {
  /** Geçerli dil. Nitelik olarak da verilebilir: `<og-octapus locale="ar">`. */
  locale: Locale;
  /** Seçili dilin yazım yönü — salt okunur. */
  readonly textDirection: Direction;
  /** Bileşen içi çeviri kısayolu. */
  t(key: MessageKey, params?: Record<string, string | number>): string;
  /** RTL'de sola dönen "ileri" oku. */
  readonly arrow: string;
}

/**
 * `locale` özelliğini, `og-language-change` aboneliğini ve `t()` kısayolunu
 * ekler; ayrıca host elemana `lang`/`dir` niteliklerini yansıtır, böylece hem
 * tarayıcı hem CSS (`:host([dir='rtl'])`) doğru yönü görür.
 */
export const Localized = <T extends Constructor<LitElement>>(Base: T) => {
  class LocalizedElement extends Base {
    static properties = {
      locale: { type: String, reflect: true },
    };

    locale: Locale = getLanguage();

    private _unsubscribeLocale?: () => void;

    get textDirection(): Direction {
      return directionOf(this.locale);
    }

    get arrow(): string {
      return forwardArrow(this.locale);
    }

    t(key: MessageKey, params?: Record<string, string | number>): string {
      return translate(this.locale, key, params);
    }

    connectedCallback() {
      super.connectedCallback();
      // Global seçim, bileşen açıkça bir locale ile işaretlenmediyse kazanır.
      if (!this.hasAttribute('locale')) this.locale = getLanguage();
      this._unsubscribeLocale = onLanguageChange(({ lang }) => {
        this.locale = lang;
      });
    }

    disconnectedCallback() {
      super.disconnectedCallback();
      this._unsubscribeLocale?.();
      this._unsubscribeLocale = undefined;
    }

    willUpdate(changed: Map<PropertyKey, unknown>) {
      super.willUpdate(changed);
      if (changed.has('locale')) {
        // Yerel `lang`/`dir` nitelikleri: tarayıcının kendi iki yönlü (bidi)
        // algoritmasını ve gölge DOM içindeki `direction` mirasını tetikler.
        this.setAttribute('lang', this.locale);
        this.setAttribute('dir', this.textDirection);
      }
    }
  }

  return LocalizedElement as unknown as Constructor<LocalizedInterface & LitElement> & T;
};

// ─── Paylaşılan stiller ─────────────────────────────────────────────────────

/**
 * Dil seçici + RTL temelleri. Oyunlar bunu kendi stillerinin *önüne* dizer:
 *   static styles = [i18nStyles, css`…`]
 */
export const i18nStyles = css`
  /* Host'a yansıtılan dir niteliği gölge DOM'a miras kalır; bu kural yalnızca
     niyeti açık kılar ve host sayfa dir vermese bile doğru yönü garanti eder. */
  :host([dir='rtl']) {
    direction: rtl;
  }

  /* Oyun tahtaları daima soldan sağa çizilir: ızgara/SVG koordinatları ve
     tıklama matematiği piksel konumuna bağlı olduğundan aynalanmaları oyunu
     bozar. Yalnızca metin ve HUD döner. */
  .ltr-lock {
    direction: ltr;
  }

  .lang-picker {
    position: relative;
    display: inline-flex;
    align-items: center;
    flex: none;
  }
  .lang-picker select {
    appearance: none;
    -webkit-appearance: none;
    cursor: pointer;
    border: none;
    border-radius: 999px;
    padding: .3rem 1.5rem .3rem .55rem;
    font-family: inherit;
    font-size: .75rem;
    font-weight: 600;
    line-height: 1;
    color: inherit;
    background: color-mix(in srgb, currentColor 10%, transparent);
    transition: background .15s, transform .15s;
  }
  :host([dir='rtl']) .lang-picker select {
    padding: .3rem .55rem .3rem 1.5rem;
  }
  .lang-picker select:hover { background: color-mix(in srgb, currentColor 18%, transparent); }
  .lang-picker select:active { transform: scale(.95); }
  .lang-picker select:focus-visible {
    outline: 3px solid var(--og-accent, #ff9900);
    outline-offset: 2px;
  }
  /* Yerel <option> listesi gölge DOM'da değil, tarayıcının kendi katmanında
     çizilir; oradaki renkleri sayfa teması değil işletim sistemi belirler, bu
     yüzden okunaklı kalsın diye açıkça verilir. */
  .lang-picker option {
    background: #1e293b;
    color: #f8fafc;
  }
  :host([theme='light']) .lang-picker option {
    background: #ffffff;
    color: #0f172a;
  }
  /* Kendi çizdiğimiz ok: appearance:none yerli oku kaldırır. */
  .lang-picker::after {
    content: '';
    position: absolute;
    inset-inline-end: .5rem;
    width: 0;
    height: 0;
    border-inline-start: 3.5px solid transparent;
    border-inline-end: 3.5px solid transparent;
    border-top: 4px solid currentColor;
    opacity: .6;
    pointer-events: none;
  }
`;

// ─── Dil seçici ─────────────────────────────────────────────────────────────

/**
 * Tema düğmesinin yanına yerleşen dropdown. Yerel `<select>` kullanılır:
 * mobil tarayıcılarda işletim sisteminin kendi seçicisi açılır, klavye ve ekran
 * okuyucu desteği bedavaya gelir, gölge DOM içinde taşan bir açılır panel
 * kırpılma sorunu yaratmaz.
 *
 * Seçenekler dilin kendi adını taşır (Türkçe, English, العربية …) — bkz.
 * `LOCALES`, bayrak emojisinin neden kullanılmadığı orada açıklanır. Kendi
 * seçicisini kuran host sayfalar dar alanlar için `LocaleMeta.short` kısa
 * kodunu kullanabilir.
 *
 * Seçim yapıldığında yalnızca `changeLanguage` çağrılır; bileşenin kendini
 * güncellemesi `og-language-change` aboneliği üzerinden olur, yani sayfadaki
 * bütün oyunlar aynı anda döner.
 */
export function renderLanguagePicker(
  locale: Locale,
  onChange: (next: Locale) => void = (next) => { changeLanguage(next); },
): TemplateResult {
  const label = translate(locale, 'common.languageAria');
  return html`
    <div class="lang-picker" part="lang-picker">
      <select
        aria-label=${label}
        title=${label}
        .value=${locale}
        @change=${(e: Event) => {
          const next = (e.target as HTMLSelectElement).value;
          if (isLocale(next)) onChange(next);
        }}
      >
        ${LOCALES.map(
          (l) => html`<option value=${l.code} ?selected=${l.code === locale}>${l.label}</option>`,
        )}
      </select>
    </div>
  `;
}
