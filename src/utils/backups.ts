import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import { BackupDestination } from '../constants/types';
import { exportData, getAllSettings, getSetting, importData, setSetting } from '../db/database';
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
  return `nox-backup-${stamp}-${Math.random().toString(36).slice(2, 8)}.json`;
};

const ensureAutomaticBackupDirectory = (): Directory => {
  const directory = new Directory(Paths.document, AUTO_BACKUP_FOLDER);
  directory.create({ intermediates: true, idempotent: true });
  return directory;
};

export const getBackupErrorMessage = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  if (/space|ENOSPC|disk.*full/i.test(message)) return 'Cihazda yeterli boş alan yok. Biraz yer açıp yeniden deneyin.';
  if (message === 'SHARING_UNAVAILABLE') return 'Bu cihazda paylaşım ekranı kullanılamıyor. Yedeğiniz NoX alanında saklandı.';
  if (message === 'DESTINATION_NOT_CONFIGURED' || /permission|denied|access|writ|directory|folder|SAF/i.test(message)) {
    return 'Seçilen klasöre erişilemiyor. “Yedekleme Aracı” bölümünden klasörü yeniden seçin veya “Diğer Uygulamalar” ile paylaşın.';
  }
  return 'Yedek kaydedilemedi. Kayıt klasörünü yeniden seçip deneyin veya “Diğer Uygulamalar” ile paylaşın.';
};

export const isBackupCancelled = (error: unknown): boolean =>
  /cancel|DIRECTORY_PERMISSION_DENIED/i.test(error instanceof Error ? error.message : String(error));

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
  for (const subscription of parsed.subscriptions ?? []) {
    if (subscription.icon_type === 'gallery') addUri(mediaUris, subscription.icon_value);
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
      const base64 = await new File(originalUri).base64();
      if (base64) mediaAssets.push({ originalUri, extension: extensionFromUri(originalUri), base64 });
    } catch {
    }
  }
  parsed.mediaAssets = mediaAssets;
  parsed.mediaIncluded = mediaAssets.length;
  parsed.version = 6;
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
  return match ? `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z` : '';
};

const readConfiguredEntries = async (): Promise<BackupEntry[]> => {
  const directory = ensureAutomaticBackupDirectory();
  return directory.list().filter((file): file is File => file instanceof File && BACKUP_PATTERN.test(file.name))
    .map(file => ({ name: file.name, uri: file.uri, createdAt: parseBackupDate(file.name), location: 'NoX uygulama alanı' }))
    .sort((a, b) => b.name.localeCompare(a.name));
};

export const cleanupTemporaryBackups = async (all = false): Promise<void> => {
  for (const file of Paths.cache.list()) {
    if (file instanceof File && BACKUP_PATTERN.test(file.name)
      && (all || (file.modificationTime !== null && Date.now() - file.modificationTime > 86400000))) {
      if (all) file.delete();
      else { try { file.delete(); } catch { /* Retry cleanup on a later launch. */ } }
    }
  }
};

export const clearLocalBackups = async (): Promise<void> => {
  const directory = new Directory(Paths.document, AUTO_BACKUP_FOLDER);
  if (directory.exists) directory.delete();
  await cleanupTemporaryBackups(true);
};

export const configureBackupDestination = async (destination: BackupDestination, destinationLabel: string): Promise<string> => {
  if (destination === 'share' || Platform.OS !== 'android') {
    await Promise.all([
      setSetting('backupDestination', 'share'),
      setSetting('backupDirectoryUri', ''),
      setSetting('backupDirectoryLabel', 'Her yedekte paylaşım ekranı'),
    ]);
    return 'Her yedekte paylaşım ekranı';
  }
  const directory = await Directory.pickDirectoryAsync();
  const probe = directory.createFile(`nox-access-check-${Date.now()}.txt`, 'text/plain');
  try {
    probe.write('NoX');
    if (await probe.text() !== 'NoX') throw new Error('DIRECTORY_WRITE_FAILED');
  } finally {
    try { probe.delete(); } catch { /* Some providers delay deletion. */ }
  }
  const label = `${destinationLabel} • seçilen klasör`;
  await Promise.all([
    setSetting('backupDestination', destination),
    setSetting('backupDirectoryUri', directory.uri),
    setSetting('backupDirectoryLabel', label),
  ]);
  return label;
};

const writeLocalBackup = async (): Promise<string> => {
  const fileName = createFileName();
  const raw = await createPortableBackup();
  const directory = ensureAutomaticBackupDirectory();
  const pending = new File(directory, `${fileName}.partial`);
  const file = new File(directory, fileName);
  try {
    pending.write(raw);
    if (await pending.text() !== raw) throw new Error('BACKUP_WRITE_FAILED');
    await pending.move(file);
  } catch (error) {
    try { pending.delete(); } catch { /* Do not hide the original write error. */ }
    throw error;
  }
  await setSetting('lastBackupAt', new Date().toISOString());
  try {
    const files = await readConfiguredEntries();
    for (const entry of files.slice(MAX_AUTOMATIC_BACKUPS)) {
      try { new File(entry.uri).delete(); } catch { /* Retry next time. */ }
    }
  } catch { /* The new backup is already safely stored. */ }
  return file.uri;
};

let automaticBackup: Promise<string> | null = null;
export const createAutomaticBackup = (): Promise<string> => {
  if (!automaticBackup) {
    automaticBackup = writeLocalBackup().then(async uri => {
      await setSetting('lastAutomaticBackupAt', new Date().toISOString());
      return uri;
    }).finally(() => { automaticBackup = null; });
  }
  return automaticBackup;
};

export const runAutomaticBackupIfDue = async (): Promise<boolean> => {
  const settings = await getAllSettings();
  if (!settings.automaticBackupEnabled) return false;
  const intervalDays = { daily: 1, weekly: 7, monthly: 30 }[settings.backupFrequency];
  const lastBackupAt = await getSetting('lastAutomaticBackupAt');
  const lastBackup = lastBackupAt ? new Date(lastBackupAt) : null;
  const elapsed = lastBackup && !Number.isNaN(lastBackup.getTime()) ? Date.now() - lastBackup.getTime() : Infinity;
  if (elapsed < intervalDays * 86400000) return false;
  await createAutomaticBackup();
  return true;
};

export const shareBackup = async (): Promise<void> => {
  const localUri = await writeLocalBackup();
  if (!(await Sharing.isAvailableAsync())) throw new Error('SHARING_UNAVAILABLE');
  const file = new File(Paths.cache, createFileName());
  await new File(localUri).copy(file);
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'NoX yedeğini kaydet', UTI: 'public.json' });
};

export const saveBackupToConfiguredDestination = async (): Promise<void> => {
  const settings = await getAllSettings();
  if (settings.backupDestination === 'share') return shareBackup();
  if (!settings.backupDirectoryUri) throw new Error('DESTINATION_NOT_CONFIGURED');
  const raw = await createPortableBackup();
  const file = new Directory(settings.backupDirectoryUri).createFile(createFileName(), 'application/json');
  try {
    file.write(raw);
    if (await file.text() !== raw) throw new Error('BACKUP_WRITE_FAILED');
  } catch (error) {
    try { file.delete(); } catch { /* Preserve the original failure. */ }
    throw error;
  }
  await setSetting('lastBackupAt', new Date().toISOString());
};

export const restoreBackupFromPicker = async (): Promise<string> => {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/json', 'text/plain'], copyToCacheDirectory: true, multiple: false });
  if (result.canceled || !result.assets[0]) throw new Error('PICKER_CANCELLED');
  const asset = result.assets[0];
  const raw = await new File(asset.uri).text();
  await restorePortableBackup(raw);
  return asset.name || fileNameFromUri(asset.uri);
};

export const listAutomaticBackups = async (): Promise<BackupEntry[]> => readConfiguredEntries();

export const restoreAutomaticBackup = async (entry: BackupEntry): Promise<string> => {
  const raw = await new File(entry.uri).text();
  await restorePortableBackup(raw);
  return entry.name;
};

export const getAutomaticBackupCount = async (): Promise<number> => (await readConfiguredEntries()).length;
