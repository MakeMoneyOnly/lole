# Native Shell

Capacitor wrapper architecture for the lole Restaurant Operating System.

## Current Status

| Component        | Status         | Notes                                                                       |
| ---------------- | -------------- | --------------------------------------------------------------------------- |
| Capacitor config | ✅ Active      | `capacitor.config.ts` configured for hybrid mode                            |
| Native plugins   | ✅ Installed   | device, biometric, preferences, push-notifications, barcode-scanner, sqlite |
| React Native     | ⏳ Not started | Architecture ready for future native components                             |
| Web fallback     | ✅ Active      | `native-shell/` serves as bootstrap bundle                                  |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Capacitor Container                       │
├─────────────────────────────────────────────────────────────┤
│  Mode: Hybrid (Server URL)          Mode: Fallback (Local) │
│  ┌─────────────────────────────┐    ┌───────────────────┐  │
│  │ Remote Next.js App          │    │ native-shell/     │  │
│  │ https://your-server.com     │    │ • index.html      │  │
│  │                             │    │ • app.js          │  │
│  │ Full restaurant experience  │    │ • styles.css      │  │
│  └─────────────────────────────┘    └───────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## How It Works

### Server Mode (Production/CI)

When `CAPACITOR_SERVER_URL` is set, Capacitor loads the remote Next.js app:

```bash
CAPACITOR_SERVER_URL=https://app.lole.restaurant npm run cap:sync:android
```

The native shell files are still required for iOS App Store compliance but won't be displayed.

### Fallback Mode (Local Development)

When no server URL is configured, Capacitor displays `native-shell/index.html`:

- Branded splash/loading state
- Device plugin status detection
- Session pairing information
- Clear messaging for next steps

## Native Plugins Available

| Plugin                                 | Purpose                              | Usage                          |
| -------------------------------------- | ------------------------------------ | ------------------------------ |
| `@capacitor/device`                    | Device info, battery, network status | `Device.getInfo()`             |
| `@capacitor/biometric`                 | Fingerprint/FaceID authentication    | `Biometric.authenticate()`     |
| `@capacitor/preferences`               | Persistent key-value storage         | `Preferences.set()`            |
| `@capacitor/push-notifications`        | Push notifications                   | `PushNotifications.register()` |
| `@capacitor-community/barcode-scanner` | QR/barcode scanning                  | Camera-based scanning          |
| `@capacitor-community/sqlite`          | Local database                       | Offline-first data sync        |

## React Native Path

React Native components will integrate via Capacitor's WebView bridge:

1. **Phase 1**: Keep hybrid architecture with native plugins
2. **Phase 2**: Add React Native modules for performance-critical features
3. **Phase 3**: Evaluate full React Native transition if beneficial

## Development

```bash
# Install dependencies (includes Capacitor)
pnpm install

# Sync Android project
pnpm cap:sync:android

# Open in Android Studio
pnpm cap:open:android
```

## Environment Variables

| Variable                           | Purpose                       | Example                |
| ---------------------------------- | ----------------------------- | ---------------------- |
| `CAPACITOR_SERVER_URL`             | Remote server for hybrid mode | `http://10.0.2.2:4000` |
| `NEXT_PUBLIC_CAPACITOR_SERVER_URL` | Build-time alternative        | Same format            |

Note: Use `http://10.0.2.2` for Android emulator localhost access, `http://127.0.0.1` for iOS simulator.
