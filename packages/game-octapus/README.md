# game-octapus — Octapus

`og-octapus` etiketiyle kullanılan bir yol bulma (maze) oyunu. Ahtapot
karakteri, ızgara üzerindeki labirentte başlangıç hücresinden bir
gider kapağına (logar) ulaşmaya çalışır.

## Kurallar
- Oyuncu bulunduğu hücreden bir yöne (yatay ya da dikey) tıklar/dokunur;
  ahtapot o yönde, labirent bir karar noktasına ulaşana kadar akıcı
  şekilde kayar (bkz. "Kontroller"). Oyun **hedefe giden yolu kendisi
  bulmaz** — bulmacayı çözmek oyuncuya kalır.
- Labirent çok sayıda çıkmaz sokak içerir: yanlış bir kola girmek mümkündür,
  ama duvardan geçilemeyeceği için oyuncu asla "geçersiz" bir hamle
  yapamaz — sadece geri dönüp doğru yolu bulması gerekir.
- Gider kapağına ulaşınca tur tamamlanır (`og-level-complete`); can/kalp
  mekaniği yoktur, başarı ölçütü hamle sayısı ve süredir.
- Üstteki ilerleme çubuğu, oyuncunun gider kapağına olan labirent-mesafesi
  (grafik mesafesi) üzerinden hesaplanan yakınlığı gösterir.

## Kazanma Animasyonu
Ahtapot gider kapağının hücresine ulaştığı an kontroller kilitlenir
(fare/dokunmatik/klavye girdisi yoksayılır). Ardından sırasıyla: kapak
kendi ekseninde dönüp küçülerek kayar, altından simsiyah bir delik
belirir, ahtapot da küçülüp saydamlaşarak deliğe süzülür. Bu görsel
dizinin toplam süresi ~1.2 saniyedir; bitiminde istatistikler
hesaplanır ve "Tebrikler!" modalı açılır — süre kaydı animasyon değil,
kapağa ulaşılan an baz alınarak tutulur. `prefers-reduced-motion`
açıkken animasyon anında (gecikmesiz) tamamlanır.

## Zorluk Eğrisi
`levelCount` parametresine göre ölçeklenir; labirent kare bir ızgaradır (n×n):
- Seviye 1 → 10×10
- Son seviye → 15×15
- `random` modu → sabit 13×13

Başlangıç ve gider kapağı her turda ızgaranın rastgele iki köşesine
(çapraz karşılıklı) yerleştirilir — aynı köşe çiftinde sabit kalmaz,
turdan tura yer değiştirirler; zorluk boyuttan ve labirentin çıkmaz
sokak yoğunluğundan gelir.

## Üretim Yöntemi
Her labirent, ızgara üzerinde büyüyen bir ağaç (growing-tree) algoritmasıyla
üretilir: başlangıç hücresinden büyüyen bir "sınır" (frontier) kenar
listesinden bir kenar seçilip labirente eklenir. Bu algoritma ızgaranın
bir yayılma ağacını (spanning tree) oluşturur; bu nedenle herhangi iki
hücre arasında **tam olarak bir** yol vardır ve üretilen her labirent
tanım gereği çözülebilirdir — ayrı bir çözücü doğrulaması gerekmez.

Sınırdan hangi kenarın seçileceği moda göre değişir:
- **levels**: tamamen rastgele seçim (randomized Prim's) — kısa, doğrudan
  çözüm yollarına sahip, sığ ve çok sayıda çıkmaz sokak içeren bir doku
  üretir.
- **random**: seçim çoğunlukla en son eklenen kenarı uzatacak şekilde
  yapılır (DFS'e yakın, dead-end-bias ağırlıklı) — daha uzun, dolambaçlı
  koridorlar ve derin çıkmaz sokaklar üretir; yanlış dönüşlerin bedeli
  daha ağırdır.

İsteğe bağlı `seed` özelliği verildiğinde mulberry32 tabanlı tohumlu bir
üreteç kullanılır: aynı seed + aynı seviye her zaman aynı labirenti
üretir (test ve günlük bulmaca senaryosu için).

## Mod Desteği
- **levels**: `levelCount` kadar seviye, boyut orantılanır.
- **random**: Sabit 13×13 labirent, her turda yeni düzen. `bestTimes`
  sözleşmeye uygun olarak tek anahtar (`0`) üzerinden tutulur;
  `currentLevel` kalıcı state'te daima `1`'dir.

## Kontroller
**Fare/dokunmatik (birincil):** Bir hücreye tıklanır/dokunulur; oyuncunun
bulunduğu konuma göre tıklanan hücrenin baskın ekseni (yatay ya da dikey,
hangisinin farkı büyükse) **yön** olarak alınır — tıklanan hücrenin tam
konumu önemli değildir, sadece hangi yöne gitmek istediğinizi belirtir.
Ahtapot o yönde, düz bir koridor boyunca kayar ve labirent bir karar
sunana kadar durmaz:
- **Kavşak** (yol ayrımı — düz gitmenin yanında başka bir açılım daha
  varsa) veya **köşe** (yön zorunlu olarak döndüğünde) → ahtapot orada
  durur, sıradaki yönü seçmek oyuncuya kalır.
- **Çıkmaz sokak** (o yönde ilerleyecek yer kalmadığında) → ahtapot
  duvarın önünde durur.

Bu sayede tek bir tıkla labirenti baştan sona "çözdürmek" mümkün değildir;
her karar noktasında oyuncunun tekrar tıklaması gerekir.

**Klavye (erişilebilirlik):** Ok tuşları veya WASD ile tek hücrelik adım
atılır; boş bir yöne basmak sessizce yoksayılır (hafif bir geri bildirim
animasyonu dışında sonuç doğurmaz).

Odak `Tab` ile oyun tahtasına gelir; `prefers-reduced-motion` tercihine
uyulur (sarsılma ve geçiş animasyonları kapanır, tıkla-yürü hareketi
adım adım beklemeden anında tamamlanır).

## Entegrasyon Örneği
```html
<og-octapus></og-octapus>
<script type="module">
  import '@octapull-games/game-octapus';
  const el = document.querySelector('og-octapus');
  el.mode = 'levels';
  el.levelCount = 10;
  el.state = await api.loadState('game-octapus');
  el.addEventListener('og-state-change', (e) => api.saveState(e.detail.state));
</script>
```

## Kullanılan Üçüncü Taraf Varlıklar
Yok — ahtapot karakteri Unicode emoji'dir (🐙); gider kapağı ise emoji
değil, sıfırdan çizilmiş bir vektör (SVG) ikondur. Ses efektleri Web
Audio API osilatörleriyle programatik üretilir, harici ses dosyası
kullanılmaz.
