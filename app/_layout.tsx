import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, AppState, AppStateStatus,
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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { initializeDatabase, getSetting } from '../src/db/database';
import { requestNotificationPermissions } from '../src/utils/notifications';
import { Colors, Spacing, BorderRadius, FontSize } from '../src/constants/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [lockMethod, setLockMethod] = useState<'pin' | 'biometric' | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [storedPin, setStoredPin] = useState('');
  const [autoLockMinutes, setAutoLockMinutes] = useState(1);
  const backgroundTimeRef = useRef<number | null>(null);
  const appStateRef = useRef<AppStateStatus>('active');

  useEffect(() => {
    async function prepare() {
      try {
        await Font.loadAsync({
          Poppins_400Regular,
          Poppins_500Medium,
          Poppins_600SemiBold,
          Poppins_700Bold,
          Poppins_800ExtraBold,
        });

        await initializeDatabase();
        await requestNotificationPermissions();

        // Load security settings
        const [pinEnabled, biometricEnabled, pinCode, autoLock] = await Promise.all([
          getSetting('pinEnabled'),
          getSetting('biometricEnabled'),
          getSetting('pinCode'),
          getSetting('autoLockMinutes'),
        ]);

        const minutes = parseInt(autoLock ?? '1');
        setAutoLockMinutes(minutes);
        setStoredPin(pinCode ?? '');

        const shouldLock = pinEnabled === 'true' || biometricEnabled === 'true';

        if (shouldLock) {
          setIsLocked(true);
          if (biometricEnabled === 'true') {
            setLockMethod('biometric');
          } else {
            setLockMethod('pin');
          }
        }

        const onboardingDone = await getSetting('onboardingCompleted');
        if (onboardingDone !== 'true') {
          setAppIsReady(true);
          return;
        }
      } catch (e) {
        console.warn('App init error:', e);
      } finally {
        setAppIsReady(true);
      }
    }
    prepare();
  }, []);

  // Auto-lock on app background/foreground
  useEffect(() => {
    const handleAppStateChange = async (nextState: AppStateStatus) => {
      if (appStateRef.current === 'active' && nextState === 'background') {
        // App going to background - record time
        backgroundTimeRef.current = Date.now();
      } else if (nextState === 'active' && appStateRef.current !== 'active') {
        // App coming to foreground - check if we should lock
        const bgTime = backgroundTimeRef.current;
        if (bgTime !== null) {
          const elapsedMinutes = (Date.now() - bgTime) / 1000 / 60;
          // Check current security settings
          const [pinEnabled, biometricEnabled, pinCode, autoLock] = await Promise.all([
            getSetting('pinEnabled'),
            getSetting('biometricEnabled'),
            getSetting('pinCode'),
            getSetting('autoLockMinutes'),
          ]);
          const lockMinutes = parseInt(autoLock ?? '1');
          setAutoLockMinutes(lockMinutes);
          setStoredPin(pinCode ?? '');

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
        }
      }
      appStateRef.current = nextState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  // Auto-trigger biometric when lock screen appears
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
        // Fall back to PIN if available
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

  const handlePinSubmit = async () => {
    const currentPin = await getSetting('pinCode');
    if (pinInput === currentPin) {
      unlock();
    } else {
      setPinError('Yanlış PIN. Tekrar deneyin.');
      setPinInput('');
    }
  };

  const unlock = () => {
    setIsLocked(false);
    setPinInput('');
    setPinError('');
    backgroundTimeRef.current = null;
  };

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      await SplashScreen.hideAsync();
    }
  }, [appIsReady]);

  if (!appIsReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
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
                      // Auto submit on 6 digits
                      getSetting('pinCode').then(code => {
                        if (digits === code) unlock();
                        else { setPinError('Yanlış PIN. Tekrar deneyin.'); setPinInput(''); }
                      });
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
