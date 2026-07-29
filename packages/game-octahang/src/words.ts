/**
 * Kelime havuzu — her kayıt bir kelime, onun ipucu ve zorluk katmanından oluşur.
 *
 * Havuz dört katmana ayrılır ve `levels` modu bu katmanları sırayla dolaşır:
 * ilk turlar ısınma niteliğinde tanıdık sözcüklerdir, son turlar edebî ve
 * bilimsel terimlere kadar çıkar. Böylece oyuncu daha ilk turda duvara
 * toslamaz ama sonuna doğru gerçekten zorlanır.
 *
 * Kurallar:
 * - Kelimeler daima Türkçe büyük harfle ve yalnızca ALPHABET içindeki 29 harfle
 *   yazılır (boşluk, tire, rakam, şapkalı harf yok). Böylece klavye ile birebir
 *   eşleşir.
 * - İpucu, kelimenin kendisini içermez.
 * - En kısa kelime 5 harflidir.
 * - Üst katmanlarda ipucu tanım değil tariftir; oyuncunun düşünmesi beklenir.
 */

/** 1: kolay · 2: orta · 3: zor · 4: çok zor. Seviye ilerledikçe katman yükselir. */
export type Tier = 1 | 2 | 3 | 4;

export interface WordEntry {
  /** Türkçe büyük harfle yazılmış hedef kelime. */
  word: string;
  /** Oyuncuya gösterilen ipucu. */
  hint: string;
  tier: Tier;
}

/** Türk alfabesindeki 29 harf, alfabetik sırayla. */
export const ALPHABET = 'ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ';

export const WORDS: WordEntry[] = [
  // ── Katman 1 · Kolay ────────────────────────────────────────────────────
  // Isınma turu: tanıdık, somut sözcükler; ipuçları doğrudan tanım verir.
  { word: 'BULUT', hint: 'Gökyüzünde süzülür, yağmuru taşır', tier: 1 },
  { word: 'ORMAN', hint: 'Ağaçlarla kaplı geniş alan', tier: 1 },
  { word: 'YILDIZ', hint: 'Geceleri gökyüzünde parlar', tier: 1 },
  { word: 'YAĞMUR', hint: 'Buluttan damla damla düşer', tier: 1 },
  { word: 'ŞİMŞEK', hint: 'Gök gürültüsünden hemen önce çakar', tier: 1 },
  { word: 'VOLKAN', hint: 'Lav püskürten dağ', tier: 1 },
  { word: 'OKYANUS', hint: 'Kıtaları ayıran en büyük su kütlesi', tier: 1 },
  { word: 'GEZEGEN', hint: 'Bir yıldızın çevresinde dolanan gök cismi', tier: 1 },
  { word: 'PAPATYA', hint: 'Beyaz yapraklı, sarı göbekli çiçek', tier: 1 },
  { word: 'KAKTÜS', hint: 'Dikenli, susuzluğa dayanıklı bitki', tier: 1 },
  { word: 'AHTAPOT', hint: 'Sekiz kollu deniz canlısı', tier: 1 },
  { word: 'KELEBEK', hint: 'Tırtılken kanatlanan böcek', tier: 1 },
  { word: 'ÖRÜMCEK', hint: 'Ağ kuran, sekiz bacaklı canlı', tier: 1 },
  { word: 'PENGUEN', hint: 'Uçamayan, buzda yaşayan kuş', tier: 1 },
  { word: 'ZÜRAFA', hint: 'Boynu en uzun kara hayvanı', tier: 1 },
  { word: 'SİNCAP', hint: 'Fındık toplayan, kabarık kuyruklu', tier: 1 },
  { word: 'TİMSAH', hint: 'Suda yaşayan, güçlü çeneli sürüngen', tier: 1 },
  { word: 'BAYKUŞ', hint: 'Geceleri avlanan, iri gözlü kuş', tier: 1 },
  { word: 'BALİNA', hint: 'Denizlerin en büyük memelisi', tier: 1 },
  { word: 'KAPLUMBAĞA', hint: 'Sırtında kabuğunu taşıyan yavaş canlı', tier: 1 },
  { word: 'KARPUZ', hint: 'Yazın sevilen, içi kırmızı iri meyve', tier: 1 },
  { word: 'ZEYTİN', hint: 'Kahvaltı sofrasının siyah ya da yeşil tanesi', tier: 1 },
  { word: 'MAKARNA', hint: 'Kaynar suda haşlanan hamur işi', tier: 1 },
  { word: 'BAKLAVA', hint: 'Kat kat yufkadan yapılan şerbetli tatlı', tier: 1 },
  { word: 'DONDURMA', hint: 'Yazın külahta yenen soğuk tatlı', tier: 1 },
  { word: 'ÇİKOLATA', hint: 'Kakaodan yapılan tatlı', tier: 1 },
  { word: 'PATLICAN', hint: 'Mor kabuklu sebze', tier: 1 },
  { word: 'SALATALIK', hint: 'Yeşil, ince uzun, salataların vazgeçilmezi', tier: 1 },
  { word: 'MANDALİNA', hint: 'Kabuğu kolay soyulan turunçgil', tier: 1 },
  { word: 'ŞEMSİYE', hint: 'Yağmurda başının üstünde açılır', tier: 1 },
  { word: 'MERDİVEN', hint: 'Basamak basamak çıkılır', tier: 1 },
  { word: 'PENCERE', hint: 'Duvardaki camlı açıklık', tier: 1 },
  { word: 'TENCERE', hint: 'Yemek pişirilen derin kap', tier: 1 },
  { word: 'ANAHTAR', hint: 'Kilidi açan küçük metal parça', tier: 1 },
  { word: 'SANDALYE', hint: 'Arkalığı olan, üzerine oturulan mobilya', tier: 1 },
  { word: 'BUZDOLABI', hint: 'Yiyecekleri soğuk tutan ev aleti', tier: 1 },
  { word: 'ÇAYDANLIK', hint: 'İki katlı, çay demlenen kap', tier: 1 },
  { word: 'BİSİKLET', hint: 'İki tekerlekli, pedal çevrilen taşıt', tier: 1 },
  { word: 'DENİZALTI', hint: 'Suyun altında ilerleyen taşıt', tier: 1 },
  { word: 'HELİKOPTER', hint: 'Pervanesi üstünde dönen hava aracı', tier: 1 },
  { word: 'ASTRONOT', hint: 'Uzaya giden kişi', tier: 1 },
  { word: 'TELESKOP', hint: 'Uzak gök cisimlerini yakınlaştıran alet', tier: 1 },
  { word: 'MİKROSKOP', hint: 'Çok küçük şeyleri büyüten alet', tier: 1 },
  { word: 'PUSULA', hint: 'İğnesi kuzeyi gösteren yön aracı', tier: 1 },
  { word: 'KLAVYE', hint: 'Harflerin dizili olduğu giriş aygıtı', tier: 1 },
  { word: 'ORKESTRA', hint: 'Birçok çalgıcının birlikte çaldığı topluluk', tier: 1 },
  { word: 'KÜTÜPHANE', hint: 'Kitapların ödünç alındığı yer', tier: 1 },
  { word: 'ÖĞRETMEN', hint: 'Sınıfta ders anlatan kişi', tier: 1 },
  { word: 'BASKETBOL', hint: 'Potaya top atılan takım sporu', tier: 1 },
  { word: 'HARİTA', hint: 'Yerlerin küçültülerek çizilmiş hâli', tier: 1 },
  { word: 'GÜNEŞ', hint: 'Gündüzü aydınlatan, gökyüzündeki ateş topu', tier: 1 },
  { word: 'GÖKKUŞAĞI', hint: 'Yağmur durunca gökte beliren yedi renkli yay', tier: 1 },
  { word: 'MAĞARA', hint: 'Dağın içine doğru uzanan karanlık oyuk', tier: 1 },
  { word: 'ŞELALE', hint: 'Suyun kayadan aşağı gürleyerek döküldüğü yer', tier: 1 },
  { word: 'NEHİR', hint: 'Denize doğru akan büyük akarsu', tier: 1 },
  { word: 'BUZUL', hint: 'Yıllar içinde birikip yavaşça akan dev buz kütlesi', tier: 1 },
  { word: 'DEPREM', hint: 'Yerin altından gelen sarsıntı', tier: 1 },
  { word: 'KARDELEN', hint: 'Karlar erimeden açan ilk çiçek', tier: 1 },
  { word: 'AYÇİÇEĞİ', hint: 'Başını gün boyu ışığa çeviren sarı tarla bitkisi', tier: 1 },
  { word: 'ORKİDE', hint: 'Saksıda özenle bakılan zarif çiçek', tier: 1 },
  { word: 'ÇINAR', hint: 'Gövdesi kalın, gölgesi geniş uzun ömürlü ağaç', tier: 1 },
  { word: 'KAVAK', hint: 'İnce uzun, yaprakları hışırdayan ağaç', tier: 1 },
  { word: 'MANTAR', hint: 'Şapkalı, nemli toprakta biten canlı', tier: 1 },
  { word: 'TAVŞAN', hint: 'Uzun kulaklı, zıplayarak koşan hayvan', tier: 1 },
  { word: 'TİLKİ', hint: 'Kurnazlığıyla anılan kızıl kuyruklu hayvan', tier: 1 },
  { word: 'GEYİK', hint: 'Başında dallanan boynuz taşıyan orman hayvanı', tier: 1 },
  { word: 'KİRPİ', hint: 'Sırtı dikenli, tehlikede top olan hayvan', tier: 1 },
  { word: 'KARINCA', hint: 'Kendinden ağır yükü yuvasına taşıyan minik böcek', tier: 1 },
  { word: 'PAPAĞAN', hint: 'Duyduğu sözü yineleyen renkli kuş', tier: 1 },
  { word: 'LEYLEK', hint: 'Uzun bacaklı, bacaya yuva kuran göçmen kuş', tier: 1 },
  { word: 'KARTAL', hint: 'Yükseklerden avını seçen yırtıcı kuş', tier: 1 },
  { word: 'KURBAĞA', hint: 'Vıraklayan, sıçrayarak ilerleyen su canlısı', tier: 1 },
  { word: 'YENGEÇ', hint: 'Yan yan yürüyen, kıskaçlı deniz canlısı', tier: 1 },
  { word: 'YUNUS', hint: 'Sürüler hâlinde yüzen, zeki deniz memelisi', tier: 1 },
  { word: 'SALYANGOZ', hint: 'Evini sırtında taşıyan, iz bırakarak süzülen canlı', tier: 1 },
  { word: 'MERCAN', hint: 'Sıcak denizlerde renkli resifler kuran canlı', tier: 1 },
  { word: 'KİRAZ', hint: 'Sapından çift çift toplanan kırmızı meyve', tier: 1 },
  { word: 'ÇİLEK', hint: 'Üzeri minik tohumlarla kaplı kırmızı meyve', tier: 1 },
  { word: 'PORTAKAL', hint: 'Kabuğu kalın, suyu sıkılan turunçgil', tier: 1 },
  { word: 'DOMATES', hint: 'Salçası yapılan kırmızı sebze', tier: 1 },
  { word: 'HAVUÇ', hint: 'Turuncu, toprak altında yetişen kök sebze', tier: 1 },
  { word: 'PATATES', hint: 'Topraktan çıkarılan, kızartılan yumru', tier: 1 },
  { word: 'ISPANAK', hint: 'Yeşil yapraklı, demir deposu sebze', tier: 1 },
  { word: 'PEYNİR', hint: 'Sütten yapılan, kahvaltının beyazı', tier: 1 },
  { word: 'SİMİT', hint: 'Susama bulanmış, halka biçiminde fırın ürünü', tier: 1 },
  { word: 'LOKUM', hint: 'Pudra şekerine bulanmış yumuşak tatlı', tier: 1 },
  { word: 'KURABİYE', hint: 'Çayın yanında kırılan, fırında pişmiş küçük tatlı', tier: 1 },
  { word: 'BATTANİYE', hint: 'Üşümemek için üstüne çekilen kalın örtü', tier: 1 },
  { word: 'DEFTER', hint: 'Notların tutulduğu, çizgili sayfalardan oluşan', tier: 1 },
  { word: 'TELEFON', hint: 'Uzaktakiyle konuşmayı sağlayan aygıt', tier: 1 },
  { word: 'BİLGİSAYAR', hint: 'Ekranı ve klavyesiyle çalışan elektronik aygıt', tier: 1 },
  { word: 'FOTOĞRAF', hint: 'Makineyle çekilip dondurulmuş görüntü', tier: 1 },
  { word: 'OTOBÜS', hint: 'Duraklardan yolcu alan büyük taşıt', tier: 1 },
  { word: 'TRAMVAY', hint: 'Şehrin içinde raylar üzerinde giden taşıt', tier: 1 },
  { word: 'UÇURTMA', hint: 'İpine tutunup rüzgarda yükselen kağıt oyuncak', tier: 1 },
  { word: 'SALINCAK', hint: 'Parkta ileri geri sallanan oyuncak', tier: 1 },
  { word: 'VOLEYBOL', hint: 'Filenin üstünden topun aşırıldığı takım sporu', tier: 1 },
  { word: 'GİTAR', hint: 'Altı teli parmakla çalınan çalgı', tier: 1 },
  { word: 'KEMAN', hint: 'Yayla çalınan dört telli çalgı', tier: 1 },
  { word: 'PİYANO', hint: 'Siyah beyaz tuşlarına basılarak çalınan çalgı', tier: 1 },

  // ── Katman 2 · Orta ─────────────────────────────────────────────────────
  // Tanıdık ama ilk denemede akla gelmeyen sözcükler.
  { word: 'KUYTU', hint: 'Göze çarpmayan, ıssız köşe', tier: 2 },
  { word: 'ŞAFAK', hint: 'Güneş görünmeden önce ufkun ağarması', tier: 2 },
  { word: 'HÜZÜN', hint: 'Sebebi tam söylenemeyen ağır duygu', tier: 2 },
  { word: 'FİDYE', hint: 'Kaçırılan kişinin geri verilmesi için istenen bedel', tier: 2 },
  { word: 'TENHA', hint: 'Kalabalığın çekildiği, boşalmış yer', tier: 2 },
  { word: 'SEDEF', hint: 'İstiridye kabuğunun parlak iç katmanı', tier: 2 },
  { word: 'GİRDAP', hint: 'Suyun kendi çevresinde dönerek içine çektiği yer', tier: 2 },
  { word: 'ZİFİRİ', hint: 'Karanlığın göz gözü görmeyen en koyusu', tier: 2 },
  { word: 'ANAFOR', hint: 'Akıntının ters yöne kıvrıldığı çalkantı', tier: 2 },
  { word: 'ZÜMRÜT', hint: 'Yeşilin en pahalı taşı', tier: 2 },
  { word: 'IŞILTI', hint: 'Titrek, hafif parıltı', tier: 2 },
  { word: 'ÇIĞLIK', hint: 'Korkunun boğazdan çıkan keskin sesi', tier: 2 },
  { word: 'TAKINTI', hint: 'Zihinden bir türlü sökülemeyen düşünce', tier: 2 },
  { word: 'ÖNYARGI', hint: 'Tanımadan verilmiş peşin hüküm', tier: 2 },
  { word: 'TESELLİ', hint: 'Acısı olana söylenen avutucu söz', tier: 2 },
  { word: 'BEREKET', hint: 'Azalmadan çoğalan bolluk', tier: 2 },
  { word: 'YADİGAR', hint: 'Gidenden geriye kalan, saklanan nesne', tier: 2 },
  { word: 'SAĞDUYU', hint: 'Abartıya kaçmayan sağlıklı akıl', tier: 2 },
  { word: 'NİLÜFER', hint: 'Suyun yüzeyinde açan, kökü dipte olan çiçek', tier: 2 },
  { word: 'SEMAVER', hint: 'Kömürüyle suyu kaynatan, musluklu çay kabı', tier: 2 },
  { word: 'MASKARA', hint: 'Gülünç duruma düşürülen, alay konusu olan', tier: 2 },
  { word: 'GÖZDAĞI', hint: 'Korkutmak için verilen üstü kapalı tehdit', tier: 2 },
  { word: 'YELKOVAN', hint: 'Kadranda hızlı dönen, uzun olanı', tier: 2 },
  { word: 'KIVILCIM', hint: 'Büyük yangının minicik başlangıcı', tier: 2 },
  { word: 'LABİRENT', hint: 'Çıkışı bulunamayan yollar ağı', tier: 2 },
  { word: 'BAŞYAPIT', hint: 'Bir sanatçının aşamadığı en büyük eseri', tier: 2 },
  { word: 'HÜKÜMDAR', hint: 'Tahtta oturan, sözü kanun olan kişi', tier: 2 },
  { word: 'DEMİRBAŞ', hint: 'Kurumda yeri sabit, listeye kayıtlı eşya', tier: 2 },
  { word: 'MÜCEVHER', hint: 'Kasada saklanan, taşı kıymetli süs', tier: 2 },
  { word: 'TEDİRGİN', hint: 'İçine kurt düşmüş, huzuru kaçmış', tier: 2 },
  { word: 'TASTAMAM', hint: 'Eksiksiz, tam olarak öyle', tier: 2 },
  { word: 'YALINAYAK', hint: 'Ayakkabısız, çıplak ayakla', tier: 2 },
  { word: 'KARANTİNA', hint: 'Bulaşma riski için ayrı tutulma dönemi', tier: 2 },
  { word: 'MİRASYEDİ', hint: 'Babadan kalanı hızla eritip bitiren', tier: 2 },
  { word: 'KUŞKONMAZ', hint: 'Adı bir kuşu reddeder, kendisi ince yeşil bir sebzedir', tier: 2 },
  { word: 'DOĞAÇLAMA', hint: 'Hazırlıksız, o anda uydurarak yapma', tier: 2 },
  { word: 'TAHTEREVALLİ', hint: 'İki ucu sırayla havalanan bahçe oyuncağı', tier: 2 },
  { word: 'HÜLYA', hint: 'Tatlı tatlı dalınan hayal', tier: 2 },
  { word: 'ENDİŞE', hint: 'İçi rahat ettirmeyen kaygı', tier: 2 },
  { word: 'ÖZLEM', hint: 'Uzaktakine duyulan içten istek', tier: 2 },
  { word: 'TELAŞ', hint: 'Acele ve şaşkınlıkla koşuşturma', tier: 2 },
  { word: 'HEYECAN', hint: 'Kalbi hızlandıran coşku', tier: 2 },
  { word: 'CESARET', hint: 'Korkuya rağmen adım atabilme', tier: 2 },
  { word: 'MERHAMET', hint: 'Acı çekene el uzatma duygusu', tier: 2 },
  { word: 'NEZAKET', hint: 'Kırmadan, incelikle davranma', tier: 2 },
  { word: 'SADAKAT', hint: 'Bağlılığından hiç dönmeme', tier: 2 },
  { word: 'KISKANÇLIK', hint: 'Başkasının elindekine içerleme', tier: 2 },
  { word: 'CÖMERT', hint: 'Elindekini paylaşmaktan kaçınmayan', tier: 2 },
  { word: 'CİMRİ', hint: 'Parasını harcamaya kıyamayan', tier: 2 },
  { word: 'ÜRKEK', hint: 'Küçük bir seste bile kaçan', tier: 2 },
  { word: 'KURNAZ', hint: 'Çıkarı için ince yollar bulan', tier: 2 },
  { word: 'KIRILGAN', hint: 'Kolay incinen, üzerine titrenen', tier: 2 },
  { word: 'DOLUNAY', hint: 'Ayın tam yuvarlak göründüğü gece', tier: 2 },
  { word: 'HİLAL', hint: 'Ayın incecik yay biçimindeki hâli', tier: 2 },
  { word: 'GÜNBATIMI', hint: 'Ufkun kızıla boyandığı akşam anı', tier: 2 },
  { word: 'SERAP', hint: 'Çölde uzaktan su sanılan yanılsama', tier: 2 },
  { word: 'FISILTI', hint: 'Kulağa eğilerek söylenen alçak ses', tier: 2 },
  { word: 'KORKULUK', hint: 'Tarlada kuşları ürkütmek için dikilen kukla', tier: 2 },
  { word: 'DEĞİRMEN', hint: 'Kanatları rüzgarla dönen, un öğüten yapı', tier: 2 },
  { word: 'KERVAN', hint: 'Çölü birlikte aşan yüklü hayvan katarı', tier: 2 },
  { word: 'DEMİRCİ', hint: 'Örste kızgın metal döven usta', tier: 2 },
  { word: 'ÇÖMLEK', hint: 'Toprağın fırınlanmasıyla yapılan pişmiş kap', tier: 2 },
  { word: 'KANDİL', hint: 'Yağıyla yanan eski aydınlatma kabı', tier: 2 },
  { word: 'FENER', hint: 'Kıyıda gemilere yol gösteren ışıklı kule', tier: 2 },
  { word: 'TIRPAN', hint: 'Uzun saplı, ekin biçilen keskin araç', tier: 2 },
  { word: 'HARMAN', hint: 'Ekinin dövülüp tanesinin ayrıldığı yer', tier: 2 },
  { word: 'KUMBARA', hint: 'Bozuk paranın biriktirildiği kap', tier: 2 },
  { word: 'PAZARLIK', hint: 'Fiyatı indirtmek için yapılan konuşma', tier: 2 },
  { word: 'İMECE', hint: 'Köylünün elbirliğiyle iş görmesi', tier: 2 },
  { word: 'TURŞU', hint: 'Sirkeli suda bekletilmiş sebze', tier: 2 },
  { word: 'PEKMEZ', hint: 'Üzüm suyunun kaynatılıp koyulaştırılmışı', tier: 2 },
  { word: 'TARHANA', hint: 'Kurutulup çorbası yapılan ekşi hamur', tier: 2 },
  { word: 'BAĞLAMA', hint: 'Telleri mızrapla vurulan halk çalgısı', tier: 2 },
  { word: 'ZURNA', hint: 'Davulun yanında öten nefesli çalgı', tier: 2 },

  // ── Katman 3 · Zor ──────────────────────────────────────────────────────
  // Soyut kavramlar ve günlük dilde seyrekleşmiş sözcükler.
  { word: 'MUAMMA', hint: 'Bir türlü çözülemeyen, karanlıkta kalan iş', tier: 3 },
  { word: 'TEVAZU', hint: 'Büyüklüğünü hiç göstermeme hâli', tier: 3 },
  { word: 'MÜPHEM', hint: 'Sınırları seçilemeyen, bulanık', tier: 3 },
  { word: 'İRONİ', hint: 'Söylenenin tersini kastederek iğneleme', tier: 3 },
  { word: 'SEZGİ', hint: 'Akıl yürütmeden, birdenbire varılan bilme', tier: 3 },
  { word: 'ERDEM', hint: 'Ahlakın en yüksek basamağı', tier: 3 },
  { word: 'NEBZE', hint: 'Ancak fark edilen, zerre kadar miktar', tier: 3 },
  { word: 'ZÜPPE', hint: 'Gösterişe düşkün, özenti kimse', tier: 3 },
  { word: 'ZEVAL', hint: 'Sona erme, ortadan kalkma', tier: 3 },
  { word: 'MECAZ', hint: 'Sözün gerçek anlamının dışında kullanılması', tier: 3 },
  { word: 'ÜSLUP', hint: 'Anlatımın kişiye özgü biçimi', tier: 3 },
  { word: 'GAİLE', hint: 'İnsanın başından eksilmeyen dert', tier: 3 },
  { word: 'KADİM', hint: 'Başlangıcı bilinemeyecek kadar eski', tier: 3 },
  { word: 'İTİBAR', hint: 'Kişinin başkalarının gözündeki değeri', tier: 3 },
  { word: 'EMPATİ', hint: 'Karşındakinin yerine geçip öyle bakabilme', tier: 3 },
  { word: 'GAFLET', hint: 'Tehlikeyi göremeyen dalgınlık', tier: 3 },
  { word: 'MÜSRİF', hint: 'Elindekini savuran, tutumsuz', tier: 3 },
  { word: 'HÜSRAN', hint: 'Umudun elde kalan yıkıntısı', tier: 3 },
  { word: 'ŞÜKRAN', hint: 'Karşılıksız iyiliğe duyulan derin minnet', tier: 3 },
  { word: 'HİCRAN', hint: 'Ayrılığın yürekte açtığı yara', tier: 3 },
  { word: 'VUSLAT', hint: 'Uzun ayrılıktan sonra kavuşma', tier: 3 },
  { word: 'GURBET', hint: 'Memleketin uzağında geçen ömür', tier: 3 },
  { word: 'KANAAT', hint: 'Hem yetinme hem de edinilen görüş', tier: 3 },
  { word: 'TEŞBİH', hint: 'İki şeyi ortak yanıyla anma sanatı', tier: 3 },
  { word: 'MEFHUM', hint: 'Zihinde karşılığı olan kavram', tier: 3 },
  { word: 'TEDBİR', hint: 'İş işten geçmeden alınan önlem', tier: 3 },
  { word: 'TELAFİ', hint: 'Eksik kalanı sonradan kapatma', tier: 3 },
  { word: 'İTİDAL', hint: 'Aşırıya kaçmayan ölçülülük', tier: 3 },
  { word: 'JARGON', hint: 'Bir mesleğin kendi arasında konuştuğu kapalı dil', tier: 3 },
  { word: 'ŞEBNEM', hint: 'Sabahleyin yapraklara konan ince su', tier: 3 },
  { word: 'FİRUZE', hint: 'Turkuaz renkli, gökyüzüne çalan değerli taş', tier: 3 },
  { word: 'LAKAYT', hint: 'Hiçbir şeyi umursamayan, aldırışsız', tier: 3 },
  { word: 'AKIBET', hint: 'İş bittiğinde başa gelen son durum', tier: 3 },
  { word: 'IRGAT', hint: 'Tarlada gündelikle çalışan işçi', tier: 3 },
  { word: 'IZDIRAP', hint: 'İçe işleyen, dinmeyen acı', tier: 3 },
  { word: 'İHTİRAS', hint: 'Dizginlenemeyen, gözü karartan tutku', tier: 3 },
  { word: 'NEDAMET', hint: 'Yapılan işin ardından gelen pişmanlık', tier: 3 },
  { word: 'FERASET', hint: 'Çabuk kavrayış, keskin seziş', tier: 3 },
  { word: 'BASİRET', hint: 'Olacakları önceden görebilme yetisi', tier: 3 },
  { word: 'İSTİSNA', hint: 'Kuralın dışında bırakılan tek durum', tier: 3 },
  { word: 'TESADÜF', hint: 'Kimsenin planlamadığı karşılaşma', tier: 3 },
  { word: 'MUHATAP', hint: 'Sözün doğrudan yöneltildiği kişi', tier: 3 },
  { word: 'TRAJEDİ', hint: 'Sonu yıkımla biten sahne eseri', tier: 3 },
  { word: 'JEOLOJİ', hint: 'Yer kabuğunun katmanlarını inceleyen bilim', tier: 3 },
  { word: 'İHTİYAT', hint: 'Hem tedbirli davranma hem yedekte tutma', tier: 3 },
  { word: 'ISKARTA', hint: 'Ayıklanıp bir kenara atılmış olan', tier: 3 },
  { word: 'MUAZZAM', hint: 'Büyüklüğü insanı şaşırtan', tier: 3 },
  { word: 'İHTİŞAM', hint: 'Göz kamaştıran görkem', tier: 3 },
  { word: 'SÜKUNET', hint: 'Ses soluğun kesildiği derin dinginlik', tier: 3 },
  { word: 'İNFİLAK', hint: 'Ani ve gürültülü patlama', tier: 3 },
  { word: 'DAĞARCIK', hint: 'Bir kişinin bellekte biriktirdiği söz varlığı', tier: 3 },
  { word: 'PARADOKS', hint: 'Kendi kendini çürüten, şaşırtıcı önerme', tier: 3 },
  { word: 'İSTİKRAR', hint: 'Sarsılmadan, aynı çizgide sürüp gitme', tier: 3 },
  { word: 'NOSTALJİ', hint: 'Geçmişe duyulan tatlı özlem', tier: 3 },
  { word: 'TAHAMMÜL', hint: 'Katlanma gücünün son sınırı', tier: 3 },
  { word: 'TEREDDÜT', hint: 'İki seçenek arasında kalakalma', tier: 3 },
  { word: 'İSTİHDAM', hint: 'İşe alıp çalıştırma', tier: 3 },
  { word: 'MÜTEVAZI', hint: 'Övünmeyi bilmeyen, gösterişsiz', tier: 3 },
  { word: 'MÜNAKAŞA', hint: 'Sesi yükselten sert tartışma', tier: 3 },
  { word: 'TEŞEBBÜS', hint: 'Bir işe kalkışma, ilk adımı atma', tier: 3 },
  { word: 'MEŞAKKAT', hint: 'İnsanı yoran ağır sıkıntı', tier: 3 },
  { word: 'MUHAKEME', hint: 'Tartıp biçerek yargıya varma', tier: 3 },
  { word: 'TEFEKKÜR', hint: 'Uzun uzun, derinden düşünme', tier: 3 },
  { word: 'TAHRİBAT', hint: 'Geriye kalan yıkımın tümü', tier: 3 },
  { word: 'MÜSVEDDE', hint: 'Temize çekilmeden önceki ilk karalama', tier: 3 },
  { word: 'MELANKOLİ', hint: 'Sebebi gösterilemeyen ağır, sürekli hüzün', tier: 3 },
  { word: 'MUTABAKAT', hint: 'Tarafların aynı noktada buluşması', tier: 3 },
  { word: 'İSTİKAMET', hint: 'Gidilen yön, tutulan doğrultu', tier: 3 },
  { word: 'MAHCUP', hint: 'Utangaç, yüzü kolay kızaran', tier: 3 },
  { word: 'MAHZUN', hint: 'Yüzünden üzüntü eksilmeyen', tier: 3 },
  { word: 'MAĞRUR', hint: 'Kendini beğenmiş, burnu havada', tier: 3 },
  { word: 'MENFAAT', hint: 'Kişinin gözettiği kendi çıkarı', tier: 3 },
  { word: 'MERHALE', hint: 'Yolun ya da işin bir aşaması', tier: 3 },
  { word: 'MEŞGALE', hint: 'İnsanı oyalayıp vaktini alan uğraş', tier: 3 },
  { word: 'MUHABBET', hint: 'Hem sevgi hem tatlı sohbet', tier: 3 },
  { word: 'MUHAFAZA', hint: 'Bozulmadan, olduğu gibi saklama', tier: 3 },
  { word: 'MUKAVEMET', hint: 'Karşı koyup dayanma gücü', tier: 3 },
  { word: 'MUSİBET', hint: 'Başa gelen büyük bela', tier: 3 },
  { word: 'MÜBAREK', hint: 'Kutlu, bereketli sayılan', tier: 3 },
  { word: 'MÜCADELE', hint: 'Yılmadan sürdürülen savaşım', tier: 3 },
  { word: 'MÜDAHALE', hint: 'Araya girip işe karışma', tier: 3 },
  { word: 'MÜLAYİM', hint: 'Yumuşak huylu, sertliği olmayan', tier: 3 },
  { word: 'MÜNASİP', hint: 'Duruma uygun düşen', tier: 3 },
  { word: 'MÜSAMAHA', hint: 'Hoş görüp göz yumma', tier: 3 },
  { word: 'MÜŞKÜL', hint: 'İçinden çıkılması güç durum', tier: 3 },
  { word: 'MÜZAKERE', hint: 'Karşılıklı görüşüp tartışma', tier: 3 },
  { word: 'NAKARAT', hint: 'Şarkıda her kıtadan sonra dönüp gelen bölüm', tier: 3 },
  { word: 'NASİHAT', hint: 'Büyüğün küçüğe verdiği öğüt', tier: 3 },
  { word: 'NÜANS', hint: 'Ayrıntıdaki ince fark', tier: 3 },
  { word: 'RİVAYET', hint: 'Ağızdan ağza dolaşan söylenti', tier: 3 },
  { word: 'SAADET', hint: 'Kesintisiz süren mutluluk', tier: 3 },
  { word: 'SAMİMİYET', hint: 'İçten davranma hâli', tier: 3 },
  { word: 'SEFALET', hint: 'Yoksulluğun en dibi', tier: 3 },
  { word: 'SELAMET', hint: 'Tehlikeden uzak, esen kalma', tier: 3 },
  { word: 'SERZENİŞ', hint: 'Kırgınlıkla yapılan sitem', tier: 3 },
  { word: 'ŞEFKAT', hint: 'Koruyup kollayan anaç sevgi', tier: 3 },
  { word: 'TABİAT', hint: 'Hem doğa hem insanın huyu', tier: 3 },
  { word: 'TAKDİR', hint: 'Değerini görüp beğeniyle anma', tier: 3 },
  { word: 'TALİHSİZ', hint: 'Şansı hep ters giden', tier: 3 },
  { word: 'TASAVVUR', hint: 'Bir şeyi kafada önceden kurma', tier: 3 },
  { word: 'TAVSİYE', hint: 'Uygun görüp salık verme', tier: 3 },
  { word: 'TECRÜBE', hint: 'Yaşayarak öğrenilen bilgi', tier: 3 },
  { word: 'TEMKİNLİ', hint: 'Adımını ölçerek atan', tier: 3 },
  { word: 'TENEZZÜL', hint: 'Gururunu bırakıp alçalma', tier: 3 },
  { word: 'TEVATÜR', hint: 'Herkesin ağzında dolaşıp büyüyen söz', tier: 3 },
  { word: 'TEZAT', hint: 'Birbirine taban tabana zıtlık', tier: 3 },
  { word: 'VİCDAN', hint: 'İçeriden yargılayan ses', tier: 3 },
  { word: 'YEKPARE', hint: 'Tek parçadan oluşan, bölünmemiş', tier: 3 },
  { word: 'ZAFİYET', hint: 'Güçten düşme, halsizlik', tier: 3 },
  { word: 'ZAHMET', hint: 'İşin insana yüklediği yorgunluk', tier: 3 },
  { word: 'İBRET', hint: 'Görüp ders alınası durum', tier: 3 },
  { word: 'İDRAK', hint: 'Anlayıp kavrama gücü', tier: 3 },
  { word: 'İFRAT', hint: 'Ölçüyü kaçırıp aşırıya gitme', tier: 3 },
  { word: 'İHANET', hint: 'Güvenen kişiyi sırtından vurma', tier: 3 },
  { word: 'İHMAL', hint: 'Yapılması gerekeni savsaklama', tier: 3 },
  { word: 'İKRAM', hint: 'Konuğa karşılıksız sunma', tier: 3 },
  { word: 'İLTİFAT', hint: 'Gönül alan güzel söz', tier: 3 },
  { word: 'İMTİYAZ', hint: 'Başkasında olmayan ayrıcalık', tier: 3 },
  { word: 'İNZİVA', hint: 'Toplumdan çekilip tek başına kalma', tier: 3 },
  { word: 'İSTİFA', hint: 'Görevi kendi isteğiyle bırakma', tier: 3 },
  { word: 'İTİRAF', hint: 'Sakladığını açıkça söyleyiverme', tier: 3 },
  { word: 'İZDİHAM', hint: 'Kalabalığın birbirini ezdiği yığılma', tier: 3 },
  { word: 'HASRET', hint: 'Kavuşamamanın içe çöken özlemi', tier: 3 },
  { word: 'HAYSİYET', hint: 'Kişinin çiğnenmemesi gereken onuru', tier: 3 },
  { word: 'HİMAYE', hint: 'Kanadı altına alıp koruma', tier: 3 },
  { word: 'GAYRET', hint: 'Yılmadan gösterilen çaba', tier: 3 },
  { word: 'HARABE', hint: 'Yıkılıp terk edilmiş yapı kalıntısı', tier: 3 },
  { word: 'FASILA', hint: 'İki olay arasında kalan ara', tier: 3 },
  { word: 'FELAKET', hint: 'Ardında yıkım bırakan büyük kötülük', tier: 3 },
  { word: 'FEVKALADE', hint: 'Olağanın çok üstünde olan', tier: 3 },
  { word: 'EMANET', hint: 'Sahibine geri verilmek üzere bırakılan', tier: 3 },
  { word: 'EZBER', hint: 'Anlamadan belleğe kazıma', tier: 3 },
  { word: 'BEYHUDE', hint: 'Sonuç vermeyecek, boşuna', tier: 3 },
  { word: 'BUHRAN', hint: 'Bunalıma dönüşen ağır kriz', tier: 3 },
  { word: 'AŞİKAR', hint: 'Gizlenemeyecek kadar açık', tier: 3 },
  { word: 'AHENK', hint: 'Parçaların birbirine uyumu', tier: 3 },

  // ── Katman 4 · Çok zor ──────────────────────────────────────────────────
  // Edebî, felsefî ve bilimsel terimler; yalnızca son turlarda çıkar.
  { word: 'MÜNZEVİ', hint: 'Dünyadan elini eteğini çekip yalnız yaşayan', tier: 4 },
  { word: 'İSTİHZA', hint: 'İnce ve alaycı bir küçümseme', tier: 4 },
  { word: 'TERAKKİ', hint: 'Basamak basamak ilerleme, yükselme', tier: 4 },
  { word: 'TEZAHÜR', hint: 'İçteki şeyin dışarıya belirmesi', tier: 4 },
  { word: 'TENAKUZ', hint: 'Bir sözün kendi içinde çelişmesi', tier: 4 },
  { word: 'TELAKKİ', hint: 'Bir şeyi belli bir biçimde anlayış, görüş', tier: 4 },
  { word: 'ENTROPİ', hint: 'Düzensizliğin fizikteki ölçüsü', tier: 4 },
  { word: 'MUHAYYEL', hint: 'Yalnızca hayalde var olan', tier: 4 },
  { word: 'TAHAYYÜL', hint: 'Zihinde canlandırıp kurma', tier: 4 },
  { word: 'MÜBALAĞA', hint: 'Olduğundan büyük gösterme', tier: 4 },
  { word: 'SERENCAM', hint: 'Bir işin başından sonuna gelip dayandığı yer', tier: 4 },
  { word: 'İSTİSMAR', hint: 'Bir hakkı ya da kişiyi kötüye kullanma', tier: 4 },
  { word: 'TAHAKKÜM', hint: 'Zor kullanarak üstünlük kurma', tier: 4 },
  { word: 'MÜBADELE', hint: 'Karşılıklı değiş tokuş', tier: 4 },
  { word: 'TEVEKKÜL', hint: 'Elinden geleni yapıp gerisini bırakma', tier: 4 },
  { word: 'MUZDARİP', hint: 'Sürekli bir acıyla yaşayan', tier: 4 },
  { word: 'MÜNEVVER', hint: 'Okumuş, aydın kimse', tier: 4 },
  { word: 'İZAFİYET', hint: 'Ölçümün gözlemciye göre değiştiğini söyleyen kuram', tier: 4 },
  { word: 'SİMBİYOZ', hint: 'İki farklı canlının birbirinden beslenen ortak yaşamı', tier: 4 },
  { word: 'NİHİLİZM', hint: 'Hiçbir değeri tanımayan görüş', tier: 4 },
  { word: 'KAKOFONİ', hint: 'Kulağı tırmalayan ses karmaşası', tier: 4 },
  { word: 'AKROSTİŞ', hint: 'Dizelerin ilk harfleri bir ad veren şiir', tier: 4 },
  { word: 'KEHRİBAR', hint: 'İçinde böcek kalabilen, taşlaşmış reçine', tier: 4 },
  { word: 'OBSİDYEN', hint: 'Aniden soğumuş lavdan oluşan doğal cam', tier: 4 },
  { word: 'MÜTEREDDİT', hint: 'Bir türlü karar veremeyen, ikircikli', tier: 4 },
  { word: 'MUTLAKİYET', hint: 'Tüm yetkinin tek elde toplandığı yönetim', tier: 4 },
  { word: 'MEŞRUTİYET', hint: 'Padişahın yanı sıra meclisin de bulunduğu düzen', tier: 4 },
  { word: 'KATALİZÖR', hint: 'Tepkimeyi hızlandırdığı hâlde kendisi tükenmeyen madde', tier: 4 },
  { word: 'METAFİZİK', hint: 'Varlığın ötesini soruşturan felsefe dalı', tier: 4 },
  { word: 'SEMBOLİZM', hint: 'Anlatmak yerine simgeyle sezdiren sanat akımı', tier: 4 },
  { word: 'FOTOSENTEZ', hint: 'Yaprağın ışıktan besin üretmesi', tier: 4 },
  { word: 'PALİMPSEST', hint: 'Kazınıp üzerine yeniden yazılmış eski yazma', tier: 4 },
  { word: 'HİYEROGLİF', hint: 'Resim biçimli işaretlerle yazılan eski yazı', tier: 4 },
  { word: 'ZÜMRÜDÜANKA', hint: 'Külünden yeniden doğan efsanevi kuş', tier: 4 },
  { word: 'ANTROPOLOJİ', hint: 'İnsanı ve kültürlerini inceleyen bilim', tier: 4 },
  { word: 'DETERMİNİZM', hint: 'Her olayın kaçınılmaz bir nedeni olduğu görüşü', tier: 4 },
  { word: 'PROJEKSİYON', hint: 'Bir yüzeye ışıkla görüntü düşürme', tier: 4 },
  { word: 'EPİSTEMOLOJİ', hint: 'Bilginin kendisini sorgulayan felsefe dalı', tier: 4 },
  { word: 'EMPRESYONİZM', hint: 'Anlık izlenimi resmeden sanat akımı', tier: 4 },
  { word: 'MÜLAHAZA', hint: 'Enine boyuna düşünüp değerlendirme', tier: 4 },
  { word: 'MUTASAVVIF', hint: 'Tasavvuf yoluna girmiş, gönül eri kimse', tier: 4 },
  { word: 'MÜSTAKBEL', hint: 'Gelecekte olması beklenen', tier: 4 },
  { word: 'MÜSTAKİL', hint: 'Kendi başına duran, bağımsız', tier: 4 },
  { word: 'MÜTEMADİYEN', hint: 'Ara vermeksizin, sürüp giderek', tier: 4 },
  { word: 'TEFERRUAT', hint: 'Aslı değil, işin ince ayrıntıları', tier: 4 },
  { word: 'TEKAMÜL', hint: 'Eksiği kalmayacak biçimde olgunlaşma', tier: 4 },
  { word: 'TELMİH', hint: 'Bilinen bir olaya üstü kapalı gönderme yapma sanatı', tier: 4 },
  { word: 'TEVRİYE', hint: 'Sözü iki anlamlı kullanıp uzak anlamı kastetme', tier: 4 },
  { word: 'İSTİARE', hint: 'Benzetmenin tek yanıyla kurulan söz sanatı', tier: 4 },
  { word: 'KİNAYE', hint: 'Söylenenin ardında saklı duran asıl anlam', tier: 4 },
  { word: 'ALEGORİ', hint: 'Soyut bir düşünceyi baştan sona simgelerle anlatma', tier: 4 },
  { word: 'AFORİZMA', hint: 'Az sözle derin bir yargı bildiren cümle', tier: 4 },
  { word: 'DİYALEKTİK', hint: 'Karşıtların çatışmasından doğan düşünme yöntemi', tier: 4 },
  { word: 'PRAGMATİZM', hint: 'Doğruyu yararlı olanda arayan görüş', tier: 4 },
  { word: 'RASYONALİZM', hint: 'Bilginin kaynağını akılda gören görüş', tier: 4 },
  { word: 'AMPİRİZM', hint: 'Bilginin deneyden geldiğini savunan görüş', tier: 4 },
  { word: 'STOİSİZM', hint: 'Acıya kayıtsız kalmayı öğütleyen felsefe', tier: 4 },
  { word: 'HEDONİZM', hint: 'Hazzı en yüksek değer sayan görüş', tier: 4 },
  { word: 'DİSTOPYA', hint: 'Karanlık bir gelecek tasarımı', tier: 4 },
  { word: 'ARKETİP', hint: 'Ortak bilinçdışında yatan ilk örnek', tier: 4 },
  { word: 'METAMORFOZ', hint: 'Biçimden biçime tümüyle dönüşme', tier: 4 },
  { word: 'SİNESTEZİ', hint: 'Duyuların karışması, sesin renk gibi duyulması', tier: 4 },
  { word: 'TERMODİNAMİK', hint: 'Isı ile enerji dönüşümlerini inceleyen fizik dalı', tier: 4 },
  { word: 'RADYOAKTİF', hint: 'Çekirdeği kendiliğinden ışıma yapan', tier: 4 },
  { word: 'KROMOZOM', hint: 'Kalıtım bilgisini taşıyan iplikçik', tier: 4 },
  { word: 'MİTOKONDRİ', hint: 'Hücrenin enerjisini üreten organel', tier: 4 },
  { word: 'OSMOZ', hint: 'Suyun yarı geçirgen zardan yoğun tarafa geçmesi', tier: 4 },
  { word: 'STALAKTİT', hint: 'Mağara tavanından sarkan kireç sütunu', tier: 4 },
  { word: 'TEKTONİK', hint: 'Yer kabuğu levhalarının hareketiyle ilgili', tier: 4 },
  { word: 'SÜPERNOVA', hint: 'Bir yıldızın ömrünü bitiren dev patlama', tier: 4 },
  { word: 'KUANTUM', hint: 'Enerjinin bölünemeyen en küçük paketi', tier: 4 },
  { word: 'LOGARİTMA', hint: 'Üsse karşılık gelen sayıyı veren işlem', tier: 4 },
  { word: 'HİPOTENÜS', hint: 'Dik üçgenin en uzun kenarı', tier: 4 },
  { word: 'SÜRREALİZM', hint: 'Düş ile gerçeği iç içe geçiren akım', tier: 4 },
  { word: 'TEZHİP', hint: 'Yazma eserleri altın yaldızla bezeme sanatı', tier: 4 },
  { word: 'AKROPOL', hint: 'Antik kentin yüksekteki kutsal tepesi', tier: 4 },
  { word: 'AMFORA', hint: 'İki kulplu, sivri dipli antik testi', tier: 4 },
  { word: 'PAPİRÜS', hint: 'Kamıştan yapılmış, eski çağların yazı yaprağı', tier: 4 },
];

// ─── Dile göre havuzlar ─────────────────────────────────────────────────────

/**
 * Her dilin kendi alfabesi, kendi kelime havuzu ve kendi girdi normalizasyonu
 * vardır. Normalizasyon iki yerde birden kullanılır: havuzdaki kelimeler zaten
 * normalleştirilmiş yazılır, oyuncunun bastığı tuş da aynı fonksiyondan geçer;
 * böylece "İ" ile "i", ya da Arapçadaki "أ" ile "ا" aynı harf sayılır.
 */
export interface WordPool {
  /** Sanal klavyede bu sırayla dizilen harfler. */
  alphabet: string;
  /** Büyük harfe çevirme + dile özgü harf birleştirmeleri. */
  normalize(input: string): string;
  words: WordEntry[];
}

/** Türk alfabesi: 'i' → 'İ' ayrımı motorun locale ayarından bağımsız yapılır. */
function trNormalize(input: string): string {
  return input.replace(/i/g, 'İ').replace(/ı/g, 'I').toUpperCase();
}

/** Unicode birleşen aksan işaretleri (combining diacritical marks) bloğu. */
const COMBINING_MARKS = /[\u0300-\u036f]/g;

/** Latin alfabeli diller: aksanlar taban harfe indirgenir (É → E, Ò → O). */
function latinNormalize(input: string): string {
  return input.normalize('NFD').replace(COMBINING_MARKS, '').toUpperCase();
}

/**
 * İspanyolca: Ñ kendi başına bir harftir, korunur; kalan aksanlar (Á, É, Í, Ó,
 * Ú, Ü) düşürülür. NFD ayrıştırması ñ'yi de n + tilde'ye böleceğinden harf önce
 * ayrışmayan bir vekil karakterle korunur, aksanlar atıldıktan sonra geri konur.
 */
const N_TILDE_GUARD = '\u0001';
function esNormalize(input: string): string {
  return input
    .replace(/[ñÑ]/g, N_TILDE_GUARD)
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toUpperCase()
    .split(N_TILDE_GUARD)
    .join('Ñ');
}

/**
 * Arapça: harf biçimleri klavyedeki tek bir tuşa indirgenir — hemze taşıyan
 * elifler (أ إ آ ٱ) düz elife, kürsülü hemzeler (ئ ؤ) müstakil hemzeye (ء),
 * tâ marbûta (ة) hâ'ya, elif maksûra (ى) yâ'ya döner;
 * harekeler ve tatvîl atılır. Aksi hâlde oyuncu doğru harfe bassa da kelimede
 * eşleşme bulunamazdı. Arapçada büyük/küçük harf ayrımı yoktur.
 */
function arNormalize(input: string): string {
  return input
    .replace(/[\u0623\u0625\u0622\u0671]/g, '\u0627') // أ إ آ ٱ → ا
    .replace(/[\u0626\u0624]/g, '\u0621')                 // ئ ؤ → ء
    .replace(/\u0629/g, '\u0647')                        // ة → ه
    .replace(/\u0649/g, '\u064a')                        // ى → ي
    .replace(/[\u064b-\u0652\u0640\u0670]/g, '');      // harekeler ve tatvîl
}

const EN_WORDS: WordEntry[] = [
  // ── Tier 1 · Easy ───────────────────────────────────────────────────────
  { word: 'CLOUD', hint: 'Drifts across the sky and carries the rain', tier: 1 },
  { word: 'FOREST', hint: 'A wide area covered in trees', tier: 1 },
  { word: 'BRIDGE', hint: 'Carries a road across a river', tier: 1 },
  { word: 'ISLAND', hint: 'Land with water on every side', tier: 1 },
  { word: 'GARDEN', hint: 'Where flowers and vegetables are grown', tier: 1 },
  { word: 'WINTER', hint: 'The coldest of the four seasons', tier: 1 },
  { word: 'MARKET', hint: 'Where goods are bought and sold', tier: 1 },
  { word: 'CANDLE', hint: 'Wax with a wick, burns for light', tier: 1 },
  { word: 'MIRROR', hint: 'Shows you your own face', tier: 1 },
  { word: 'DESERT', hint: 'Vast dry land of sand and heat', tier: 1 },
  { word: 'PLANET', hint: 'Orbits a star, like the one you stand on', tier: 1 },
  { word: 'THUNDER', hint: 'The rumble that follows lightning', tier: 1 },

  // ── Tier 2 · Medium ─────────────────────────────────────────────────────
  { word: 'COMPASS', hint: 'Its needle always seeks the north', tier: 2 },
  { word: 'HARVEST', hint: 'Gathering the crops when they ripen', tier: 2 },
  { word: 'VOLCANO', hint: 'A mountain that spits out lava', tier: 2 },
  { word: 'GLACIER', hint: 'A river of ice that creeps downhill', tier: 2 },
  { word: 'LANTERN', hint: 'A lamp you can carry by its handle', tier: 2 },
  { word: 'ORCHARD', hint: 'A field planted with fruit trees', tier: 2 },
  { word: 'JOURNEY', hint: 'Travel from one place to a distant other', tier: 2 },
  { word: 'MYSTERY', hint: 'Something that resists every explanation', tier: 2 },
  { word: 'FURNACE', hint: 'Where metal is melted by fierce heat', tier: 2 },
  { word: 'PYRAMID', hint: 'Square base, four triangles, a pharaoh inside', tier: 2 },
  { word: 'BLIZZARD', hint: 'A snowstorm driven by violent wind', tier: 2 },
  { word: 'VOYAGE', hint: 'A long passage taken over the sea', tier: 2 },

  // ── Tier 3 · Hard ───────────────────────────────────────────────────────
  { word: 'ECLIPSE', hint: 'One body slides in front of another and steals its light', tier: 3 },
  { word: 'LABYRINTH', hint: 'Passages built so that finding the way out is the trial', tier: 3 },
  { word: 'ARCHIPELAGO', hint: 'A scattered family of islands', tier: 3 },
  { word: 'MONSOON', hint: 'The wind that turns and brings a season of rain', tier: 3 },
  { word: 'CATALYST', hint: 'Speeds the change without being changed itself', tier: 3 },
  { word: 'MANUSCRIPT', hint: 'A book from before printing, written by hand', tier: 3 },
  { word: 'SYMPHONY', hint: 'A long work written for a full orchestra', tier: 3 },
  { word: 'HORIZON', hint: 'The line where sky appears to meet earth', tier: 3 },
  { word: 'PENDULUM', hint: 'Swings back and forth and measures time by it', tier: 3 },
  { word: 'MIGRATION', hint: 'The seasonal journey of whole flocks', tier: 3 },
  { word: 'OBSERVATORY', hint: 'A dome built for watching the night sky', tier: 3 },
  { word: 'PARADOX', hint: 'A statement that contradicts itself yet may hold', tier: 3 },

  // ── Tier 4 · Very hard ──────────────────────────────────────────────────
  { word: 'STALACTITE', hint: 'Hangs from a cave roof, grown drop by drop', tier: 4 },
  { word: 'TECTONIC', hint: 'Of the great plates that grind beneath the crust', tier: 4 },
  { word: 'SUPERNOVA', hint: 'The blast that ends a massive star', tier: 4 },
  { word: 'LOGARITHM', hint: 'Answers the question: to what power?', tier: 4 },
  { word: 'HYPOTENUSE', hint: 'The longest side of a right triangle', tier: 4 },
  { word: 'SURREALISM', hint: 'The movement that braided dream into the waking world', tier: 4 },
  { word: 'ACROPOLIS', hint: 'The sacred height above an ancient city', tier: 4 },
  { word: 'PAPYRUS', hint: 'Antiquity wrote on this reed', tier: 4 },
  { word: 'BIOLUMINESCENCE', hint: 'Living things that make their own light', tier: 4 },
  { word: 'PHOTOSYNTHESIS', hint: 'How a leaf turns sunlight into sugar', tier: 4 },
  { word: 'ONOMATOPOEIA', hint: 'A word shaped like the sound it names', tier: 4 },
  { word: 'CARTOGRAPHY', hint: 'The craft of setting the world down on paper', tier: 4 },
];

const IT_WORDS: WordEntry[] = [
  // ── Livello 1 · Facile ──────────────────────────────────────────────────
  { word: 'NUVOLA', hint: 'Scivola nel cielo e porta la pioggia', tier: 1 },
  { word: 'FORESTA', hint: 'Vasta distesa coperta di alberi', tier: 1 },
  { word: 'PONTE', hint: 'Porta la strada al di là del fiume', tier: 1 },
  { word: 'ISOLA', hint: 'Terra circondata dall acqua da ogni lato', tier: 1 },
  { word: 'GIARDINO', hint: 'Vi si coltivano fiori e ortaggi', tier: 1 },
  { word: 'INVERNO', hint: 'La più fredda delle quattro stagioni', tier: 1 },
  { word: 'MERCATO', hint: 'Dove si compra e si vende', tier: 1 },
  { word: 'CANDELA', hint: 'Cera con stoppino, arde per fare luce', tier: 1 },
  { word: 'SPECCHIO', hint: 'Ti restituisce il tuo stesso volto', tier: 1 },
  { word: 'DESERTO', hint: 'Immensa terra arida di sabbia e calura', tier: 1 },
  { word: 'PIANETA', hint: 'Gira attorno a una stella, come quello sotto i tuoi piedi', tier: 1 },
  { word: 'TUONO', hint: 'Il rombo che segue il lampo', tier: 1 },

  // ── Livello 2 · Medio ───────────────────────────────────────────────────
  { word: 'BUSSOLA', hint: 'Il suo ago cerca sempre il nord', tier: 2 },
  { word: 'RACCOLTO', hint: 'Si porta a casa quando le messi sono mature', tier: 2 },
  { word: 'VULCANO', hint: 'Montagna che sputa lava', tier: 2 },
  { word: 'GHIACCIAIO', hint: 'Fiume di ghiaccio che scende lentissimo', tier: 2 },
  { word: 'LANTERNA', hint: 'Lume che si porta per il manico', tier: 2 },
  { word: 'FRUTTETO', hint: 'Campo piantato ad alberi da frutto', tier: 2 },
  { word: 'VIAGGIO', hint: 'Spostamento verso un luogo lontano', tier: 2 },
  { word: 'MISTERO', hint: 'Ciò che resiste a ogni spiegazione', tier: 2 },
  { word: 'FORNACE', hint: 'Vi si fonde il metallo con calore feroce', tier: 2 },
  { word: 'PIRAMIDE', hint: 'Base quadrata, quattro triangoli, un faraone dentro', tier: 2 },
  { word: 'TEMPESTA', hint: 'Vento e pioggia scatenati insieme', tier: 2 },
  { word: 'FARO', hint: 'Torre che accende la rotta ai naviganti', tier: 2 },

  // ── Livello 3 · Difficile ───────────────────────────────────────────────
  { word: 'ECLISSI', hint: 'Un corpo si mette davanti a un altro e ne ruba la luce', tier: 3 },
  { word: 'LABIRINTO', hint: 'Corridoi costruiti perché uscirne sia la prova', tier: 3 },
  { word: 'ARCIPELAGO', hint: 'Famiglia sparsa di isole', tier: 3 },
  { word: 'MONSONE', hint: 'Il vento che gira e porta la stagione delle piogge', tier: 3 },
  { word: 'CATALIZZATORE', hint: 'Accelera la reazione senza consumarsi', tier: 3 },
  { word: 'MANOSCRITTO', hint: 'Libro anteriore alla stampa, vergato a mano', tier: 3 },
  { word: 'SINFONIA', hint: 'Ampia opera scritta per tutta l orchestra', tier: 3 },
  { word: 'ORIZZONTE', hint: 'La linea dove il cielo sembra toccare la terra', tier: 3 },
  { word: 'PENDOLO', hint: 'Oscilla avanti e indietro e così misura il tempo', tier: 3 },
  { word: 'MIGRAZIONE', hint: 'Il viaggio stagionale di interi stormi', tier: 3 },
  { word: 'OSSERVATORIO', hint: 'Cupola costruita per scrutare il cielo notturno', tier: 3 },
  { word: 'PARADOSSO', hint: 'Affermazione che contraddice sé stessa eppure regge', tier: 3 },

  // ── Livello 4 · Molto difficile ─────────────────────────────────────────
  { word: 'STALATTITE', hint: 'Pende dalla volta della grotta, cresciuta goccia a goccia', tier: 4 },
  { word: 'TETTONICA', hint: 'Riguarda le grandi placche che stridono sotto la crosta', tier: 4 },
  { word: 'SUPERNOVA', hint: 'Lo scoppio che chiude la vita di una stella massiccia', tier: 4 },
  { word: 'LOGARITMO', hint: 'Risponde alla domanda: elevato a quale potenza?', tier: 4 },
  { word: 'IPOTENUSA', hint: 'Il lato più lungo del triangolo rettangolo', tier: 4 },
  { word: 'SURREALISMO', hint: 'Il movimento che intrecciò il sogno alla veglia', tier: 4 },
  { word: 'ACROPOLI', hint: 'L altura sacra sopra la città antica', tier: 4 },
  { word: 'PAPIRO', hint: 'Su questa canna scriveva l antichità', tier: 4 },
  { word: 'FOTOSINTESI', hint: 'Come la foglia trasforma il sole in zucchero', tier: 4 },
  { word: 'ONOMATOPEA', hint: 'Parola foggiata sul suono che nomina', tier: 4 },
  { word: 'CARTOGRAFIA', hint: 'L arte di fissare il mondo sulla carta', tier: 4 },
  { word: 'ANFORA', hint: 'Vaso antico a due anse e fondo appuntito', tier: 4 },
];

const ES_WORDS: WordEntry[] = [
  // ── Nivel 1 · Fácil ─────────────────────────────────────────────────────
  { word: 'NUBE', hint: 'Se desliza por el cielo y trae la lluvia', tier: 1 },
  { word: 'BOSQUE', hint: 'Extensión ancha cubierta de árboles', tier: 1 },
  { word: 'PUENTE', hint: 'Lleva el camino al otro lado del río', tier: 1 },
  { word: 'ISLA', hint: 'Tierra rodeada de agua por todos lados', tier: 1 },
  { word: 'JARDIN', hint: 'Allí se cultivan flores y hortalizas', tier: 1 },
  { word: 'INVIERNO', hint: 'La más fría de las cuatro estaciones', tier: 1 },
  { word: 'MERCADO', hint: 'Donde se compra y se vende', tier: 1 },
  { word: 'VELA', hint: 'Cera con mecha que arde para dar luz', tier: 1 },
  { word: 'ESPEJO', hint: 'Te devuelve tu propio rostro', tier: 1 },
  { word: 'DESIERTO', hint: 'Inmensa tierra seca de arena y calor', tier: 1 },
  { word: 'PLANETA', hint: 'Gira alrededor de una estrella, como el que pisas', tier: 1 },
  { word: 'TRUENO', hint: 'El estruendo que sigue al relámpago', tier: 1 },

  // ── Nivel 2 · Medio ─────────────────────────────────────────────────────
  { word: 'BRUJULA', hint: 'Su aguja busca siempre el norte', tier: 2 },
  { word: 'COSECHA', hint: 'Se recoge cuando el grano madura', tier: 2 },
  { word: 'VOLCAN', hint: 'Montaña que escupe lava', tier: 2 },
  { word: 'GLACIAR', hint: 'Río de hielo que baja despacísimo', tier: 2 },
  { word: 'LINTERNA', hint: 'Lámpara que se lleva de la mano', tier: 2 },
  { word: 'HUERTO', hint: 'Campo plantado de árboles frutales', tier: 2 },
  { word: 'MONTAÑA', hint: 'Se alza y hay que subirla para verla toda', tier: 2 },
  { word: 'MISTERIO', hint: 'Aquello que resiste toda explicación', tier: 2 },
  { word: 'HORNO', hint: 'Allí el metal se funde con calor feroz', tier: 2 },
  { word: 'PIRAMIDE', hint: 'Base cuadrada, cuatro triángulos, un faraón dentro', tier: 2 },
  { word: 'TORMENTA', hint: 'Viento y lluvia desatados a la vez', tier: 2 },
  { word: 'FARO', hint: 'Torre que enciende la ruta a los navegantes', tier: 2 },

  // ── Nivel 3 · Difícil ───────────────────────────────────────────────────
  { word: 'ECLIPSE', hint: 'Un cuerpo se pone delante de otro y le roba la luz', tier: 3 },
  { word: 'LABERINTO', hint: 'Pasillos hechos para que salir sea la prueba', tier: 3 },
  { word: 'ARCHIPIELAGO', hint: 'Familia dispersa de islas', tier: 3 },
  { word: 'MONZON', hint: 'El viento que gira y trae la estación de lluvias', tier: 3 },
  { word: 'CATALIZADOR', hint: 'Acelera la reacción sin gastarse en ella', tier: 3 },
  { word: 'MANUSCRITO', hint: 'Libro anterior a la imprenta, trazado a mano', tier: 3 },
  { word: 'SINFONIA', hint: 'Obra amplia escrita para toda la orquesta', tier: 3 },
  { word: 'HORIZONTE', hint: 'La línea donde el cielo parece tocar la tierra', tier: 3 },
  { word: 'PENDULO', hint: 'Va y viene, y con ello mide el tiempo', tier: 3 },
  { word: 'MIGRACION', hint: 'El viaje estacional de bandadas enteras', tier: 3 },
  { word: 'OBSERVATORIO', hint: 'Cúpula levantada para escrutar el cielo nocturno', tier: 3 },
  { word: 'PARADOJA', hint: 'Afirmación que se contradice y aun así se sostiene', tier: 3 },

  // ── Nivel 4 · Muy difícil ───────────────────────────────────────────────
  { word: 'ESTALACTITA', hint: 'Cuelga del techo de la cueva, crecida gota a gota', tier: 4 },
  { word: 'TECTONICA', hint: 'De las grandes placas que rozan bajo la corteza', tier: 4 },
  { word: 'SUPERNOVA', hint: 'El estallido que cierra la vida de una estrella masiva', tier: 4 },
  { word: 'LOGARITMO', hint: 'Responde a la pregunta: elevado a qué potencia', tier: 4 },
  { word: 'HIPOTENUSA', hint: 'El lado más largo del triángulo rectángulo', tier: 4 },
  { word: 'SURREALISMO', hint: 'El movimiento que trenzó el sueño con la vigilia', tier: 4 },
  { word: 'ACROPOLIS', hint: 'La altura sagrada sobre la ciudad antigua', tier: 4 },
  { word: 'PAPIRO', hint: 'Sobre esta caña escribía la antigüedad', tier: 4 },
  { word: 'FOTOSINTESIS', hint: 'Cómo la hoja convierte el sol en azúcar', tier: 4 },
  { word: 'ONOMATOPEYA', hint: 'Palabra forjada sobre el sonido que nombra', tier: 4 },
  { word: 'CARTOGRAFIA', hint: 'El arte de fijar el mundo sobre el papel', tier: 4 },
  { word: 'ANFORA', hint: 'Vasija antigua de dos asas y fondo puntiagudo', tier: 4 },
];

/**
 * Kelimeler okunabilirlik için hemzeli/ta-marbûtalı doğal yazımlarıyla
 * girilir; havuz kurulurken `arNormalize`'dan geçirilerek klavyedeki 28 temel
 * harfe indirgenir, böylece oyuncunun bastığı harf daima eşleşir.
 */
const AR_WORDS_RAW: WordEntry[] = [
  // ── المستوى ١ · سهل ─────────────────────────────────────────────────────
  { word: 'سحاب', hint: 'ينساب في السماء ويحمل المطر', tier: 1 },
  { word: 'غابه', hint: 'مساحة واسعة تغطيها الأشجار', tier: 1 },
  { word: 'جسر', hint: 'يحمل الطريق إلى الضفة الأخرى', tier: 1 },
  { word: 'جزيره', hint: 'أرض يحيط بها الماء من كل جانب', tier: 1 },
  { word: 'حديقه', hint: 'تزرع فيها الأزهار والخضروات', tier: 1 },
  { word: 'شتاء', hint: 'أبرد الفصول الأربعة', tier: 1 },
  { word: 'سوق', hint: 'مكان البيع والشراء', tier: 1 },
  { word: 'شمعه', hint: 'شمع بفتيل يحترق ليضيء', tier: 1 },
  { word: 'مراه', hint: 'ترد إليك وجهك أنت', tier: 1 },
  { word: 'صحراء', hint: 'أرض شاسعة من الرمل والحر', tier: 1 },
  { word: 'كوكب', hint: 'يدور حول نجم، مثل الذي تقف عليه', tier: 1 },
  { word: 'رعد', hint: 'الهدير الذي يتبع البرق', tier: 1 },

  // ── المستوى ٢ · متوسط ───────────────────────────────────────────────────
  { word: 'بوصله', hint: 'إبرتها تطلب الشمال دائمًا', tier: 2 },
  { word: 'حصاد', hint: 'يُجمع حين ينضج الزرع', tier: 2 },
  { word: 'بركان', hint: 'جبل يقذف الحمم', tier: 2 },
  { word: 'نهر', hint: 'ماء جارٍ يشق الأرض إلى البحر', tier: 2 },
  { word: 'فانوس', hint: 'مصباح يُحمل من مقبضه', tier: 2 },
  { word: 'بستان', hint: 'حقل مغروس بأشجار الفاكهة', tier: 2 },
  { word: 'رحله', hint: 'انتقال إلى مكان بعيد', tier: 2 },
  { word: 'لغز', hint: 'ما يستعصي على كل تفسير', tier: 2 },
  { word: 'فرن', hint: 'فيه يذوب المعدن بحرارة شديدة', tier: 2 },
  { word: 'هرم', hint: 'قاعدة مربعة وأربعة مثلثات وفرعون في الداخل', tier: 2 },
  { word: 'عاصفه', hint: 'ريح ومطر انطلقا معًا', tier: 2 },
  { word: 'مناره', hint: 'برج يضيء الطريق للبحارة', tier: 2 },

  // ── المستوى ٣ · صعب ─────────────────────────────────────────────────────
  { word: 'كسوف', hint: 'جرم يقف أمام آخر فيسرق ضوءه', tier: 3 },
  { word: 'متاهه', hint: 'ممرات بُنيت ليكون الخروج منها هو الاختبار', tier: 3 },
  { word: 'ارخبيل', hint: 'أسرة متناثرة من الجزر', tier: 3 },
  { word: 'موسميه', hint: 'رياح تنقلب فتجلب فصل الأمطار', tier: 3 },
  { word: 'محفز', hint: 'يسرّع التفاعل دون أن يستهلك فيه', tier: 3 },
  { word: 'مخطوط', hint: 'كتاب سابق للطباعة، خُطّ باليد', tier: 3 },
  { word: 'سيمفونيه', hint: 'عمل واسع كُتب للأوركسترا كاملة', tier: 3 },
  { word: 'افق', hint: 'الخط الذي تبدو السماء عنده ملامسة للأرض', tier: 3 },
  { word: 'بندول', hint: 'يتأرجح ذهابًا وإيابًا فيقيس الزمن', tier: 3 },
  { word: 'هجره', hint: 'رحلة موسمية لأسراب بأكملها', tier: 3 },
  { word: 'مرصد', hint: 'قبة شُيّدت لتأمل سماء الليل', tier: 3 },
  { word: 'مفارقه', hint: 'قول يناقض نفسه ومع ذلك قد يصح', tier: 3 },

  // ── المستوى ٤ · صعب جدًا ────────────────────────────────────────────────
  { word: 'هوابط', hint: 'تتدلى من سقف الكهف، نمت قطرة قطرة', tier: 4 },
  { word: 'تكتونيه', hint: 'تخص الصفائح الكبرى التي تحتك تحت القشرة', tier: 4 },
  { word: 'مستعر', hint: 'الانفجار الذي يُنهي حياة نجم ضخم', tier: 4 },
  { word: 'لوغاريتم', hint: 'يجيب عن سؤال: مرفوع إلى أي قوة', tier: 4 },
  { word: 'وتر', hint: 'أطول أضلاع المثلث القائم', tier: 4 },
  { word: 'سرياليه', hint: 'الحركة التي ضفرت الحلم باليقظة', tier: 4 },
  { word: 'اكروبول', hint: 'المرتفع المقدس فوق المدينة القديمة', tier: 4 },
  { word: 'بردي', hint: 'على هذا القصب كتبت العصور القديمة', tier: 4 },
  { word: 'ضوئي', hint: 'وصف التركيب الذي تحول به الورقة الشمس سكرًا', tier: 4 },
  { word: 'محاكاه', hint: 'كلمة صيغت على صورة الصوت الذي تسميه', tier: 4 },
  { word: 'خرائطيه', hint: 'فن تثبيت العالم على الورق', tier: 4 },
  { word: 'جرافه', hint: 'جرة قديمة بمقبضين وقاع مدبب', tier: 4 },
];

const AR_WORDS: WordEntry[] = AR_WORDS_RAW.map((e) => ({ ...e, word: arNormalize(e.word) }));

/**
 * Dil kodu → havuz. TR havuzu tam (388 kelime); diğerleri katman başına 12
 * kelimelik oynanabilir başlangıç havuzlarıdır ve aynı biçimi izleyerek
 * genişletilebilir. Yeni kelime eklerken tek kural: yalnızca o dilin
 * `alphabet` dizisindeki harfleri kullan (boşluk, tire, rakam yok).
 */
export const WORD_POOLS: Record<string, WordPool> = {
  tr: { alphabet: ALPHABET, normalize: trNormalize, words: WORDS },
  en: { alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', normalize: latinNormalize, words: EN_WORDS },
  // İtalyan alfabesi 21 harftir; J K W X Y yalnızca alıntı sözcüklerde geçer
  // ve havuzda böyle bir sözcük yoktur, bu yüzden klavyeye de konmaz.
  it: { alphabet: 'ABCDEFGHILMNOPQRSTUVZ', normalize: latinNormalize, words: IT_WORDS },
  es: { alphabet: 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ', normalize: esNormalize, words: ES_WORDS },
  ar: { alphabet: 'ابتثجحخدذرزسشصضطظعغفقكلمنهويء', normalize: arNormalize, words: AR_WORDS },
};

/** Bilinmeyen ya da henüz doldurulmamış bir dil istenirse TR havuzuna düşer. */
export function getWordPool(locale: string): WordPool {
  const pool = WORD_POOLS[locale];
  return pool && pool.words.length ? pool : WORD_POOLS.tr;
}
