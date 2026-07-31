# game-octahang — Octahang

`og-octahang` etiketiyle kullanılan bir kelime/tahmin oyunu (adam asmaca).
Oyuncuya bir **ipucu cümlesi** ve kelimenin harf sayısı kadar boş çizgi verilir;
oyuncu harf harf tahmin ederek kelimeyi çözmeye çalışır. Her yanlış harf,
darağacındaki adamın bir parçasını çizer.

## Amaç
Altı hata hakkı bitmeden gizli kelimenin tüm harflerini bulmak.

## Kurallar
1. Her turda havuzdan bir kelime ve ona ait ipucu seçilir. İpucu ekranın en
   üstünde daima görünür.
2. Oyuncu bir harf seçer:
   - **Doğru:** Harf, kelimede geçtiği **tüm** konumlarda açığa çıkar; harf
     düğmesi yeşile döner.
   - **Yanlış:** Hata sayacı bir artar, adamın sıradaki parçası çizilir; harf
     düğmesi kırmızıya döner.
3. Basılan harf her iki durumda da **pasifleşir**; aynı harf tekrar denenemez.
4. Tüm harfler bulunursa tur **kazanılır**. Hata sayısı 6'ya ulaşırsa tur
   **kaybedilir** ve doğru kelime ekranda gösterilir.
5. **Her tur boş tahtayla başlar:** Kelime ne kadar uzun olursa olsun hiçbir
   harf baştan açık gelmez; tek yardım, kelimenin üstünde duran ipuçu metnidir.

### Çizim
Sehpa (taban, dikey direk, üst kiriş ve ip) oyun boyunca görünür durumdadır ve
hiç değişmez. Çizilen adam altı parçadan oluşur; sıra sabittir:

| Hata | Parça |
|---|---|
| 1 | Kafa |
| 2 | Gövde |
| 3 | Sol kol |
| 4 | Sağ kol |
| 5 | Sol bacak |
| 6 | Sağ bacak → tur biter |

Çizim SVG'dir; her parça `pathLength="1"` taşıdığı için tek bir
`stroke-dashoffset` geçişiyle "elle çiziliyormuş" gibi belirir. Lit, listeyi
index'e göre eşlediğinden daha önce çizilmiş parçalar yeniden animasyona
girmez.

## Arayüz Düzeni
Ekran yukarıdan aşağıya dört bölgeden oluşur:

1. **İpucu alanı** — `💡 İpucu: …` kutusu; sağ ucunda kelimenin zorluk katmanı
   rozeti (`KOLAY` / `ORTA` / `ZOR` / `ÇOK ZOR`).
2. **Çizim alanı** — darağacı ve hata sayısına göre çizilen adam.
3. **Kelime çizgileri** — harf sayısı kadar alt çizgi; bulunan harfler
   çizgilerin üzerine oturur (dar ekranda alt satıra sarar).
4. **Sanal klavye** — Türk alfabesindeki 29 harfin tamamı, alfabetik sırayı
   bozmadan **10-10-9** olarak üç satıra bölünmüş hâlde. Tuş genişliği en uzun
   satıra göre hesaplanır, satırlar ortalanır; böylece 9 tuşlu son satır da
   simetrik durur ve tuşlar kartın yuvarlatılmış köşelerine dayanmaz.

Tur bittiğinde **sonuç paneli** açılır: "Tebrikler!" / "Kaybettin!" mesajı,
doğru kelime, tur istatistikleri ve **Yeniden Başla** düğmesi. Panel, bileşenin
**kutusunun tam ortasında** belirir (hafif karartılmış bir arka planın üzerinde);
sayfanın altına doğru kaymaz. Klavye yerinde ve kilitli kalır, böylece panel
kapanınca düzen zıplamaz.

Bunların üstünde ince bir HUD şeridi vardır: tema düğmesi, host'un kendi
düğmeleri için `host-controls` slot'u, seviye/süre bilgisi ve kalan hak (`❤️ 4/6`).
İlerleme çubuğu, kelimedeki **benzersiz harflerin** ne kadarının bulunduğunu
gösterir.

## Kontroller
- **Fare / dokunmatik (birincil):** Sanal klavyedeki harfe dokunmak.
- **Fiziksel klavye:** Oyuncu doğrudan bilgisayarının klavyesinden de harfe
  basabilir. Dinleyici `window` üzerindedir, yani bileşene önceden odaklanmak
  gerekmez; ancak host sayfadaki bir `input`/`textarea`/`contenteditable`
  alanına yazı yazılıyorsa tuş **yutulmaz**. `Ctrl/Alt/Meta` kısayolları da
  yoksayılır.
- **Erişilebilirlik:** `Tab` ile harf düğmeleri gezilir, `Enter`/`Boşluk` ile
  seçilir. Tur bitince odak otomatik olarak sonuç panelinin düğmesine taşınır.
  Her tahmin `aria-live` ile duyurulur; kelime satırı ve çizim alanı
  `aria-label` taşır.

### Türkçe harf duyarlılığı
Türkçede `i ↔ İ` ve `ı ↔ I` ayrımı kritiktir; JavaScript'in varsayılan
`toUpperCase()` metodu `i` harfini yanlışlıkla `I` yapar. Bileşen bu yüzden
kendi `trUpper()` yardımcısını kullanır: önce `i → İ` ve `ı → I` dönüşümü
uygulanır, sonra büyütme yapılır. Böylece klavyeden gelen `i`, kelimedeki `İ`
ile doğru eşleşir ve davranış tarayıcının locale ayarından bağımsız olur.
Havuzdaki tüm kelimeler zaten Türkçe büyük harfle ve yalnızca alfabedeki 29
harfle yazılıdır (boşluk, tire, rakam yoktur).

## Puanlama
Oyun **puana dayalıdır** (kök README §4) ve süreyi de raporlar. Tur puanı
yalnızca kazanılan turda hesaplanır:

```
puan = ((katman − 1) × 40) + (kelime uzunluğu × 10) + (kalan hak × 25) + zaman bonusu
zaman bonusu = max(0, 120 − geçen saniye)
```

- `bestScores` yalnızca önceki en yüksekten büyükse güncellenir.
- `bestTimes` yalnızca kazanılan turlarda ve önceki en iyiden düşükse güncellenir.
- "🌟 Yeni Rekor" rozeti, o seviyede **önceden bir kayıt varken** aşıldığında
  çıkar; ilk oynanış rekor sayılmaz.
- Kaybedilen tur puan üretmez, `completedLevels` listesine yazılmaz; ancak
  geçen süre `totalPlayMs`'e eklenir ve `og-level-fail` yayınlanır.

## Zorluk Eğrisi
Havuz **dört zorluk katmanına** ayrılmıştır ve `levels` modu bu katmanları
sırayla dolaşır: oyun kolay başlar, kademe kademe zorlaşır. Seviyeler eşit
dört parçaya bölünür (`tierForLevel`):

| Katman | Rozet | Seviye aralığı | Örnek |
|---|---|---|---|
| 1 | `KOLAY` | ilk çeyrek | `KELEBEK`, `ŞEMSİYE`, `TELESKOP` |
| 2 | `ORTA` | ikinci çeyrek | `KIVILCIM`, `MİRASYEDİ`, `TEDİRGİN` |
| 3 | `ZOR` | üçüncü çeyrek | `MUAMMA`, `BASİRET`, `TAHAMMÜL` |
| 4 | `ÇOK ZOR` | son çeyrek | `İSTİHZA`, `PALİMPSEST`, `ZÜMRÜDÜANKA` |

Aktif katman, ipucu kutusunun sağındaki renkli rozetle oyuncuya gösterilir.
Üst katmanlarda zorluk üç kaynaktan gelir:

1. **Sözcüğün seyrekliği** — soyut kavramlar, edebî ve bilimsel terimler.
2. **İpucunun dolaylılığı** — sözlük tanımı değil, bilmece gibi bir tarif
   ("Dünyadan elini eteğini çekip yalnız yaşayan" → `MÜNZEVİ`).
3. **Harf dağılımı** — J, Ğ, Ö, Ü, Ç, Ş gibi geç akla gelen harfler.

Hata hakkı her seviyede sabittir (6); zorluk yalnızca kelimeden gelir.

### Boş tahtayla başlangıç
Tur, kelime uzunluğundan bağımsız olarak **tamamen kapalı** başlar; oyuncuya
baştan açık ("hediye") harf verilmez. Uzun ve zor kelimelerde tek destek,
kelimenin üstündeki ipucu metnidir. Böylece her tur aynı kurallarla oynanır ve
`moves` sayımı doğrudan oyuncunun denediği harf sayısıdır.

## Kelime Seçimi ve Tekrar Önleme
Kelimeler `src/words.ts` içindeki havuzdan seçilir; her kayıt bir kelime, ipucu
ve katmandan oluşur. Havuzda **388 kayıt** vardır ve katmanlara şöyle dağılır:

| Katman | Kelime |
|---|---|
| 1 · Kolay | 100 |
| 2 · Orta | 74 |
| 3 · Zor | 136 |
| 4 · Çok zor | 78 |

Seçim şu sırayla yapılır:

1. İstenen katmandaki, **daha önce çıkmamış** kelimeler.
2. Aday kalmazsa katmana en yakın olandan başlayarak diğer katmanlara bakılır
   (eşit uzaklıkta zor olan önce gelir, tur kolaylaşmasın diye).
3. Havuz tümüyle tükenmişse "daha önce çıkmamış" koşulu düşer.

Son çıkan **60** kelime (`USED_WORD_MEMORY`) `state.extra.usedWords` alanında
tutulur ve host tarafından kalıcılaştırıldığı için tekrar önleme **oturumlar
arasında** da çalışır. Bu sayı, en küçük katmanın (2 · Orta, 74 kelime) altında
tutulur; aksi hâlde bir katman tümüyle "kullanılmış" duruma düşer ve seçim
sürekli yedek dallara sapardı. Bir test bu payı doğrudan denetler, yani bellek
büyütülürse havuzun da büyümesi gerektiği derlemede değil testte yakalanır.

İsteğe bağlı `seed` özelliği verildiğinde mulberry32 tabanlı tohumlu bir üreteç
kullanılır: aynı seed + aynı seviye her zaman aynı kelimeyi getirir (test ve
günlük bulmaca senaryosu için).

## Mod Desteği
- **levels:** `levelCount` kadar seviye; zorluk katmanı orantılanır. Kazanılan
  tur bir sonraki seviyeye geçirir, **kaybedilen tur seviyeyi ilerletmez** —
  oyuncu aynı seviyeyi yeni bir kelimeyle tekrar dener. Son seviye kazanılınca
  `og-game-complete` yayınlanır.
- **random:** Her tur bağımsızdır, seviye sonu yoktur; zorluk eğrisi olmadığı
  için kelimeler **orta-zor** banttan (2. ve 3. katman) gelir.
  `bestTimes`/`bestScores`
  sözleşmeye uygun olarak tek anahtar (`0`) üzerinden tutulur; `currentLevel`
  kalıcı state'te daima `1`'dir.

## Görsel Özelleştirme ve Gömme (Modal)
Bileşen **bağımsız, kendi kendine yeten bir kutudur**: dış arka planını
zorlamaz, tam ekran kaplamaz ve konduğu kapsayıcının (panel, pop-up, modal)
genişliğine uyar; 320 px'e kadar sorunsuz çalışır. Sonuç ekranı `position: fixed`
değil, bileşenin **kendi kutusu içinde** (`absolute`) ortalanır — yani host
modalın dışına taşan ikinci bir tam-ekran katman oluşmaz.

### Tema (`theme` parametresi)
Bileşen açık ve koyu için hazır dahili bir palet taşır; host sayfa hiçbir şey
tanımlamadan da doğru görünür:

```html
<og-octahang theme="dark"></og-octahang>  <!-- varsayılan -->
<og-octahang theme="light"></og-octahang>
```

`theme` özelliği yansıtılır (`reflect`), böylece CSS'te
`og-octahang[theme="light"]` ile de hedeflenebilir. HUD'daki tema düğmesine
basıldığında bileşen `og-theme-change` (`{ gameId, theme }`) yayınlar; host
sayfa bunu dinleyip kendi yüzeyini de çevirebilir (bkz. `demo/index.html`).

### Host düğmeleri için slot
`host-controls` adlı bir slot vardır: host sayfa kendi düğmelerini (mod
değiştirme, ses vb.) bileşenin tema düğmesinin yanına yerleştirebilir. Slot hem
başlangıç ekranında hem de HUD'da aynı adla bulunur.

### CSS custom property'leri
Tüm renk/tipografi değerleri `--og-*` değişkenlerinden okunur ve host bunları
**her zaman ezebilir**: `--og-bg`, `--og-surface`, `--og-primary`,
`--og-accent`, `--og-text`, `--og-radius`, `--og-font`. Oyuna özgü ek
değişkenler:

| Değişken | Ne yapar |
|---|---|
| `--og-octahang-gallows` | Sehpa ve ip çizgilerinin rengi |
| `--og-octahang-figure` | Çizilen adamın çizgi rengi (varsayılan: `--og-accent`) |

Dışa açılan `part`'lar: `hud`, `theme-toggle`, `hint`, `stage`, `word`,
`keyboard`, `key`, `result`, `button`.

## Entegrasyon Örneği
```html
<og-octahang></og-octahang>
<script type="module">
  import '@octapull-games/game-octahang';
  const el = document.querySelector('og-octahang');
  el.mode = 'levels';
  el.levelCount = 10;
  el.state = await api.loadState('game-octahang'); // null olabilir
  el.addEventListener('og-state-change', (e) => api.saveState(e.detail.state));
  el.addEventListener('og-level-fail', (e) => ui.toast(`Kaybedildi: ${e.detail.reason}`));
</script>
```

> Not: Bu bileşen, girdi property'sini kök README sözleşmesindeki (§3.1) adla,
> yani `state` olarak açar; depodaki bütün oyunlar aynı adı kullanır.

## Sözleşme Uyumu
- Çalışma zamanı bağımlılığı yalnızca Lit'tir; ağ erişimi ve yerel depolama
  kullanılmaz (demo sayfasındaki `sessionStorage` yalnızca host taklidi içindir).
- Üretim çıktısı: **~51 KB ham / ~17,5 KB gzip** (Lit dahil) — 60 KB sınırının
  altında.
- `disconnectedCallback` içinde rAF, tüm `setTimeout`'lar, `visibilitychange` ve
  `keydown` dinleyicileri temizlenir.
- `prefers-reduced-motion` tercihine saygı gösterilir: çizim, sarsılma ve panel
  animasyonları kapanır, sonuç paneli beklemeden açılır.

## Kullanılan Üçüncü Taraf Varlıklar
Bileşenin kendisinde yok. Darağacı ve adam figürü, projeye özgü olarak yazılmış SVG yollarıdır —
başlangıç ekranındaki amblem de dahil: orada tahtadaki çizimin küçültülmüş bir
kopyası (sehpa + tamamlanmış çöp adam) ipin kirişe bağlandığı noktadan hafifçe
sallanarak durur, böylece oyuncu daha ilk bakışta oyunun ne olduğunu anlar.
Kullanılan diğer simgeler (💡, ❤️, 🎉, 💀, 🏆, ⭐, ⏱️) Unicode
karakterlerdir. Ses efektleri Web Audio API osilatörleriyle programatik
üretilir, harici ses dosyası kullanılmaz. Kelime havuzu ve ipucu cümleleri ekip
tarafından yazılmıştır.

**Yazı tipi (yalnızca demo sayfası):** `demo/index.html`, gösterim amacıyla
[Inter](https://fonts.google.com/specimen/Inter) yazı tipini Google Fonts
üzerinden yükler; lisansı **SIL Open Font License 1.1**'dir (ticari kullanım
dahil serbest, atıf zorunluluğu yoktur). Yazı tipi pakete dâhil edilmez ve
bileşenin çalışması için gerekli değildir: bileşen `--og-font` değişkenini okur,
host sayfa hangi yazı tipini verirse onu kullanır.
