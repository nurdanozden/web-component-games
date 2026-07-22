# game-octafort — Octafort

`og-octafort` etiketiyle kullanılan bir mantık/çıkarım bulmacası. Oyuncu,
renklerle ayrılmış bir güvenlik şebekesine **Siber-Kale Kuleleri** (🏰)
yerleştirerek tüm ağı, hiçbir savunma sinyali çakışmadan koruma altına alır.

## Amaç
`N×N` ızgaraya, aşağıdaki kuralları aynı anda sağlayacak şekilde tam olarak
`N` adet Kule yerleştirmek.

## Kurallar
1. **Satır:** Her satırda tam olarak 1 Kule bulunur.
2. **Sütun:** Her sütunda tam olarak 1 Kule bulunur.
3. **Güvenlik Sektörü (Avlu):** Grid, surlarla ayrılmış `N` adet renkli sektöre
   bölünür; her sektörde tam olarak 1 Kule bulunur.
4. **Temas / Sinyal Çakışması Yasağı:** İki Kule asla birbirine değemez — yatay,
   dikey **ve çapraz** komşuluk dahil. Yani bir Kulenin etrafındaki 8 karenin
   hiçbirine başka bir kule kurulamaz.

Bu kurallar birlikte, her tahtanın tek bir mantıksal çözümü olacak şekilde
tasarlanır (bkz. "Üretim Yöntemi"); bulmaca tahmin gerektirmeden, eleme
yoluyla çözülebilir.

## Kontroller
İşaretleme, olasılıkları eleyerek çözmeyi kolaylaştıran üç durumlu bir döngüdür.
Bir hücreye her dokunuş bir sonraki duruma geçer:

| Dokunuş | Durum | Anlamı |
|---|---|---|
| 1. | **✕ Sur** | "Buraya kesinlikle kule kurulamaz" (güvenli eleme) |
| 2. | **🏰 Kule** | Hücreye Siber-Kale Kulesi yerleştirir |
| 3. | **(boş)** | Hücreyi sıfırlar |

- **Fare / dokunmatik (birincil):** Bir hücreye dokunmak durumları sırayla
  değiştirir.
- **Klavye (erişilebilirlik):** `Tab` ile tahtaya odaklanılır; **ok tuşları**
  veya **WASD** ile imleç gezdirilir; **Boşluk** ya da **Enter** o hücrenin
  durumunu değiştirir (gezinme, hareketli imleç / roving tabindex ile yönetilir).
- **Sıfırla** düğmesi tahtadaki tüm işaretleri temizler (bulmaca değişmez).

### Eleme yardımı (Çapraz Eleme Mantığı)
Bir Kule yerleştirildiği anda; bulunduğu satır, sütun ve güvenlik sektöründeki
tüm boş kareler ile etrafındaki 8 komşu kare **"artık kule olamaz"** olarak
soluk bir noktayla işaretlenir. Bu yalnızca görsel bir yardımdır; oyuncunun
kendi ✕ işaretlerinin yerini tutmaz, sadece bir sonraki çıkarımı kolaylaştırır.

### Hata bildirimi
Bir kural ihlal edilirse (aynı satır/sütun/sektörde ikinci kule ya da birbirine
değen kuleler), çakışan kuleler **kırmızı neon** ile vurgulanır ve tahta hafifçe
sarsılır. Oyuncu yanlış kuleyi tekrar dokunarak kaldırabilir.

### Kazanma Koşulu
Tahtada tam olarak `N` kule varken ve **hiçbir çakışma yokken** tur tamamlanır.
`N` çakışmasız kule, dört kuralın hepsinin sağlandığı anlamına gelir. Kazanınca
kuleler neon ışıkla parlar ve `og-level-complete` yayınlanır; can/kalp mekaniği
yoktur, başarı ölçütü **süre** ve **hamle** sayısıdır.

## Zorluk Eğrisi
`levelCount` parametresine göre ölçeklenir; tahta kare bir ızgaradır (n×n):
- Seviye 1 → 5×5
- Son seviye → 9×9
- `random` modu → sabit 8×8

Zorluk hem boyuttan hem de sektör şekillerinden gelir; büyük ızgaralarda çıkarım
zinciri uzar.

## Üretim Yöntemi
Her bulmaca **bilinen bir çözümden geriye doğru** üretilir; bu, sözleşmenin
çözülebilirlik garantisini (README §5) yapısal olarak sağlar:

1. **Temel çözüm:** Geri izlemeli (backtracking) arama ile, her satır ve
   sütunda bir kule olan ve hiçbiri birbirine değmeyen bir yerleşim bulunur.
   (Bir satır/sütunda tek kule olduğundan iki kule ancak **ardışık** satırlarda
   değebilir; bu yüzden komşu satırların sütunları en az 2 fark eder.)
2. **Sektörler:** Her kule bir "tohum" alınıp, rastgele çok-kaynaklı taşma
   (flood fill) ile sektörler büyütülür. Böylece her sektör bağlantılıdır ve
   içinde tam olarak bir çözüm-kulesi bulunur → "sektör başına 1 kule" kuralı
   tanım gereği sağlanabilir.
3. **Teklik doğrulaması:** Bir çözücü (aynı kısıtlarla satır satır backtracking)
   üretilen tahtayı sayar; **yalnızca tek çözümü olan** tahtalar kabul edilir,
   aksi halde sektörler yeniden büyütülür / yeni temel çözüm denenir. Bütçe
   dolarsa çözülebilir (ama tek olmayabilecek) son tahtaya düşülür — sözleşme
   çözülebilirliği zorunlu kılar, teklik ise üstüne eklenen kalite ölçütüdür.

İsteğe bağlı `seed` özelliği verildiğinde mulberry32 tabanlı tohumlu bir üreteç
kullanılır: aynı seed + aynı seviye her zaman aynı bulmacayı üretir (test ve
günlük bulmaca senaryosu için).

## Mod Desteği
- **levels:** `levelCount` kadar seviye, boyut orantılanır.
- **random:** Sabit 8×8, her turda yeni düzen. `bestTimes` sözleşmeye uygun
  olarak tek anahtar (`0`) üzerinden tutulur; `currentLevel` kalıcı state'te
  daima `1`'dir.

## Görsel Özelleştirme ve Gömme (Modal)
Bileşen **bağımsız, kendi kendine yeten bir kutudur**: kendi dış arka planını
zorlamaz, tam ekran kaplamaz ve konduğu kapsayıcının (panel, pop-up, modal)
genişliğine uyar. Bir Octapull modalının içine doğrudan yerleştirilebilir; dış
kenar boşluğunu ve sayfa arka planını host sayfa yönetir. Kazanma ekranı bile
`position: fixed` değil, bileşenin **kendi kutusu içinde** (`absolute`) açılır —
yani host modalın dışına taşan ikinci bir tam-ekran katman oluşmaz.

### Tema (`theme` parametresi)
Bileşen, açık ve koyu için hazır dahili bir palet taşır; host sayfa hiçbir şey
tanımlamadan da doğru görünür:

```html
<og-octafort theme="dark"></og-octafort>  <!-- varsayılan -->
<og-octafort theme="light"></og-octafort>
```

`theme` özelliği yansıtılır (`reflect`), böylece CSS'te `og-octafort[theme="light"]`
ile de hedeflenebilir. Palet, `:host([theme="light"])` / `:host` kuralları üzerinden
dahili değişkenlerle değişir.

### CSS custom property'leri
Tüm renk/tipografi değerleri `--og-*` değişkenlerinden okunur ve host bunları
**her zaman ezebilir** (host'un verdiği değer, `theme` paletinin önüne geçer):
`--og-bg`, `--og-surface`, `--og-primary`, `--og-accent`, `--og-text`,
`--og-radius`, `--og-font`. Oyuna özgü ek değişken: `--og-octafort-wall` —
sektörleri ayıran sur (rampart) çizgilerinin rengi (koyu temada varsayılan
neon camgöbeği `#6fe3ff`). Dışa açılan `part`'lar:
`hud`, `board`, `modal`, `button`. Sektör dolgu renkleri, bulmacanın ayrılmaz
bir parçası olduğu için altın-açı (golden-angle) hue dizisiyle programatik
üretilir ve her iki temada da okunur.

## Entegrasyon Örneği
```html
<og-octafort></og-octafort>
<script type="module">
  import '@octapull-games/game-octafort';
  const el = document.querySelector('og-octafort');
  el.mode = 'levels';
  el.levelCount = 10;
  el.state = await api.loadState('game-octafort'); // null olabilir
  el.addEventListener('og-state-change', (e) => api.saveState(e.detail.state));
</script>
```

> Not: Bu bileşen, girdi property'sini kök README sözleşmesindeki (§3.1) adla,
> yani `state` olarak açar (game-octapus ile aynı). Depodaki bazı eski oyunlar
> (`game-ornek`, `game-hafiza`) bunu `gameState` olarak adlandırır; host
> entegrasyonunda paketin kullandığı ada dikkat edin.

## Kullanılan Üçüncü Taraf Varlıklar
Yok — kule ve sur işaretleri Unicode karakterlerdir (🏰, ✕, 🏆); ses efektleri
Web Audio API osilatörleriyle programatik üretilir, harici ses dosyası
kullanılmaz.
