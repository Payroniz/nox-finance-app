const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const { DatabaseSync } = require('node:sqlite');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);
const salary = require('../src/utils/salary.ts');
const period = { id: 1, month: '2026-10', currency: 'TRY', mode: 'hourly', hourly_rate_minor: 15050, monthly_salary_minor: 3500000 };
const payment = (overrides = {}) => ({ id: 1, name: 'Kira', amount: 1000, currency: 'TRY', due_date: '2026-11-01', status: 'pending', category: 'Diğer', icon_type: 'icon', icon_value: 'cash', due_time: '09:00', recurrence: 'none', notes: '', reminder_days: '[]', notification_id: '', ...overrides });
const debt = (overrides = {}) => ({ id: 1, person_name: 'Borç', total_amount: 1000, paid_amount: 200, currency: 'TRY', debt_direction: 'owe', due_date: '2026-11-10', person_photo: '', icon_type: 'icon', icon_value: 'cash', interest_rate: 0, notes: '', reminder_days: '[]', notification_ids: '[]', ...overrides });
const subscription = (overrides = {}) => ({ id: 1, name: 'Abonelik', amount: 99.99, currency: 'TRY', billing_cycle: 'monthly', renewal_date: '2026-10-31', active: 1, notes: '', ...overrides });
const work = (overrides = {}) => ({ id: 1, period_id: 1, date: '2026-10-10', worked_minutes: 480, break_minutes: 30, hourly_rate_minor: 15050, notes: '', ...overrides });
const allocation = (overrides = {}) => ({ id: 1, period_id: 1, kind: 'manual', source_id: null, occurrence_date: '', title: 'Market', amount_minor: 10000, notes: '', ...overrides });
const next = salary.salaryMonthRange('2026-10', 1);

async function withDatabase(fn) {
  const sqlite = new DatabaseSync(':memory:');
  const adapter = {
    execAsync: async sql => sqlite.exec(sql),
    runAsync: async (sql, values = []) => sqlite.prepare(sql).run(...values),
    getAllAsync: async (sql, values = []) => sqlite.prepare(sql).all(...values).map(row => ({ ...row })),
    getFirstAsync: async (sql, values = []) => { const row = sqlite.prepare(sql).get(...values); return row ? { ...row } : null; },
    withExclusiveTransactionAsync: async callback => {
      sqlite.exec('BEGIN IMMEDIATE');
      try { await callback(adapter); sqlite.exec('COMMIT'); } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
  const original = Module._load;
  Module._load = function (name, ...args) { return name === 'expo-sqlite' ? { openDatabaseAsync: async () => adapter } : original.call(this, name, ...args); };
  let db;
  try { delete require.cache[require.resolve('../src/db/database.ts')]; db = require('../src/db/database.ts'); }
  finally { Module._load = original; }
  try {
    await db.initializeDatabase();
    await db.saveSalaryPeriod(period);
    await fn(db, adapter);
  } finally { sqlite.close(); }
}

test('money parsing rejects ambiguous formats and preserves exact cents', () => {
  assert.equal(salary.parseSalaryMoney('150,50'), 15050);
  assert.equal(salary.parseSalaryMoney('0.01'), 1);
  for (const value of ['1.000,00', '-1', '1e3', '1.005', '0', '', 'Infinity']) assert.throws(() => salary.parseSalaryMoney(value));
  assert.equal(salary.expenseToMinor(1.005), 101);
  assert.equal(salary.expenseToMinor(0.1 + 0.2), 30);
});

test('daily earnings agree with integer BigInt oracle for all minute counts', () => {
  for (const rate of [1, 29, 30, 101, 15050, salary.MAX_SALARY_MONEY]) {
    for (let minutes = 1; minutes <= 1440; minutes++) {
      assert.equal(salary.workEntryEarnings(work({ worked_minutes: minutes, break_minutes: 0, hourly_rate_minor: rate })), Number((BigInt(minutes) * BigInt(rate) + 30n) / 60n));
    }
  }
  assert.equal(salary.workEntryEarnings(work()), 112875);
});

test('invalid durations, future work and wrong-month work fail', () => {
  for (const [h, m] of [['24', '1'], ['8', '60'], ['1.5', '0'], ['0', '0']]) assert.throws(() => salary.parseWorkDuration(h, m));
  assert.throws(() => salary.validateSalaryWorkEntry(work({ break_minutes: 480 }), period));
  assert.throws(() => salary.validateSalaryWorkEntry(work({ date: '2026-11-01' }), period));
  assert.throws(() => salary.validateSalaryWorkEntry(work({ date: '2026-10-30' }), period, '2026-10-29'));
});

test('salary summaries isolate period and mode, preserve negative balances', () => {
  assert.deepEqual(salary.salarySummary(period, [work(), work({ id: 2, period_id: 2 })], [allocation({ amount_minor: 200000 })]), { earned: 112875, allocated: 200000, remaining: -87125, days: 1, paidMinutes: 450, breakMinutes: 30 });
  assert.equal(salary.salarySummary({ ...period, mode: 'monthly' }, [work()], []).earned, 3500000);
});

test('month ranges cover year rollover and leap days', () => {
  assert.deepEqual(salary.salaryMonthRange('2026-12', 1), { start: '2027-01-01', end: '2027-01-31', includeEarlier: false });
  assert.equal(salary.salaryMonthRange('2028-02').end, '2028-02-29');
  assert.equal(salary.salaryMonthRange('2027-02').end, '2027-02-28');
  assert.throws(() => salary.salaryMonthRange('2199-12', 1));
  assert.throws(() => salary.salaryMonthRange('1900-01', -1));
});

test('custom ranges validate real dates, order and inclusive 366-day limit', () => {
  for (const range of [{ start: '2026-02-30', end: '2026-03-01' }, { start: '2026-11-01', end: '2026-10-31' }, { start: '2028-01-01', end: '2029-01-01' }]) assert.throws(() => salary.validateSalaryExpenseRange({ ...range, includeEarlier: false }));
  assert.doesNotThrow(() => salary.validateSalaryExpenseRange({ start: '2028-01-01', end: '2028-12-31', includeEarlier: false }));
});

test('future selection is inclusive and excludes paid, other currency and receivables', () => {
  const payments = [payment(), payment({ id: 2, due_date: '2026-11-30' }), payment({ id: 3, due_date: '2026-12-01' }), payment({ id: 4, status: 'paid' }), payment({ id: 5, currency: 'USD' })];
  const debts = [debt(), debt({ id: 2, due_date: '' }), debt({ id: 3, debt_direction: 'owed' }), debt({ id: 4, paid_amount: 1000 })];
  const items = salary.salaryExpenseCandidates(period, payments, debts, [], next);
  assert.equal(items.length, 4);
  assert.deepEqual(items.filter(x => x.kind === 'payment').map(x => x.source_id), [1, 2]);
  assert.equal(items.find(x => x.kind === 'debt').amount_minor, 80000);
  assert.equal(items.at(-1).occurrence_date, '');
});

test('overdue toggle includes older payments/debts but no extra subscription renewals', () => {
  const payments = [payment({ due_date: '2026-09-01' })];
  const debts = [debt({ due_date: '2026-09-01' })];
  assert.equal(salary.salaryExpenseCandidates(period, payments, debts, [], next).length, 0);
  const items = salary.salaryExpenseCandidates(period, payments, debts, [subscription()], { ...next, includeEarlier: true });
  assert.equal(items.length, 3);
  assert.equal(items.find(x => x.kind === 'subscription').occurrence_date, '2026-11-30');
});

test('recurrences keep month-end anchors and separate each renewal', () => {
  const items = salary.salaryExpenseCandidates(period, [], [], [subscription()], { start: '2026-11-01', end: '2027-03-31', includeEarlier: false });
  assert.deepEqual(items.map(x => x.occurrence_date), ['2026-11-30', '2026-12-31', '2027-01-31', '2027-02-28', '2027-03-31']);
  assert.equal(new Set(items.map(salary.salarySourceKey)).size, 5);
  const weekly = salary.salaryExpenseCandidates(period, [], [], [subscription({ billing_cycle: 'weekly', renewal_date: '2026-11-01' })], next);
  assert.equal(weekly.length, 5);
  assert.equal(salary.salaryExpenseCandidates(period, [], [], [subscription({ active: 0 })], next).length, 0);
  assert.equal(salary.salaryExpenseCandidates(period, [], [], [subscription({ billing_cycle: 'yearly' })], next).length, 0);
});

test('allocation grouping and source lookup do not depend on salary month', () => {
  const item = allocation({ kind: 'payment', source_id: 1, occurrence_date: '2026-11-01' });
  assert.equal(salary.salaryAllocationSource(period, item, [payment()], [], []).amount_minor, 100000);
  assert.deepEqual(salary.salaryAllocationGroups([allocation(), item, allocation({ id: 3, occurrence_date: '2026-11-30' })]).map(x => [x.month, x.amount]), [['2026-11', 20000], ['', 10000]]);
});

test('future payment saves, edits and removes against the current salary in SQLite', () => withDatabase(async db => {
  await db.addPayment(payment());
  const item = allocation({ kind: 'payment', source_id: 1, occurrence_date: '2026-11-01', amount_minor: 100000 });
  await db.saveSalaryWorkEntry(work());
  await db.saveSalaryAllocation(item);
  let data = await db.getSalaryData();
  assert.equal(salary.salarySummary(data.periods[0], data.workEntries, data.allocations).remaining, 12875);
  await db.saveSalaryAllocation({ ...item, amount_minor: 50000 }, 1);
  data = await db.getSalaryData();
  assert.equal(salary.salarySummary(data.periods[0], data.workEntries, data.allocations).remaining, 62875);
  assert.equal((await db.getPayments())[0].status, 'pending');
  await db.deleteSalaryAllocation(1, 1);
  assert.equal((await db.getSalaryData()).allocations.length, 0);
}));

test('payment duplicates cannot cross salary months or evade checks after rescheduling', () => withDatabase(async (db, sql) => {
  await db.addPayment(payment());
  await db.saveSalaryPeriod({ ...period, month: '2026-11' });
  const item = allocation({ kind: 'payment', source_id: 1, occurrence_date: '2026-11-01' });
  await db.saveSalaryAllocation(item);
  await assert.rejects(db.saveSalaryAllocation({ ...item, period_id: 2 }), /zaten/);
  await sql.runAsync('UPDATE payments SET due_date = ? WHERE id = 1', ['2026-12-01']);
  await assert.rejects(db.saveSalaryAllocation({ ...item, period_id: 2, occurrence_date: '2026-12-01' }), /zaten/);
}));

test('distinct future subscription renewals can be saved; same renewal cannot', () => withDatabase(async db => {
  await db.saveSubscription(subscription());
  const item = allocation({ kind: 'subscription', source_id: 1, occurrence_date: '2026-11-30', amount_minor: 9999 });
  await db.saveSalaryAllocation(item);
  await db.saveSalaryAllocation({ ...item, occurrence_date: '2026-12-31' });
  await assert.rejects(db.saveSalaryAllocation(item), /zaten/);
  await assert.rejects(db.saveSalaryAllocation({ ...item, occurrence_date: '2026-12-30' }), /eklenebilir/);
  assert.equal((await db.getSalaryData()).allocations.length, 2);
}));

test('dated debt duplicates remain per-period after due-date changes', () => withDatabase(async (db, sql) => {
  await db.addDebt(debt());
  const item = allocation({ kind: 'debt', source_id: 1, occurrence_date: '2026-11-10', amount_minor: 40000 });
  await db.saveSalaryAllocation(item);
  await sql.runAsync('UPDATE debts SET due_date = ? WHERE id = 1', ['2026-12-10']);
  await assert.rejects(db.saveSalaryAllocation({ ...item, occurrence_date: '2026-12-10' }), /zaten/);
  await db.saveSalaryAllocation({ ...item, amount_minor: 50000 }, 1);
  assert.equal((await db.getSalaryData()).allocations[0].occurrence_date, '2026-11-10');
  await assert.rejects(db.saveSalaryAllocation({ ...item, amount_minor: 80001 }, 1), /aşamaz/);
  assert.equal((await db.getDebts())[0].paid_amount, 200);
}));

test('manual expense dates persist when edited and can be cleared', () => withDatabase(async db => {
  await db.saveSalaryAllocation(allocation());
  await db.saveSalaryAllocation(allocation({ occurrence_date: '2027-01-15' }), 1);
  assert.equal((await db.getSalaryData()).allocations[0].occurrence_date, '2027-01-15');
  await db.saveSalaryAllocation(allocation(), 1);
  assert.equal((await db.getSalaryData()).allocations[0].occurrence_date, '');
}));

test('stale sources, wrong currency, and excessive amounts are rejected', () => withDatabase(async (db, sql) => {
  await db.addPayment(payment());
  const item = allocation({ kind: 'payment', source_id: 1, occurrence_date: '2026-11-01' });
  await assert.rejects(db.saveSalaryAllocation({ ...item, amount_minor: 100001 }), /aşamaz/);
  await sql.runAsync('UPDATE payments SET due_date = ? WHERE id = 1', ['2026-12-01']);
  await assert.rejects(db.saveSalaryAllocation(item), /vadesi/);
  await sql.runAsync('UPDATE payments SET currency = ? WHERE id = 1', ['USD']);
  await assert.rejects(db.saveSalaryAllocation({ ...item, occurrence_date: '2026-12-01' }), /eklenebilir/);
}));

test('deleted source keeps saved snapshot and allows reductions only', () => withDatabase(async db => {
  await db.addPayment(payment());
  const item = allocation({ kind: 'payment', source_id: 1, occurrence_date: '2026-11-01' });
  await db.saveSalaryAllocation(item);
  await db.deletePayment(1);
  await db.saveSalaryAllocation({ ...item, amount_minor: 5000 }, 1);
  await assert.rejects(db.saveSalaryAllocation({ ...item, amount_minor: 6000 }, 1), /eklenebilir/);
  assert.equal((await db.getSalaryData()).allocations[0].amount_minor, 5000);
}));

test('daily rate snapshots, duplicate days and mode changes remain correct', () => withDatabase(async db => {
  await db.saveSalaryWorkEntry(work());
  await assert.rejects(db.saveSalaryWorkEntry(work()), /zaten/);
  await db.saveSalaryPeriod({ ...period, hourly_rate_minor: 20000 }, 1);
  assert.equal((await db.getSalaryData()).workEntries[0].hourly_rate_minor, 15050);
  await db.saveSalaryPeriod({ ...period, mode: 'monthly' }, 1);
  const data = await db.getSalaryData();
  assert.equal(salary.salarySummary(data.periods[0], data.workEntries, []).earned, 3500000);
  await assert.rejects(db.saveSalaryWorkEntry(work()), /saatlik/);
}));

test('backup 9 round-trips dated allocations and validates before replacing data', () => withDatabase(async db => {
  await db.saveSalaryWorkEntry(work());
  await db.saveSalaryAllocation(allocation({ occurrence_date: '2027-01-01' }));
  const saved = await db.getSalaryData();
  const backup = JSON.parse(await db.exportData());
  assert.equal(backup.version, 9);
  await db.importData(JSON.stringify(backup));
  assert.deepEqual(await db.getSalaryData(), saved);
  backup.salary.allocations.push({ ...backup.salary.allocations[0] });
  await assert.rejects(db.importData(JSON.stringify(backup)), /geçersiz/);
  assert.deepEqual(await db.getSalaryData(), saved);
}));

test('failed imports roll back and legacy backups still restore', () => withDatabase(async db => {
  await db.saveSalaryAllocation(allocation());
  const backup = JSON.parse(await db.exportData());
  const saved = await db.getSalaryData();
  const bad = { ...backup, payments: [payment({ id: 1, amount: null })] };
  await assert.rejects(db.importData(JSON.stringify(bad)));
  assert.deepEqual(await db.getSalaryData(), saved);
  await db.importData(JSON.stringify({ ...backup, version: 8 }));
  assert.deepEqual(await db.getSalaryData(), saved);
  const legacy = { ...backup, version: 7 }; delete legacy.salary;
  await db.importData(JSON.stringify(legacy));
  assert.deepEqual(await db.getSalaryData(), { periods: [], workEntries: [], allocations: [] });
}));