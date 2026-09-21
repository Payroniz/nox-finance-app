const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const createLoader = require('./load-typescript.cjs');
const load = createLoader();
const { getNextRenewal, getMonthlySubscriptionTotals, validateSubscription } = load('src/utils/subscriptions.ts');

const sample = { name: 'Spotify', amount: 99.99, currency: 'TRY', billing_cycle: 'monthly', renewal_date: '2026-01-31', active: 1, notes: 'Bireysel' };

test('monthly billing preserves the original day across short months', () => {
  assert.equal(getNextRenewal(sample, new Date(2026, 1, 1)), '2026-02-28');
  assert.equal(getNextRenewal(sample, new Date(2026, 2, 1)), '2026-03-31');
  assert.equal(getNextRenewal(sample, new Date(2026, 2, 31)), '2026-03-31');
  assert.equal(getNextRenewal(sample, new Date(2026, 3, 1)), '2026-04-30');
});
test('yearly leap-day subscriptions recover 29 February in leap years', () => {
  const item = { ...sample, billing_cycle: 'yearly', renewal_date: '2024-02-29' };
  assert.equal(getNextRenewal(item, new Date(2025, 1, 1)), '2025-02-28');
  assert.equal(getNextRenewal(item, new Date(2028, 1, 1)), '2028-02-29');
});
test('weekly billing crosses year boundaries and includes today', () => {
  const item = { ...sample, billing_cycle: 'weekly', renewal_date: '2025-12-29' };
  assert.equal(getNextRenewal(item, new Date(2026, 0, 1)), '2026-01-05');
  assert.equal(getNextRenewal(item, new Date(2026, 0, 5)), '2026-01-05');
  assert.equal(getNextRenewal(item, new Date(2026, 0, 6)), '2026-01-12');
});
test('monthly totals normalize periods, separate currencies, and exclude inactive records', () => {
  const totals = getMonthlySubscriptionTotals([
    { ...sample, amount: 120 }, { ...sample, amount: 1200, billing_cycle: 'yearly' },
    { ...sample, amount: 12, billing_cycle: 'weekly', currency: 'USD' },
    { ...sample, amount: 999, active: 0 },
  ]);
  assert.deepEqual(totals, { TRY: 220, USD: 52 });
});
test('invalid dates, blank names, invalid money and cycles are rejected', () => {
  for (const change of [{ amount: 0 }, { amount: -1 }, { amount: Infinity }, { name: ' ' },
    { renewal_date: '2026-02-30' }, { currency: 'XYZ' }, { billing_cycle: 'daily' }]) {
    assert.throws(() => validateSubscription({ ...sample, ...change }), /INVALID_SUBSCRIPTION/);
  }
});

function database() {
  const sqlite = new DatabaseSync(':memory:');
  const adapter = {
    execAsync: async sql => sqlite.exec(sql),
    getAllAsync: async (sql, args = []) => sqlite.prepare(sql).all(...args),
    getFirstAsync: async (sql, args = []) => sqlite.prepare(sql).get(...args) ?? null,
    runAsync: async (sql, args = []) => {
      const result = sqlite.prepare(sql).run(...args);
      return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
    },
    withExclusiveTransactionAsync: async callback => {
      sqlite.exec('BEGIN');
      try { await callback(adapter); sqlite.exec('COMMIT'); }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
  return { sqlite, db: createLoader({ 'expo-sqlite': { openDatabaseAsync: async () => adapter } })('src/db/database.ts') };
}

test('schema upgrade is idempotent; CRUD, backup roundtrip and complete deletion work on SQLite', async () => {
  const { db, sqlite } = database();
  try {
    await db.initializeDatabase();
    await db.saveSubscription(sample);
    await db.initializeDatabase();
    const [saved] = await db.getSubscriptions();
    assert.equal(saved.name, 'Spotify');
    await db.saveSubscription({ ...sample, name: 'Netflix', currency: 'EUR', active: 0 }, saved.id);
    await db.setSetting('lastAutomaticBackupAt', 'private-device-state');
    const raw = await db.exportData();
    const backup = JSON.parse(raw);
    assert.equal(backup.version, 5);
    assert.equal(backup.subscriptions[0].name, 'Netflix');
    assert.ok(!backup.settings.some(item => item.key === 'lastAutomaticBackupAt'));
    await db.deleteSubscription(saved.id);
    assert.equal((await db.getSubscriptions()).length, 0);
    await db.importData(raw);
    assert.equal((await db.getSubscriptions())[0].active, 0);
    assert.equal((await db.getSubscriptions())[0].currency, 'EUR');
    await db.deleteAllData();
    assert.deepEqual(await db.getSubscriptions(), []);
  } finally { sqlite.close(); }
});
test('old backups restore successfully and malformed subscriptions do not destroy existing data', async () => {
  const { db, sqlite } = database();
  try {
    await db.initializeDatabase(); await db.saveSubscription(sample);
    const backup = JSON.parse(await db.exportData());
    await assert.rejects(db.importData(JSON.stringify({ ...backup, subscriptions: [{ ...backup.subscriptions[0], amount: -1 }] })));
    assert.equal((await db.getSubscriptions()).length, 1);
    await assert.rejects(db.importData(JSON.stringify({ ...backup, subscriptions: [backup.subscriptions[0], backup.subscriptions[0]] })));
    assert.equal((await db.getSubscriptions()).length, 1, 'transaction rolls back duplicate IDs');
    delete backup.subscriptions; backup.version = 4;
    await db.importData(JSON.stringify(backup));
    assert.equal((await db.getSubscriptions()).length, 0);
  } finally { sqlite.close(); }
});
