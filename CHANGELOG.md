# NoX Finance Değişiklik Günlüğü

Bu dosya NoX Finance uygulamasındaki kullanıcıya yansıyan değişiklikleri kaydeder. Önceki sürümlerin kaynak geçmişi [GitHub etiketlerinde](https://github.com/Payroniz/nox-finance-app/tags) bulunur.

## v3.1.8 - 2026-09-21

### Eklendi
* Abonelikler sekmesi: ekleme, düzenleme, silme, aktif/pasif takip, haftalık/aylık/yıllık yenileme ve para birimine göre aylık toplamlar.
* Aboneliklerin JSON yedeklerine ve geri yüklemeye dahil edilmesi, eski yedeklerle uyumluluk.
* SQLite, yenileme hesapları ve yedekleme hata senaryoları için regresyon testleri.

### Düzeltildi
* Android dosya sağlayıcılarıyla uyumsuz eski dosya API'si güncel File/Directory API'siyle değiştirildi, kayıt sonrası içerik doğrulaması eklendi.
* Otomatik yedekler klasör iznine bağlı olmadan NoX alanında saklanır, başarısız eski kopya temizliği başarılı yedeği hata olarak göstermez.
* Yedekleme hedefi her zaman değiştirilebilir, izin/alan hataları ve paylaşım sonuçları doğru açıklanır.
* Paylaşılan dosyalar alıcı uygulama okumadan silinmez, yerel yedekleme zamanı ayrı takip edilir.
* Tarayıcı önizlemesinde desteklenmeyen başlangıç bildirimi çağrısı engellendi.

### Değiştirildi
* Açılış logosu ve NoX yazısı birlikte büyütüldü.
* Alt menü yüksekliği, etiketlerin ve cihazın alt güvenli alanının sığması için güncellendi.
* Uygulama sürümü 3.1.8, yerel Android versionCode 5, EAS preview/production derlemelerinde otomatik build numarası artışı.