# Octapull Games

Bu depo (`Octapull/web-component-games`), eğlence amaçlı mini oyun bileşenlerinin geliştirildiği ortak çalışma alanıdır. Her oyun, herhangi bir sayfaya tek bir HTML etiketi ile eklenebilen bağımsız bir web bileşeni (custom element) olarak geliştirilir. Depo tek bir monorepo olarak yönetilir; içinde birden fazla oyun paketi barındırır. Etiket ve değişken adlarında kullanılan `og-` öneki **O**ctapull **G**ames'in kısaltmasıdır.

Bileşenler belirli bir ürüne veya çatıya (framework) bağlı değildir; düz HTML, Angular, React, Vue ya da sunucu taraflı üretilen herhangi bir sayfa içinde aynı biçimde çalışacak şekilde tasarlanır. Bu taşınabilirliği güvence altına alan unsur aşağıdaki sözleşmedir; sözleşmeye uymayan bileşenler gözden geçirme sürecinde iade edilir.

---

## 1. Teknoloji ve Bağımlılık Politikası

- Tek çalışma zamanı bağımlılığı **Lit**'tir. `package.json` içindeki `dependencies` alanında Lit dışında paket bulunamaz.
- Geliştirme bağımlılıkları (TypeScript, Vite/esbuild, ESLint, Prettier, test araçları) serbesttir; bunlar `devDependencies` altında kalır ve üretim paketine dahil edilmez.
- Harici CSS/UI kütüphanesi, animasyon kütüphanesi, fizik motoru vb. kullanılamaz. İhtiyaç duyulan her şey tarayıcının yerleşik API'leri ile yazılır (Canvas, SVG, Web Audio, Pointer Events, requestAnimationFrame).
- İkonlar için izin verilebilir lisanslı açık kaynak ikon setleri (MIT, ISC, Apache-2.0, CC0 vb.) kullanılabilir; ancak çalışma zamanı paketi olarak değil, ihtiyaç duyulan ikonların SVG olarak projeye kopyalanması yoluyla. Kullanılan setin adı ve lisansı oyunun README dosyasına yazılır. Lisansı belirsiz ya da yalnızca "ücretsiz" diye sunulan kaynaklardan varlık alınamaz.
- Ses için harici ses dosyası tercih edilmez; efektler mümkün olduğunca **Web Audio API** ile programatik üretilir. Ses dosyası zorunluysa paket içinde tutulur, toplam 100 KB'ı aşamaz ve base64 olarak gömülmez.
- Her oyunun üretim çıktısı, Lit dahil **gzip sonrası 60 KB'ı** aşmamalıdır.
- Ağ erişimi yasaktır. Bileşen hiçbir koşulda kendi başına HTTP isteği atamaz; veri alışverişi yalnızca aşağıda tanımlanan property/event sözleşmesi üzerinden yapılır.

## 2. Depo Yapısı

```
/
├── packages/
│   ├── core/                # Ortak yardımcılar: taban sınıf, zamanlayıcı, ses, tipler
│   ├── game-ornek/          # Referans oyun (bu yapıyı kopyalayarak başlayın)
│   │   ├── src/
│   │   │   ├── index.ts     # customElements.define çağrısı burada
│   │   │   └── game.ts      # Bileşen sınıfı
│   │   ├── demo/index.html  # Bağımsız çalışan demo sayfası
│   │   ├── package.json
│   │   └── README.md        # Oyunun kuralları ve level tasarımı
│   └── game-<oyun-adi>/
├── docs/                    # Bu sözleşmenin ekleri, tasarım notları
└── package.json             # Workspace tanımı
```

- Her oyun `packages/game-<oyun-adi>` altında ayrı bir paket olarak yaşar.
- Etiket adları `og-` (Octapull Games) öneki ile başlar: `<og-fermuar>`, `<og-hafiza>`, `<og-refleks>` gibi. Önek, ad çakışmalarını önlemek için zorunludur.
- Ortak kod tekrarı görüldüğünde `packages/core` altına taşınır; oyunlar core'a bağımlı olabilir, birbirine bağımlı olamaz.

## 3. Bileşen Sözleşmesi

Her oyun bileşeni aynı arayüzü uygular. Bileşeni barındıran uygulama (bundan sonra "host uygulama") bu arayüz sayesinde hiçbir oyunu özel olarak tanımadan hepsini çalıştırabilir, durumlarını dilediği yerde kalıcılaştırabilir ve kaldığı yerden devam ettirebilir. Host uygulamanın ne olduğu bileşeni ilgilendirmez; bir SaaS paneli, statik bir site veya üçüncü taraf bir uygulama olabilir.

### 3.1 Property'ler (girdi)

Aşağıdaki property'ler host uygulama tarafından JavaScript üzerinden set edilir. Kompleks değerler attribute değil property olarak geçilir.

| Property | Tip | Zorunlu | Açıklama |
|---|---|---|---|
| `mode` | `'levels' \| 'random'` | Evet | `levels`: tanımlı seviyeler sırayla oynanır. `random`: her turda rastgele/üretilmiş bir bölüm gelir, seviye sonu yoktur. |
| `levelCount` | `number` | `levels` modunda | Oyunun kaç seviyesi olduğu. Oyun bu sayıya göre zorluk eğrisini kendi belirler. |
| `state` | `GameState \| null` | Hayır | Önceki oturumdan devam durumu. `null` veya verilmemişse oyun sıfırdan başlar. |
| `muted` | `boolean` | Hayır | Ses açık/kapalı. Varsayılan `false`. |
| `seed` | `number` | Hayır | Rastgelelik tohumu. Verildiğinde aynı seed aynı bölümü üretir (test ve günlük bulmaca senaryosu için). |

### 3.2 `GameState` şeması

Durum nesnesi oyunlar arasında ortaktır. Oyuna özgü ek veriler `extra` alanına konur; kök alanlara oyun özelinde alan eklenemez.

```ts
interface GameState {
  version: 1;                       // Şema sürümü, şimdilik daima 1
  gameId: string;                   // Paket adıyla aynı, ör. "game-fermuar"
  currentLevel: number;             // 1 tabanlı. random modda daima 1
  completedLevels: LevelResult[];   // Tamamlanan her seviyenin kaydı
  bestTimes: Record<number, number>;// seviye -> en iyi süre (ms). random modda tek anahtar: 0
  bestScores?: Record<number, number>; // Puana dayalı oyunlarda seviye -> en yüksek puan
  totalPlayMs: number;              // Toplam oynama süresi
  extra?: Record<string, unknown>;  // Oyuna özgü serbest alan
}

interface LevelResult {
  level: number;
  durationMs: number;
  completedAt: string;              // ISO 8601
  moves?: number;                   // Varsa hamle sayısı
  score?: number;                   // Puana dayalı oyunlarda tur puanı
}
```

Bileşen kendisine verilen `state` nesnesini **mutasyona uğratmaz**; her değişiklikte yeni bir nesne üretir ve event ile dışarı bildirir. Durumun kalıcılaştırılması tamamen host uygulamanın sorumluluğudur; bileşen localStorage dahil hiçbir yerel depolama kullanmaz.

### 3.3 Event'ler (çıktı)

Tüm event'ler `CustomEvent` olarak, `bubbles: true, composed: true` ile fırlatılır. İsimler ve `detail` şemaları sabittir; oyunlar yeni event ekleyebilir ancak buradakileri değiştiremez.

| Event | `detail` | Ne zaman |
|---|---|---|
| `og-ready` | `{ gameId }` | Bileşen yüklendi, girdiler işlendi, oynanabilir durumda. |
| `og-level-start` | `{ gameId, level, startedAt }` | Bir seviye/tur fiilen başladığında (ilk kullanıcı etkileşimi). |
| `og-level-complete` | `{ gameId, level, durationMs, moves?, score?, isBest }` | Seviye/tur başarıyla bittiğinde. |
| `og-level-fail` | `{ gameId, level, reason }` | Başarısızlıkla bittiğinde (süre doldu, canlar bitti vb.). Uygulanabilirse. |
| `og-game-complete` | `{ gameId, totalMs }` | `levels` modunda son seviye tamamlandığında. |
| `og-state-change` | `{ gameId, state: GameState }` | Kalıcılaştırılması gereken her durum değişikliğinde. |

`og-state-change` bu sözleşmenin en kritik parçasıdır: host uygulama bu event'i dinleyip `detail.state` nesnesini kendi seçtiği yerde (veritabanı, dosya, tarayıcı deposu vb.) kalıcılaştırır, sonraki oturumda aynı nesneyi `state` property'sine geri verir. Doğrulama ölçütü şudur: bileşen sayfadan kaldırılıp son yayınlanan state ile yeniden eklendiğinde, kullanıcı kaldığı seviyeden ve kaldığı skorlarla devam edebilmelidir.

### 3.4 Örnek entegrasyon

```html
<og-fermuar></og-fermuar>
<script type="module">
  const el = document.querySelector('og-fermuar');
  el.mode = 'levels';
  el.levelCount = 10;
  el.state = await api.loadState('game-fermuar'); // null olabilir

  el.addEventListener('og-state-change', (e) => api.saveState(e.detail.state));
  el.addEventListener('og-level-complete', (e) => ui.toast(`Seviye ${e.detail.level}: ${e.detail.durationMs} ms`));
</script>
```

## 4. Süre Ölçümü ve Skor Kuralları

- Süre, seviyedeki **ilk kullanıcı etkileşimiyle** başlar; sayfanın veya bileşenin yüklenmesiyle değil.
- Ölçüm `performance.now()` ile milisaniye hassasiyetinde yapılır; gösterimde saniyeye yuvarlanabilir, event'lerde ham milisaniye gönderilir.
- Sekme arka plana alındığında (`visibilitychange`) sayaç durdurulur, geri dönüldüğünde devam eder.
- `bestTimes` yalnızca başarıyla tamamlanan turlarda güncellenir ve yalnızca önceki en iyiden düşükse değişir.
- Süre tek başarı ölçütü değildir. Puana dayalı oyunlar (refleks, hafıza, kelime vb.) `score` alanını kullanır; `bestScores` yalnızca önceki en yüksekten büyükse güncellenir. Bir oyun süre, puan veya ikisini birden raporlayabilir; hangisini kullandığını kendi README dosyasında belirtir.

## 5. Oyun Türleri ve Level Tasarımı

Oyun türü serbesttir: yol/çizgi bulmacaları, ızgara doldurma, eşleştirme, hafıza, refleks ve beceri, kelime oyunları ya da bambaşka bir fikir olabilir. Ölçüt tür değil, bu dokümandaki sözleşmeye uyumdur.

- `levels` modunda zorluk `levelCount` üzerinden orantılanır; seviye verisi koda gömülü sabit listeler yerine mümkünse parametrik/prosedürel üretilir.
- `random` modunda her tur bağımsızdır; tur bitince bileşen yeni bir tur üretmeye hazır hale gelir ve bunu arayüzünde belli eder ("Yeni bölüm" gibi).
- Prosedürel üretim yapan oyunlar **çözülebilirliği garanti etmek** zorundadır: bölüm, bilinen bir çözümden geriye doğru üretilir ya da üretim sonrası çözücüyle doğrulanır. Çözümsüz bölüm üretme ihtimali olan yaklaşım kabul edilmez.
- Her oyunun kendi `README.md` dosyasında kurallar, zorluk eğrisi ve üretim yöntemi kısaca belgelenir.

## 6. Görsel Özelleştirme

Bileşenler, içine yerleştirildikleri sayfanın temasına uyum sağlayabilmelidir; renk ve tipografi değerleri koda sabitlenmez.

- Tüm renk, yazı tipi ve yarıçap değerleri **CSS custom property** üzerinden okunur ve makul bir varsayılan içerir: `var(--og-surface, #f4f7fb)` gibi.
- Ortak değişken adları core pakette tanımlıdır ve tüm oyunlarda aynıdır: `--og-bg`, `--og-surface`, `--og-primary`, `--og-accent`, `--og-text`, `--og-radius`, `--og-font`. Oyuna özgü değişkenler `--og-<oyun>-` önekiyle eklenebilir.
- Dış stillendirmeye açılması anlamlı iç parçalara `part` verilir (`part="board"`, `part="hud"`, `part="button"`); host sayfa `og-fermuar::part(board)` seçicisiyle müdahale edebilmelidir.
- Bileşen kök düzeyde sabit genişlik dayatmaz; konulduğu kapsayıcının genişliğine uyar ve 320 px'e kadar sorunsuz çalışır.

## 7. Erişilebilirlik ve Kalite Ölçütleri

Bir oyunun "tamamlandı" sayılması için asgari koşullar:

1. Fare, dokunmatik ekran ve mümkün olduğunca klavye ile oynanabilir olması (Pointer Events kullanılır, `touch-action` doğru ayarlanır).
2. `prefers-reduced-motion` tercihine saygı gösterilmesi.
3. Odak görünürlüğü ve etkileşimli öğelerde erişilebilir adlandırma (`aria-label`).
4. `demo/index.html` sayfasının hiçbir sunucuya ihtiyaç duymadan, build sonrası tek başına çalışması.
5. Sözleşmedeki tüm event'lerin doğru sırada ve doğru şemayla yayınlandığını gösteren temel testlerin bulunması.
6. Konsolda hata ve uyarı bırakılmaması; `disconnectedCallback` içinde zamanlayıcı ve dinleyicilerin temizlenmesi.

## 8. Fikri Haklar ve Lisans Uyumu

Bu bölümdeki kurallar tartışmaya kapalıdır; tereddüt edilen her durumda geliştirme başlamadan önce proje sorumlusuna danışılır.

- Oyunlar özgün tasarımlardır. Klasik ve yaygın bulmaca/oyun mekaniklerinden (yol çizme, eşleştirme, ızgara doldurma, hafıza, kelime türetme vb.) yararlanılabilir; ancak piyasadaki belirli bir ticari oyunun kural seti, görsel dili, seviye kurgusu ve genel deneyimini bir bütün olarak yeniden üreten çalışmalar kabul edilmez. Ölçüt şudur: oyunu gören bir kullanıcının aklına belirli bir ticari ürün geliyorsa tasarım yeterince özgün değildir ve revize edilir.
- Mevcut oyunların ve markaların adları, logoları, karakterleri, görsel varlıkları, ses dosyaları ve metinleri hiçbir biçimde kullanılamaz, kopyalanamaz, çağrıştıracak şekilde taklit edilemez.
- Her oyuna özgün bir ad verilir; arayüz görselleri ekip tarafından sıfırdan tasarlanır.
- Depoya yalnızca ekip tarafından üretilmiş veya lisansı açıkça izin veren (MIT, CC0, Apache-2.0 vb.) üçüncü taraf varlıklar eklenir. Lisanslı, tescilli, kaynağı veya lisansı belirsiz hiçbir varlık (görsel, ses, font, ikon, kod parçası) depoya giremez; "internette açık duruyordu" kullanım hakkı doğurmaz. Kullanılan her üçüncü taraf varlığın kaynağı ve lisansı oyunun README dosyasında listelenir.
- Yapay zekâ araçlarıyla üretilen varlıklar dahil, kökeni doğrulanamayan içerikler için de aynı özen gösterilir; şüpheli varlık kullanılmaz.

## 9. Katkı Süreci

- Her oyun kendi dalında geliştirilir: `game/<oyun-adi>`.
- Ana dala doğrudan push yapılmaz; birleştirme yalnızca onaylanmış pull request ile olur.
- PR açıklamasında: oyunun kısa tanımı, sözleşme maddelerinin karşılandığına dair kontrol listesi ve demo ekran kaydı/görüntüsü bulunur.
- Kod gözden geçirmede öncelik sırası: sözleşme uyumu, durum yönetiminin doğruluğu (kaydet/geri yükle senaryosu), paket boyutu, kod okunabilirliği.

## 10. Başlarken

```bash
npm install
npm run dev --workspace=packages/game-ornek   # Referans oyunu çalıştırır
```

Yeni oyuna başlarken `packages/game-ornek` kopyalanır, paket adı ve etiket adı güncellenir, oyunun README dosyası doldurulur. Sorular için önce bu doküman, ardından `docs/` klasörü kontrol edilir; yanıt bulunamazsa proje sorumlusuna danışılır.
