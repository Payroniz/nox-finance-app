# NoX Finance Security Policy

NoX Finance stores payment, debt, receivable, subscription, and profile information on the device. Preventing disclosure of this information is a priority when reporting security issues.

## Supported Version

Fixes are prepared for the current code on the `main` branch. There is no separate security patch schedule for older releases. Using the latest version is recommended.

## Reporting a Vulnerability

Do not publish vulnerability details or working exploit code in public issues.

1. Open the [repository's Security page](https://github.com/Payroniz/nox-finance-app/security). If **Report a vulnerability** is available, use it to create a private report.
2. Otherwise, use a private contact channel published by the [repository owner](https://github.com/Payroniz). If no private channel is available, open an issue requesting one without disclosing vulnerability details.

Include the affected version and platform, expected and actual behavior, reproduction steps, and potential impact. Use fictional records instead of real user data. Do not send PINs, access tokens, backups, or signing keys.

## Protecting Data and Backups

- JSON backups may contain financial and profile information. PINs and device security settings are excluded from exports. JSON backups are not encrypted.
- The PIN or biometric screen lock does not encrypt exported backup files.
- Backups in the app's storage may be deleted when the app is uninstalled. Store external copies in locations where you control access.
- When testing security fixes, verify that older backups can be restored and existing records are preserved.

No fixed response or resolution time is guaranteed. Coordinate disclosure with the repository owner to allow time for a fix and for users to update.
