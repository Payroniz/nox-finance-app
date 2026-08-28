import * as FileSystem from 'expo-file-system/legacy';

const MEDIA_FOLDER = 'nox-media/';

const getMediaDirectory = (): string => {
  if (!FileSystem.documentDirectory) throw new Error('DOCUMENT_DIRECTORY_UNAVAILABLE');
  return `${FileSystem.documentDirectory}${MEDIA_FOLDER}`;
};

export const ensureMediaDirectory = async (): Promise<string> => {
  const directory = getMediaDirectory();
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  return directory;
};

const extensionFromUri = (uri: string): string => {
  const clean = decodeURIComponent(uri.split('?')[0]);
  const extension = clean.match(/\.([a-zA-Z0-9]{2,5})$/)?.[1]?.toLowerCase();
  return extension && ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic'].includes(extension)
    ? extension
    : 'jpg';
};

export const persistMediaFile = async (sourceUri: string, prefix = 'image'): Promise<string> => {
  if (!sourceUri) return '';
  if (sourceUri.startsWith(getMediaDirectory())) return sourceUri;
  const directory = await ensureMediaDirectory();
  const target = `${directory}${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extensionFromUri(sourceUri)}`;
  await FileSystem.copyAsync({ from: sourceUri, to: target });
  return target;
};

export const writeRestoredMedia = async (base64: string, extension: string, prefix = 'restored'): Promise<string> => {
  const directory = await ensureMediaDirectory();
  const safeExtension = extension.replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
  const target = `${directory}${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExtension}`;
  await FileSystem.writeAsStringAsync(target, base64, { encoding: FileSystem.EncodingType.Base64 });
  return target;
};

export const clearManagedMedia = async (): Promise<void> => {
  await FileSystem.deleteAsync(getMediaDirectory(), { idempotent: true }).catch(() => undefined);
};
