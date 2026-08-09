import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Alert, StatusBar, Image, TextInput, Modal, KeyboardAvoidingView, Platform
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as LocalAuthentication from 'expo-local-authentication';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { Colors, Spacing, BorderRadius, FontSize } from '../../src/constants/theme';
import { Card } from '../../src/components/Card';
import { deleteAllData, getAllSettings, setSetting, exportData } from '../../src/db/database';
import {
  cancelAllNotifications,
  canScheduleNotifications,
  requestNotificationPermissions,
  scheduleDailySummary,
} from '../../src/utils/notifications';
import {
  deleteSecurePin,
  isSecureStorageAvailable,
  setSecurePin,
} from '../../src/utils/security';
import { cleanupTemporaryBackups } from '../../src/utils/backups';
import { AppSettings, Currency } from '../../src/constants/types';


type SettingRowProps = {
  icon: string;
  label: string;
  children?: React.ReactNode;
  onPress?: () => void;
};

const SettingRow = ({ icon, label, children, onPress }: SettingRowProps) => (
  <TouchableOpacity
    style={styles.settingRow}
    onPress={onPress}
    disabled={!onPress}
    activeOpacity={onPress ? 0.7 : 1}
  >
    <View style={styles.settingLeft}>
      <View style={styles.settingIcon}>
        <MaterialCommunityIcons name={icon as any} size={20} color={Colors.primary} />
      </View>
      <Text style={styles.settingLabel}>{label}</Text>
    </View>
    {children}
  </TouchableOpacity>
);

export default function SettingsScreen() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [showNameModal, setShowNameModal] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [showSummaryTimePicker, setShowSummaryTimePicker] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinStep, setPinStep] = useState<'enter' | 'confirm'>('enter');
  const [pinError, setPinError] = useState('');

  useFocusEffect(useCallback(() => { loadSettings(); }, []));

  const loadSettings = async () => {
    const s = await getAllSettings();
    if (s.notificationsEnabled && !(await canScheduleNotifications())) {
      await setSetting('notificationsEnabled', 'false');
      s.notificationsEnabled = false;
    }
    setSettings(s);
  };

  const updateSetting = async (key: keyof AppSettings, value: any) => {
    await setSetting(key, String(value));
    setSettings(prev => prev ? { ...prev, [key]: value } : null);
  };

  const handlePickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      await updateSetting('profilePhoto', result.assets[0].uri);
    }
  };

  const handleOpenNameModal = () => {
    setNameInput(settings?.userName ?? '');
    setShowNameModal(true);
  };
  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    await updateSetting('userName', trimmed);
    setShowNameModal(false);
  };

  const REMINDER_OPTIONS = [1, 2, 3, 5, 7, 14];
  const handleReminderDays = () => {
    Alert.alert(
      'Varsayılan Hatırlatma',
      'Kaç gün önceden hatırlatılsın?',
      [
        ...REMINDER_OPTIONS.map(d => ({
          text: `${d} gün önce${settings?.defaultReminderDays === d ? ' ✓' : ''}`,
          onPress: () => updateSetting('defaultReminderDays', d),
        })),
        { text: 'İptal', style: 'cancel' as const },
      ]
    );
  };

  const handleSummaryTimeConfirm = async (date: Date) => {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    const timeStr = `${h}:${m}`;
    await updateSetting('dailySummaryTime', timeStr);
    if (settings?.notificationsEnabled) {
      await scheduleDailySummary(timeStr);
    }
    setShowSummaryTimePicker(false);
  };

  const AUTO_LOCK_OPTIONS = [
    { label: 'Anında', value: 0 },
    { label: '1 Dakika sonra', value: 1 },
    { label: '5 Dakika sonra', value: 5 },
    { label: '10 Dakika sonra', value: 10 },
    { label: '30 Dakika sonra', value: 30 },
    { label: '1 Saat sonra', value: 60 },
  ];

  const handleAutoLock = () => {
    const current = settings?.autoLockMinutes ?? 1;
    Alert.alert(
      'Otomatik Kilitleme',
      'Uygulama ne zaman kilitlensin?',
      [
        ...AUTO_LOCK_OPTIONS.map(opt => ({
          text: opt.label + (current === opt.value ? ' ✓' : ''),
          onPress: () => updateSetting('autoLockMinutes', opt.value),
        })),
        { text: 'İptal', style: 'cancel' as const },
      ]
    );
  };

  const getAutoLockLabel = (minutes: number) => {
    const opt = AUTO_LOCK_OPTIONS.find(o => o.value === minutes);
    return opt ? opt.label : `${minutes} dk`;
  };

  const handlePinToggle = async (value: boolean) => {
    if (value) {
      if (!(await isSecureStorageAvailable())) {
        Alert.alert('PIN Kullanılamıyor', 'Bu cihazda güvenli PIN saklama alanı kullanılamıyor.');
        return;
      }
      setPinInput('');
      setPinConfirm('');
      setPinStep('enter');
      setPinError('');
      setShowPinModal(true);
    } else {
      await deleteSecurePin();
      await updateSetting('pinEnabled', false);
    }
  };

  const handlePinNext = () => {
    if (pinInput.length !== 6) {
      setPinError('PIN 6 haneli olmalıdır.');
      return;
    }
    setPinError('');
    setPinStep('confirm');
  };

  const handlePinSave = async () => {
    if (pinConfirm !== pinInput) {
      setPinError('PIN kodları eşleşmiyor.');
      return;
    }
    try {
      await setSecurePin(pinInput);
      await updateSetting('pinEnabled', true);
      setShowPinModal(false);
      setPinInput('');
      setPinConfirm('');
    } catch {
      setPinError('PIN güvenli alana kaydedilemedi.');
    }
  };

  const handlePinModalClose = () => {
    setShowPinModal(false);
    setPinInput('');
    setPinConfirm('');
    setPinStep('enter');
    setPinError('');
  };

  const handleBiometricToggle = async (value: boolean) => {
    if (value) {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!compatible || !enrolled) {
        Alert.alert('Biyometrik Yok', 'Cihazınızda kayıtlı parmak izi veya yüz tanıma bulunamadı.');
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Biyometrik doğrulama',
        cancelLabel: 'İptal',
      });
      if (result.success) {
        await updateSetting('biometricEnabled', true);
      } else {
        Alert.alert('Doğrulama Başarısız', 'Biyometrik kimlik doğrulanamadı.');
      }
    } else {
      await updateSetting('biometricEnabled', false);
    }
  };

  const handleNotificationsToggle = async (value: boolean) => {
    if (!value) {
      await cancelAllNotifications();
      await updateSetting('notificationsEnabled', false);
      return;
    }

    const granted = await requestNotificationPermissions();
    if (!granted) {
      await updateSetting('notificationsEnabled', false);
      Alert.alert('İzin Gerekli', 'Bildirim izni verilmediği için hatırlatıcılar açılamadı.');
      return;
    }

    await updateSetting('notificationsEnabled', true);
    await scheduleDailySummary(settings?.dailySummaryTime ?? '08:00');
  };

  const performExport = async () => {
    let path: string | null = null;
    try {
      if (!FileSystem.cacheDirectory) throw new Error('CACHE_UNAVAILABLE');
      if (!(await Sharing.isAvailableAsync())) throw new Error('SHARING_UNAVAILABLE');

      const data = await exportData();
      path = `${FileSystem.cacheDirectory}nox-backup-${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(path, data, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(path, { mimeType: 'application/json' });
    } catch (e) {
      Alert.alert('Hata', 'Dışa aktarma sırasında hata oluştu.');
    } finally {
      if (path) {
        await FileSystem.deleteAsync(path, { idempotent: true }).catch(() => undefined);
      }
    }
  };

  const handleExport = () => {
    Alert.alert(
      'Hassas Veri Uyarısı',
      'Yedek; ödeme, borç ve profil bilgilerinizi içerir. PIN ve güvenlik ayarları yedeğe eklenmez. Dosyayı yalnızca güvendiğiniz bir konuma gönderin.',
      [
        { text: 'İptal', style: 'cancel' },
        { text: 'Yedekle', onPress: () => void performExport() },
      ]
    );
  };

  const handleDeleteAllData = async () => {
    try {
      await cancelAllNotifications();
      await deleteAllData();
      await deleteSecurePin();
      await cleanupTemporaryBackups();
      await loadSettings();
      Alert.alert('Tamamlandı', 'Tüm uygulama verileri, PIN ve geçici yedekler silindi.');
    } catch (error) {
      console.error('Delete all data error:', error);
      Alert.alert('Hata', 'Verilerin tamamı silinemedi. Lütfen tekrar deneyin.');
    }
  };

  const CURRENCIES: Currency[] = ['TRY', 'USD', 'EUR', 'GBP'];
  const CURRENCY_LABELS: Record<Currency, string> = {
    TRY: '₺ Türk Lirası', USD: '$ Amerikan Doları', EUR: '€ Euro', GBP: '£ İngiliz Sterlini'
  };

  if (!settings) return null;

  const summaryDate = (() => {
    const [h, m] = settings.dailySummaryTime.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  })();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Ayarlar</Text>
        </View>

        {/* Profil */}
        <Card style={styles.profileCard}>
          <View style={styles.profileInner}>
            <TouchableOpacity onPress={handlePickPhoto}>
              <View style={styles.avatarContainer}>
                {settings.profilePhoto ? (
                  <Image source={{ uri: settings.profilePhoto }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarText}>{settings.userName.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <View style={styles.avatarEditBadge}>
                  <MaterialCommunityIcons name="camera" size={12} color="#fff" />
                </View>
              </View>
            </TouchableOpacity>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{settings.userName}</Text>
              <TouchableOpacity onPress={handleOpenNameModal}>
                <Text style={styles.profileEdit}>İsmi Değiştir</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Card>

        {/* Genel */}
        <Text style={styles.sectionLabel}>GENEL</Text>
        <Card style={styles.settingCard}>
          <SettingRow
            icon="translate"
            label="Para Birimi"
            onPress={() => {
              Alert.alert('Para Birimi Seç', '',
                CURRENCIES.map(c => ({
                  text: CURRENCY_LABELS[c] + (settings.defaultCurrency === c ? ' ✓' : ''),
                  onPress: () => updateSetting('defaultCurrency', c),
                }))
              );
            }}
          >
            <Text style={styles.settingValue}>{settings.defaultCurrency}</Text>
          </SettingRow>
        </Card>

        {/* Bildirimler */}
        <Text style={styles.sectionLabel}>BİLDİRİMLER</Text>
        <Card style={styles.settingCard}>
          <SettingRow icon="bell" label="Bildirimleri Aç">
            <Switch
              value={settings.notificationsEnabled}
              onValueChange={handleNotificationsToggle}
              trackColor={{ false: Colors.surfaceBorder, true: Colors.primary }}
              thumbColor="#fff"
            />
          </SettingRow>
          <View style={styles.divider} />
          <SettingRow icon="clock-alert" label="Varsayılan Hatırlatma" onPress={handleReminderDays}>
            <View style={styles.settingValueRow}>
              <Text style={styles.settingValue}>{settings.defaultReminderDays} gün önce</Text>
              <MaterialCommunityIcons name="chevron-right" size={18} color={Colors.textMuted} />
            </View>
          </SettingRow>
          <View style={styles.divider} />
          <SettingRow icon="weather-sunset-up" label="Günlük Özet Saati" onPress={() => setShowSummaryTimePicker(true)}>
            <View style={styles.settingValueRow}>
              <Text style={styles.settingValue}>{settings.dailySummaryTime}</Text>
              <MaterialCommunityIcons name="chevron-right" size={18} color={Colors.textMuted} />
            </View>
          </SettingRow>
        </Card>

        {/* Güvenlik */}
        <Text style={styles.sectionLabel}>GÜVENLİK</Text>
        <Card style={styles.settingCard}>
          <SettingRow icon="lock" label="PIN Kilidi">
            <Switch
              value={settings.pinEnabled}
              onValueChange={handlePinToggle}
              trackColor={{ false: Colors.surfaceBorder, true: Colors.primary }}
              thumbColor="#fff"
            />
          </SettingRow>
          <View style={styles.divider} />
          <SettingRow icon="fingerprint" label="Biyometrik">
            <Switch
              value={settings.biometricEnabled}
              onValueChange={handleBiometricToggle}
              trackColor={{ false: Colors.surfaceBorder, true: Colors.primary }}
              thumbColor="#fff"
            />
          </SettingRow>
          {(settings.pinEnabled || settings.biometricEnabled) && (
            <>
              <View style={styles.divider} />
              <SettingRow icon="timer-lock" label="Otomatik Kilitleme" onPress={handleAutoLock}>
                <View style={styles.settingValueRow}>
                  <Text style={styles.settingValue}>{getAutoLockLabel(settings.autoLockMinutes ?? 1)}</Text>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={Colors.textMuted} />
                </View>
              </SettingRow>
            </>
          )}
        </Card>

        {/* Veri */}
        <Text style={styles.sectionLabel}>VERİ YÖNETİMİ</Text>
        <Card style={styles.settingCard}>
          <SettingRow icon="export" label="Yedekle (JSON)" onPress={handleExport}>
            <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.textMuted} />
          </SettingRow>
          <View style={styles.divider} />
          <SettingRow
            icon="delete-alert"
            label="Tüm Verileri Sil"
            onPress={() => {
              Alert.alert('Verileri Sil', 'Tüm verileriniz kalıcı olarak silinecek. Emin misiniz?',
                [
                  { text: 'İptal', style: 'cancel' },
                  { text: 'Sil', style: 'destructive', onPress: () => void handleDeleteAllData() },
                ]
              );
            }}
          >
            <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.danger} />
          </SettingRow>
        </Card>

        <Text style={styles.sectionLabel}>HAKKINDA</Text>
        <Card style={styles.settingCard}>
          <SettingRow icon="information" label="NoX Finance">
            <Text style={styles.settingValue}>v2.0.0</Text>
          </SettingRow>
        </Card>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* PIN Modal */}
      <Modal visible={showPinModal} transparent animationType="fade" onRequestClose={handlePinModalClose}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={handlePinModalClose}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <TouchableOpacity activeOpacity={1}>
              <View style={styles.nameModal}>
                <Text style={styles.nameModalTitle}>
                  {pinStep === 'enter' ? '🔒 PIN Kilidi Oluştur' : '✅ PIN Doğrula'}
                </Text>
                <Text style={[styles.settingLabel, { textAlign: 'center', marginBottom: Spacing.md, color: Colors.textSecondary }]}>
                  {pinStep === 'enter' ? '6 haneli PIN kodunuzu girin' : 'PIN kodunuzu tekrar girin'}
                </Text>
                <TextInput
                  style={[styles.nameInput, { letterSpacing: 8, fontSize: 24, textAlign: 'center', fontFamily: 'Poppins_700Bold' }]}
                  value={pinStep === 'enter' ? pinInput : pinConfirm}
                  onChangeText={(t) => {
                    const digits = t.replace(/[^0-9]/g, '').slice(0, 6);
                    if (pinStep === 'enter') setPinInput(digits);
                    else setPinConfirm(digits);
                    setPinError('');
                  }}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={6}
                  autoFocus
                  placeholder="••••••"
                  placeholderTextColor={Colors.textMuted}
                />
                {pinError ? (
                  <Text style={{ color: Colors.danger, fontSize: 13, fontFamily: 'Poppins_400Regular', textAlign: 'center', marginTop: 4 }}>
                    {pinError}
                  </Text>
                ) : null}
                <View style={styles.nameModalBtns}>
                  <TouchableOpacity style={styles.nameCancelBtn} onPress={handlePinModalClose}>
                    <Text style={styles.nameCancelText}>İptal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.nameSaveBtn, { opacity: (pinStep === 'enter' ? pinInput : pinConfirm).length === 6 ? 1 : 0.5 }]}
                    onPress={pinStep === 'enter' ? handlePinNext : handlePinSave}
                  >
                    <Text style={styles.nameSaveText}>{pinStep === 'enter' ? 'İleri' : 'Kaydet'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* İsim Değiştir Modal */}
      <Modal visible={showNameModal} transparent animationType="fade" onRequestClose={() => setShowNameModal(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.nameModal}>
            <Text style={styles.nameModalTitle}>İsmi Değiştir</Text>
            <TextInput
              style={styles.nameInput}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="Adınızı girin"
              placeholderTextColor={Colors.textMuted}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSaveName}
            />
            <View style={styles.nameModalBtns}>
              <TouchableOpacity style={styles.nameCancelBtn} onPress={() => setShowNameModal(false)}>
                <Text style={styles.nameCancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.nameSaveBtn} onPress={handleSaveName}>
                <Text style={styles.nameSaveText}>Kaydet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Günlük özet saati picker */}
      <DateTimePickerModal
        isVisible={showSummaryTimePicker}
        mode="time"
        date={summaryDate}
        onConfirm={handleSummaryTimeConfirm}
        onCancel={() => setShowSummaryTimePicker(false)}
        locale="tr"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg },
  header: { paddingTop: Spacing.xxxl, marginBottom: Spacing.lg },
  headerTitle: { fontFamily: 'Poppins_700Bold', fontSize: 22, color: Colors.textPrimary },
  profileCard: { marginBottom: Spacing.xl },
  profileInner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatarContainer: { position: 'relative' },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  avatarPlaceholder: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontFamily: 'Poppins_700Bold', fontSize: 28, color: '#fff' },
  avatarEditBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.surface,
  },
  profileInfo: { flex: 1 },
  profileName: { fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: Colors.textPrimary },
  profileEdit: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: Colors.primary, marginTop: 3 },
  sectionLabel: {
    fontFamily: 'Poppins_500Medium', fontSize: 11,
    color: Colors.textMuted, letterSpacing: 1.2,
    marginBottom: Spacing.sm, marginLeft: 4, marginTop: Spacing.sm,
  },
  settingCard: { marginBottom: Spacing.sm, padding: 0, overflow: 'hidden' },
  settingRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', padding: Spacing.md,
  },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
  settingIcon: {
    width: 36, height: 36, borderRadius: BorderRadius.md,
    backgroundColor: `${Colors.primary}20`,
    alignItems: 'center', justifyContent: 'center',
  },
  settingLabel: { fontFamily: 'Poppins_400Regular', fontSize: 14, color: Colors.textPrimary },
  settingValue: { fontFamily: 'Poppins_500Medium', fontSize: 13, color: Colors.textSecondary },
  settingValueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  divider: { height: 1, backgroundColor: Colors.surfaceBorder, marginHorizontal: Spacing.md },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  nameModal: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    width: '100%',
    gap: Spacing.lg,
  },
  nameModalTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 18, color: Colors.textPrimary, textAlign: 'center' },
  nameInput: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontFamily: 'Poppins_400Regular',
    fontSize: 16, color: Colors.textPrimary,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  nameModalBtns: { flexDirection: 'row', gap: Spacing.sm },
  nameCancelBtn: {
    flex: 1, paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
  },
  nameCancelText: { fontFamily: 'Poppins_500Medium', fontSize: 14, color: Colors.textSecondary },
  nameSaveBtn: {
    flex: 1, paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
  },
  nameSaveText: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: '#fff' },
});
