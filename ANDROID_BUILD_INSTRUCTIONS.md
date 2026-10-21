# TubeWell Khata — Corrected Android Build Package

This ZIP includes the original app source, real Firebase Android config in `config/google-services.json`, a stable **development-only** debug keystore in `signing/tubewell-debug.keystore`, and an updated GitHub Actions workflow.

**Important:** This is a NEW development signing key. The user has now registered its SHA-1 and SHA-256 in Firebase:

SHA-1: `25:71:11:86:B9:17:08:75:30:11:7D:FB:F2:4A:8A:1E:3A:72:02:E0`

SHA-256: `75:AD:37:AE:B0:E4:B2:86:EA:0E:F3:03:48:38:EE:54:AF:A1:AE:9F:F4:F3:82:6B:97:64:3C:1F:58:35:32:95`

The fresh `config/google-services.json` has now been bundled and validated. It contains an Android OAuth client matching the new signing SHA-1 and the expected Web OAuth client.

The APK is signed by the included stable debug keystore. If the existing installed APK was signed by a different key, Android will not allow an in-place update. Because you said there is no customer data yet, you can consider a fresh installation after checking that there is nothing else to preserve. Never uninstall to solve a signature problem without confirming this.

**Security:** The included signing key is a development/debug key with default Android debug credentials, for a PRIVATE GitHub repository and testing only. Do not publish this repository or use this signing key to distribute a production app. For production, create a private release key and store it securely in GitHub Secrets or another signing service.

## Build

1. Upload the contents of this ZIP to the **private** GitHub repository, keeping paths intact. The ZIP has no `android/` folder because the workflow generates it with Capacitor.
2. Check `.github/workflows/build-apk.yml` is the updated workflow (not the older 51-line workflow).
3. In GitHub Actions, run **Build TubeWell Khata Android APK**.
4. Download `TubeWell-Khata-APK` from the completed workflow run.
5. Install the APK and test Google Sign-In on the actual phone. No device sign-in success has been verified yet.

## Known limitations

- The current `config/google-services.json` includes the newly registered signing SHA-1. The APK and Google Sign-In still require real-device testing.
- Drive backup requires separate OAuth authorization and may require Google Cloud OAuth consent/test-user setup. Google login is configured with basic profile/email scopes to avoid Drive permission prompts at login.
- This package has not been built on GitHub Actions or tested on a real Android device here. Verify the Actions logs and on-device sign-in before considering it fixed.
- Android code is generated during build; avoid mixing the old repository's `android/` files with this source without reviewing them.

## Firebase configuration verified on 2026-10-21
The bundled `config/google-services.json` is the fresh file provided after adding the new SHA fingerprints. It contains both the original and new Android OAuth client, and the expected Web OAuth client. The workflow copies this file to `android/app/google-services.json` after Capacitor generates the Android project.
