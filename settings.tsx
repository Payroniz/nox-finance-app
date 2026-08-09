import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Alert, StatusBar, Image
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Colors, Spacing, BorderRadius, FontSize, Shadow } from '../../src/constants/theme';
import { Card } from '../../src/components/Card';
import { getAllSettings, setSetting, exportData } from '../../src/db/database';
import { AppSettings, Currency } from '../../src/constants/types';

export default function SettingsScreen() {
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useFocusEffect(useCallback(() => {
    loadSettings();
  }, []));

  const loadSettings = async () => {
    const s = await getAllSettings();
    setSettings(s);
  };

  const updateSetting = async (key: keyof AppSettings, value: any) => {
    await setSetting(key, String(value));
    setSettings(prev => prev ? { ...prev, [key]: value } : null);
  };

  const handlePickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      await updateSetting('profilePhoto', result.assets[0].uri);
    }
  };

  const handleExport = async () => {
    try {
      const data = await exportData();
      const path = `${FileSystem.documentDirectory}nox-backup-${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(path, data, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(path, { mimeType: 'application/json' });
    } catch (e) {
      Alert.alert('Hata', 'Dışa aktarma sırasında hata oluştu.');
    }
  };

  const CURRENCIES: Currency[] = ['TRY', 'USD', 'EUR', 'GBP'];
  const CURRENCY_LABELS: Record<Currency, string> = { TRY: '₺ Türk Lirası', USD: '$ Amerikan Doları', EUR: '€ Euro', GBP: '£ İngiliz Sterlini' };

  if (!settings) return null;

  const SettingRow = ({ icon, label, children, onPress }: any) => (
    <TouchableOpacity
      style={styles.settingRow}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.settingLeft}>
        <View style={styles.settingIcon}>
          <MaterialCommunityIcons name={icon} size={20} color={Colors.primary} />
        </View>
        <Text style={styles.settingLabel}>{label}</Text>
      </View>
      {children}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Ayarlar</Text>
        </View>

        {/* Profile section */}
        <Card style={styles.profileCard}>
          <TouchableOpacity style={styles.profileInner} onPress={handlePickPhoto}>
            <View style={styles.avatarContainer}>
              {settings.profilePhoto ? (
                <Image source={{ uri: settings.profilePhoto }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>
                    {settings.userName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.avatarEditBadge}>
                <MaterialCommunityIcons name="camera" size={12} color="#fff" />
              </View>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{settings.userName}</Text>
              <Text style={styles.profileEdit}>Profili Düzenle</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        </Card>

        {/* General settings */}
        <Text style={styles.sectionLabel}>GENEL</Text>
        <Card style={styles.settingCard}>
          <SettingRow
            icon="translate"
            label="Para Birimi"
            onPress={() => {
              Alert.alert(
                'Para Birimi Seç',
                '',
                CURRENCIES.map(c => ({
                  text: CURRENCY_LABELS[c] + (settings.defaultCurrency === c ? ' ✓' : ''),
                  onPress: () => updateSetting('defaultCurrency', c),
                }))
              );
            }}
          >
            <Text style={styles.settingValue}>{settings.defaultCurrency}</Text>
          </SettingRow>

          <View style={styles.divider} />

          <SettingRow icon="theme-light-dark" label="Tema">
            <Text style={styles.settingValue}>
              {settings.theme === 'dark' ? 'Koyu' : settings.theme === 'light' ? 'Açık' : 'Sistem'}
            </Text>
          </SettingRow>
        </Card>

        {/* Notifications */}
        <Text style={styles.sectionLabel}>BİLDİRİMLER</Text>
        <Card style={styles.settingCard}>
          <SettingRow icon="bell" label="Bildirimleri Aç">
            <Switch
              value={settings.notificationsEnabled}
              onValueChange={(v) => updateSetting('notificationsEnabled', v)}
              trackColor={{ false: Colors.surfaceBorder, true: Colors.primary }}
              thumbColor="#fff"
            />
          </SettingRow>
          <View style={styles.divider} />
          <SettingRow icon="clock-alert" label="Varsayılan Hatırlatma">
            <Text style={styles.settingValue}>{settings.defaultReminderDays} gün önce</Text>
          </SettingRow>
          <View style={styles.divider} />
          <SettingRow icon="weather-sunset-up" label="Günlük Özet Saati">
            <Text style={styles.settingValue}>{settings.dailySummaryTime}</Text>
          </SettingRow>
        </Card>

        {/* Security */}
        <Text style={styles.sectionLabel}>GÜVENLİK</Text>
        <Card style={styles.settingCard}>
          <SettingRow icon="lock" label="PIN Kilidi">
            <Switch
              value={settings.pinEnabled}
              onValueChange={(v) => updateSetting('pinEnabled', v)}
              trackColor={{ false: Colors.surfaceBorder, true: Colors.primary }}
              thumbColor="#fff"
            />
          </SettingRow>
          <View style={styles.divider} />
          <SettingRow icon="fingerprint" label="Biyometrik">
            <Switch
              value={settings.biometricEnabled}
              onValueChange={(v) => updateSetting('biometricEnabled', v)}
              trackColor={{ false: Colors.surfaceBorder, true: Colors.primary }}
              thumbColor="#fff"
            />
          </SettingRow>
        </Card>

        {/* Data */}
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
              Alert.alert(
                'Verileri Sil',
                'Tüm verileriniz kalıcı olarak silinecek. Emin misiniz?',
                [
                  { text: 'İptal', style: 'cancel' },
                  { text: 'Sil', style: 'destructive', onPress: () => {} },
                ]
              );
            }}
          >
            <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.danger} />
          </SettingRow>
        </Card>

        {/* About */}
        <Text style={styles.sectionLabel}>HAKKINDA</Text>
        <Card style={styles.settingCard}>
          <SettingRow icon="information" label="NoX Finance">
            <Text style={styles.settingValue}>v2.0.0</Text>
          </SettingRow>
        </Card>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg },
  header: {
    paddingTop: Spacing.xxxl,
    marginBottom: Spacing.lg,
  },
  headerTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: FontSize.xxl,
    color: Colors.textPrimary,
  },
  profileCard: { marginBottom: Spacing.xl },
  profileInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatarContainer: { position: 'relative' },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.full,
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 28,
    color: '#fff',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  profileInfo: { flex: 1 },
  profileName: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
  },
  profileEdit: {
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.sm,
    color: Colors.primary,
    marginTop: 2,
  },
  sectionLabel: {
    fontFamily: 'Poppins_500Medium',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    letterSpacing: 1.2,
    marginBottom: Spacing.sm,
    marginLeft: 4,
    marginTop: Spacing.sm,
  },
  settingCard: { marginBottom: Spacing.sm, padding: 0, overflow: 'hidden' },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    backgroundColor: `${Colors.primary}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingLabel: {
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  settingValue: {
    fontFamily: 'Poppins_500Medium',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.surfaceBorder,
    marginHorizontal: Spacing.md,
  },
});
