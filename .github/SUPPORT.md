# NoX Finance Support Guide

Read the [README](../README.md) for setup and features, the [CHANGELOG](../CHANGELOG.md) for release changes, and the [contribution guide](CONTRIBUTING.md) for development information.

## Bugs, Questions, and Feature Requests

Open a report in [NoX Finance Issues](https://github.com/Payroniz/nox-finance-app/issues). Include:

- App version, device model, and Android or iOS version.
- Steps to reproduce the problem and the expected behavior.
- A screenshot or error message with personal information redacted.
- For backup problems, the selected destination: a device folder, cloud provider, or share sheet.

Do not attach real payment or debt records, JSON backups, account details, PINs, or signing keys to public reports. Use fictional data in examples.

## Backups

Automatic backups are stored in NoX's application storage, keeping the five newest copies. Uninstalling the app also deletes these copies. Use the manual backup option in Settings to save an additional copy outside the app.

- If a folder permission fails, select the folder again in the backup destination settings.
- If a cloud app does not support folder selection, use the option to share with other apps and complete the save operation in the receiving app.
- If storage is full, free some space and try again.
- Restoring a backup replaces current financial records with the records in the selected backup. Export a copy of your current data first.

The developer cannot remotely access records stored on your device. You do not need to uninstall the app to request support.

## Notifications and Subscriptions

For notification problems, check both the device's app permissions and NoX's notification setting. The Subscriptions tab tracks amounts and renewal dates. It does not purchase services, charge you, or cancel memberships with providers.

Report security vulnerabilities through the process described in the [security policy](SECURITY.md), rather than in a public issue.
