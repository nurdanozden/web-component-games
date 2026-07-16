# game-octapus — Octapus

`og-octapus` etiketiyle kullanılan bir yol bulma (maze) oyunu. Ahtapot
karakteri, ızgara üzerindeki labirentte başlangıç hücresinden sağ alt
köşedeki çıkış kapısına ulaşmaya çalışır.

## Kurallar
- Oyuncu bulunduğu hücreden bir yöne (yatay ya da dikey) tıklar/dokunur;
  ahtapot o yönde, labirent bir karar noktasına ulaşana kadar akıcı
  şekilde kayar (bkz. "Kontroller"). Oyun **hedefe giden yolu kendisi
  bulmaz** — bulmacayı çözmek oyuncuya kalır.
- Labirent çok sayıda çıkmaz sokak içerir: yanlış bir kola girmek mümkündür,
  ama duvardan geçilemeyeceği için oyuncu asla "geçersiz" bir hamle
  yapamaz — sadece geri dönüp doğru yolu bulması gerekir.
- Kapıya (🚪) ulaşınca tur tamamlanır (`og-level-complete`); can/kalp
  mekaniği yoktur, başarı ölçütü hamle sayısı ve süredir.
- Üstteki ilerleme çubuğu, oyuncunun kapıya olan labirent-mesafesi
  (grafik mesafesi) üzerinden hesaplanan yakınlığı gösterir.

## Zorluk Eğrisi
`levelCount` parametresine göre ölçeklenir; labirent kare bir ızgaradır (n×n):
- Seviye 1 → 5×5
- Son seviye → 13×13
- `random` modu → sabit 9×9

Başlangıç hep sol üst köşe (0,0), çıkış kapısı hep sağ alt köşedir
(n-1, n-1); zorluk boyuttan ve labirentin çıkmaz sokak yoğunluğundan gelir.

## Üretim Yöntemi
Her labirent, ızgara üzerinde **rastgele Prim algoritması**
(randomized Prim's) ile üretilir: başlangıç hücresinden büyüyen bir
"sınır" (frontier) kenar listesinden rastgele bir kenar seçilip labirente
eklenir. Bu algoritma da (recursive backtracker gibi) ızgaranın bir
yayılma ağacını (spanning tree) oluşturur; bu nedenle herhangi iki hücre
arasında **tam olarak bir** yol vardır ve üretilen her labirent tanım
gereği çözülebilirdir — ayrı bir çözücü doğrulaması gerekmez. DFS tabanlı
üretimden farklı olarak Prim's, tek uzun dolambaçlı bir koridor yerine
çok sayıda kısa çıkmaz sokak ve dallanma noktası üretir; asıl bulmaca
hissini veren de budur.

İsteğe bağlı `seed` özelliği verildiğinde mulberry32 tabanlı tohumlu bir
üreteç kullanılır: aynı seed + aynı seviye her zaman aynı labirenti
üretir (test ve günlük bulmaca senaryosu için).

## Mod Desteği
- **levels**: `levelCount` kadar seviye, boyut orantılanır.
- **random**: Sabit 9×9 labirent, her turda yeni düzen. `bestTimes`
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
Yok — karakter ve kapı işaretleri Unicode emoji'dir (🐙, 🚪); ses
efektleri Web Audio API osilatörleriyle programatik üretilir, harici
ses dosyası kullanılmaz.
