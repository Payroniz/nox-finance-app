import * as SecureStore from 'expo-secure-store';
import { getSetting, purgeLegacyPin } from '../db/database';

const PIN_KEY = 'nox.pinCode';

export const isSecureStorageAvailable = async (): Promise<boolean> => {
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
};

export const getSecurePin = async (): Promise<string | null> => {
  if (!(await isSecureStorageAvailable())) return null;
  return SecureStore.getItemAsync(PIN_KEY);
};

export const setSecurePin = async (pin: string): Promise<void> => {
  if (!(await isSecureStorageAvailable())) {
    throw new Error('SECURE_STORAGE_UNAVAILABLE');
  }

  await SecureStore.setItemAsync(PIN_KEY, pin, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
};

export const deleteSecurePin = async (): Promise<void> => {
  if (await isSecureStorageAvailable()) {
    await SecureStore.deleteItemAsync(PIN_KEY);
  }
  //Eski sürümlerden kalabilecek açık PIN kaydını da temizle.
  await purgeLegacyPin();
};

export const migrateLegacyPin = async (): Promise<boolean> => {
  const legacyPin = await getSetting('pinCode');
  if (!(await isSecureStorageAvailable())) return false;

  const securePin = await SecureStore.getItemAsync(PIN_KEY);
  if (!securePin && legacyPin) {
    await setSecurePin(legacyPin);
  }

  await purgeLegacyPin();
  return Boolean(securePin || legacyPin);
};

export const verifyPin = async (candidate: string): Promise<boolean> => {
  const storedPin = await getSecurePin();
  return Boolean(storedPin) && candidate === storedPin;
};
