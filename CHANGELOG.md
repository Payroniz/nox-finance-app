# NoX Finance Changelog

This file records user-facing changes to NoX Finance. Source history for earlier releases is available through the [GitHub tags](https://github.com/Payroniz/nox-finance-app/tags).

---

## [v3.1.7] - 2026-09-21

### Added

- "Upload Icons" and "Uploaded Icons" are back in the settings.
- Uploaded icons can be selected from the payment and debt adding/editing screens.
- Profile photos and icons are now included in the JSON backup as Base64.
- "Restore Backup" allows direct selection of the JSON file.
- Automatic backups can be restored by selecting from a dated list.
- Frequency, tool, and automatic backup history are hidden when automatic backup is off.
- When Drive, Dropbox, and OneDrive are selected, Android's account/folder provider opens; the selected folder becomes the automatic backup target. The relevant application must be installed on the phone and logged into the account.
- The home page, payments, debts, and statistics have been improved.
- A new "Plan" tab has been added, offering 7/30/90-day cash flow.

---

## [v3.1.8] - 2026-09-21

### Added

- Subscriptions tab with add, edit, and delete actions, active or paused tracking, weekly/monthly/yearly renewals, and monthly totals by currency.
- Subscription records in JSON backups and restores, with compatibility for older backups.
- Regression tests for SQLite operations, renewal calculations, and backup failure scenarios.

### Fixed

- Replaced the legacy file API that was incompatible with some Android document providers with the current File/Directory API, and added verification after saving.
- Automatic backups are stored in NoX's application storage without requiring external folder permissions. Failure to remove older copies no longer reports a successfully saved backup as failed.
- Backup destinations can always be changed, with clearer messages for permission errors, insufficient storage, and sharing results.
- Shared files are retained after the share sheet closes so the receiving app has time to read them. Automatic backup timestamps are tracked separately.
- Prevented an unsupported notification response call during startup in the browser preview.

### Changed

- Enlarged the splash screen logo and NoX wordmark together.
- Adjusted the bottom navigation height to accommodate labels and the device's bottom safe area.
- Updated the app version to 3.1.8 and the local Android versionCode to 5, with automatic build number increments for EAS preview and production builds.

---

## [v3.1.9] - 2026-09-21

### Added

- A color customization feature has been added to subscription cards
- You can now choose the image for your subscription cards from both your local files and the pre-installed icons.

---

## [v3.2.2] - 2026-09-30

### Added

- Combined weekly, monthly, and yearly subscription filters with custom categories, selection counts, and filtered monthly estimates.
- Category creation from the subscription list and add/edit form, renaming, and deletion that keeps subscriptions under Uncategorized.
- Persistent subscription category assignments, backward-compatible backup format 7, and regression coverage for category migration, transfers, restore validation, and dashboard calculations.
- Dashboard shortcuts for adding payments, subscriptions, and debts, plus a chronological seven-day agenda with a separate overdue view.

### Changed

- Rebuilt the home screen around a monthly expense breakdown, upcoming transactions, outstanding debts and receivables, and a compact subscription summary.
- Restyled all seven bottom navigation destinations as a bordered capsule with outline icons, a rounded active pill in the app's purple palette, and horizontal scrolling on narrow screens.
- Removed the solid backdrop outside the navigation capsule so page content can scroll behind it, with bottom spacing that keeps the last items accessible.
- Subscription add/edit now saves the chosen category and shows the saved record in that category; existing subscriptions start as uncategorized.
- Updated application version metadata and the settings display to v3.2.2, with Android versionCode 6.

### Removed

- Removed duplicate category/weekday charts and the promotional planner banner from the home screen; detailed reports and planning remain available in their tabs.

### Fixed

- Dashboard upcoming items now follow the selected currency, matching the displayed totals.
- Seven-day subscription summaries now count actual renewals within seven calendar days, including today, without including an eighth day.

---

## [v3.2.3] - 2026-10-29

### Added
- **Maaş** beside **Plan**, with separate months/currencies, hourly or fixed monthly net pay, and a remaining-income summary.
- Daily hours, minutes, unpaid breaks, individual rates, notes, editing, and deletion. Historical daily rates remain unchanged when the monthly default changes.
- Salary allocations to unpaid payments, partial debt amounts, individual subscription renewals, or manual budget items; editing, removal, source links, and negative-budget warnings.
- Integer minor-unit arithmetic, per-day rounding, duplicate-day/source protection, strict input validation, calendar boundaries, SQLite persistence, and restore failures.
- Expense-period selection independent of the salary month: salary month, next month, month navigation, or a custom inclusive range of up to 366 days, with an optional overdue-payment/debt filter.
- Future payment, debt, and subscription-renewal allocations from the current salary, grouped by expense month, with future-month totals and optional dates for manual expenses.
- Animated launch experience with orbiting rings, a subtle breathing glow, and a smooth exit after initialization. Respects reduced-motion preferences and preserves startup security checks.
- Backup format 9 for salary records and dated allocations, backward-compatible restores, and salary cleanup during deletion of all app data.

### Changed
- Redesigned the salary dashboard and all salary setup, work, allocation, editing, and removal forms with dark layered cards, purple/teal accents, a budget ring, numbered sections, live calculations, and persistent save/cancel actions.
- Settings now reads the version from app metadata.
- Matched the native splash background to the animated launch screen.

### Fixed
- Future expenses are validated against their own due/renewal dates when saving, instead of being restricted to the salary month.
- Duplicate payment and debt detection remains valid after their due dates change. Each subscription renewal is protected independently across salary months.
- Manual expense dates are retained when editing and restoring backups. Linked allocations retain their original date and amount snapshots.
- Budget percentages remain accurate above 100%; a zero-income budget does not display a misleading percentage.

### Behavior
- Allocations reserve a budget amount; they do not perform payments or modify paid statuses, debt balances, or expense statistics.
- Saved allocations retain their amounts after changes to their original sources. Each subscription renewal is a distinct expense; currencies are never combined.
- Net rates are entered by the user; taxes, insurance deductions, and overtime coefficients are not inferred.

---

[v3.1.7]: https://github.com/Payroniz/nox-finance-app/releases/tag/V3.1.7
[v3.1.8]: https://github.com/Payroniz/nox-finance-app/releases/tag/V3.1.8
[v3.1.9]: https://github.com/Payroniz/nox-finance-app/releases/tag/V3.1.9
[v3.2.2]: https://github.com/Payroniz/nox-finance-app/releases/tag/V3.2.2
[v3.2.3]: https://github.com/Payroniz/nox-finance-app/releases/tag/V3.2.3