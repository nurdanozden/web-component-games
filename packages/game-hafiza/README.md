# game-hafiza — Hafıza Kartları

`og-hafiza` etiketiyle kullanılan kart eşleştirme oyunu.

## Kurallar
Tahtadaki kapalı kartlar arasında gizlenmiş emoji çiftlerini bul.
Her turda iki kart çevrilir; eşleşirse açık kalır, eşleşmezse kapanır.
Tüm çiftler bulununca seviye tamamlanır.

## Zorluk Eğrisi
`levelCount` parametresine göre ölçeklenir:
- Seviye 1 → 3 çift (6 kart)
- Son seviye → 12 çift (24 kart)

## Üretim Yöntemi
Kart sembolü havuzu (SYMBOL_POOL) 24 emoji içerir; her seviye için
`pairCount` adet sembol rastgele seçilir ve iki kez listeye eklenerek
karıştırılır. İsteğe bağlı `seed` özelliği belirlenirse aynı seed
her zaman aynı kart dizilimini üretir.
Çözülebilirlik: her deste tanım gereği çözülebilirdir (tüm kartlar
birebir eşleşmiş şekilde oluşturulur, yalnızca sırası karıştırılır).

## Mod Desteği
- **levels**: `levelCount` kadar seviye, zorluk orantılanır.
- **random**: Sabit 6 çift, her turda yeni karıştırma.

## Entegrasyon Örneği
```html
<og-hafiza></og-hafiza>
<script type="module">
  import '@octapull-games/game-hafiza';
  const el = document.querySelector('og-hafiza');
  el.mode = 'levels';
  el.levelCount = 10;
  el.gameState = await api.loadState('game-hafiza');
  el.addEventListener('og-state-change', e => api.saveState(e.detail.state));
</script>
```

## Kullanılan Üçüncü Taraf Varlıklar
Yok — tüm semboller Unicode emoji'dir (herhangi bir lisans gerektirmez).
