# NoX Finance Güvenlik Politikası

NoX Finance; ödeme, borç, alacak, abonelik ve profil bilgilerini cihazda saklar. Güvenlik bildirimlerinde bu bilgilerin açığa çıkmasını önlemek önceliklidir.

## Desteklenen sürüm

Düzeltmeler `main` dalındaki güncel kod için hazırlanır. Eski sürümler için ayrı bir güvenlik yaması takvimi yoktur; güncel sürümün kullanılması önerilir.

## Açık bildirme

Güvenlik açığının ayrıntılarını veya çalışan istismar kodunu herkese açık Issues alanında paylaşmayın.

1. [Deponun Security sayfasını](https://github.com/Payroniz/nox-finance-app/security) açın. **Report a vulnerability** seçeneği görünüyorsa özel bildirim oluşturun.
2. Bu seçenek görünmüyorsa [depo sahibinin](https://github.com/Payroniz) yayımladığı özel iletişim kanalını kullanın. Böyle bir kanal da yoksa ayrıntıları paylaşmadan, yalnızca özel bildirim kanalının açılmasını isteyen bir konu oluşturun.

Bildirimde etkilenen sürüm/platform, beklenen ve gerçekleşen davranış, tekrar oluşturma adımları ve olası etki bulunsun. Gerçek kullanıcı verileri yerine sahte kayıtlar kullanın. PIN, erişim belirteci, yedek veya imzalama anahtarı göndermeyin.

## Veri ve yedeklerin korunması

- JSON yedekleri finans ve profil verileri içerebilir; PIN ve cihaz güvenlik ayarları dışa aktarılmaz. JSON yedekleri şifrelenmez.
- PIN/biometrik ekran kilidi, dışarıya kaydedilmiş yedek dosyasını şifrelemez.
- Uygulama alanındaki yedekler kaldırma işleminde silinebilir. Dış kopyaları erişimini denetlediğiniz konumlarda saklayın.
- Güvenlik düzeltmeleri test edilirken eski yedeklerin geri yüklenmesi ve mevcut kayıtların korunması kontrol edilmelidir.

Bildirim için sabit yanıt veya çözüm süresi taahhüt edilmez. Açığın ayrıntılarını, düzeltmenin hazırlanması ve kullanıcıların güncelleyebilmesi için depo sahibiyle koordineli olarak paylaşın.
