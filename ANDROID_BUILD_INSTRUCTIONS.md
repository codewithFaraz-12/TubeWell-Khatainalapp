# TubeWell Khata — Android APK Build & Firebase Configuration Guide

**Application Details:**
- **App Name:** TubeWell Khata
- **Package ID:** `com.tubewellkhata.app`
- **Default Business Name:** `Farhan TubeWell`
- **Tariff:** Rs 600 / hour (Rs 10 / minute fixed integer calculation)
- **Architecture:** One Google Account = One Private TubeWell Khata (Local IndexedDB offline persistence + Cloud Firestore real-time sync + AES-256 encrypted Google Drive disaster recovery)
- **Target Platform:** Android (Capacitor) & Modern Web
- **Firebase Project ID:** `gen-lang-client-0211199320`
- **OAuth Web Client ID:** `849806943027-f0du4l077ucpi05jrbi031t18c0ac56j.apps.googleusercontent.com`

---

## 🔑 Permanent Keystore Fingerprints (Consistent Signing)
The repository now includes a permanent, committed keystore (`android/keystore/tubewell-debug.keystore`).
Subsequent builds in GitHub Actions will ALWAYS use this exact keystore, ensuring:
- You never get Android signature conflict errors when updating installed APKs.
- The SHA-1 registered in Firebase Console will permanently match every APK built.

| Key Property | Value |
|---|---|
| **Keystore Path** | `android/keystore/tubewell-debug.keystore` |
| **Keystore Alias** | `androiddebugkey` |
| **Keystore Password** | `android` |
| **SHA-1 Fingerprint** | `55:76:F0:19:51:9D:C6:2D:43:50:97:96:D0:A4:6A:A7:00:39:A7:F9` |
| **SHA-256 Fingerprint** | `3C:22:84:4F:8F:C1:73:6A:49:07:74:60:5C:56:B6:7B:94:2A:C4:4D:31:A9:3A:5B:D7:8B:85:68:16:4A:7C:F5` |

---

## 🛠️ Essential Firebase Console Settings to Configure Manually

Follow these 4 simple steps in your Firebase Console to enable Google Sign-In and Firestore Sync:

### Step 1: Enable Google Sign-In in Firebase Authentication
1. Go to [Firebase Console](https://console.firebase.google.com/project/gen-lang-client-0211199320/authentication/providers).
2. Click **Build ➔ Authentication ➔ Sign-in method**.
3. Under **Sign-in providers**, click **Google**.
4. Toggle **Enable** to ON.
5. Select your support email (e.g. `newfarazgm1@gmail.com`).
6. Click **Save**.

### Step 2: Register Android App & Add SHA-1 Fingerprint
1. Go to [Firebase Project Settings](https://console.firebase.google.com/project/gen-lang-client-0211199320/settings/general).
2. Scroll down to the **Your apps** section:
   - If an Android app with package `com.tubewellkhata.app` is already listed, click on it.
   - If not, click **Add app**, select the **Android icon**, and enter:
     - Android package name: `com.tubewellkhata.app`
     - App nickname: `TubeWell Khata`
     - Click **Register app**.
3. Under the `com.tubewellkhata.app` Android app, click **Add fingerprint**.
4. Paste the permanent SHA-1 fingerprint:
   ```
   55:76:F0:19:51:9D:C6:2D:43:50:97:96:D0:A4:6A:A7:00:39:A7:F9
   ```
5. Click **Add fingerprint** again and paste the SHA-256 fingerprint:
   ```
   3C:22:84:4F:8F:C1:73:6A:49:07:74:60:5C:56:B6:7B:94:2A:C4:4D:31:A9:3A:5B:D7:8B:85:68:16:4A:7C:F5
   ```
6. Click **Save**.

### Step 3: Google Cloud OAuth Consent Screen & Test Users
1. Open [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials?project=gen-lang-client-0211199320).
2. Click **OAuth consent screen**:
   - User Type: If in "External" and publishing status is "Testing", ensure your Gmail is added under **Test users**.
   - Add your Gmail account (e.g. `newfarazgm1@gmail.com`).
3. Click **Save and Continue**.

### Step 4: Verify Firestore Rules
The rules have already been deployed to your database (`ai-studio-remixremixremixr-501c9ff8-cb46-48c5-b941-719c0253e96c`).
Each user's data is strictly partitioned by their Firebase UID under `/users/{userId}/**`, ensuring that **ONE GOOGLE ACCOUNT = ONE PRIVATE TUBEWELL KHATA**.

---

## ☁️ One Google Account = One Private TubeWell Khata
- **Completely Private Database:** Every Google account is securely isolated by its unique Firebase UID (`/users/{userId}/**`).
- **Multi-Device Synchronization:**
  - If you sign into another Android phone using the **SAME Google account**, your entire khata (customers, water records, payments, balances, business settings) automatically synchronizes and loads in real time.
  - When changes are made on one device, they automatically appear on all your connected devices running the same account.
  - If a different Gmail account signs in, it gets its own private khata and can **NEVER** view or access your data.
- **Phone Loss & Recovery:**
  - If a phone is lost or damaged, simply install TubeWell Khata on your new phone and sign in with your Google account. All previous records are restored automatically.
- **Zero Data Loss Guarantee:**
  - Works 100% offline via local IndexedDB.
  - Syncs automatically when internet connectivity returns.
  - Non-destructive migration never deletes existing records or overwrites cloud data.

---

## 🚀 How to Build the APK on GitHub

1. Commit and push your code to your GitHub repository:
   ```bash
   git add .
   git commit -m "Configure permanent APK signing keystore and single-account cloud sync"
   git push origin main
   ```
2. In your GitHub repository, click the **Actions** tab.
3. The workflow **"Build TubeWell Khata Android APK"** starts automatically.
4. After ~3 minutes, click the completed run.
5. In the **Artifacts** section at the bottom, download **`TubeWellKhata-Debug-APK`**.
6. Inside the downloaded zip is `app-debug.apk` — install it directly on your Android phone!
