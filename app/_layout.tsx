import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, AppState, AppStateStatus, Platform,
} from 'react-native';
import { Stack, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
} from '@expo-google-fonts/poppins';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Notifications from 'expo-notifications';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { initializeDatabase, getSetting } from '../src/db/database';
import { migrateNotificationSchedulesIfNeeded, removeLegacySensitiveNotifications } from '../src/utils/notifications';
import { migrateLegacyPin, verifyPin } from '../src/utils/security';
import { cleanupTemporaryBackups, runAutomaticBackupIfDue } from '../src/utils/backups';
import { Colors, Spacing, BorderRadius, FontSize } from '../src/constants/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [initializationError, setInitializationError] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [lockMethod, setLockMethod] = useState<'pin' | 'biometric' | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const backgroundTimeRef = useRef<number | null>(null);
  const appStateRef = useRef<AppStateStatus>('active');
  const failedPinAttemptsRef = useRef(0);
  const pinLockoutUntilRef = useRef(0);

  useEffect(() => {
    async function prepare() {
      try {
        await initializeDatabase();
        await migrateLegacyPin();

        const [pinEnabled, biometricEnabled] = await Promise.all([
          getSetting('pinEnabled'),
          getSetting('biometricEnabled'),
        ]);

        const shouldLock = pinEnabled === 'true' || biometricEnabled === 'true';

        if (shouldLock) {
          setIsLocked(true);
          if (biometricEnabled === 'true') {
            setLockMethod('biometric');
          } else {
            setLockMethod('pin');
          }
        }

        await Promise.allSettled([
          cleanupTemporaryBackups(),
          removeLegacySensitiveNotifications(),
        ]);
        await Promise.allSettled([
          runAutomaticBackupIfDue(),
          migrateNotificationSchedulesIfNeeded(),
        ]);

        const onboardingDone = await getSetting('onboardingCompleted');
        if (onboardingDone !== 'true') return;
      } catch (e) {
        console.warn('App init error:', e);
        setInitializationError(true);
      } finally {
        try {
          await Font.loadAsync({
            Poppins_400Regular,
            Poppins_500Medium,
            Poppins_600SemiBold,
            Poppins_700Bold,
            Poppins_800ExtraBold,
          });
        } catch (fontError) {
          console.warn('Font load error:', fontError);
        }
        setAppIsReady(true);
      }
    }
    prepare();
  }, []);

  useEffect(() => {
    if (!appIsReady || Platform.OS === 'web') return;

    const openNotificationTarget = (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      const id = typeof data.entityId === 'number' ? data.entityId : Number(data.entityId);
      if (data.type === 'payment' && Number.isInteger(id)) router.push(`/payment/${id}`);
      if (data.type === 'debt' && Number.isInteger(id)) router.push(`/debt/${id}`);
      if (data.type === 'daily_summary') router.push('/(tabs)');
    };

    const subscription = Notifications.addNotificationResponseReceivedListener(openNotificationTarget);
    Notifications.getLastNotificationResponseAsync().then(response => {
      if (response) {
        openNotificationTarget(response);
        void Notifications.clearLastNotificationResponseAsync();
      }
    });
    return () => subscription.remove();
  }, [appIsReady]);

  useEffect(() => {
    const handleAppStateChange = async (nextState: AppStateStatus) => {
      if (appStateRef.current === 'active' && nextState === 'background') {
        backgroundTimeRef.current = Date.now();
      } else if (nextState === 'active' && appStateRef.current !== 'active') {
        const bgTime = backgroundTimeRef.current;
        if (bgTime !== null) {
          const elapsedMinutes = (Date.now() - bgTime) / 1000 / 60;
          try {
            const [pinEnabled, biometricEnabled, autoLock] = await Promise.all([
              getSetting('pinEnabled'),
              getSetting('biometricEnabled'),
              getSetting('autoLockMinutes'),
            ]);
            const lockMinutes = parseInt(autoLock ?? '1');

            const securityEnabled = pinEnabled === 'true' || biometricEnabled === 'true';
            const shouldLock = securityEnabled && (lockMinutes === 0 || elapsedMinutes >= lockMinutes);

            if (shouldLock) {
              setIsLocked(true);
              setPinInput('');
              setPinError('');
              if (biometricEnabled === 'true') {
                setLockMethod('biometric');
              } else {
                setLockMethod('pin');
              }
            }
          } catch (error) {
            console.warn('Security settings read error:', error);
            setIsLocked(true);
            setLockMethod('pin');
            setPinError('Güvenlik ayarları okunamadı. Uygulamayı yeniden başlatın.');
          }
        }
      }
      appStateRef.current = nextState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (isLocked && lockMethod === 'biometric') {
      handleBiometricAuth();
    }
  }, [isLocked, lockMethod]);

  const handleBiometricAuth = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Kimliğinizi doğrulayın',
        cancelLabel: 'PIN Kullan',
        fallbackLabel: 'PIN Kullan',
      });
      if (result.success) {
        unlock();
      } else {
        const pinEnabled = await getSetting('pinEnabled');
        if (pinEnabled === 'true') {
          setLockMethod('pin');
        }
      }
    } catch (e) {
      const pinEnabled = await getSetting('pinEnabled');
      if (pinEnabled === 'true') setLockMethod('pin');
    }
  };

  const handlePinAttempt = async (candidate: string) => {
    if (candidate.length !== 6) {
      setPinError('PIN 6 haneli olmalıdır.');
      return;
    }

    const remainingSeconds = Math.ceil((pinLockoutUntilRef.current - Date.now()) / 1000);
    if (remainingSeconds > 0) {
      setPinError(`Çok fazla hatalı deneme. ${remainingSeconds} saniye bekleyin.`);
      setPinInput('');
      return;
    }

    if (await verifyPin(candidate)) {
      unlock();
    } else {
      failedPinAttemptsRef.current += 1;
      if (failedPinAttemptsRef.current >= 5) {
        failedPinAttemptsRef.current = 0;
        pinLockoutUntilRef.current = Date.now() + 30_000;
        setPinError('Çok fazla hatalı deneme. 30 saniye bekleyin.');
      } else {
        setPinError('Yanlış PIN. Tekrar deneyin.');
      }
      setPinInput('');
    }
  };

  const handlePinSubmit = async () => {
    await handlePinAttempt(pinInput);
  };

  const unlock = () => {
    setIsLocked(false);
    setPinInput('');
    setPinError('');
    failedPinAttemptsRef.current = 0;
    pinLockoutUntilRef.current = 0;
    backgroundTimeRef.current = null;
  };

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      await SplashScreen.hideAsync();
    }
  }, [appIsReady]);

  if (!appIsReady) return null;

  if (initializationError) {
    return (
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.tabBar }} onLayout={onLayoutRootView}>
        <View style={lockStyles.overlay}>
          <View style={lockStyles.container}>
            <MaterialCommunityIcons name="shield-alert" size={56} color={Colors.danger} />
            <Text style={lockStyles.title}>Güvenli Başlatma Başarısız</Text>
            <Text style={[lockStyles.subtitle, { textAlign: 'center' }]}>
              Uygulama verileri güvenli biçimde açılamadı. Uygulamayı tamamen kapatıp yeniden deneyin.
            </Text>
          </View>
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.tabBar }} onLayout={onLayoutRootView}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="payment/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="payment/add" options={{ presentation: 'modal' }} />
        <Stack.Screen name="debt/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="debt/add" options={{ presentation: 'modal' }} />
      </Stack>

      {/* Lock Screen Overlay */}
      {isLocked && (
        <View style={lockStyles.overlay}>
          <View style={lockStyles.container}>
            <View style={lockStyles.iconWrap}>
              <MaterialCommunityIcons
                name={lockMethod === 'biometric' ? 'fingerprint' : 'lock'}
                size={56}
                color={Colors.primary}
              />
            </View>
            <Text style={lockStyles.title}>NoX Finance</Text>
            <Text style={lockStyles.subtitle}>
              {lockMethod === 'biometric' ? 'Parmak izi ile doğrulayın' : 'PIN kodunuzu girin'}
            </Text>

            {lockMethod === 'pin' && (
              <>
                <TextInput
                  style={lockStyles.pinInput}
                  value={pinInput}
                  onChangeText={(t) => {
                    const digits = t.replace(/[^0-9]/g, '').slice(0, 6);
                    setPinInput(digits);
                    setPinError('');
                    if (digits.length === 6) {
                      void handlePinAttempt(digits);
                    }
                  }}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={6}
                  autoFocus
                  placeholder="••••••"
                  placeholderTextColor={Colors.textMuted}
                />
                {pinError ? <Text style={lockStyles.error}>{pinError}</Text> : null}
                <TouchableOpacity style={lockStyles.btn} onPress={handlePinSubmit}>
                  <Text style={lockStyles.btnText}>Giriş Yap</Text>
                </TouchableOpacity>
              </>
            )}

            {lockMethod === 'biometric' && (
              <TouchableOpacity style={lockStyles.btn} onPress={handleBiometricAuth}>
                <MaterialCommunityIcons name="fingerprint" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={lockStyles.btnText}>Tekrar Dene</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </GestureHandlerRootView>
  );
}

const lockStyles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: Colors.background,
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '85%',
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconWrap: {
    width: 96, height: 96,
    borderRadius: 48,
    backgroundColor: `${Colors.primary}20`,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontFamily: 'Poppins_700Bold',
    fontSize: FontSize.xxl,
    color: Colors.textPrimary,
  },
  subtitle: {
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  pinInput: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontFamily: 'Poppins_700Bold',
    fontSize: 28,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    textAlign: 'center',
    letterSpacing: 12,
  },
  error: {
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.sm,
    color: Colors.danger,
    textAlign: 'center',
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: Spacing.md,
    width: '100%',
  },
  btnText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: FontSize.md,
    color: '#fff',
  },
});
