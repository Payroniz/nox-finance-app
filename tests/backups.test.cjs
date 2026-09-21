const { test } = require('node:test');
const assert = require('node:assert/strict');
const createLoader = require('./load-typescript.cjs');

function fixture() {
  const files = new Map();
  const directories = new Set(['file:///documents', 'file:///cache', 'content://com.example.drive/tree/123']);
  const settings = { backupDirectoryUri: 'content://com.example.drive/tree/123', backupDestination: 'google-drive',
    automaticBackupEnabled: true, backupFrequency: 'weekly', lastBackupAt: 'previous-success' };
  const state = { failWrite: false, failDelete: false, cancelPicker: false, sharing: true, restored: null, shared: null };
  const join = parts => parts.map(part => typeof part === 'string' ? part : part.uri)
    .map((uri, index) => index ? uri.replace(/^\/+|\/+$/g, '') : uri.replace(/\/+$/, '')).join('/');
  class File {
    constructor(...parts) { this.uri = join(parts); }
    get name() { return this.uri.split('/').pop(); }
    get exists() { return files.has(this.uri); }
    get modificationTime() { return files.get(this.uri)?.time ?? null; }
    write(raw) { if (state.failWrite) throw new Error('permission denied'); files.set(this.uri, { raw, time: Date.now() }); }
    async text() { if (!this.exists) throw new Error('missing file'); return files.get(this.uri).raw; }
    async base64() { return Buffer.from(await this.text()).toString('base64'); }
    delete() { if (state.failDelete) throw new Error('cannot delete'); files.delete(this.uri); }
    async move(target) { files.set(target.uri, files.get(this.uri)); files.delete(this.uri); this.uri = target.uri; }
    async copy(target) { files.set(target.uri, { ...files.get(this.uri) }); }
  }
  class Directory {
    constructor(...parts) { this.uri = join(parts); }
    get exists() { return directories.has(this.uri); }
    create() { directories.add(this.uri); }
    createFile(name) { if (!this.exists) throw new Error('directory permission denied'); const file = new File(this, name); files.set(file.uri, { raw: '', time: Date.now() }); return file; }
    list() { if (!this.exists) throw new Error('directory permission denied'); return [...files.keys()].filter(uri => uri.startsWith(`${this.uri}/`)).map(uri => new File(uri)); }
    delete() { for (const uri of files.keys()) if (uri.startsWith(`${this.uri}/`)) files.delete(uri); directories.delete(this.uri); }
    static async pickDirectoryAsync() { if (state.cancelPicker) throw new Error('Picker cancelled'); return new Directory('content://com.example.drive/tree/123'); }
  }
  const Paths = { document: new Directory('file:///documents'), cache: new Directory('file:///cache') };
  const payload = { format: 'nox-finance-backup', version: 5, payments: [], debts: [], debtPayments: [], categories: [], settings: [],
    subscriptions: [{ name: 'Netflix', amount: 150, currency: 'TRY' }], uploadedIcons: [] };
  const db = {
    exportData: async () => JSON.stringify(payload),
    getAllSettings: async () => ({ ...settings }), getSetting: async key => settings[key] ?? null,
    setSetting: async (key, value) => { settings[key] = value; }, importData: async raw => { state.restored = JSON.parse(raw); },
  };
  const api = createLoader({ 'expo-file-system': { File, Directory, Paths }, 'react-native': { Platform: { OS: 'android' } },
    'expo-document-picker': { getDocumentAsync: async () => ({ canceled: true, assets: [] }) },
    'expo-sharing': { isAvailableAsync: async () => state.sharing, shareAsync: async uri => { state.shared = uri; } },
    '../db/database': db,
  })('src/utils/backups.ts');
  return { api, files, directories, settings, state, payload, File };
}

test('automatic backup succeeds without external permissions and retains the newest five copies', async () => {
  const f = fixture();
  f.settings.backupDirectoryUri = 'content://revoked/tree/old';
  for (let i = 1; i <= 6; i++) f.files.set(`file:///documents/nox-backups/nox-backup-2020-01-0${i}T00-00-00.json`, { raw: '{}', time: 0 });
  const uri = await f.api.createAutomaticBackup();
  assert.ok(uri.startsWith('file:///documents/nox-backups/'));
  assert.equal((await f.api.listAutomaticBackups()).length, 5);
  assert.equal(JSON.parse(f.files.get(uri).raw).subscriptions[0].name, 'Netflix');
  assert.ok(f.settings.lastAutomaticBackupAt);
});
test('retention failure does not report a successfully written backup as failed', async () => {
  const f = fixture(); f.state.failDelete = true;
  for (let i = 1; i <= 6; i++) f.files.set(`file:///documents/nox-backups/nox-backup-2020-01-0${i}T00-00-00.json`, { raw: '{}', time: 0 });
  const uri = await f.api.createAutomaticBackup();
  assert.ok(f.files.has(uri)); assert.notEqual(f.settings.lastBackupAt, 'previous-success');
});
test('write failures preserve the previous successful timestamp and remove incomplete files', async () => {
  const f = fixture(); f.state.failWrite = true;
  await assert.rejects(f.api.createAutomaticBackup());
  assert.equal(f.settings.lastBackupAt, 'previous-success');
  assert.equal(f.settings.lastAutomaticBackupAt, undefined);
  assert.equal(f.files.size, 0);
});
test('provider content URIs work through modern Directory/File and roundtrip subscriptions', async () => {
  const f = fixture();
  await f.api.configureBackupDestination('google-drive', 'Google Drive');
  await f.api.saveBackupToConfiguredDestination();
  const [uri] = f.files.keys();
  assert.ok(uri.startsWith('content://com.example.drive/'));
  await f.api.restoreAutomaticBackup({ name: 'test.json', uri });
  assert.equal(f.state.restored.subscriptions[0].name, 'Netflix');
  assert.equal(f.state.restored.version, 5);
});
test('external write failure leaves neither a success timestamp nor an empty JSON backup', async () => {
  const f = fixture(); f.state.failWrite = true;
  await assert.rejects(f.api.saveBackupToConfiguredDestination());
  assert.equal(f.files.size, 0);
  assert.equal(f.settings.lastBackupAt, 'previous-success');
});
test('cancelled picker and failed write probe preserve the previous destination', async () => {
  const f = fixture(); f.settings.backupDirectoryUri = 'previous-folder';
  f.state.cancelPicker = true;
  await assert.rejects(f.api.configureBackupDestination('device', 'Cihaz'), error => f.api.isBackupCancelled(error));
  assert.equal(f.settings.backupDirectoryUri, 'previous-folder');
  f.state.cancelPicker = false; f.state.failWrite = true;
  await assert.rejects(f.api.configureBackupDestination('device', 'Cihaz'));
  assert.equal(f.settings.backupDirectoryUri, 'previous-folder');
  assert.equal(f.files.size, 0);
});
test('sharing keeps a durable local copy and does not prematurely delete the receiving app file', async () => {
  const f = fixture();
  await f.api.shareBackup();
  assert.ok(f.files.has(f.state.shared));
  assert.equal((await f.api.listAutomaticBackups()).length, 1);
  await f.api.cleanupTemporaryBackups();
  assert.ok(f.files.has(f.state.shared));
  f.files.get(f.state.shared).time = Date.now() - 86400001;
  await f.api.cleanupTemporaryBackups();
  assert.ok(!f.files.has(f.state.shared));
  assert.equal((await f.api.listAutomaticBackups()).length, 1);
});
test('automatic schedule uses its own timestamp; concurrent automatic requests produce one file', async () => {
  const f = fixture(); f.settings.lastBackupAt = new Date().toISOString();
  assert.equal(await f.api.runAutomaticBackupIfDue(), true);
  assert.equal(await f.api.runAutomaticBackupIfDue(), false);
  const [a, b] = await Promise.all([f.api.createAutomaticBackup(), f.api.createAutomaticBackup()]);
  assert.equal(a, b);
});
test('embedded media survives export and restore; clearing local backups leaves external exports', async () => {
  const f = fixture();
  f.files.set('file:///photo.jpg', { raw: 'image-bytes', time: Date.now() });
  f.payload.uploadedIcons.push({ id: 1, uri: 'file:///photo.jpg' });
  const uri = await f.api.createAutomaticBackup();
  await f.api.restoreAutomaticBackup({ name: 'test', uri });
  assert.ok(f.state.restored.uploadedIcons[0].uri.startsWith('file:///documents/nox-media/'));
  await f.api.saveBackupToConfiguredDestination();
  await f.api.clearLocalBackups();
  assert.equal((await f.api.listAutomaticBackups()).length, 0);
  assert.ok([...f.files.keys()].some(key => key.startsWith('content://')));
});
