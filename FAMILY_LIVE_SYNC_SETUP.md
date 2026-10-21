# TubeWell Khata — Family Live Sync (PHASE 1 / NOT YET DEPLOYED)

This ZIP contains an **initial implementation**, not a verified production APK. It has not been configured or tested against the user's live Firebase project or three Android devices.

## What was added

- Firestore-based per-family water/customer/payment ledger with real-time listeners.
- Google-verified email invitation for two or more family editors.
- Owner retains exclusive invite/revoke controls. Other members can add/edit/delete all records.
- Owner-only explicit one-time migration of **existing local records** into an empty shared ledger.
- Local data is not erased by creating or joining a family.
- Family-mode edits require internet; offline edits are intentionally not implemented to avoid silent conflicts.
- Record add/edit/delete audit entries; users should understand this is a **client-enforced audit trail** (not tamper-proof against a modified client).
- Family cloud records can be exported/backed up; Google Drive backup remains separate.

## Important: prerequisite setup

1. Back up original project and actual records as a local JSON export before changing APKs.
2. Open Firebase Console for the **project identified by the existing `firebase-applet-config.json`**. Do not create a separate unrelated project without updating this file.
3. Enable **Authentication → Sign-in method → Google**; configure approved OAuth clients and domains for the actual deployment.
4. Enable **Cloud Firestore** in production mode, choose an appropriate region.
5. **Publish the exact rules from `firestore.rules` in Firebase Console → Firestore Database → Rules** before opening Family Live Sync to anyone. Never use `allow read, write: if true`.
6. Android APK Google login is **not production ready** just because browser `signInWithPopup` code exists. Capacitor Android WebView generally requires a native compatible login integration and correct Android OAuth configuration (app package name + signing SHA certificates). This ZIP does NOT claim to have implemented/tested it.
7. Install/test on a safe copy using a disposable test family and test records. Verify login, access revocation, live updates, simultaneous edits and backup/restore before importing actual customer accounts.

## Owner workflow (once a working native login is configured)

- Sign in with owner's Google account in **Settings → Family Live Sync**.
- Create family. Copy Family ID; it's a locator, not an authorization token.
- From Settings export a local JSON backup and store it safely.
- Upload local ledger once; import refuses to overwrite existing cloud data, refuses sample/demo records, and limits first migration to **390 records**. If more than 390, DO NOT split by manually altering code; use a reviewed batch migration process.
- Enter Abu's and Brother's **exact Google account emails** via Invite.
- Send each the Family ID. Each signs into their own Google account, pastes ID, and joins.
- Owner can list and revoke family members (both their member doc and outstanding invitation get removed).

## Limitations / safety

- Native Android Google Sign-In has **not** been built or tested here. Do not replace your working APK yet.
- No offline shared editing, reconciliation, or conflict UI. Editing the same record from two devices can result in a **last-committed-write-wins** outcome.
- Deleting a customer and dependents uses a batch based on a read; concurrent inserts during deletion need additional server-side protection.
- Rules must be tested using Firebase Emulator Suite against a real Firebase SDK environment before release; they have not been deployed from this ZIP.
- Existing Drive backup encryption derives a key from a Firebase UID; UID is **not a secret**, so this is not a secure secret-derived encryption design. Existing backup scheme should be reviewed before relying on it for confidential records. Changing it carelessly would break restore of old backups.
- Restoring a backup while in family mode is blocked to prevent accidental overwrites. Switch to local mode before restoring local files.
- Firebase service quotas/billing may apply.
- Project ZIP contains no `android/` directory. **Keep the Android folder and already-working GitHub Actions workflow in the existing GitHub repo**, and merge only the intended React source/package changes after tests. Do not overwrite the working workflow blindly with this ZIP's generic workflow.
- Never upload passwords, Drive access tokens, service-account keys, or private signing keys in chat or GitHub.

## Deployment/testing checklist

1. Install dependencies with `npm install --legacy-peer-deps` in an internet-enabled development environment.
2. Run `npm run lint` then `npm run build`.
3. Configure Firebase, deploy and review `firestore.rules`.
4. Test live sync with **two distinct test Google accounts**, plus a third viewer/editor, including revoked access.
5. Integrate native Android Google Sign-In and thoroughly test APK on devices.
6. Only then consider switching real family accounts to shared ledger.
