import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Alert, StatusBar, Image, TextInput, Modal, KeyboardAvoidingView, Platform, Linking
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as LocalAuthentication from 'expo-local-authentication';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { Colors, Spacing, BorderRadius, FontSize } from '../../src/constants/theme';
import { Card } from '../../src/components/Card';
import { addUploadedIcon, deleteAllData, deleteUploadedIcon, getAllSettings, getUploadedIcons, setSetting } from '../../src/db/database';
import {
  cancelAllNotifications,
  canScheduleNotifications,
  requestNotificationPermissions,
  getNotificationDiagnostics,
  rescheduleAllNotifications,
  scheduleDailySummary,
  scheduleTestNotification,
} from '../../src/utils/notifications';
import {
  deleteSecurePin,
  isSecureStorageAvailable,
  setSecurePin,
} from '../../src/utils/security';
import {
  BackupEntry,
  clearLocalBackups,
  configureBackupDestination,
  createAutomaticBackup,
  getAutomaticBackupCount,
  getBackupErrorMessage,
  isBackupCancelled,
  listAutomaticBackups,
  restoreAutomaticBackup,
  restoreBackupFromPicker,
  saveBackupToConfiguredDestination,
  shareBackup,
} from '../../src/utils/backups';
import { AppSettings, BackupDestination, BackupFrequency, Currency, UploadedIcon } from '../../src/constants/types';
import { SelectionSheet } from '../../src/components/SelectionSheet';
import { clearManagedMedia, persistMediaFile } from '../../src/utils/media';


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
  const [activeSheet, setActiveSheet] = useState<'currency' | 'reminder' | 'autoLock' | 'backupFrequency' | 'backupDestination' | null>(null);
  const [notificationDiagnostics, setNotificationDiagnostics] = useState({ permission: 'undetermined', scheduledCount: 0 });
  const [automaticBackupCount, setAutomaticBackupCount] = useState(0);
  const [backupBusy, setBackupBusy] = useState(false);
  const [uploadedIcons, setUploadedIcons] = useState<UploadedIcon[]>([]);
  const [showUploadedIcons, setShowUploadedIcons] = useState(false);
  const [showBackupHistory, setShowBackupHistory] = useState(false);
  const [backupEntries, setBackupEntries] = useState<BackupEntry[]>([]);

  useFocusEffect(useCallback(() => { loadSettings(); }, []));

  const loadSettings = async () => {
    const s = await getAllSettings();
    if (s.notificationsEnabled && !(await canScheduleNotifications())) {
      await setSetting('notificationsEnabled', 'false');
      s.notificationsEnabled = false;
    }
    const [diagnostics, backupCount, icons] = await Promise.all([
      getNotificationDiagnostics().catch(() => ({ permission: 'undetermined', scheduledCount: 0 })),
      getAutomaticBackupCount().catch(() => 0),
      getUploadedIcons().catch(() => []),
    ]);
    setNotificationDiagnostics(diagnostics);
    setAutomaticBackupCount(backupCount);
    setUploadedIcons(icons);
    setSettings(s);
  };

  const updateSetting = async (key: keyof AppSettings, value: any) => {
    await setSetting(key, Array.isArray(value) ? JSON.stringify(value) : String(value));
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
      const uri = await persistMediaFile(result.assets[0].uri, 'avatar');
      await updateSetting('profilePhoto', uri);
    }
  };

  const handleUploadIcon = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsMultipleSelection: true,
      quality: 0.85,
    });
    if (result.canceled) return;
    setBackupBusy(true);
    try {
      for (const [index, asset] of result.assets.entries()) {
        const uri = await persistMediaFile(asset.uri, 'icon');
        await addUploadedIcon(uri, asset.fileName || `İkon ${uploadedIcons.length + index + 1}`);
      }
      await loadSettings();
      Alert.alert('İkonlar Hazır', `${result.assets.length} ikon kütüphaneye eklendi.`);
    } finally {
      setBackupBusy(false);
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

  const REMINDER_OPTIONS = [0, 1, 2, 3, 5, 7, 14];
  const handleReminderDays = () => setActiveSheet('reminder');

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

  const handleAutoLock = () => setActiveSheet('autoLock');

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
      setNotificationDiagnostics(current => ({ ...current, scheduledCount: 0 }));
      return;
    }

    const granted = await requestNotificationPermissions();
    if (!granted) {
      await updateSetting('notificationsEnabled', false);
      Alert.alert('İzin Gerekli', 'Bildirim izni verilmediği için hatırlatıcılar açılamadı.', [
        { text: 'İptal', style: 'cancel' },
        { text: 'Sistem Ayarlarını Aç', onPress: () => void Linking.openSettings() },
      ]);
      return;
    }

    await updateSetting('notificationsEnabled', true);
    const count = await rescheduleAllNotifications();
    setNotificationDiagnostics({ permission: 'granted', scheduledCount: count + 1 });
    Alert.alert('Bildirimler Hazır', `${count} ödeme/borç hatırlatıcısı yeniden planlandı.`);
  };

  const performExport = async () => {
    if (!settings) return;
    setBackupBusy(true);
    try {
      if (Platform.OS === 'android') {
        if (settings.backupDestination !== 'share' && !settings.backupDirectoryUri) {
          await configureBackupDestination(settings.backupDestination, BACKUP_DESTINATION_LABELS[settings.backupDestination]);
        }
        await saveBackupToConfiguredDestination();
      }
      else await shareBackup();
      await loadSettings();
      Alert.alert('Yedek Hazır', settings.backupDestination === 'share' || Platform.OS !== 'android'
        ? 'Bir kopya NoX alanında saklandı. Dışarıya kaydetmek için paylaşım ekranındaki işlemi tamamlayın.'
        : 'Yedek dosyası seçtiğiniz klasöre kaydedildi ve doğrulandı.');
    } catch (e) {
      if (!isBackupCancelled(e)) {
        Alert.alert('Yedeklenemedi', getBackupErrorMessage(e), [
          { text: 'Tamam', style: 'cancel' },
          { text: 'Hedefi Değiştir', onPress: () => setActiveSheet('backupDestination') },
        ]);
      }
    } finally {
      setBackupBusy(false);
    }
  };

  const handleExport = () => {
    Alert.alert(
      'Hassas Veri Uyarısı',
      'Yedek; ödeme, borç, abonelik ve profil bilgilerinizi içerir. PIN ve güvenlik ayarları yedeğe eklenmez. Dosyayı yalnızca güvendiğiniz bir konuma gönderin.',
      [
        { text: 'İptal', style: 'cancel' },
        { text: 'Yedekle', onPress: () => void performExport() },
      ]
    );
  };

  const handleAutomaticBackupToggle = async (value: boolean) => {
    if (!value) return;
    setBackupBusy(true);
    try {
      await createAutomaticBackup();
      await updateSetting('automaticBackupEnabled', true);
      await loadSettings();
      Alert.alert('Otomatik Yedekleme Açıldı', 'İlk yedek NoX uygulama alanına kaydedildi; en yeni 5 kopya saklanır. Uygulama silinirse bu kopyalar da silinir. “Şimdi Yedekle” ile ayrıca dışarıya kaydedebilirsiniz.');
    } catch (e) {
      Alert.alert('Yedekleme Açılamadı', getBackupErrorMessage(e));
    } finally {
      setBackupBusy(false);
    }
  };

  const handleAutomaticBackupSwitch = async (value: boolean) => {
    if (!value) {
      await updateSetting('automaticBackupEnabled', false);
      return;
    }
    await handleAutomaticBackupToggle(true);
  };

  const handleBackupDestination = async (destination: BackupDestination) => {
    const label = BACKUP_DESTINATION_LABELS[destination];
    setBackupBusy(true);
    try {
      await configureBackupDestination(destination, label);
      await loadSettings();
      if (destination !== 'share' && Platform.OS === 'android') {
        Alert.alert(
          'Kayıt Yeri Bağlandı',
          `${label} için seçtiğiniz hesap/klasör kullanılacak. Sistem ekranında Drive, Dropbox veya OneDrive sağlayıcısından hesap ve klasörü siz belirleyebilirsiniz.`
        );
      }
    } catch (e) {
      if (isBackupCancelled(e)) {
        Alert.alert('Hedef Değişmedi', 'Hesap veya klasör seçimi tamamlanmadı.');
      } else {
        Alert.alert('Hedef Bağlanamadı', getBackupErrorMessage(e));
      }
    } finally {
      setBackupBusy(false);
    }
  };

  const openBackupHistory = async () => {
    setBackupBusy(true);
    try {
      const entries = await listAutomaticBackups();
      setBackupEntries(entries);
      setShowBackupHistory(true);
    } catch {
      Alert.alert('Yedekler Okunamadı', 'Seçilen klasöre erişim iznini yenileyin.');
    } finally {
      setBackupBusy(false);
    }
  };

  const finishRestore = async (restore: () => Promise<string>) => {
    setBackupBusy(true);
    try {
      const fileName = await restore();
      await rescheduleAllNotifications().catch(() => 0);
      await loadSettings();
      Alert.alert('Geri Yükleme Tamamlandı', `${fileName} yedeği başarıyla geri yüklendi.`);
    } catch (e) {
      const message = (e as Error).message;
      if (!['DIRECTORY_PERMISSION_DENIED', 'PICKER_CANCELLED'].includes(message)) {
        Alert.alert('Geri Yüklenemedi', message === 'BACKUP_NOT_FOUND'
          ? 'Seçilen konumda NoX JSON yedeği bulunamadı.'
          : 'Yedek dosyası geçersiz veya okunamıyor.');
      }
    } finally {
      setBackupBusy(false);
    }
  };

  const handleTestNotification = async () => {
    try {
      await scheduleTestNotification();
      Alert.alert('Test Planlandı', 'Bildirim yaklaşık 2 saniye içinde gelecek.');
      const diagnostics = await getNotificationDiagnostics();
      setNotificationDiagnostics(diagnostics);
    } catch {
      Alert.alert('Bildirim Gönderilemedi', 'Bildirimleri açın ve sistem ayarlarında NoX iznini kontrol edin.', [
        { text: 'İptal', style: 'cancel' },
        { text: 'Sistem Ayarlarını Aç', onPress: () => void Linking.openSettings() },
      ]);
    }
  };

  const handleRepairNotifications = async () => {
    if (!settings?.notificationsEnabled) {
      Alert.alert('Bildirimler Kapalı', 'Önce bildirimleri açın.');
      return;
    }
    try {
      const count = await rescheduleAllNotifications();
      const diagnostics = await getNotificationDiagnostics();
      setNotificationDiagnostics(diagnostics);
      Alert.alert('Hatırlatıcılar Yenilendi', `${count} ödeme ve borç bildirimi yeniden planlandı.`);
    } catch {
      Alert.alert('Yenilenemedi', 'Sistem bildirim iznini kontrol edip tekrar deneyin.');
    }
  };

  const handleDeleteAllData = async () => {
    try {
      await cancelAllNotifications();
      await deleteAllData();
      await deleteSecurePin();
      await clearLocalBackups();
      await clearManagedMedia();
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
  const BACKUP_DESTINATION_LABELS: Record<BackupDestination, string> = {
    device: 'Cihaz / Klasör',
    'google-drive': 'Google Drive',
    dropbox: 'Dropbox',
    onedrive: 'OneDrive',
    share: 'Diğer Uygulamalar',
  };
  const BACKUP_FREQUENCY_LABELS: Record<BackupFrequency, string> = {
    daily: 'Günlük',
    weekly: 'Haftalık',
    monthly: 'Aylık',
  };

  if (!settings) return null;

  const summaryDate = (() => {
    const [h, m] = settings.dailySummaryTime.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  })();
  const lastBackupLabel = (() => {
    if (!settings.lastBackupAt) return '';
    const date = new Date(settings.lastBackupAt);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('tr-TR');
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
            onPress={() => setActiveSheet('currency')}
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
              <Text style={styles.settingValue}>
                {settings.defaultReminderDays.length === 1
                  ? (settings.defaultReminderDays[0] === 0 ? 'Aynı gün' : `${settings.defaultReminderDays[0]} gün önce`)
                  : `${settings.defaultReminderDays.length} zaman seçili`}
              </Text>
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
          <View style={styles.divider} />
          <SettingRow icon="calendar-refresh-outline" label="Hatırlatıcıları Yenile" onPress={handleRepairNotifications}>
            <MaterialCommunityIcons name="chevron-right" size={18} color={Colors.textMuted} />
          </SettingRow>
          <View style={styles.divider} />
          <SettingRow icon="bell-check-outline" label="Test Bildirimi" onPress={handleTestNotification}>
            <View style={styles.settingValueRow}>
              <Text style={[styles.settingValue, { color: settings.notificationsEnabled && notificationDiagnostics.permission === 'granted' ? Colors.success : Colors.warning }]}>
                {!settings.notificationsEnabled ? 'Kapalı' : notificationDiagnostics.permission === 'granted' ? `${notificationDiagnostics.scheduledCount} planlı` : 'İzin gerekli'}
              </Text>
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

        <Text style={styles.sectionLabel}>İKON KÜTÜPHANESİ</Text>
        <Card style={styles.settingCard}>
          <SettingRow icon="image-plus-outline" label="İkon Yükle" onPress={backupBusy ? undefined : handleUploadIcon}>
            <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.textMuted} />
          </SettingRow>
          <View style={styles.divider} />
          <SettingRow icon="image-multiple-outline" label={`Yüklü İkonlar (${uploadedIcons.length})`} onPress={() => setShowUploadedIcons(true)}>
            <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.textMuted} />
          </SettingRow>
        </Card>

        {/* Veri */}
        <Text style={styles.sectionLabel}>VERİ YÖNETİMİ</Text>
        <Card style={styles.settingCard}>
          <SettingRow icon="cloud-sync-outline" label="Otomatik Yedekleme">
            <Switch
              value={settings.automaticBackupEnabled}
              onValueChange={handleAutomaticBackupSwitch}
              disabled={backupBusy}
              trackColor={{ false: Colors.surfaceBorder, true: Colors.primary }}
              thumbColor="#fff"
            />
          </SettingRow>
          {settings.automaticBackupEnabled ? (
            <>
              <View style={styles.divider} />
              <SettingRow icon="calendar-sync" label="Yedek Sıklığı" onPress={() => setActiveSheet('backupFrequency')}>
                <View style={styles.settingValueRow}>
                  <Text style={styles.settingValue}>{BACKUP_FREQUENCY_LABELS[settings.backupFrequency]}</Text>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={Colors.textMuted} />
                </View>
              </SettingRow>
            </>
          ) : null}
              <View style={styles.divider} />
              <SettingRow icon="cloud-outline" label="Yedekleme Aracı" onPress={backupBusy ? undefined : () => setActiveSheet('backupDestination')}>
                <View style={[styles.settingValueRow, { maxWidth: '55%' }]}>
                  <Text style={styles.settingValue} numberOfLines={1}>
                    {settings.backupDirectoryLabel || BACKUP_DESTINATION_LABELS[settings.backupDestination]}
                  </Text>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={Colors.textMuted} />
                </View>
              </SettingRow>
              {automaticBackupCount > 0 ? (
                <>
                  <View style={styles.divider} />
                  <SettingRow icon="history" label="Yerel Yedekler" onPress={backupBusy ? undefined : openBackupHistory}>
                    <View style={styles.settingValueRow}>
                      <Text style={styles.settingValue}>{automaticBackupCount} yedek</Text>
                      <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.textMuted} />
                    </View>
                  </SettingRow>
                </>
              ) : null}
          <View style={styles.divider} />
          <SettingRow icon="backup-restore" label={backupBusy ? 'İşlem Sürüyor...' : 'Şimdi Yedekle'} onPress={backupBusy ? undefined : handleExport}>
            <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.textMuted} />
          </SettingRow>
          <View style={styles.divider} />
          <SettingRow
            icon="file-restore-outline"
            label="Yedeği Geri Yükle"
            onPress={backupBusy ? undefined : () => Alert.alert(
              'Yedeği Geri Yükle',
              'Seçeceğiniz NoX JSON yedeği mevcut finans kayıtlarının yerini alacak. Profil fotoğrafı ve ikonlar da geri getirilecek.',
              [
                { text: 'İptal', style: 'cancel' },
                { text: 'Dosya Seç', onPress: () => void finishRestore(restoreBackupFromPicker) },
              ]
            )}
          >
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

        <View style={styles.backupStatusCard}>
          <View style={styles.backupStatusIcon}>
            <MaterialCommunityIcons name={lastBackupLabel ? 'shield-check' : 'shield-alert-outline'} size={20} color={lastBackupLabel ? Colors.success : Colors.warning} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.backupStatusTitle}>{lastBackupLabel ? 'Verileriniz yedeklendi' : 'Henüz yedek yok'}</Text>
            <Text style={styles.backupStatusText}>
              {lastBackupLabel ? `Son yedek: ${lastBackupLabel}` : 'Veri kaybına karşı ilk yedeğinizi oluşturun.'}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>HAKKINDA</Text>
        <Card style={styles.settingCard}>
          <SettingRow icon="information" label="NoX Finance">
            <Text style={styles.settingValue}>v3.1.8</Text>
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

      <Modal visible={showUploadedIcons} transparent animationType="slide" onRequestClose={() => setShowUploadedIcons(false)}>
        <View style={styles.bottomOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowUploadedIcons(false)} />
          <View style={styles.librarySheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.libraryHeader}>
              <View>
                <Text style={styles.libraryTitle}>Yüklü İkonlar</Text>
                <Text style={styles.librarySubtitle}>Ödeme ve borçlarda tek dokunuşla kullanabilirsiniz.</Text>
              </View>
              <TouchableOpacity style={styles.sheetClose} onPress={() => setShowUploadedIcons(false)}>
                <MaterialCommunityIcons name="close" size={21} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {uploadedIcons.length ? (
              <ScrollView contentContainerStyle={styles.iconLibraryGrid} showsVerticalScrollIndicator={false}>
                {uploadedIcons.map(icon => (
                  <View key={icon.id} style={styles.libraryIconCard}>
                    <Image source={{ uri: icon.uri }} style={styles.libraryIconImage} />
                    <TouchableOpacity
                      style={styles.libraryDelete}
                      onPress={() => Alert.alert('İkonu Kaldır', 'İkon kütüphaneden kaldırılsın mı? Mevcut kayıtlarda kullanılmaya devam eder.', [
                        { text: 'İptal', style: 'cancel' },
                        { text: 'Kaldır', style: 'destructive', onPress: async () => { await deleteUploadedIcon(icon.id); await loadSettings(); } },
                      ])}
                    >
                      <MaterialCommunityIcons name="close" size={14} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.emptyLibrary}>
                <MaterialCommunityIcons name="image-multiple-outline" size={48} color={Colors.textMuted} />
                <Text style={styles.emptyLibraryTitle}>Henüz ikon yüklenmedi</Text>
                <TouchableOpacity style={styles.nameSaveBtn} onPress={() => { setShowUploadedIcons(false); void handleUploadIcon(); }}>
                  <Text style={styles.nameSaveText}>İlk İkonu Yükle</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={showBackupHistory} transparent animationType="slide" onRequestClose={() => setShowBackupHistory(false)}>
        <View style={styles.bottomOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowBackupHistory(false)} />
          <View style={styles.librarySheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.libraryHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.libraryTitle}>Yerel Yedekler</Text>
                <Text style={styles.librarySubtitle}>Geri yüklemek istediğiniz kopyayı tarihine göre seçin.</Text>
              </View>
              <TouchableOpacity style={styles.sheetClose} onPress={() => setShowBackupHistory(false)}>
                <MaterialCommunityIcons name="close" size={21} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ gap: Spacing.sm }} showsVerticalScrollIndicator={false}>
              {backupEntries.map((entry, index) => {
                const date = entry.createdAt ? new Date(entry.createdAt) : null;
                return (
                  <TouchableOpacity
                    key={entry.uri}
                    style={styles.backupEntry}
                    onPress={() => Alert.alert('Bu Yedeği Geri Yükle', `${date && !Number.isNaN(date.getTime()) ? date.toLocaleString('tr-TR') : entry.name} tarihli yedek geri yüklensin mi?`, [
                      { text: 'İptal', style: 'cancel' },
                      { text: 'Geri Yükle', onPress: () => { setShowBackupHistory(false); void finishRestore(() => restoreAutomaticBackup(entry)); } },
                    ])}
                  >
                    <View style={styles.backupEntryIcon}>
                      <MaterialCommunityIcons name={index === 0 ? 'shield-star-outline' : 'backup-restore'} size={22} color={Colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.backupEntryTitle}>{date && !Number.isNaN(date.getTime()) ? date.toLocaleString('tr-TR') : entry.name}</Text>
                      <Text style={styles.backupEntrySubtitle}>{entry.location}{index === 0 ? ' • En yeni' : ''}</Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.textMuted} />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <SelectionSheet
        visible={activeSheet === 'currency'}
        title="Para Birimi"
        subtitle="Yeni kayıtlarda varsayılan olarak kullanılacak para birimini seçin."
        options={CURRENCIES.map(currency => ({
          value: currency,
          label: CURRENCY_LABELS[currency],
          icon: 'cash-multiple',
        }))}
        selectedValues={[settings.defaultCurrency]}
        onClose={() => setActiveSheet(null)}
        onConfirm={values => updateSetting('defaultCurrency', values[0] as Currency)}
      />

      <SelectionSheet
        visible={activeSheet === 'reminder'}
        title="Varsayılan Hatırlatıcılar"
        subtitle="Ödeme ve borçlar için birden fazla zaman seçebilirsiniz."
        options={REMINDER_OPTIONS.map(days => ({
          value: String(days),
          label: days === 0 ? 'Aynı gün' : `${days} gün önce`,
          description: days === 0 ? 'Vade saatinde bir kez daha hatırlatır.' : `Vade tarihinden ${days} gün önce bildirim gönderir.`,
          icon: days === 0 ? 'calendar-today' : 'clock-alert-outline',
        }))}
        selectedValues={settings.defaultReminderDays.map(String)}
        multiple
        confirmLabel="Hatırlatıcıları Kaydet"
        onClose={() => setActiveSheet(null)}
        onConfirm={async values => {
          const days = values.map(Number).sort((a, b) => a - b);
          await updateSetting('defaultReminderDays', days);
          if (settings.notificationsEnabled) {
            const count = await rescheduleAllNotifications();
            setNotificationDiagnostics(current => ({ ...current, scheduledCount: count + 1 }));
          }
        }}
      />

      <SelectionSheet
        visible={activeSheet === 'autoLock'}
        title="Otomatik Kilitleme"
        subtitle="Uygulama arka plana geçtikten sonra ne zaman kilitleneceğini seçin."
        options={AUTO_LOCK_OPTIONS.map(option => ({
          value: String(option.value),
          label: option.label,
          icon: option.value === 0 ? 'lock-alert' : 'timer-lock-outline',
        }))}
        selectedValues={[String(settings.autoLockMinutes ?? 1)]}
        onClose={() => setActiveSheet(null)}
        onConfirm={values => updateSetting('autoLockMinutes', Number(values[0]))}
      />

      <SelectionSheet
        visible={activeSheet === 'backupFrequency'}
        title="Yedek Sıklığı"
        subtitle="Uygulama açıldığında NoX alanında yerel kopya oluşturulur. En yeni 5 kopya saklanır."
        options={[
          { value: 'daily', label: 'Günlük', description: 'Her gün yeni bir güvenli kopya.', icon: 'calendar-today' },
          { value: 'weekly', label: 'Haftalık', description: 'Dengeli depolama kullanımı.', icon: 'calendar-week' },
          { value: 'monthly', label: 'Aylık', description: 'Daha seyrek arşivleme.', icon: 'calendar-month' },
        ]}
        selectedValues={[settings.backupFrequency]}
        onClose={() => setActiveSheet(null)}
        onConfirm={values => updateSetting('backupFrequency', values[0] as BackupFrequency)}
      />

      <SelectionSheet
        visible={activeSheet === 'backupDestination'}
        title="Yedekleme Aracı"
        subtitle="Elle alınan yedeğin kayıt yerini seçin. Sağlayıcı klasör seçtirmiyorsa Diğer Uygulamalar ile paylaşın."
        options={[
          { value: 'device', label: 'Cihaz / Seçilen Klasör', description: 'Dosyayı telefonunuzda seçeceğiniz klasöre kaydeder.', icon: 'folder-outline', color: Colors.info },
          { value: 'google-drive', label: 'Google Drive', description: 'Drive uygulamasındaki Google hesabınızı kullanır.', icon: 'google-drive', color: '#4285F4' },
          { value: 'dropbox', label: 'Dropbox', description: 'Dropbox uygulamasındaki hesabınızı kullanır.', icon: 'dropbox', color: '#0061FF' },
          { value: 'onedrive', label: 'Microsoft OneDrive', description: 'OneDrive uygulamasındaki Microsoft hesabınızı kullanır.', icon: 'microsoft-onedrive', color: '#28A8EA' },
          { value: 'share', label: 'Diğer Uygulamalar', description: 'Dosyalar, iCloud Drive, e-posta veya kurulu başka bir uygulama.', icon: 'share-variant-outline', color: Colors.success },
        ]}
        selectedValues={[settings.backupDestination]}
        onClose={() => setActiveSheet(null)}
        onConfirm={values => handleBackupDestination(values[0] as BackupDestination)}
      />

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
  backupStatusCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: `${Colors.primary}10`, borderWidth: 1, borderColor: `${Colors.primary}35`,
    borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.lg,
  },
  backupStatusIcon: {
    width: 40, height: 40, borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceLight, alignItems: 'center', justifyContent: 'center',
  },
  backupStatusTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: FontSize.sm, color: Colors.textPrimary },
  backupStatusText: { fontFamily: 'Poppins_400Regular', fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
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
  bottomOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(8,8,18,0.72)' },
  librarySheet: {
    maxHeight: '78%', minHeight: 310, backgroundColor: Colors.surface,
    borderTopLeftRadius: 30, borderTopRightRadius: 30,
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.xxl,
    borderWidth: 1, borderBottomWidth: 0, borderColor: Colors.surfaceBorder,
  },
  sheetHandle: { width: 42, height: 4, borderRadius: 2, backgroundColor: Colors.surfaceBorder, alignSelf: 'center', marginBottom: Spacing.lg },
  libraryHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, marginBottom: Spacing.lg },
  libraryTitle: { fontFamily: 'Poppins_700Bold', fontSize: FontSize.xl, color: Colors.textPrimary },
  librarySubtitle: { fontFamily: 'Poppins_400Regular', fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  sheetClose: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.surfaceLight, alignItems: 'center', justifyContent: 'center' },
  iconLibraryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, paddingBottom: Spacing.lg },
  libraryIconCard: { width: '21%', aspectRatio: 1, borderRadius: BorderRadius.lg, backgroundColor: Colors.surfaceLight, padding: 7, position: 'relative' },
  libraryIconImage: { width: '100%', height: '100%', borderRadius: BorderRadius.md },
  libraryDelete: { position: 'absolute', right: -5, top: -5, width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.danger, alignItems: 'center', justifyContent: 'center' },
  emptyLibrary: { alignItems: 'center', justifyContent: 'center', gap: Spacing.md, paddingVertical: Spacing.xxl },
  emptyLibraryTitle: { fontFamily: 'Poppins_500Medium', fontSize: FontSize.md, color: Colors.textSecondary },
  backupEntry: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.surfaceBorder },
  backupEntryIcon: { width: 44, height: 44, borderRadius: BorderRadius.md, backgroundColor: `${Colors.primary}18`, alignItems: 'center', justifyContent: 'center' },
  backupEntryTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: FontSize.sm, color: Colors.textPrimary },
  backupEntrySubtitle: { fontFamily: 'Poppins_400Regular', fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
});
