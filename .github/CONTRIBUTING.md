# NoX Finance'e Katkı Sağlama

NoX Finance, Expo ve React Native ile geliştirilen, verileri cihazdaki SQLite veritabanında tutan bir kişisel finans uygulamasıdır. Ödemeler, borçlar, alacaklar ve abonelikler üzerinde çalışırken mevcut kullanıcı verileriyle uyumluluğu koruyun.

## Hata ve özellik bildirimleri

Önce [mevcut konuları](https://github.com/Payroniz/nox-finance-app/issues) kontrol edin. Yeni bir bildirimde uygulama sürümünü, cihaz modelini, işletim sistemi sürümünü, tekrar oluşturma adımlarını ve beklenen sonucu belirtin. Ekran görüntülerindeki kişisel bilgileri gizleyin; gerçek finans kayıtları, yedek dosyaları veya PIN paylaşmayın.

Güvenlik açıkları için [güvenlik politikasını](SECURITY.md) izleyin.

## Geliştirme ortamı

Node.js 22.20 veya üzeri bir 22.x sürümü ve npm kullanın. Depoyu forklayıp kendi kopyanızı klonlayın:

```bash
git clone https://github.com/KULLANICI_ADINIZ/nox-finance-app.git
cd nox-finance-app
npm ci
git switch -c codex/degisiklik-aciklamasi
npm start
```

`npm run android` için Android SDK/JDK, `npm run ios` için macOS ve Xcode gerekir. `npm run web` tarayıcı önizlemesini açar; dosya erişimi, biyometri, bildirim ve yerel tarih seçici gibi özellikler ayrıca gerçek cihazda doğrulanmalıdır. `npm run build:android` EAS hesabı ve proje erişimiyle preview APK derlemesi başlatır.

## Değişiklikleri doğrulama

```bash
npm run lint
npm run typecheck
npm test
npx expo export --platform android
```

- ESLint ayarları `.github/eslint.config.mjs` içindedir; `npm run lint` bu dosyayı açıkça kullanır.
- Testler yenileme tarihlerini, para birimi toplamlarını, gerçek SQLite işlemlerini ve taklit dosya adaptörleriyle yedekleme hata senaryolarını kontrol eder. `npm test` uygulamayı başlatmaz.
- Veritabanı değişiklikleri mevcut kayıtları korumalıdır. Yeni alanları yedek dışa/içe aktarma ve tüm verileri silme akışlarına dahil edin; eski yedekleri de test edin.
- Görsel değişiklikleri dar ekranlarda, klavye açıkken ve güvenli ekran alanlarıyla kontrol edin.
- Expo/React Native bağımlılıklarını SDK uyumluluğuna göre güncelleyin. Gerekirse `npx expo install --check` kullanın; `package-lock.json` değişikliklerini birlikte ekleyin.
- Açılış ekranı ve native yapılandırma değişiklikleri için yeni uygulama derlemesi gerekir.

## Pull request

Sorunu, değişiklikten sonraki davranışı ve çalıştırılan kontrolleri açıklayın. Arayüz değişiklikleri için kişisel veri içermeyen ekran görüntüleri ekleyin. Sürüm notlarını [CHANGELOG.md](../CHANGELOG.md) içinde tutun. İmzalama anahtarlarını, EAS kimlik bilgilerini, yerel veritabanlarını ve yedekleri commit etmeyin.

## GitHub otomasyonları

- `lint.yml`: `main` dalına gönderimlerde ve bu dala açılan PR'larda ESLint, TypeScript, regresyon testleri ve Android JavaScript paketlemesini çalıştırır. APK üretmez.
- Dependabot: npm ve GitHub Actions güncellemelerini haftalık önerir; otomatik birleştirme yapmaz.
- `stale.yml`: 14 gün etkinlik olmayan konuları işaretler; 7 gün daha etkinlik olmazsa kapatır. Atanan, taslak veya `security`, `bug`, `keep-open` etiketli kayıtlar dışarıda tutulur.
