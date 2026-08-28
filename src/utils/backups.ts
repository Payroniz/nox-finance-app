import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { BackupDestination } from '../constants/types';
import { exportData, getAllSettings, importData, setSetting } from '../db/database';
import { writeRestoredMedia } from './media';

const AUTO_BACKUP_FOLDER = 'nox-backups/';
const MAX_AUTOMATIC_BACKUPS = 5;
const BACKUP_PATTERN = /^nox-backup-.*\.json$/i;

export interface BackupEntry {
  name: string;
  uri: string;
  createdAt: string;
  location: string;
}

type EmbeddedAsset = { originalUri: string; extension: string; base64: string };

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

const fileNameFromUri = (uri: string): string => {
  const decoded = decodeURIComponent(uri);
  return decoded.split('/').pop()?.split(':').pop() || 'NoX yedeği';
};

const extensionFromUri = (uri: string): string =>
  decodeURIComponent(uri.split('?')[0]).match(/\.([a-zA-Z0-9]{2,5})$/)?.[1] || 'jpg';

const addUri = (uris: Set<string>, value: unknown): void => {
  if (typeof value === 'string' && value && !value.startsWith('http')) uris.add(value);
};

const createPortableBackup = async (): Promise<string> => {
  const parsed = JSON.parse(await exportData()) as any;
  const mediaUris = new Set<string>();
  for (const payment of parsed.payments ?? []) {
    if (payment.icon_type === 'gallery') addUri(mediaUris, payment.icon_value);
  }
  for (const debt of parsed.debts ?? []) {
    addUri(mediaUris, debt.person_photo);
    if (debt.icon_type === 'gallery') addUri(mediaUris, debt.icon_value);
  }
  for (const icon of parsed.uploadedIcons ?? []) addUri(mediaUris, icon.uri);
  addUri(mediaUris, (parsed.settings ?? []).find((item: any) => item.key === 'profilePhoto')?.value);

  const mediaAssets: EmbeddedAsset[] = [];
  for (const originalUri of mediaUris) {
    try {
      const base64 = await FileSystem.readAsStringAsync(originalUri, { encoding: FileSystem.EncodingType.Base64 });
      if (base64) mediaAssets.push({ originalUri, extension: extensionFromUri(originalUri), base64 });
    } catch {
    }
  }
  parsed.mediaAssets = mediaAssets;
  parsed.mediaIncluded = mediaAssets.length;
  parsed.version = 4;
  return JSON.stringify(parsed, null, 2);
};

const replaceStrings = (value: unknown, replacements: Map<string, string>): unknown => {
  if (typeof value === 'string') return replacements.get(value) ?? value;
  if (Array.isArray(value)) return value.map(item => replaceStrings(item, replacements));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => [key, replaceStrings(item, replacements)]));
  }
  return value;
};

const restorePortableBackup = async (raw: string): Promise<void> => {
  const parsed = JSON.parse(raw) as any;
  const assets: EmbeddedAsset[] = Array.isArray(parsed.mediaAssets) ? parsed.mediaAssets : [];
  const replacements = new Map<string, string>();
  for (const asset of assets) {
    if (!asset?.originalUri || !asset?.base64) continue;
    replacements.set(
      asset.originalUri,
      await writeRestoredMedia(asset.base64, asset.extension || 'jpg', 'backup')
    );
  }
  const restored = replaceStrings(parsed, replacements) as Record<string, unknown>;
  delete restored.mediaAssets;
  await importData(JSON.stringify(restored));
};

const parseBackupDate = (name: string): string => {
  const match = name.match(/nox-backup-(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})/i);
  return match ? `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}` : '';
};

const readConfiguredEntries = async (): Promise<BackupEntry[]> => {
  const settings = await getAllSettings();
  if (settings.backupDirectoryUri) {
    const files = await FileSystem.StorageAccessFramework.readDirectoryAsync(settings.backupDirectoryUri);
    return files.filter(uri => BACKUP_PATTERN.test(fileNameFromUri(uri))).map(uri => {
      const name = fileNameFromUri(uri);
      return { name, uri, createdAt: parseBackupDate(name), location: settings.backupDirectoryLabel || 'Seçilen klasör' };
    }).sort((a, b) => b.name.localeCompare(a.name));
  }
  const directory = await ensureAutomaticBackupDirectory();
  const files = await FileSystem.readDirectoryAsync(directory);
  return files.filter(name => BACKUP_PATTERN.test(name))
    .map(name => ({ name, uri: `${directory}${name}`, createdAt: parseBackupDate(name), location: 'NoX güvenli alanı' }))
    .sort((a, b) => b.name.localeCompare(a.name));
};

export const cleanupTemporaryBackups = async (): Promise<void> => {
  if (!FileSystem.cacheDirectory) return;
  const files = await FileSystem.readDirectoryAsync(FileSystem.cacheDirectory).catch(() => []);
  await Promise.all(files.filter(name => BACKUP_PATTERN.test(name)).map(name =>
    FileSystem.deleteAsync(`${FileSystem.cacheDirectory}${name}`, { idempotent: true })
  ));
};

export const configureBackupDestination = async (destination: BackupDestination, destinationLabel: string): Promise<string> => {
  if (destination === 'share') {
    await Promise.all([
      setSetting('backupDestination', destination),
      setSetting('backupDirectoryUri', ''),
      setSetting('backupDirectoryLabel', 'Her yedekte paylaşım ekranı'),
    ]);
    return 'Her yedekte paylaşım ekranı';
  }
  const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!permissions.granted) throw new Error('DIRECTORY_PERMISSION_DENIED');
  const label = `${destinationLabel} • seçilen klasör`;
  await Promise.all([
    setSetting('backupDestination', destination),
    setSetting('backupDirectoryUri', permissions.directoryUri),
    setSetting('backupDirectoryLabel', label),
  ]);
  return label;
};

export const createAutomaticBackup = async (): Promise<string> => {
  const settings = await getAllSettings();
  const fileName = createFileName();
  const raw = await createPortableBackup();
  const path = settings.backupDirectoryUri
    ? await FileSystem.StorageAccessFramework.createFileAsync(settings.backupDirectoryUri, fileName, 'application/json')
    : `${await ensureAutomaticBackupDirectory()}${fileName}`;
  await FileSystem.writeAsStringAsync(path, raw, { encoding: FileSystem.EncodingType.UTF8 });
  await setSetting('lastBackupAt', new Date().toISOString());
  const files = await readConfiguredEntries();
  await Promise.all(files.slice(MAX_AUTOMATIC_BACKUPS).map(item => FileSystem.deleteAsync(item.uri, { idempotent: true })));
  return path;
};

export const runAutomaticBackupIfDue = async (): Promise<boolean> => {
  const settings = await getAllSettings();
  if (!settings.automaticBackupEnabled) return false;
  const intervalDays = { daily: 1, weekly: 7, monthly: 30 }[settings.backupFrequency];
  const lastBackup = settings.lastBackupAt ? new Date(settings.lastBackupAt) : null;
  const elapsed = lastBackup && !Number.isNaN(lastBackup.getTime()) ? Date.now() - lastBackup.getTime() : Infinity;
  if (elapsed < intervalDays * 86400000) return false;
  await createAutomaticBackup();
  return true;
};

export const shareBackup = async (): Promise<void> => {
  if (!FileSystem.cacheDirectory) throw new Error('CACHE_UNAVAILABLE');
  if (!(await Sharing.isAvailableAsync())) throw new Error('SHARING_UNAVAILABLE');
  const path = `${FileSystem.cacheDirectory}${createFileName()}`;
  try {
    await FileSystem.writeAsStringAsync(path, await createPortableBackup(), { encoding: FileSystem.EncodingType.UTF8 });
    await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: 'NoX yedeğini kaydet', UTI: 'public.json' });
    await setSetting('lastBackupAt', new Date().toISOString());
  } finally {
    await FileSystem.deleteAsync(path, { idempotent: true }).catch(() => undefined);
  }
};

export const saveBackupToConfiguredDestination = async (): Promise<void> => {
  const settings = await getAllSettings();
  if (settings.backupDestination === 'share') return shareBackup();
  if (!settings.backupDirectoryUri) throw new Error('DESTINATION_NOT_CONFIGURED');
  const uri = await FileSystem.StorageAccessFramework.createFileAsync(settings.backupDirectoryUri, createFileName(), 'application/json');
  await FileSystem.writeAsStringAsync(uri, await createPortableBackup(), { encoding: FileSystem.EncodingType.UTF8 });
  await setSetting('lastBackupAt', new Date().toISOString());
};

export const restoreBackupFromPicker = async (): Promise<string> => {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/json', 'text/plain'], copyToCacheDirectory: true, multiple: false });
  if (result.canceled || !result.assets[0]) throw new Error('PICKER_CANCELLED');
  const asset = result.assets[0];
  const raw = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
  await restorePortableBackup(raw);
  return asset.name || fileNameFromUri(asset.uri);
};

export const listAutomaticBackups = async (): Promise<BackupEntry[]> => readConfiguredEntries();

export const restoreAutomaticBackup = async (entry: BackupEntry): Promise<string> => {
  const raw = await FileSystem.readAsStringAsync(entry.uri, { encoding: FileSystem.EncodingType.UTF8 });
  await restorePortableBackup(raw);
  return entry.name;
};

export const getAutomaticBackupCount = async (): Promise<number> => (await readConfiguredEntries()).length;
