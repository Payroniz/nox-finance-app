import { Directory, File, Paths } from 'expo-file-system';

const MEDIA_FOLDER = 'nox-media/';

const getMediaDirectory = (): string => {
  return new Directory(Paths.document, MEDIA_FOLDER).uri.replace(/\/+$/, '') + '/';
};

export const ensureMediaDirectory = async (): Promise<string> => {
  const directory = getMediaDirectory();
  new Directory(directory).create({ intermediates: true, idempotent: true });
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
  await new File(sourceUri).copy(new File(target));
  return target;
};

export const writeRestoredMedia = async (base64: string, extension: string, prefix = 'restored'): Promise<string> => {
  const directory = await ensureMediaDirectory();
  const safeExtension = extension.replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
  const target = `${directory}${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExtension}`;
  new File(target).write(base64, { encoding: 'base64' });
  return target;
};

export const clearManagedMedia = async (): Promise<void> => {
  const directory = new Directory(getMediaDirectory());
  if (directory.exists) directory.delete();
};
