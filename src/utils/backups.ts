import * as FileSystem from 'expo-file-system/legacy';

export const cleanupTemporaryBackups = async (): Promise<void> => {
  const roots = [FileSystem.documentDirectory, FileSystem.cacheDirectory].filter(
    (root): root is string => Boolean(root)
  );

  for (const root of roots) {
    const files = await FileSystem.readDirectoryAsync(root).catch(() => []);
    const backups = files.filter(name => /^nox-backup-\d+\.json$/.test(name));
    await Promise.all(
      backups.map(name => FileSystem.deleteAsync(`${root}${name}`, { idempotent: true }))
    );
  }
};
