# Arada Kahve — Proje Bağlamı

> Son güncelleme: 2 Ekim 2026  
> Kapsam: Repository kaynak kodu ve migration dosyaları üzerinden teknik inceleme. Canlı Supabase projesinin şema, RLS, grant ve veri durumu ayrıca doğrulanmamıştır.

## 1. Dokümanın amacı

Bu belge, projeyi daha önce görmemiş bir geliştiricinin ürünün amacını, kullanıcı akışlarını, kod organizasyonunu, Supabase entegrasyonunu ve bilinen risklerini uçtan uca anlayabilmesi için hazırlanmıştır.

Repository çok kiracılı bir kafe/işletme deneyimi uygulamasıdır. Her işletme bir `tenantId` ile ayrılır. Misafirler masadaki QR koddan uygulamaya girer, oyunlara ve sosyal içeriklere erişir, skor ve XP kazanır, damga toplar ve belirli koşullarda kasada kullanılabilecek ikram kuponu alır. İşletmeci aynı tenant için mobil odaklı bir panelden kupon, masa, içerik, tema, oyun ve metrik yönetir.

Bu belge mevcut uygulamayı tarif eder; güvenlik açısından ideal mimariyi temsil etmez. Özellikle yönetici kimliği, müşteri PIN'leri, istemci erişimli Supabase RPC'leri ve migration bütünlüğü için aşağıdaki risk bölümleri dikkate alınmalıdır.

## 2. Ürün amacı ve kullanıcılar

### 2.1 Ürün amacı

Ürün, fiziksel mekândaki masa deneyimini oyunlaştırmayı amaçlar:

- QR ile misafiri tenant ve masa bağlamında uygulamaya almak.
- Tek başına, masayla veya mekândaki başka kişilerle oynanabilen oyunlar sunmak.
- Günün sorusu, sohbet kartları ve benzeri içeriklerle masa etkileşimini artırmak.
- Oyun, skor, XP, damga ve süre bazlı ödülleri tek deneyimde birleştirmek.
- Kazanılan ikramı kısa kodla kasada doğrulamak.
- İşletmeciye canlı masa görünümü, içerik yönetimi ve temel metrikler sağlamak.
- Tema, marka ve oyun seçimini tenant bazında değiştirmek.

### 2.2 Kullanıcı tipleri

Uygulamada Supabase Auth tabanlı gerçek bir rol sistemi yoktur. Kod düzeyinde şu kullanıcı tipleri bulunur:

1. **Misafir/oyuncu**
   - QR veya tenant URL'si ile girer.
   - Takma ad, avatar ve isteğe bağlı dört haneli PIN kullanır.
   - Oyun, günlük soru, XP, damga ve ödül akışlarını kullanır.
2. **İşletmeci/barista/kasa kullanıcısı**
   - `/{tenant}/admin` ekranına parola/PIN ile girer.
   - Kupon kullanır, damga taleplerini onaylar ve işletme ayarlarını yönetir.
3. **Platform yöneticisi**
   - Ayrı bir süper admin rolü veya arayüzü bulunmamıştır.

## 3. Ana kullanıcı akışları

### 3.1 Misafir giriş ve lobi akışı

1. Misafir `/{tenant}` adresine gelir.
2. `app/[tenant]/layout.tsx`, tenant kimliğini doğrular ve `tenant_settings` verisini yükler.
3. Veritabanında tenant satırı yoksa `config/tenant.config.ts` içindeki varsayılan kampanya/tema kullanılır.
4. Karşılama görünümünden oyun lobisine geçilir.
5. Lobi; oyunlar, etkinlik/skor ekranları ve sadakat alanını sunar.
6. Alt menüden profil ve diğer ana bölümlere erişilir.

Ana dosyalar:

- `app/[tenant]/page.tsx`
- `app/[tenant]/layout.tsx`
- `components/Landing.tsx`
- `components/GuestProviders.tsx`
- `components/GuestDock.tsx`
- `lib/venueHome.ts`
- `lib/campaignState.ts`

### 3.2 QR → masa → oyuncu → oyun → skor → XP → ödül → kupon → kasa

Uçtan uca akış şöyledir:

```text
QR URL
  → tenant sayfası
  → masa kodunun URL'den okunması
  → imzalı cihaz kimliği oluşturma/okuma
  → tables + table_sessions kaydı
  → oyuncu kimliği ve profil
  → oyun seçimi
  → oyun başlangıcının masa oturumuna yazılması
  → oyun skoru ve/veya XP
  → aktif oyun süresinin sunucuda birikmesi
  → süre dolunca reward_coupons kaydı ve kısa kod
  → kullanıcı kodu kasaya gösterir
  → işletmeci kodu kullanılmış olarak işaretler
```

Detaylar:

1. QR'nin `/{tenant}?tableId=4`, `/{tenant}?masa=4` veya `/{tenant}?m=4` biçimlerinden biriyle gelmesi beklenir.
2. `lib/tableSession.ts` masa kodunu normalize eder ve sorgu parametresini adres çubuğundan siler.
3. `components/TableSessionBootstrap.tsx`, URL'deki veya tenant bazlı `localStorage` önbelleğindeki kodla `/api/economy/tables/join` isteği gönderir.
4. Sunucu `arada_device` adlı HMAC imzalı, `httpOnly`, `sameSite=lax` cihaz çerezini okur veya oluşturur. Varsayılan ömrü 180 gündür.
5. Join route'u verilen masa kodu için `tables` satırını upsert eder ve cihaz için aktif `table_sessions` kaydı oluşturur/günceller.
6. Oyuncunun lobi ve Realtime kimliği ayrıca `sessionStorage` içindeki `duel_client_id` üzerinden üretilir. Bu kimlik sunucudaki imzalı cihaz kimliğinden ayrıdır.
7. Oyun açıldığında `components/GameContainer.tsx`, aynı route'a `action: "start"` göndererek `start_table_game` RPC'sini tetikler. Oyun kapanırken `action: "end"` gönderilir.
8. Quiz ve Block Blast skorları leaderboard RPC'sine gönderilir. Diğer oyunlar etkinlik türüne göre sabit XP üretebilir.
9. `/api/economy/xp` istemciden XP miktarı kabul etmez; yalnızca aktivite adı ve isteğe bağlı skor alır. XP miktarını `award_xp` RPC'si `xp_configs` üzerinden hesaplar.
10. `components/PlayRewardProvider.tsx` ve `hooks/useRewardTimer.ts`, aktif ve görünür oyun sırasında `/api/economy/play/heartbeat` çağrılarıyla süreyi ilerletir.
11. Sunucu `play_sessions.elapsed_seconds` değerini tutar. Hedef süreye ulaşılınca `reward_coupons` tablosuna bir kupon kaydı yazılır ve kupon kodu istemciye döner.
12. Ödül ekranı isteğe bağlı pusula soruları ile ürün önerisi gösterebilir.
13. Kasa kullanıcısı kodu panelde girer. `/api/economy/coupons/redeem`, yönetici parolasını doğrular ve kuponu `REDEEMED` durumuna geçirir.

Önemli güncel davranış: `TableSessionBootstrap` masa join isteğini girişte/kimlik değişiminde bir kez yapar. Önceki periyodik 30 saniyelik masa ping'i çalışma ağacında kaldırılmıştır. `fetchActiveTableSessions` ise son görülme zamanına iki dakikalık istemci filtresi uygular. Uzun süre aynı sayfada kalan ve başka bir masa/oyun isteği üretmeyen kullanıcıların panelde aktif görünmesi bu nedenle kırılgan olabilir.

## 4. Teknoloji stack'i

### Uygulama

- **Next.js 16.3.4** — App Router, React Server Components ve route handler'ları.
- **React 19.2.8**.
- **TypeScript 5**.
- **Tailwind CSS 4** — `@tailwindcss/postcss` ile.
- **Framer Motion 13** — oyun ve arayüz animasyonları.
- **Lucide React** — ikonlar.
- **canvas-confetti** — ödül/başarı efektleri.

### Veri ve altyapı

- **Supabase JavaScript SDK 2.x**.
- **Supabase PostgreSQL** — kalıcı veri, RPC, trigger ve RLS.
- **Supabase Realtime** — presence, broadcast ve Postgres değişiklikleri.
- README dağıtım hedefi olarak **Vercel** belirtir; repository içinden canlı dağıtım doğrulanmamıştır.
- PWA manifest'i ve `/sw.js?v=2` servis çalışanı kaydı vardır.

Not: `README.md` hâlâ Next.js 14 yazmaktadır; gerçek paket sürümü `package.json` ve kilit dosyasında Next.js 16.3.4'tür.

## 5. Önemli klasörler ve dosyalar

```text
app/
  [tenant]/                 Tenant kapsamlı misafir ve işletmeci rotaları
  api/                      Next.js sunucu route handler'ları
  admin/, kasa/             Varsayılan tenant'a yönlendirme rotaları
components/                 Oyunlar, sağlayıcılar, lobi ve admin arayüzü
config/tenant.config.ts     Varsayılan marka, metin, tema, oyun ve ödül ayarları
hooks/useRewardTimer.ts     Oyun süresi ve heartbeat orkestrasyonu
lib/                        İş kuralları, Supabase istemcileri ve veri erişimi
public/                     Görseller, oyun kapakları ve PWA varlıkları
supabase/migrations/        Ardışık SQL migration'ları
scripts/                    Yardımcı üretim script'leri
```

Özellikle bilinmesi gereken dosyalar:

- `config/tenant.config.ts`: Büyük varsayılan tenant konfigürasyonu, tüm kullanıcı metinleri, tema paletleri, oyun ayarları ve fallback değerleri.
- `lib/campaignState.ts`: `tenant_settings` satırını uygulama modeline çevirir, eski/yeni kolon uyumluluğunu yönetir ve değişikliklere abone olur.
- `lib/tenant.ts`: Tenant kimliği, tema, logo, kategori ve varsayılan değer yardımcıları.
- `lib/supabase.ts`: Tarayıcı/anon Supabase istemcisi.
- `lib/supabaseAdmin.ts`: Sunucu/service-role Supabase istemcisi.
- `lib/deviceCookie.ts`: Sunucuda kullanılan imzalı cihaz kimliği.
- `lib/economy.ts`: XP, damga ve ekonomi istemci API katmanı.
- `lib/economyServer.ts`: Service-role istemcisi, tenant okuma ve yönetici parolası doğrulama.
- `lib/tableSession.ts`: QR parametreleri, masa önbelleği ve masa oturumu işlemleri.
- `lib/playReward.ts`: Süre bazlı ödülün istemci durumu ve heartbeat çağrıları.
- `lib/duelLeaderboard.ts`: Skor gönderme ve leaderboard sorguları.
- `lib/dailyQuestion.ts`: Günün sorusu, yanıt, beğeni ve moderasyon işlemleri.
- `components/DuelProvider.tsx`: Oyuncu kimliği, lobi presence, challenge ve çizim odası durumu.
- `components/GameContainer.tsx`: Oyun kabuğu, masa oyun başlangıç/bitiş bildirimi ve ödül durumu.
- `components/AdminDashboard.tsx`: İşletmeci panelinin tüm sekmeleri.

## 6. Frontend mimarisi

### 6.1 Route yapısı

Tenant kapsamlı ana rotalar:

- `/{tenant}` — karşılama ve lobi.
- `/{tenant}/profile` — misafir profili ve yerel hesap işlemleri.
- `/{tenant}/draw` — Çiz & Bil.
- `/{tenant}/trivia` — bilgi yarışması.
- `/{tenant}/blockblast` — Block Blast.
- `/{tenant}/taboo` — Tabu.
- `/{tenant}/whoami` — Ben Kimim.
- `/{tenant}/icebreaker` — sohbet kartları.
- `/{tenant}/wheel` — Hesap Kimde.
- `/{tenant}/duel` — eski/genel düello lobisi.
- `/{tenant}/admin` — işletmeci paneli.
- `/{tenant}/kasa` — `/{tenant}/admin` adresine yönlenir.

Kök `/admin` ve `/kasa`, varsayılan tenant'a yönlenir. Kök `/` de varsayılan tenant'a yönlendirme katmanıdır.

### 6.2 Provider katmanı

Misafir rotaları çoğunlukla şu provider zincirini kullanır:

```text
TenantProvider
  → DuelProvider
    → PlayRewardProvider
      → TableSessionBootstrap
      → sayfa içeriği
      → RewardClaimModal
      → DuelStage
```

- `TenantProvider`, tenant kampanya/tema durumunu taşır.
- `DuelProvider`, oyuncu kimliği, lobi ve eşleşme/çizim durumunu taşır.
- `PlayRewardProvider`, oyun süresini ve kupon açılmasını yönetir.
- `TableSessionBootstrap`, QR veya önbellek üzerinden masaya bağlar.
- `DuelStage`, aktif eşleşme veya çizim odasını üst katmanda gösterir.

### 6.3 Durum saklama

Uygulama üç farklı durum katmanı kullanır:

- **Supabase/PostgreSQL:** tenant ayarları, müşteri, skor, masa, XP, damga, kupon ve günlük soru verileri.
- **`localStorage`:** tenant bazlı masa önbelleği, bazı oyun oturumları, profil ve ödül yardımcı durumu.
- **`sessionStorage`:** düello oyuncu kimliği, aktif eşleşme, admin panel kilidi ve oturum bazlı analytics bayrakları.

Bu katmanlar arasında tek bir merkezi kimlik modeli yoktur; bilinen bug ve teknik borçların önemli bölümü buradan kaynaklanır.

## 7. Backend mimarisi

Backend iki farklı erişim biçiminden oluşur:

1. **Next.js API route'ları**
   - Service-role anahtarıyla güvenilir ekonomi işlemlerini yürütür.
   - İmzalı cihaz çerezini kullanır.
   - Bazı yönetici işlemlerinde parolayı sunucuda tekrar doğrular.
2. **Tarayıcıdan doğrudan Supabase**
   - Tenant ayarları, analytics, günlük soru, profil, leaderboard ve Realtime işlemlerinin bir bölümü anon istemciyle yapılır.
   - Güvenlik bütünü Supabase grant ve RLS politikalarına bağlıdır.

Bu hibrit yapı geçiş hâlindedir. Ekonomi işlemleri büyük ölçüde service-role API sınırına taşınmıştır; profil, içerik ve bazı yönetim işlemleri hâlâ istemci erişimlidir.

## 8. Next.js API route'ları

### Tenant ayarları

- `GET /api/tenant-settings?id={tenant}`
  - `tenant_settings` satırını `select("*")` ile döndürür.
  - Satır yoksa 404 döner.
- `PUT /api/tenant-settings?id={tenant}`
  - Kampanya modelini veritabanı satırına çevirir ve update/upsert yapar.
  - Eski şemalarda bulunmayan opsiyonel kolonları hatadan tespit edip payload'dan çıkararak tekrar dener.
  - Route içinde sunucu taraflı yönetici doğrulaması yoktur.

Dosya: `app/api/tenant-settings/route.ts`

### Ekonomi ve oturum route'ları

- `GET|POST /api/economy/status`
  - Haftalık lider damgasını sonuçlandırmayı dener.
  - Cihazın XP/damga/ödül durumunu `get_economy_status` ile döndürür.
- `POST /api/economy/xp`
  - Aktivite adı ve skor alır; XP miktarını sunucu/RPC hesaplar.
  - Quiz ve Block Blast için yakın zamanda heartbeat ve en az 30 saniye oyun koşulu arar.
- `GET /api/economy/xp-configs`
  - XP kurallarını listeler.
  - Kayıt yoksa varsayılan kuralları oluşturur; dolayısıyla GET yazma yan etkisine sahiptir.
- `POST /api/economy/xp-configs`
  - Yönetici parolasını doğrulayıp XP kuralını günceller.
- `POST /api/economy/stamps/request`
  - Masa/kasa moduna göre damga talebi ve üç haneli kod üretir.
- `POST /api/economy/stamps/approve`
  - Yönetici parolasını doğrulayıp talebi onaylar.
- `POST /api/economy/stamps/redeem`
  - Altı damgayı kısa süreli kullanım kanıtına çevirir.
- `POST /api/economy/play/heartbeat`
  - Aktif oyun süresini sunucuda ilerletir ve süre dolunca kupon üretir.
- `POST /api/economy/play/reset`
  - İlgili cihazın `play_sessions` kaydını siler. Arayüzde test/sıfırlama yardımcısı olarak erişilebilmektedir.
- `POST /api/economy/coupons/redeem`
  - Yönetici parolasını doğrular, kuponu bulur ve kullanılmış işaretler.
- `POST /api/economy/tables/join`
  - `join`, `start` ve `end` eylemlerini aynı route içinde işler.

Dosyalar: `app/api/economy/**/route.ts`

## 9. Supabase entegrasyonu

### 9.1 İstemciler

- `lib/supabase.ts`, `NEXT_PUBLIC_SUPABASE_URL` ve `NEXT_PUBLIC_SUPABASE_ANON_KEY` ile tarayıcı istemcisi üretir.
- `lib/supabaseAdmin.ts`, sunucuda `SUPABASE_SERVICE_ROLE_KEY` kullanır.
- `lib/economyServer.ts`, ekonomi route'larına service-role istemcisi sağlar.

Service-role anahtarı hiçbir istemci bundle'ına geçirilmemelidir. Şu an yalnızca sunucu yardımcılarında kullanılmaktadır.

### 9.2 Başlıca tablolar

| Tablo | Amaç | Başlıca ilişkiler/durum |
|---|---|---|
| `tenant_settings` | Tenant marka, tema, oyun, kampanya ve işletme ayarları | `id` tenant anahtarıdır. Başlangıç `CREATE TABLE` migration'ı repository'de yoktur. |
| `campaign_events` | Oturum ve kampanya analytics olayları | Başlangıç migration'ı repository'de yoktur. |
| `customers` | Tenant + client kimliği, profil, XP ve damga toplamları | `(tenant_id, client_id)` benzersizdir. PIN düz metin alan olarak ele alınır. |
| `tables` | Tenant içindeki masa kodu ve etiketi | `(tenant_id, code)` benzersizdir. |
| `table_sessions` | Cihazın aktif masası ve oynadığı oyun | `client_id`, `status`, `last_seen_at`, oyun başlangıç/bitiş alanları. |
| `duel_quiz_scores` | Quiz ve Block Blast leaderboard skorları | Tenant, oyuncu, oyun türü ve kategori bilgileri. |
| `daily_questions` | Tenant'ın aktif/günlük sorusu | Tenant başına tek aktif soru için partial unique index. |
| `daily_answers` | Misafir yanıtları | Onay/pending ve gizleme durumu, beğeni sayısı. |
| `daily_answer_likes` | Yanıt beğenileri | Yanıt + client kimliği üzerinden tekil beğeni. |
| `xp_configs` | Aktivite başına XP hesaplama kuralları | `base_xp`, `multiplier`, `max_xp_per_action`, `enabled`. |
| `stamp_requests` | Bekleyen/onaylanan/süresi dolan damga talepleri | Üç haneli kod, masa etiketi, üç dakikalık süre. |
| `stamp_redeem_proofs` | Altı damganın ödüle çevrildiğini gösteren kısa kanıt | Üç haneli kod ve kısa son kullanım süresi. |
| `play_sessions` | Sunucu sahipli oyun süresi | Cihaz, biriken saniye, heartbeat, kupon kodu. |
| `reward_coupons` | Süre bazlı ikram kuponları | Tenant + kupon kodu benzersiz; `ACTIVE`/`REDEEMED`. |
| `claimed_rewards` | Önceki/alternatif ödül kayıt sistemi | Yeni `reward_coupons` akışıyla birlikte eski yol olarak duruyor. |
| `weekly_stamp_awards` | Haftalık XP liderine verilen damganın idempotency kaydı | Tenant + hafta için tek sonuç. |

## 10. Auth, roller ve RLS

### 10.1 Misafir kimliği

Supabase Auth kullanılmaz. Misafir tarafında iki kimlik vardır:

- `sessionStorage` içindeki oyun/düello `clientId`.
- `arada_device` imzalı çerezindeki sunucu ekonomi cihaz kimliği.

Profil `customers` tablosunda takma ad, PIN ve avatar ile tutulur. PIN eşleştirmesi uygulama/RPC akışında yapılır; parola hash altyapısı yoktur.

İlgili dosyalar:

- `lib/duel.ts`
- `lib/guestAuth.ts`
- `lib/customerProfile.ts`
- `lib/deviceCookie.ts`

### 10.2 İşletmeci kimliği

Panel girişinde:

1. Kullanıcı parolayı formda girer.
2. `adminPasswordAccepted` istemciye yüklenmiş kampanya parolası, barista PIN'i veya kod içi fallback ile karşılaştırır.
3. Başarılı sonuç tenant bazlı `sessionStorage` anahtarında tutulur.
4. Bazı hassas ekonomi route'ları parolayı ayrıca sunucuda `tenant_settings.admin_password` ile doğrular.

Panel kilidi gerçek bir sunucu oturumu değildir. Route koruması, kullanıcı rolü, süresi dolan token veya Supabase Auth claim'i bulunmaz.

### 10.3 RLS ve grant yaklaşımı

Migration'larda tabloların çoğunda RLS etkinleştirilir; ancak ilk migration'larda geniş `anon`/`authenticated` politikaları vardır. Daha yeni `20260925120000_economy_trust_boundary.sql`, ekonomi tablolarındaki istemci insert/update/delete yetkilerini kaldırır ve ekonomi RPC'lerini service-role API'lerine taşımaya çalışır.

Önemli noktalar:

- `customers` üzerinde public select politikası vardır; profil ve PIN verisinin görünürlüğü risklidir.
- `daily_questions`, `daily_answers` ve beğeni tablolarında geniş anon politikaları bulunur.
- `save_customer_profile`, `park_customer_client` ve `rebind_customer_client` RPC'leri anon/authenticated rollerine açıktır.
- `publish_daily_question` RPC'si anon/authenticated rollerine açıktır.
- Ekonomi RPC'lerinde son migration anon/authenticated grant'lerini kaldırsa da efektif `PUBLIC` yetkileri canlı veritabanında ayrıca doğrulanmalıdır.
- Service-role RLS'yi bypass eder; API route doğrulaması bu nedenle tek güven sınırıdır.

## 11. İşletmeci paneli

Panel `components/AdminDashboard.tsx` içinde beş sekmeden oluşur.

### 11.1 Kasa

- Kupon kodunu arar ve kullanır.
- Kullanılan kuponun ödül, masa ve zaman bilgisini gösterir.
- Bekleyen damga taleplerini ve kısa kodlarını listeler.
- Damga talebini yönetici parolasıyla onaylar.
- Stamp request değişikliklerini Realtime ile izler.

İlgili modüller: `lib/rewardCoupons.ts`, `lib/economy.ts`.

### 11.2 Masalar

- `get_active_table_sessions` RPC'sinden aktif masa oturumlarını çeker.
- Masa, oyuncu adı, aktif oyun, masada geçen süre ve oyunda geçen süreyi gösterir.
- İstemci son `last_seen_at` zamanı iki dakikadan eski satırları filtreler.
- Güncel bootstrap davranışında sürekli join ping'i olmadığı için aktiflik verisinin sürekliliği oyun/heartbeat işlemlerine bağlı olabilir.

İlgili modüller: `lib/tableSession.ts`, `components/TableSessionBootstrap.tsx`.

### 11.3 Mekan

- Marka adı, logo, mekan kategorisi ve ana ekran metinlerini düzenler.
- Tema paletini ve logo biçimini seçer.
- Google değerlendirme ve Instagram URL'lerini yönetir.
- Oyunların açık/kapalı durumunu yönetir.
- Pusula/ürün önerisi akışını açıp kapatır.
- Mekan modunu `masa` veya `kasa` olarak ayarlar.
- Yönetici parolasını değiştirir.
- Ayarlar `tenant_settings` üzerinden saklanır.

### 11.4 Soru

- Yeni günlük soru yayınlar; önceki aktif soruyu pasif hâle getirir.
- Pending cevapları onaylar, gizler veya silmeye çalışır.
- Cevaplar için küfür/uygunsuz içerik filtresi ve moderasyon durumu vardır.
- Soru/cevap güncellemeleri Realtime ile izlenir.

İlgili modüller: `lib/dailyQuestion.ts`, `lib/profanityFilter.ts`.

### 11.5 Metrikler

- Kampanya olaylarından oturum, pusula/quiz tamamlama, Google yönlendirme ve ödül kullanım sayılarını çıkarır.
- Günlük ve toplam kupon metriklerini gösterir.
- XP aktivite kurallarını listeler ve düzenler.
- Ortalama masa kalış süresi mevcut implementasyonda tamamlanmamıştır; değer `null` kalabilir.

İlgili modüller: `lib/analytics.ts`, `lib/rewardCoupons.ts`, `lib/economy.ts`.

## 12. Oyunlar ve skor sistemi

### 12.1 Güncel katalog

`lib/gameCatalog.ts` içindeki görünür oyunlar:

- **Çiz & Bil (`draw`)** — ortak kafe odası veya PIN ile özel oda; Realtime broadcast/presence.
- **Bilgi Yarışması (`quiz`/`trivia`)** — yerel soru bankası, skor ve leaderboard.
- **Block Blast (`blockblast`)** — yerel board state, skor ve leaderboard.
- **Tabu (`taboo`)** — takım/masa oyunu, yerel oturum.
- **Ben Kimim (`whoami`)** — yerel oturum.
- **Sohbet Kartları (`talk`/`icebreaker`)** — kategori ve prompt akışı.
- **Hesap Kimde (`bill`/`wheel`)** — isimler arasında çark seçimi.

`DuelGameId` altında `trivia`, `emoji`, `swipe`, `number` ve `quiz` eski/genel düello modları da bulunmaktadır. Bunların kodu Realtime eşleşme sisteminde durur; güncel ana oyun kataloğu tümünü ayrı kart olarak sunmaz.

### 12.2 Skor

- Quiz ve Block Blast sonuçları `submit_duel_quiz_score` RPC'si ile `duel_quiz_scores` tablosuna yazılır.
- Leaderboard `get_duel_quiz_leaderboard` RPC'si ile tenant, oyun türü ve isteğe bağlı kategori bazında okunur.
- RPC imzaları zaman içinde genişletildiği için `lib/duelLeaderboard.ts` yeni imzayı dener, hata olursa eski imzalara fallback yapar.
- Skor RPC'si istemciden gelen skoru kabul eder; oyunun gerçek akışını sunucuda yeniden hesaplamaz.
- Quiz ve Block Blast XP'si için API en az 30 saniyelik güncel play session arar; bu kontrol leaderboard skorunun doğruluğunu tek başına sağlamaz.

## 13. XP ve ekonomi mantığı

### 13.1 XP hesaplama

Temel formül `award_xp` RPC'sinde `xp_configs` üzerinden çalışır:

```text
hesaplanan XP = base_xp + score × multiplier
verilen XP = min(hesaplanan XP, max_xp_per_action, günlük kalan limit)
```

Kritik kurallar:

- Günlük toplam XP limiti: **100**.
- XP miktarını istemci doğrudan göndermez.
- Aktivite kapalıysa XP verilmez.
- Quiz ve Block Blast için en az 30 saniye oyun ve son üç dakika içinde heartbeat aranır.
- `customers.xp_day` ve `xp_day_earned` günlük sayacı tutar.
- Toplam XP `customers.xp_total` alanında tutulur.
- Her haftanın önceki dönem lideri `settle_weekly_leader_stamp` ile bir damga alabilir.
- `weekly_stamp_awards`, aynı tenant/hafta ödülünün tekrar verilmesini engeller.

Varsayılan aktiviteler `gunun_sorusu`, `quiz`, `blockblast`, `taboo`, `whoami`, `draw` ve `mini_oyun`dur. Sayısal ayarlar `xp_configs` tablosundan tenant bazında değiştirilebilir.

### 13.2 Damga sistemi

- Hedef: **6 damga**.
- Aynı müşteri için onaylar arasında varsayılan bekleme: **12 saat**.
- Talep kodu: üç haneli ve **3 dakika** geçerli.
- `venue_mode = masa` ise aktif masa etiketi zorunludur.
- `venue_mode = kasa` ise masa zorunluluğu kalkar.
- Talep oluşturma eski pending talepleri expired yapar.
- İşletmeci talebi onaylayınca `customers.stamp_count` en fazla hedefe kadar artırılır.
- Altı damga kullanıldığında sayaç altı azalır ve üç dakikalık `stamp_redeem_proofs` kaydı üretilir.

### 13.3 Ekonomi koruma trigger'ları

- `protect_customer_economy` istemci kaynaklı müşteri update'lerinin XP/damga alanlarını değiştirmesini engellemeyi amaçlar.
- `protect_customer_economy_insert` güvenilir ekonomi yazma bağlamı yoksa yeni müşterinin XP/damga alanlarını sıfırlar.
- `protect_stamp_request` istemci kaynaklı damga durumu değişikliklerini korur.
- Güvenilir fonksiyonlar transaction-local `app.economy_write = '1'` ayarıyla korumalı alanları günceller.

## 14. Süre bazlı ödül ve kupon sistemi

### 14.1 Oyun süresi

- Varsayılan hedef süre `config/tenant.config.ts` içinde **1200 saniye/20 dakika**dır.
- İstemci görünür ve oyun aktifken heartbeat yollar.
- Sunucu heartbeat aralığını ve önceki zamanı kullanarak `play_sessions.elapsed_seconds` değerini ilerletir.
- İstemci tarafındaki sayaç görsel geri bildirim sağlar; güvenilir kupon kararı sunucu süresinden verilmelidir.
- Yerel sayaç tek tick'te en fazla iki saniye kredi verir.

### 14.2 Kupon üretimi

- Süre hedefe ulaşınca heartbeat route'u `reward_coupons` satırı üretir.
- Kupon kodu `play_sessions.coupon_code` alanına da bağlanır; aynı oturum için tekrar üretimi önlenmeye çalışılır.
- Ödül metni ve masa bilgisi kuponla tutulabilir.
- Ödül modalı kuponu göstermeden önce isteğe bağlı pusula soruları ve ürün eşleştirmesi sunabilir.
- Pusula kapalıysa kullanıcı doğrudan sonuç/kupon adımına ilerler.

### 14.3 Kupon kullanımı

- Kasa kullanıcısı kupon kodu ve yönetici parolası gönderir.
- Route tenant + kod ile kuponu bulur.
- Zaten `REDEEMED` ise tekrar kullanımı reddeder.
- Aksi durumda `status = REDEEMED` ve `redeemed_at = now()` yazar.
- Mevcut read-then-update işlemi atomik değildir; eşzamanlı kullanımlarda yarış koşulu riski vardır.

Repository'de `claimed_rewards` tabanlı eski/alternatif ödül yardımcıları da bulunur. Güncel süre ekonomisinin ana yolu `play_sessions` + `reward_coupons` sistemidir.

## 15. PostgreSQL RPC, function ve trigger'ları

### Profil ve müşteri

- `save_customer_profile`
- `park_customer_client`
- `rebind_customer_client`
- `ensure_customer_row`
- Trigger: `trg_protect_customer_economy`
- Trigger: `trg_protect_customer_economy_insert`

### Masa ve oturum

- `ensure_venue_table`
- `join_table_session`
- `start_table_game`
- `end_table_game`
- `get_active_table_sessions`

Not: Güncel Next.js join route'u `tables` ve `table_sessions` için doğrudan service-role sorguları kullanır; `join_table_session` eski/alternatif RPC olarak migration'da kalmıştır. Start/end işlemleri RPC kullanır.

### Skor

- `submit_duel_quiz_score`
- `get_duel_quiz_leaderboard`

Bu fonksiyonların imzaları avatar, oyun türü ve kategori eklemeleriyle sonraki migration'larda yeniden tanımlanmıştır.

### Günlük soru

- `publish_daily_question`
- `like_daily_answer`

### Eski ödül sistemi

- `register_claimed_reward`
- `redeem_claimed_reward`

### XP, damga ve süre ekonomisi

- `award_xp`
- `create_stamp_request`
- `approve_stamp_request`
- `redeem_stamp_reward`
- `get_economy_status`
- `touch_play_session`
- `settle_weekly_leader_stamp`
- Trigger: `trg_protect_stamp_request`

Fonksiyon tanımlarının son ve efektif hâli için migration sırası önemlidir; aynı fonksiyonlar birden fazla migration'da `create or replace` edilir.

## 16. Realtime kullanılan yerler

Supabase Realtime aşağıdaki alanlarda kullanılır:

- `components/DuelProvider.tsx`
  - `tenant_{tenantId}_lobby` kanalı.
  - Presence ile çevrimiçi oyuncular.
  - Broadcast ile challenge/accept/decline/cancel mesajları.
- `components/DuelMatchContainer.tsx`
  - `match_{match.id}` kanalı.
  - Oyun cevabı, tur ve eşleşme senkronizasyonu.
- `components/DrawRoom.tsx`
  - Oda kimliğiyle kanal.
  - Çizim stroke'ları, tahminler, sıra ve presence.
- `lib/campaignState.ts`
  - `tenant_settings` Postgres change aboneliği.
- `lib/dailyQuestion.ts`
  - `daily_feed_{tenantId}` kanalıyla soru/yanıt değişiklikleri.
- `lib/economy.ts`
  - `stamp_requests:{tenantId}` kanalıyla kasa damga talepleri.

Migration'ların bazıları tabloları `supabase_realtime` publication'a eklemeyi dener. Canlı publication içeriği repository'den kesin olarak doğrulanamaz.

## 17. Migration yapısı

Migration'lar `supabase/migrations/` altında zaman damgalı SQL dosyalarıdır. Tarih sırasına göre başlıca evrim:

1. Oyunların tenant bazında açılıp kapanması.
2. Quiz leaderboard tablosu ve RPC'leri.
3. Eski `claimed_rewards` ve ardından `reward_coupons` sistemi.
4. Günlük soru/yanıt/beğeni sistemi.
5. Müşteri damga alanları ve profil kolonları.
6. Kullanılmayan live şemanın kaldırılması.
7. Masa ve masa oturumu sistemi.
8. Leaderboard'a avatar, kategori ve oyun türü eklenmesi.
9. Günlük cevap avatar ve moderasyon durumu.
10. Çift ekonomi: XP, damga talepleri ve kanıtları.
11. Güven sınırı: ekonomi yazılarının service-role API'lerine taşınması ve `play_sessions`.
12. Haftalık XP lideri damgası.

Migration'larla ilgili kritik sınırlamalar:

- `tenant_settings` için başlangıç `CREATE TABLE` migration'ı yoktur; dosyalar mevcut tabloyu alter eder.
- `campaign_events` için migration bulunmamıştır.
- Aynı fonksiyonlar farklı imzalarla tekrar oluşturulur; migration atlanırsa istemci fallback yollarına düşer.
- Kod bazı eksik kolonlarda payload alanlarını çıkarıp tekrar deneyerek şema farkını gizler.
- Çalışma ağacında `20260919120000_venue_tables_sessions.sql` üzerinde commit edilmemiş küçük bir sözdizimi temizliği bulunmaktadır. Bu belge güncel çalışma ağacını esas alır.
- Repository migration'larıyla boş bir Supabase projesinin eksiksiz kurulabileceği varsayılmamalıdır.

## 18. Environment değişkenleri ve dış servisler

Gerekli/okunan environment variable adları:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ECONOMY_COOKIE_SECRET
NODE_ENV
```

Kurallar:

- `NEXT_PUBLIC_*` değişkenleri istemciye açıktır; anon anahtarının güvenliği RLS ile sağlanmalıdır.
- `SUPABASE_SERVICE_ROLE_KEY` yalnızca sunucuda kullanılmalıdır.
- `ECONOMY_COOKIE_SECRET` cihaz çerezinin HMAC imzası içindir.
- `ECONOMY_COOKIE_SECRET` yoksa kod service-role anahtarını fallback secret olarak kullanır; ayrı secret tercih edilmelidir.
- Secret değerler hiçbir kaynak dokümanına veya istemci bundle'ına yazılmamalıdır.

Dış bağlantılar:

- Supabase PostgreSQL/Realtime.
- Google Maps değerlendirme URL'si.
- Instagram profil URL'si.
- Vercel, README'de hedef deployment olarak belirtilir.

## 19. Kritik iş kuralları

- Her veri işlemi tenant bağlamında yapılmalıdır; `tenant_id` filtresi atlanmamalıdır.
- Geçerli tenant kimliği harf/rakamla başlar; devamında harf, rakam, `_` veya `-` kullanır ve en fazla 64 karakterdir.
- `admin`, `api`, `offline` ve `favicon.ico` tenant kimliği olarak rezerve edilmiştir.
- Masa kodu sayı veya normalize edilmiş kısa metin olabilir; sayılar `Masa #N` etiketi alır.
- Mevcut join akışı bilinmeyen masa kodunu reddetmez; yeni `tables` satırı oluşturabilir.
- Oyunların kapalı olması şu an temel olarak kart görünürlüğünü kontrol eder; route seviyesinde zorunlu koruma değildir.
- Quiz/Block Blast XP'si için güncel heartbeat ve en az 30 saniye gerekir.
- Günlük XP tavanı 100'dür.
- Damga hedefi 6, onay bekleme süresi 12 saat, kod süresi 3 dakikadır.
- Masa modunda damga talebi için aktif masa gerekir; kasa modunda gerekmez.
- Oyun ödül hedefi varsayılan olarak 20 dakikadır.
- Kupon kodu tenant kapsamında benzersiz olmalıdır ve yalnızca bir kez kullanılmalıdır.
- Haftalık lider ödülü tenant ve hafta bazında idempotent olmalıdır.
- Günlük soruda tenant başına tek aktif soru hedeflenir.
- Misafir akışı Supabase hatalarında mümkün olduğunca çalışmaya devam edecek şekilde best-effort/fallback davranışları kullanır.

## 20. Tamamlanmış görünen özellikler

Kod düzeyinde uygulanmış özellikler:

- Tenant bazlı tema, marka, metin ve oyun ayarları.
- Mobil karşılama ekranı, lobi ve alt navigasyon.
- QR parametresinden masa oturumu oluşturma ve yerel masa önbelleği.
- Yedi görünür oyun ve eski düello altyapısı.
- Realtime oyuncu lobisi, challenge sistemi ve çizim odaları.
- Quiz ve Block Blast leaderboard'u.
- Misafir profil/takma ad/avatar/PIN akışı.
- Günlük soru, yanıt, beğeni ve moderasyon.
- XP konfigürasyonu, günlük limit ve haftalık lider damgası.
- Damga talebi, kasa onayı ve damga ödülü kanıtı.
- Sunucu tabanlı oyun süresi ve kupon üretimi.
- Kasa kupon kullanımı.
- Canlı masa ve aktif oyun görünümü.
- İşletmeci tema, marka, oyun ve sosyal bağlantı ayarları.
- PWA manifest'i, servis çalışanı kaydı ve çevrimdışı uyarısı.

“Tamamlanmış” burada kod yolunun mevcut olduğunu belirtir. Repository incelemesinde uçtan uca canlı ortam testi yapılmamıştır.

## 21. Yarım, eski veya geçici implementasyonlar

- Başlangıç Supabase şeması repository'de tam değildir.
- `tenant_settings` route'u eksik kolonları hata mesajından çıkarıp tekrar deneyen geçici uyumluluk katmanı kullanır.
- Daily question ve leaderboard katmanlarında eski RPC/kolon imzalarına fallback vardır.
- `claimed_rewards` ve `reward_coupons` olmak üzere iki ödül modeli birlikte durur.
- Ana katalog dışında kalan eski düello oyunları ve `/duel` rotası hâlâ kod tabanındadır.
- Profilde hesap silme akışı yerel veriyi temizler; veritabanındaki müşteri kaydını gerçek anlamda silmez.
- Metriklerde ortalama masa kalış süresi tamamlanmamıştır.
- QR görseli üretimi veya masa QR yönetim ekranı yoktur; sistem dışarıda hazırlanmış URL'leri bekler.
- Platform/süper admin arayüzü yoktur.
- Test/sıfırlama yardımcıları misafir arayüzünde erişilebilir durumdadır.
- README teknoloji ve ürün mimarisini güncel yansıtmaz.
- Otomatik test script'i veya belirgin test paketi bulunmamıştır.

## 22. Bilinen ve potansiyel buglar

### Yüksek etkili

1. **İki ayrı müşteri kimliği**  
   Oyun/profil `sessionStorage` client kimliği, ekonomi ise imzalı cihaz çerezi kullanır. Profil, skor, XP ve damga farklı `customers`/oyuncu kayıtlarına bağlanabilir.

2. **Kök yönlendirmede QR parametresi kaybı**  
   QR doğrudan `/` adresine sorgu parametresiyle basılırsa varsayılan tenant yönlendirmesi parametreyi korumayabilir.

3. **Aktif masa tazeliği**  
   Bootstrap'teki periyodik join ping'i kaldırılmıştır. Panel iki dakikadan eski `last_seen_at` satırlarını gizlediği için hareketsiz ama hâlâ masada olan kullanıcı kaybolabilir.

4. **Kupon yarış koşulu**  
   Kupon kullanımı select + update olarak iki aşamalıdır. Atomik durum koşulu/tek RPC olmadığı için iki eşzamanlı istek aynı kuponu başarılı kullanmış gibi görebilir.

### Orta etkili

- Kapalı oyun route'una doğrudan URL ile girilebilir.
- Günlük cevap silme arayüzü, migration'daki anon grant/policy ile uyumsuz olup başarısız olabilir.
- Ödülün bazı istemci saklama anahtarları tenant'a özgü değildir; aynı tarayıcıda tenant'lar arası durum karışabilir.
- Join API bilinmeyen/uydurulmuş masa kodunu upsert eder; fiziksel masa envanteri doğrulanmaz.
- Masa join başarısız olsa bile masa yerelde cache'lenir; UI sunucuya bağlanmamış masayı aktif gösterebilir.
- Leaderboard skoru sunucuda oyundan yeniden üretilmediği için değiştirilebilir istemci skoru kabul edilir.
- GET status haftalık ödül yazımı, GET xp-configs ise varsayılan satır oluşturma yan etkisine sahiptir.
- XP varsayılan etiketlerinde dosya encoding bozulması işaretleri görülebilir; kullanıcıya yansıması doğrulanmalıdır.

## 23. Güvenlik riskleri

### Kritik

1. **Yönetici parolası istemciye açılıyor**  
   `GET /api/tenant-settings` tüm satırı döndürür ve model `admin_password` alanını içerir. Panel de parolayı istemcide karşılaştırır. Parola gerçek bir gizli bilgi olarak korunmamaktadır.

2. **Tenant ayarı yazma route'unda sunucu auth yok**  
   `PUT /api/tenant-settings` route'u yönetici oturumu/parolası doğrulamaz. Güvenlik yalnızca anon Supabase yetkilerine bırakılmıştır.

3. **Müşteri PIN'leri düz metin ve public select riski**  
   `customers` üzerindeki geniş select politikası ve düz metin PIN modeli, kullanıcı profillerinin ele geçirilmesine yol açabilir.

4. **Anon profil RPC'leri başkasının kimliğini değiştirebilir**  
   `save_customer_profile`, `park_customer_client` ve `rebind_customer_client` çağrıları güvenilir kullanıcı oturumuna bağlı değildir.

### Yüksek

- Günlük soru yayınlama ve cevap moderasyonu gerçek yönetici rolüyle korunmaz; anon erişimli tablo/RPC yolları vardır.
- Ekonomi RPC'lerinin son migration'daki `REVOKE` sonuçları canlı DB'de `PUBLIC`, `anon` ve `authenticated` için doğrulanmalıdır.
- QR/masa kodları imzasızdır ve join route yeni masa oluşturabilir.
- Admin panel kilidi yalnızca `sessionStorage` + bellek bayrağıdır; sunucu route koruması değildir.
- Skor ve bazı analytics olayları istemci tarafından üretilebilir/manipüle edilebilir.
- Service-role kullanan route'larda tenant ve işlem doğrulamasındaki her eksik kontrol tüm RLS sınırını bypass eder.
- Yönetici parolası düz metin karşılaştırılır; hash, rate limit, lockout ve oturum süresi yoktur.

### Orta

- `ECONOMY_COOKIE_SECRET` yoksa service-role anahtarı çerez imzası için kullanılır; sırların görevleri ayrılmamış olur.
- Cihaz kimliği 180 gün sürer; kullanıcı tarafından iptal/revoke mekanizması yoktur.
- İstemciye açık sosyal/logo URL'leri kaydedilirken izin verilen protokol/domain doğrulaması sınırlı görünmektedir.
- API route'larında belirgin rate limiting veya abuse throttling yoktur.

## 24. Teknik borçlar

- Tek ve sunucu doğrulamalı kullanıcı/cihaz kimliği bulunmuyor.
- Supabase Auth veya eşdeğer session/role sistemi yok.
- Şema kaynağı eksik; canlı DB ile migration geçmişi arasında olası drift var.
- İş mantığı `config/tenant.config.ts` içindeki büyük statik konfigürasyon, istemci modülleri, API route'ları ve SQL RPC'leri arasında dağılmış durumda.
- Aynı sabitler hem TypeScript hem SQL içinde tekrar ediyor: XP tavanı, damga hedefi, cooldown ve kod süreleri.
- Eski ve yeni ödül/duel yolları birlikte tutuluyor.
- Şema uyumluluğu kontrollü migration yerine runtime fallback ile yönetiliyor.
- Admin panelinin tamamı tek büyük `AdminDashboard.tsx` bileşeninde yoğunlaşıyor.
- Hata yakalama bloklarının önemli bölümü hatayı sessizce yutuyor; gözlemlenebilirlik sınırlı.
- Analytics istemci kaynaklı ve doğrulanmamış.
- Route, RPC ve RLS davranışlarını kapsayan otomatik entegrasyon testi yok.
- README, gerçek Next.js sürümü ve ekonomi mimarisiyle uyumsuz.
- Masa aktiflik semantiği net değil: join, heartbeat, oyun başlangıcı ve görünürlük farklı kaynaklardan güncelleniyor.

## 25. Geliştirmeye devam etmeden önce önerilen teknik sıra

1. Canlı Supabase şemasını repository migration'larıyla salt okunur karşılaştırmak.
2. Efektif tablo grant'lerini, RLS politikalarını ve function `PUBLIC` yetkilerini çıkarmak.
3. Yönetici parolasını istemciden kaldırıp sunucu oturumu ve rol doğrulaması kurmak.
4. Misafir profil, oyun ve ekonomi için tek kimlik sözleşmesi belirlemek.
5. Eksik başlangıç migration'larını oluşturup boş projeden tekrar kurulabilir şema sağlamak.
6. Kupon kullanımını tek atomik SQL fonksiyonu veya koşullu update içine almak.
7. QR masa envanteri ve imzalı/doğrulanabilir masa token'ı kararını vermek.
8. Aktif masa heartbeat ve expiry sözleşmesini tek yerde tanımlamak.
9. Kritik ekonomi ve yetki akışlarına entegrasyon testleri eklemek.
10. Eski ödül, düello ve compatibility yollarını planlı biçimde kaldırmak.

## 26. İnceleme sınırları

- Canlı Supabase'e bağlanılmadı.
- Migration çalıştırılmadı.
- Veritabanında okuma veya yazma yapılmadı.
- Dependency kurulmadı veya güncellenmedi.
- Build, lint ve otomatik test çalıştırılmadı.
- Environment variable değerleri ve secret'lar bu belgeye alınmadı.
- Tamamlanmış özellikler kaynak kodunun varlığına göre sınıflandırıldı; üretim ortamında uçtan uca doğrulanmadı.
