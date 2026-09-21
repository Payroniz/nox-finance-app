# Contributing to NoX Finance

NoX Finance is a personal finance application built with Expo and React Native. It stores data in an on-device SQLite database. Preserve compatibility with existing user data when working on payments, debts, receivables, and subscriptions.

## Bug Reports and Feature Requests

Check [existing issues](https://github.com/Payroniz/nox-finance-app/issues) first. When opening a new report, include the app version, device model, operating system version, steps to reproduce, and expected behavior. Redact personal information from screenshots. Do not share real financial records, backup files, or PINs.

For security vulnerabilities, follow the [security policy](SECURITY.md).

## Development Environment

Use Node.js 22.20 or a later 22.x release, along with npm. Fork the repository and clone your own copy:

```bash
git clone https://github.com/YOUR_USERNAME/nox-finance-app.git
cd nox-finance-app
npm ci
git switch -c codex/describe-your-change
npm start
```

`npm run android` requires the Android SDK and JDK. `npm run ios` requires macOS and Xcode. `npm run web` starts a browser preview; file access, biometrics, notifications, and the native date picker must also be verified on a real device. `npm run build:android` starts a preview APK build using an EAS account with access to the project.

## Validating Changes

```bash
npm run lint
npm run typecheck
npm test
npx expo export --platform android
```

- ESLint configuration lives in `.github/eslint.config.mjs`; `npm run lint` explicitly uses this file.
- Tests cover renewal dates, totals by currency, real SQLite operations, and backup failure scenarios using simulated file adapters. `npm test` does not start the app.
- Database changes must preserve existing records. Include new fields in backup export, restore, and data deletion flows. Test older backups as well.
- Check visual changes on narrow screens, with the keyboard open, and with safe area insets.
- Update Expo and React Native dependencies according to SDK compatibility. Use `npx expo install --check` when needed, and include the corresponding `package-lock.json` changes.
- Splash screen and native configuration changes require a new app build.

## Pull Requests

Describe the problem, the resulting behavior, and the checks you ran. Include screenshots without personal data for interface changes. Keep release notes in [CHANGELOG.md](../CHANGELOG.md). Do not commit signing keys, EAS credentials, local databases, or backups.

## GitHub Automation

- `lint.yml`: Runs ESLint, TypeScript checks, regression tests, and Android JavaScript bundling on pushes to `main` and pull requests targeting it. It does not build an APK.
- Dependabot: Proposes npm and GitHub Actions updates weekly. It does not merge them automatically.
- `stale.yml`: Marks issues and pull requests after 14 days of inactivity and closes them after another 7 days without activity. Assigned items, draft pull requests, and items labeled `security`, `bug`, or `keep-open` are exempt.
