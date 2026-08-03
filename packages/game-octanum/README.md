# game-octanum — Octanum

`og-octanum` etiketiyle kullanılan bir sayı/aritmetik bulmacası. Oyuncu bir orta
çağ simyacısının laboratuvarındadır: elindeki **altı temel iksir bileşenini**
(sayıları) dört işlem kazanında karıştırarak krallığın istediği **Hedef
Formül**'ün (hedef sayının) değerine ulaşmaya çalışır.

## Amaç
Süre dolmadan, dağıtılan altı sayıyı ve dört işlemi kullanarak hedef sayıyı
birebir üretmek.

## Kurallar
1. Turun başında sahneye **altı bileşen kartı** düşer ve üstte **hedef sayı**
   belirir. Geri sayım başlar.
2. Oyuncu sırayla **birinci bileşen → işlem kazanı → ikinci bileşen** seçer.
   Sistem işlemi anında yapar: kullanılan iki kart sahneden kalkar, yerlerine
   sonuç kartı gelir.
3. **Her kart bir kez kullanılır.** Ancak işlem sonucu oluşan yeni kart tekrar
   kullanılabilir; oyun bu şekilde adım adım hedefe yaklaşır.
4. **İşlem sınırları** (ara adımlarda ondalıklı veya eksi sayı oluşamaz):
   - Çıkarmada büyük sayı önce gelir (`A ≥ B`). `A − B = 0` serbesttir ama
     işe yaramaz.
   - Bölme tam olmalıdır (`A mod B = 0`), `B = 0` yasaktır.
   - Toplama ve çarpmada sınır yoktur.
5. Bir işlemin sonucu hedefe **eşit olduğu anda** tur kendiliğinden biter ve
   tam isabet sayılır.
6. Süre dolduğunda ya da **Tamamla** düğmesine basıldığında tur biter; sahnede
   kalan kartlardan **hedefe en yakın olanı** o turun sonucudur.
7. Bütün kartlar tükenip tek kart kalsa bile tur kendiliğinden bitmez; oyuncu
   Geri Al / Sıfırla ile yeniden deneyebilir.

### Yardımcı düğmeler
| Düğme | Ne yapar |
|---|---|
| **↺ Geri Al** | Son karışımı bozar; iki kart sahnedeki **eski yerlerine** döner. |
| **⟲ Sıfırla** | Bölümün başındaki altı bileşene döner. Süre durmaz. |
| **✦ Tamamla** | Turu bitirir ve puanı hesaplar. |

Geri Al ve Sıfırla süreyi geri almaz — düşünmek de bir maliyettir.

## Arayüz Düzeni
Ekran yukarıdan aşağıya altı bölgeden oluşur:

1. **HUD** — dil seçici, tema düğmesi, host'un kendi düğmeleri için
   `host-controls` slot'u, seviye bilgisi ve geri sayım (`⏳ 01:12`). Son on
   saniyede sayaç kırmızıya döner.
2. **Süre çubuğu** — kalan sürenin oranı; son %15'te kırmızıya geçer.
3. **Hedef Formül** — kaynayan bir kazan ve yanında büyük, parlayan hedef sayı.
   Hedefe ulaşıldığı anda sayı bir kez büyüyüp yerine oturur.
4. **Bileşen şişeleri** — her kart bir cam şişedir; içindeki iksirin seviyesi
   kartın değerine göre (logaritmik ölçekle) yükselir, böylece büyük değerler
   ilk bakışta ayırt edilir. İşlem sonucu oluşan kartların çerçevesi kesiklidir.
5. **İşlem kazanları** — `+ − × ÷`. Seçili kazan dolgulu görünür.
6. **Yönerge satırı + eylem düğmeleri + Karışım Defteri** — defter, o tura ait
   bütün adımları (`50 × 7 = 350`) sırayla tutar.

Tur bittiğinde **sonuç paneli** açılır: sonuç başlığı, tur istatistikleri ve
sonraki tura geçiş düğmesi. Panel, bileşenin **kutusunun tam ortasında** belirir
(hafif karartılmış bir arka planın üzerinde); sayfanın altına doğru kaymaz.

### Hatalı karışımı önceden engelleme
İlk bileşen ve kazan seçildiğinde, kurala takılacak bütün şişeler anında
**pasifleşir** (`7` seçiliyken `−` kazanında `7`'den büyük şişeler, `50`
seçiliyken `÷` kazanında `50`'yi tam bölmeyen şişeler…). Oyuncu böylece kuralı
denemeden görür. Klavye kısayolundan gelen kural dışı bir deneme ise şişeleri
sarsar ve yönerge satırında kırmızı bir uyarı gösterir.

## Kontroller
- **Fare / dokunmatik (birincil):** Şişeye ve kazana dokunmak. Seçili şişeye
  ikinci kez dokunmak seçimi bırakır.
- **Fiziksel klavye:** Dinleyici `window` üzerindedir, yani bileşene önceden
  odaklanmak gerekmez; host sayfadaki bir `input`/`textarea`/`contenteditable`
  alanına yazı yazılıyorsa tuş **yutulmaz**, `Ctrl/Alt/Meta` kısayolları da
  yoksayılır.

  | Tuş | İşlev |
  |---|---|
  | `1`–`6` | Soldan sağa n. bileşeni seç |
  | `+` `-` `*` (`x`) `/` (`:`) | İşlem kazanını seç |
  | `Backspace` | Geri al |
  | `Enter` | Tamamla |
  | `Escape` | Seçimi bırak |

- **Erişilebilirlik:** `Tab` ile bütün şişeler, kazanlar ve düğmeler gezilir,
  `Enter`/`Boşluk` ile seçilir. Tur bitince odak otomatik olarak sonuç
  panelinin düğmesine taşınır. Her hamle, geri alma, kural ihlali ve tur sonucu
  `aria-live` ile duyurulur; şişeler `aria-pressed` taşır ve pasif olanların
  nedeni `aria-label`'a yazılır.

## Puanlama
Oyun **puana dayalıdır** (kök README §4) ve süreyi de raporlar:

```
Tam isabet : 100 + kalan tam saniye
Kısmi      : max(0, 100 − (fark × 10))
```

- `bestScores` yalnızca önceki en yüksekten büyükse güncellenir; kısmi turlar da
  puan üretebildiği için bu tabloya yazılabilir.
- `bestTimes` **yalnızca tam isabetle biten** turlarda ve önceki en iyiden
  düşükse güncellenir (§4).
- "🌟 Yeni Rekor" rozeti, o seviyede **önceden bir kayıt varken** aşıldığında
  çıkar; ilk oynanış rekor sayılmaz.
- Tam isabet olmayan tur `completedLevels` listesine yazılmaz ve seviyeyi
  ilerletmez; ancak geçen süre `totalPlayMs`'e eklenir ve `og-level-fail`
  yayınlanır (`reason`: `time-up` ya da `inexact`).

## Zorluk Eğrisi
`levels` modunda zorluk, seviyeden hesaplanan `0 … 1` aralığındaki tek bir
katsayıya bağlanır (`difficultyFor`) ve dört kolu birden çevirir:

| Zorluk | Gereken karışım | Hedef aralığı | Süre | Nadir öz havuzu |
|---|---|---|---|---|
| 0 · ilk seviye | 2 | 24 – 99 | 150 sn | `15, 20, 25` |
| 0.5 · orta | 3 | 142 – 499 | 120 sn | `15, 20, 25, 50` |
| 1 · son seviye | 5 | 260 – 899 | 90 sn | `15, 20, 25, 50, 75, 100` |

**Asıl kol, hedefin büyüklüğü değil formülün uzunluğudur** (`stepsFor`): tur,
hedefe kaç karışımda varılacağı baştan belirlenerek örülür. Ölçek katsayısı 2.5
seçilmiştir; 10 seviyelik bir oyunda bu, adımların `2,2,3,3,3,3,4,4,4,5` diye
yayılmasını sağlar. Oyuncu iki adımlık turlarla ısınır, uzun süre üç adımda
kalır ve beş adımlık formülle yalnızca son seviyede karşılaşır. Doğrudan 3 ile
ölçekleseydik orta seviyeler dört adıma sıçrar, eğri baştan dikleşirdi.

Hedef aralığı bu kola eşlik eder: küçük hedef tek başına turu kolaylaştırmaz ama
büyük hedef her zaman zorlaştırır. Nadir öz havuzu da zorlukla açılır — kolay
turlarda elde `100` bulunması işe yaramaz, iki basamaklı bir hedefe onunla
yaklaşılamaz ve kart ölü ağırlığa dönüşür.

Bileşenler iki havuzdan çekilir:

- **Nadir özler:** yukarıdaki zorluk havuzundan 1–2 tane, her turda en çok
  bir kez.
- **Temel özler:** `1 … 10` — aynı değerden en çok iki tane (üç tane `7` gelen
  bir el hem tekdüze görünür hem de çözüm uzayı bakımından fakirdir).

## Üretim Yöntemi ve Çözülebilirlik Garantisi
Kök README §5, prosedürel üretim yapan oyunların çözülebilirliği **garanti
etmesini** şart koşar. Octanum hedefi rastgele isteyip aratmaz; **ileriye doğru
kurar** (`src/round.ts`):

1. Altı bileşen çekilir.
2. El karıştırılır, baştan `adım + 1` kart alınır ve sırayla birbirine eklenerek
   bir formül örülür: `v = n₀`, sonra her adımda `v = v ⊕ nᵢ`. Ulaşılan son
   değer hedeftir. Her adımda geçerli işlemler arasından sonucu aralıkta kalan
   biri seçilir (son adımda `[lo, hi]`, ara adımlarda yalnızca `≤ hi` — böylece
   `100 × 75` gibi bir sıçrama zinciri raydan çıkarmaz).
3. Aday tur üç denetimden geçer, geçemezse el yeniden çekilir:
   - hedef zorluk aralığında mı,
   - hedef sahnedeki bir kartın kopyası değil mi (tur sıfır hamlede biterdi),
   - hedef **vaat edilenden daha kısa yoldan düşmüyor** mu
     (`reachableWithin`, en çok iki adım derinliğinde bakar).

Çözüm zaten elimizde olduğu için **çözümsüz bölüm üretmek yapısal olarak
imkânsızdır**; bir test bunu 60 farklı tohum için üretilen turları baştan
oynayarak doğrular. Asıl kazanç ise zorluğun **ölçülebilir bir büyüklük**
olmasıdır: bir turun kaç karışım gerektirdiği baştan bilinir. Hedefi rastgele
isteyip çözücüye bıraktığımızda "kolay" seviyeler de beş-altı adımlık formüller
doğurabiliyordu; oyunun genelinin fazla zor kaçmasının sebebi buydu.

Kurulan çözüm turla birlikte saklanır ve tam isabet kaçırıldığında sonuç
panelinde "Simyacının formülü" olarak gösterilir — tam isabette gösterilmez,
sürpriz bozulmasın diye.

`src/solver.ts` bu akışta iki iş görür: `reachableWithin` ile "fazla kolay"
denetimini yapar, `solve` ile de testlerin üretilen her turu bağımsız olarak
doğrulamasını sağlar.

### Arama ve budamalar
Ham ağaç 6 sayı için milyonlarca düğümdür. Dört budama onu tarayıcıda göz
kırpmadan bitecek boyuta indirir — aynı budamalar `reachableWithin`'in derinlik
sınırlı taramasında da geçerlidir, bu yüzden "fazla kolay" denetimi birkaç bin
düğümde biter ve her tur üretiminde çağrılabilir:

1. Liste daima büyükten küçüğe sıralı tutulur, böylece seçilen çiftte `a ≥ b`
   garanti edilir: `a+b` ile `b+a` (ve `a×b` ile `b×a`) aynı dalı iki kez açmaz.
2. Aynı düğümde eşit değerli sayılar bir kez denenir.
3. `a−b` yalnızca `a > b` iken, `a×b` ve `a÷b` yalnızca `b ≠ 1` iken denenir —
   1 ile çarpmak ya da bölmek eli değiştirmez.
4. Tam isabet bulununca arama anında durur.

Ölçüm (`[100, 75, 50, 25, 9, 8]`, tipik dizüstü):

| Durum | Düğüm | Süre |
|---|---|---|
| Tipik tur (tam isabet, erken çıkış) | ~1.100 | ~0,4 ms |
| En kötü durum (ulaşılamayan hedef, ağacın tamamı) | ~1.127.000 | ~59 ms |

Bir düğüm bütçesi (2.000.000) yine de vardır: patolojik bir el arayüzü
kilitlemesin diye. Bütçe dolarsa o ana kadarki en iyi değer döner — o değer de
üretilebilir olduğundan tur yine çözülebilir kalır. Yukarıdaki ölçüm, bütçenin
normal turlarda hiç devreye girmediğini gösterir.

## Mod Desteği
- **levels:** `levelCount` kadar seviye; zorluk yukarıdaki eğriye göre
  orantılanır. Tam isabet bir sonraki seviyeye geçirir, **kaçırılan tur seviyeyi
  ilerletmez** — oyuncu aynı seviyeyi yeni bir formülle tekrar dener. Son seviye
  tam isabetle bitince `og-game-complete` yayınlanır.
- **random:** Her tur bağımsızdır, seviye sonu yoktur; zorluk eğrisi olmadığı
  için **orta bantta sabittir** (`RANDOM_MODE_DIFFICULTY = 0.5`): her tur üç
  karışımlık, hedef `142 – 499` arası, süre sabit **120 saniye**.
  `bestTimes`/`bestScores` sözleşmeye uygun olarak tek anahtar (`0`) üzerinden
  tutulur; `currentLevel` kalıcı state'te daima `1`'dir.

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
<og-octanum theme="dark"></og-octanum>   <!-- varsayılan: Arcane Midnight -->
<og-octanum theme="light"></og-octanum>  <!-- Aged Parchment -->
```

`theme` özelliği yansıtılır (`reflect`), böylece CSS'te
`og-octanum[theme="light"]` ile de hedeflenebilir. HUD'daki tema düğmesine
basıldığında bileşen `og-theme-change` (`{ gameId, theme }`) yayınlar; host
sayfa bunu dinleyip kendi yüzeyini de çevirebilir (bkz. `demo/index.html`).

### Host düğmeleri için slot
`host-controls` adlı bir slot vardır: host sayfa kendi düğmelerini (mod
değiştirme, ses vb.) bileşenin tema düğmesinin yanına yerleştirebilir. Slot hem
başlangıç ekranında hem de HUD'da aynı adla bulunur.

### CSS custom property'leri
Tüm renk/tipografi değerleri `--og-*` değişkenlerinden okunur ve host bunları
**her zaman ezebilir**: `--og-bg`, `--og-surface`, `--og-primary`,
`--og-accent`, `--og-text`, `--og-radius`, `--og-font`. Oyuna özgü ek değişken:

| Değişken | Ne yapar |
|---|---|
| `--og-octanum-potion` | Şişelerdeki ve kazandaki iksirin rengi |

Dışa açılan `part`'lar: `hud`, `theme-toggle`, `target`, `board`, `card`, `ops`,
`op`, `hint`, `actions`, `log`, `result`, `button`, `lang-picker`.

## Entegrasyon Örneği
```html
<og-octanum></og-octanum>
<script type="module">
  import '@octapull-games/game-octanum';
  const el = document.querySelector('og-octanum');
  el.mode = 'levels';
  el.levelCount = 10;
  el.state = await api.loadState('game-octanum'); // null olabilir
  el.addEventListener('og-state-change', (e) => api.saveState(e.detail.state));
  el.addEventListener('og-level-complete', (e) => ui.toast(`Tam isabet: ${e.detail.score} puan`));
  el.addEventListener('og-level-fail', (e) => ui.toast(`Kaçırıldı: ${e.detail.reason}`));
</script>
```

> Not: Bu bileşen, girdi property'sini kök README sözleşmesindeki (§3.1) adla,
> yani `state` olarak açar (game-octapus, game-octafort ve game-octahang ile
> aynı). Depodaki bazı eski oyunlar (`game-ornek`, `game-hafiza`) bunu
> `gameState` olarak adlandırır; host entegrasyonunda paketin kullandığı ada
> dikkat edin.

## Sözleşme Uyumu
- Çalışma zamanı bağımlılığı yalnızca Lit'tir; ağ erişimi ve yerel depolama
  kullanılmaz (demo sayfasındaki `sessionStorage` yalnızca host taklidi
  içindir).
- Üretim çıktısı: **~100 KB ham / ~32 KB gzip** (Lit ve beş dilli ortak sözlük
  dahil) — 60 KB gzip sınırının altında.
- `disconnectedCallback` içinde rAF, tüm `setTimeout`'lar, `visibilitychange` ve
  `keydown` dinleyicileri temizlenir.
- Süre `performance.now()` ile ölçülür ve sekme arka plana alındığında durur;
  geri dönüldüğünde bitiş anı kalan süre kadar ileri taşınır (§4).
- `prefers-reduced-motion` tercihine saygı gösterilir: kabarcıklar, sarsılma,
  şişe ve panel animasyonları kapanır, sonuç paneli beklemeden açılır.

## Kullanılan Üçüncü Taraf Varlıklar
Yok. Kazan, imbik ve şişe çizimleri projeye özgü olarak yazılmış SVG/CSS
biçimleridir. Kullanılan simgeler (⚗️, ⏳, 🎯, 📏, ⭐, 🌟, 🏆, 💨) Unicode
karakterlerdir. Ses efektleri Web Audio API osilatörleriyle programatik
üretilir, harici ses dosyası kullanılmaz.
