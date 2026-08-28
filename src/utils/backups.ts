import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { exportData, getAllSettings, importData, setSetting } from '../db/database';

const AUTO_BACKUP_FOLDER = 'nox-backups/';
const MAX_AUTOMATIC_BACKUPS = 5;

const createFileName = (): string => {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `nox-backup-${stamp}.json`;
};

const getAutomaticBackupDirectory = (): string => {
  if (!FileSystem.documentDirectory) throw new Error('DOCUMENT_DIRECTORY_UNAVAILABLE');
  return `${FileSystem.documentDirectory}${AUTO_BACKUP_FOLDER}`;
};

const ensureAutomaticBackupDirectory = async (): Promise<string> => {
  const directory = getAutomaticBackupDirectory();
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  return directory;
};

export const cleanupTemporaryBackups = async (): Promise<void> => {
  if (!FileSystem.cacheDirectory) return;
  const files = await FileSystem.readDirectoryAsync(FileSystem.cacheDirectory).catch(() => []);
  const backups = files.filter(name => /^nox-backup-.*\.json$/.test(name));
  await Promise.all(
    backups.map(name => FileSystem.deleteAsync(`${FileSystem.cacheDirectory}${name}`, { idempotent: true }))
  );
};

export const createAutomaticBackup = async (): Promise<string> => {
  const directory = await ensureAutomaticBackupDirectory();
  const path = `${directory}${createFileName()}`;
  await FileSystem.writeAsStringAsync(path, await exportData(), { encoding: FileSystem.EncodingType.UTF8 });
  await setSetting('lastBackupAt', new Date().toISOString());

  const files = (await FileSystem.readDirectoryAsync(directory))
    .filter(name => /^nox-backup-.*\.json$/.test(name))
    .sort()
    .reverse();
  await Promise.all(
    files.slice(MAX_AUTOMATIC_BACKUPS).map(name =>
      FileSystem.deleteAsync(`${directory}${name}`, { idempotent: true })
    )
  );
  return path;
};

export const runAutomaticBackupIfDue = async (): Promise<boolean> => {
  const settings = await getAllSettings();
  if (!settings.automaticBackupEnabled) return false;

  const intervalDays = { daily: 1, weekly: 7, monthly: 30 }[settings.backupFrequency];
  const lastBackup = settings.lastBackupAt ? new Date(settings.lastBackupAt) : null;
  const elapsed = lastBackup && !Number.isNaN(lastBackup.getTime())
    ? Date.now() - lastBackup.getTime()
    : Number.POSITIVE_INFINITY;

  if (elapsed < intervalDays * 24 * 60 * 60 * 1000) return false;
  await createAutomaticBackup();
  return true;
};

export const shareBackup = async (): Promise<void> => {
  if (!FileSystem.cacheDirectory) throw new Error('CACHE_UNAVAILABLE');
  if (!(await Sharing.isAvailableAsync())) throw new Error('SHARING_UNAVAILABLE');

  const path = `${FileSystem.cacheDirectory}${createFileName()}`;
  try {
    await FileSystem.writeAsStringAsync(path, await exportData(), { encoding: FileSystem.EncodingType.UTF8 });
    await Sharing.shareAsync(path, {
      mimeType: 'application/json',
      dialogTitle: 'NoX yedeğini kaydet',
      UTI: 'public.json',
    });
    await setSetting('lastBackupAt', new Date().toISOString());
  } finally {
    await FileSystem.deleteAsync(path, { idempotent: true }).catch(() => undefined);
  }
};

export const saveBackupToSelectedFolder = async (): Promise<void> => {
  const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!permissions.granted) throw new Error('DIRECTORY_PERMISSION_DENIED');

  const uri = await FileSystem.StorageAccessFramework.createFileAsync(
    permissions.directoryUri,
    createFileName(),
    'application/json'
  );
  await FileSystem.writeAsStringAsync(uri, await exportData(), { encoding: FileSystem.EncodingType.UTF8 });
  await setSetting('lastBackupAt', new Date().toISOString());
};

export const restoreLatestFromSelectedFolder = async (): Promise<string> => {
  const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!permissions.granted) throw new Error('DIRECTORY_PERMISSION_DENIED');

  const files = await FileSystem.StorageAccessFramework.readDirectoryAsync(permissions.directoryUri);
  const candidates = files.filter(uri => decodeURIComponent(uri).toLowerCase().endsWith('.json')).sort().reverse();
  if (candidates.length === 0) throw new Error('BACKUP_NOT_FOUND');

  const raw = await FileSystem.readAsStringAsync(candidates[0], { encoding: FileSystem.EncodingType.UTF8 });
  await importData(raw);
  return decodeURIComponent(candidates[0].split('/').pop() ?? 'NoX yedeği');
};

export const restoreLatestAutomaticBackup = async (): Promise<string> => {
  const directory = await ensureAutomaticBackupDirectory();
  const files = (await FileSystem.readDirectoryAsync(directory))
    .filter(name => /^nox-backup-.*\.json$/.test(name))
    .sort()
    .reverse();
  if (files.length === 0) throw new Error('BACKUP_NOT_FOUND');

  const raw = await FileSystem.readAsStringAsync(`${directory}${files[0]}`, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  await importData(raw);
  return files[0];
};

export const getAutomaticBackupCount = async (): Promise<number> => {
  const directory = await ensureAutomaticBackupDirectory();
  const files = await FileSystem.readDirectoryAsync(directory);
  return files.filter(name => /^nox-backup-.*\.json$/.test(name)).length;
};
