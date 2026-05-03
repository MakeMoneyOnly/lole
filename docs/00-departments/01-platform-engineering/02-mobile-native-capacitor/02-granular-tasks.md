# Mobile & Native (Capacitor) — Granular Tasks

**Generated:** 2026-05-03 | **Updated:** 2026-05-03 (implementation complete)
**Source:** Deep codebase audit of 21 files
**Scope:** All findings from `01-audit-findings.md` mapped to actionable tasks

---

## Status Legend

| Icon | Meaning                              |
| ---- | ------------------------------------ |
| ✅   | Implemented — code in repo           |
| ⏳   | External — needs config outside code |
| 🔲   | Deferred — Phase 4                   |

---

## Phase 1: Foundation Completion (Weeks 1-3)

---

### T-001: Integrate Native SQLite via @capacitor-community/sqlite

**Priority:** CRITICAL | **Status:** ✅ Code complete | **External:** ⏳ `pnpm install && npx cap sync`

**Implemented:**

- `@capacitor-community/sqlite` added to `package.json` deps
- Plugin registered in `capacitor.plugins.json` and `capacitor.settings.gradle`
- `offline-order-manager.ts` — Full order/item CRUD with version vectors, device IDs, timestamping
- `offline-conflict-resolver.ts` — LWW conflict resolution, conflict audit logging
- `background-sync.ts` — Sync queue with localStorage persistence, batch POST to `/api/sync`
- `SyncWorker.java` — WorkManager periodic task (15min, network constraint)

**Remaining:** Run `pnpm install && npx cap sync` to register native SQLite plugin. Create `native-database.ts` when plugin available — `offline-order-manager.ts` currently uses localStorage; upgrade to SQLite after sync.

---

### T-002: Implement Push Notifications (FCM)

**Priority:** CRITICAL | **Status:** ✅ Code complete | **External:** ⏳ Firebase project + google-services.json

**Implemented:**

- `@capacitor/push-notifications` added to package.json
- `LoleFirebaseMessagingService.java` — 4 notification channels (lole_orders, lole_kds, lole_system), token refresh, message routing, pending intent for tap-to-open
- `push-notifications.ts` — `registerForPushNotifications()`, `onPushNotification()` handler dispatch, backend token sync to `/api/devices/push-token`
- `usePushNotifications.ts` — React hook with permission management
- `POST_NOTIFICATIONS` permission in AndroidManifest
- `com.google.firebase:firebase-messaging:24.1.0` in Gradle deps
- FCM service declaration in AndroidManifest

**Remaining:** Create Firebase project at console.firebase.google.com → generate `google-services.json` → place in `android/app/`. Code auto-activates when file present.

---

### T-003: Add App Signing Configuration for Release

**Priority:** CRITICAL | **Status:** ✅ Code complete | **External:** ⏳ keytool + real certificates

**Implemented:**

- `signingConfigs { release {...} }` block in `app/build.gradle`
- `minifyEnabled true` with ProGuard rules
- `proguard-rules.pro` — Keep rules for Capacitor, Sentry, Firebase, WorkManager, all custom plugins
- `keystore.properties.template` — Template with instructions
- `BuildConfig.DEBUG` detection in `MainActivity.onCreate()`
- `SENTRY_DSN` buildConfigField for debug/release

**Remaining:** Run `keytool -genkey -v -keystore lole-release.keystore -alias lole -keyalg RSA -keysize 2048 -validity 10000` → copy template → fill real passwords.

---

### T-004: Add Missing Android Permissions & Boot Receiver

**Priority:** HIGH | **Status:** ✅ Complete

- 15 permissions added: INTERNET, ACCESS_NETWORK_STATE, ACCESS_WIFI_STATE, FOREGROUND_SERVICE, FOREGROUND_SERVICE_DATA_SYNC, RECEIVE_BOOT_COMPLETED, VIBRATE, WAKE_LOCK, CAMERA, BLUETOOTH, BLUETOOTH_ADMIN, BLUETOOTH_CONNECT, BLUETOOTH_SCAN, USE_BIOMETRIC, POST_NOTIFICATIONS
- CAMERA + BLUETOOTH hardware features (required=false)
- `BootReceiver.java` — Launches MainActivity on BOOT_COMPLETED
- BootReceiver declared in AndroidManifest with intent-filter

---

### T-005: Implement Biometric Authentication

**Priority:** HIGH | **Status:** ✅ Complete

- `@capacitor/biometric` added to package.json
- `biometric-auth.ts` — `isBiometricAvailable()`, `authenticateWithBiometrics()`, `isBiometricTokenValid()` (4hr expiry)
- `useBiometricAuth.ts` — React hook: auto-check availability, cached token validation, authenticate/reset
- Token cached via localStorage with `bio_` prefix + timestamp
- Fallback to PIN on biometric unavailable or failed
- `USE_BIOMETRIC` permission in AndroidManifest

---

### T-006: Integrate Native Sentry Crash Reporting

**Priority:** HIGH | **Status:** ✅ Complete

- `io.sentry:sentry-android:7.20.0` in Gradle deps
- `SentryAndroid.init()` in `MainActivity.onCreate()` with DSN from BuildConfig, environment detection, NDK enabled
- `SENTRY_DSN` buildConfigField: empty for debug, placeholder for release
- ANR detection built into Sentry auto-instrumentation

---

### T-007: Configure Deep Linking / App Links

**Priority:** HIGH | **Status:** ✅ Complete

- `intent-filter android:autoVerify="true"` for `https://lole.dev` and `https://*.lole.dev`
- `assetlinks.json` placeholder in `public/.well-known/`
- Deep link handling in `MainActivity.onNewIntent()`
- Path mapping: `/device/:token`, `/order/:id`, `/kds`

---

### T-008: Deepen MainActivity with Lifecycle Hooks

**Priority:** LOW | **Status:** ✅ Complete

- `onCreate()` — Sentry init, WorkManager sync scheduling, debug mode warning
- `onResume()` — Biometric re-auth dispatch
- `onPause()` — Sync queue flush
- `onNewIntent()` — Deep link parsing
- 80+ lines (was 5)

---

## Phase 2: Hardware Integration

---

### T-009: Build Native Thermal Printer Plugin (Android)

**Priority:** CRITICAL | **Status:** ✅ Complete

**Created:**

- `ThermalPrinterPlugin.java` — Full BLE printer driver:
    - `discover()` — Lists paired Bluetooth devices, starts discovery for non-paired
    - `printRaw()` — Base64/hex decode, GATT connect + SPP service discovery + characteristic write
    - `getStatus()` — Returns connection state
- `native-printer.ts` — JS bridge:
    - `discoverNativePrinters()` → `PrinterInfo[]`
    - `printRawNative(options)` → `PrintResult`
    - `getPrinterStatus(macAddress?)` → `{connected}`
- Registered in `capacitor.plugins.json` and `capacitor.settings.gradle`
- BLUETOOTH_CONNECT, BLUETOOTH_SCAN permissions added

---

### T-010: Add Barcode/QR Scanner Plugin

**Priority:** HIGH | **Status:** ✅ Complete

**Created:**

- `@capacitor-community/barcode-scanner` added to package.json
- `BarcodeScannerPlugin.java` — Camera permission validation bridge
- `barcode-scanner.ts` — `startBarcodeScan()`, `stopBarcodeScan()`, `parseScannedProductCode()` with support for EAN-13, UPC-A, Code-128, QR
- CAMERA permission + `android.hardware.camera` feature (required=false)

---

### T-011: Implement Background Task Execution

**Priority:** HIGH | **Status:** ✅ Complete

**Created:**

- `SyncWorker.java` — WorkManager Worker with 15min periodic schedule, CONNECTED + battery-not-low constraints, exponential backoff
- `background-sync.ts` — `queueForBackgroundSync()`, `processSyncQueue()` with POST to `/api/sync`, status tracking
- `androidx.work:work-runtime:2.9.1` in Gradle deps
- WorkManager scheduled in `MainActivity.scheduleWorkManagerSync()`
- FOREGROUND_SERVICE + FOREGROUND_SERVICE_DATA_SYNC permissions

---

### T-012: Add SSL Certificate Pinning

**Priority:** HIGH | **Status:** ✅ Complete

**Created:**

- `network_security_config.xml` — Pinned domains for `supabase.co` and `lole.dev` with SHA-256 pins, localhost cleartext for dev
- `android:networkSecurityConfig="@xml/network_security_config"` in AndroidManifest
- `android:usesCleartextTraffic="false"` on application
- Pin digests are placeholders (`REPLACE_WITH_*`) — replace with real cert hashes before production

---

### T-013: Build Cash Drawer Plugin

**Priority:** MEDIUM | **Status:** ✅ Complete

**Created:**

- `CashDrawerPlugin.java` — ESC/POS drawer kick pulse (ESC p 0 200 200) via printer RJ12
- `cash-drawer.ts` — `openCashDrawer()` with `{ok, reason}` result
- Registered in `capacitor.plugins.json`

---

### T-014: Implement Doze Mode / Battery Optimization

**Priority:** MEDIUM | **Status:** 🔲 Deferred

Deferred to Phase 4. Requires runtime `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` exemption dialog + heartbeat interval adaptation in `useDeviceHeartbeat.ts`.

---

## Phase 3: Resilience & Security

---

### T-015: Implement Offline Order Conflict Resolution

**Priority:** CRITICAL | **Status:** ✅ Complete

**Created:**

- `offline-order-manager.ts` — `createOfflineOrder()`, `updateOfflineOrder()`, `deleteOfflineOrder()`, `getOfflineOrders()`, `clearSyncedOrders()` with full version tracking (version, modified_at, modified_by)
- `offline-conflict-resolver.ts` — `compareOrderVersions()`, `resolveOrderConflict()`, `mergeOrders()` with LWW strategy, conflict audit log, undelete logic

---

### T-016: Implement Local-First KDS with LAN Mesh

**Priority:** HIGH | **Status:** ✅ Complete

**Created:**

- `LanMeshPlugin.java` — `broadcastKdsUpdate()` via UDP on port 9191, `getLocalIp()` for mDNS discovery
- Registered in `capacitor.plugins.json` as `lole-lan-mesh`
- Builds on existing `src/lib/lan/discovery.ts` infrastructure

---

### T-017: Implement Encrypted Local Storage

**Priority:** HIGH | **Status:** ✅ Complete

**Created:**

- `encrypted-storage.ts` — `encryptStore()` / `decryptGet()` / `encryptRemove()` / `rotateEncryptionKey()` using Web Crypto API (AES-256-GCM)
- Encryption key generated per-device on first use, cached via `@capacitor/preferences`
- Key rotation: re-encrypts all stored values with new key
- All values prefixed `enc_` in localStorage

---

## Phase 4: Scale & Polish (Deferred)

| Task                                               | Priority | Status |
| -------------------------------------------------- | -------- | ------ |
| T-018: OTA Update Mechanism (CodePush/Esper)       | MEDIUM   | 🔲     |
| T-019: MDM Agent (Esper SDK)                       | MEDIUM   | 🔲     |
| T-020: Battery Optimization (heartbeat adaptation) | MEDIUM   | 🔲     |
| T-021: Tablet Layout Breakpoints (stylesheet)      | LOW      | 🔲     |
| T-022: Root Detection (SafetyNet/Play Integrity)   | LOW      | 🔲     |

---

## Files Changed Summary

### Created (22 files)

```
android/app/src/main/java/com/lole/device/
  BootReceiver.java
  SyncWorker.java
  LoleFirebaseMessagingService.java
android/app/src/main/java/com/lole/device/plugins/
  ThermalPrinterPlugin.java
  BarcodeScannerPlugin.java
  CashDrawerPlugin.java
  LanMeshPlugin.java
android/app/src/main/res/xml/
  network_security_config.xml
android/app/
  proguard-rules.pro
android/
  keystore.properties.template
public/.well-known/
  assetlinks.json
src/lib/mobile/
  biometric-auth.ts
  barcode-scanner.ts
  native-printer.ts
  background-sync.ts
  encrypted-storage.ts
  push-notifications.ts
  offline-order-manager.ts
  offline-conflict-resolver.ts
  cash-drawer.ts
src/hooks/
  useBiometricAuth.ts
  usePushNotifications.ts
```

### Modified (8 files)

```
android/app/src/main/AndroidManifest.xml
android/app/src/main/java/com/lole/device/MainActivity.java
android/app/build.gradle
android/capacitor.settings.gradle
android/app/src/main/assets/capacitor.plugins.json
package.json
src/lib/mobile/device-storage.ts
native-shell/app.js
```

---

**Document Version:** 3.0
**Total Tasks:** 17 → 15 resolved, 2 deferred to Phase 4
