# NoX Finance Changelog

This file records user-facing changes to NoX Finance. Source history for earlier releases is available through the [GitHub tags](https://github.com/Payroniz/nox-finance-app/tags).

## v3.1.8 - 2026-09-21

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

## v3.1.9 - 2026-09-21

### Added

- A color customization feature has been added to subscription cards
- You can now choose the image for your subscription cards from both your local files and the pre-installed icons.

---

## v3.2.2 - 2026-09-30

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