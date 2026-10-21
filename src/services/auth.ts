import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User,
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const WEB_CLIENT_ID =
  firebaseConfig.oAuthClientId ||
  '849806943027-f0du4l077ucpi05jrbi031t18c0ac56j.apps.googleusercontent.com';

export const SCOPES = ['profile', 'email'];

export const DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.appdata',
];

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Google Auth Provider for Web Login & Drive backup
const provider = new GoogleAuthProvider();
provider.addScope('profile');
provider.addScope('email');

let isSigningIn = false;
let cachedAccessToken: string | null = null;
let currentUser: User | null = null;
let googleAuthInitialized = false;

// Ensure Capacitor GoogleAuth plugin is initialized with correct Web Client ID and scopes
export const ensureGoogleAuthInitialized = async (): Promise<void> => {
  if (googleAuthInitialized) return;
  try {
    await GoogleAuth.initialize({
      clientId: WEB_CLIENT_ID,
      scopes: SCOPES,
      grantOfflineAccess: false,
    });
    googleAuthInitialized = true;
  } catch (err) {
    // Android initialization failures must not be silently ignored.
    if (Capacitor.isNativePlatform()) throw err;
    console.warn('GoogleAuth.initialize status:', err);
  }
};

// Initialize auth state listener
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  // Try restoring cached token from persistent local storage for seamless offline access
  try {
    const savedToken = localStorage.getItem('tk_cached_drive_token');
    if (savedToken) {
      cachedAccessToken = savedToken;
    }
  } catch {
    // ignore
  }

  return onAuthStateChanged(auth, async (user: User | null) => {
    currentUser = user;
    if (user) {
      const token = (await getAccessToken()) || '';
      if (onAuthSuccess) onAuthSuccess(user, token);
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * Android-Compatible Google Sign-In:
 * - On Android APK: Uses native Google Play Services via @codetrix-studio/capacitor-google-auth.
 * - Authenticates with Firebase Authentication via signInWithCredential using the Google ID Token.
 * - STRICT RULE: Never treat Google Sign-In as successful if signInWithCredential fails.
 *   Never synthesize fake Firebase User objects.
 */
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    await ensureGoogleAuthInitialized();

    const isNative = Capacitor.isNativePlatform();

    if (isNative) {
      console.log('Initiating Native Android Google Sign-In...');
      let nativeUser;
      try {
        nativeUser = await GoogleAuth.signIn();
      } catch (nativeErr: unknown) {
        console.error('Native GoogleAuth.signIn error:', nativeErr);

        // Thoroughly extract all possible status codes from Capacitor / Android Play Services
        const anyErr = nativeErr as Record<string, unknown> | null | undefined;
        let extractedCode = '';
        if (anyErr?.code !== undefined && anyErr?.code !== null) {
          extractedCode = String(anyErr.code).trim();
        } else if (anyErr?.statusCode !== undefined && anyErr?.statusCode !== null) {
          extractedCode = String(anyErr.statusCode).trim();
        } else if (anyErr?.error !== undefined && anyErr?.error !== null) {
          extractedCode = String(anyErr.error).trim();
        } else if (anyErr?.status !== undefined && anyErr?.status !== null) {
          extractedCode = String(anyErr.status).trim();
        }

        const rawMsg =
          nativeErr instanceof Error
            ? nativeErr.message
            : typeof nativeErr === 'string'
              ? nativeErr
              : String(anyErr?.message || '');

        let fullDump = rawMsg;
        try {
          const serialized = JSON.stringify(nativeErr);
          if (serialized && serialized !== '{}') {
            fullDump = `${rawMsg} ${serialized}`;
          }
        } catch {}

        // 1. Handle user cancellation (Code 12501 or cancellation text)
        if (
          extractedCode === '12501' ||
          rawMsg.toLowerCase().includes('cancel') ||
          rawMsg.includes('12501') ||
          rawMsg.toLowerCase().includes('closed')
        ) {
          console.log('Google Sign-In was cancelled by user.');
          return null;
        }

        // 2. Handle Developer Error (Code 10: CommonStatusCodes.DEVELOPER_ERROR)
        // Usually occurs when:
        // - google-services.json is missing or doesn't match com.tubewellkhata.app
        // - APK signing SHA-1 is not added to Firebase Android app
        // - serverClientId doesn't match the Web Client ID
        const isCode10 =
          extractedCode === '10' ||
          extractedCode.toLowerCase().includes('developer_error') ||
          rawMsg.includes('10') ||
          rawMsg.toLowerCase().includes('developer_error');

        if (isCode10) {
          throw new Error(
            'Google Sign-In failed (Code 10: DEVELOPER_ERROR). Required steps: (1) Ensure your downloaded google-services.json is placed at android/app/google-services.json, (2) Verify package "com.tubewellkhata.app" and SHA-1 fingerprint 55:76:F0:19:51:9D:C6:2D:43:50:97:96:D0:A4:6A:A7:00:39:A7:F9 are registered in Firebase Console, and (3) Web Client ID matches 849806943027-f0du4l077ucpi05jrbi031t18c0ac56j.apps.googleusercontent.com.'
          );
        }

        // 3. Handle Generic Sign-In Failed (Code 12500)
        const isCode12500 =
          extractedCode === '12500' ||
          rawMsg.includes('12500');

        if (isCode12500) {
          throw new Error(
            'Google Sign-In failed (Code 12500: SIGN_IN_FAILED). Please verify google-services.json is inside android/app/, your Google account is added to OAuth Test Users in Google Cloud Console, and Google Play Services is updated on your device.'
          );
        }

        // 4. Handle Network Error (Code 7)
        const isCode7 =
          extractedCode === '7' ||
          rawMsg.toLowerCase().includes('network');

        if (isCode7) {
          throw new Error(
            'Google Sign-In failed (Code 7: NETWORK_ERROR). Please check your internet connection on your phone and try again.'
          );
        }

        // 5. If message is generic "Something went wrong.", give specific actionable guidance with code
        if (rawMsg.includes('Something went wrong') || rawMsg.trim() === '') {
          throw new Error(
            `Native Google Sign-In failed: ${rawMsg || 'Unknown native error'}${extractedCode ? ` (Code: ${extractedCode})` : ' (No error code provided by plugin)'}. Check the APK signing SHA-1 against Firebase, Android OAuth client, and Google Play Services logs.`
          );
        }

        const displayCode = extractedCode ? ` (Code: ${extractedCode})` : '';
        throw new Error(`Google Sign-In failed${displayCode}: ${rawMsg}`);
      }

      if (!nativeUser) {
        return null;
      }

      const accessToken = nativeUser.authentication?.accessToken;
      const idToken = nativeUser.authentication?.idToken;

      if (!idToken) {
        throw new Error(
          'Google Play Services signed in successfully, but did not return an ID token. Ensure that serverClientId is configured with your Firebase Web Client ID.'
        );
      }

      // ID tokens are not Google Drive access tokens.
      const effectiveToken = accessToken || '';
      if (accessToken) setCachedAccessToken(accessToken);

      // Authenticate with Firebase Authentication using the Google ID Token
      const credential = GoogleAuthProvider.credential(idToken);
      let userCredential;
      try {
        userCredential = await signInWithCredential(auth, credential);
      } catch (fbErr: unknown) {
        const fbCode = (fbErr as { code?: string })?.code || '';
        const fbMsg = fbErr instanceof Error ? fbErr.message : String(fbErr);
        console.error('Firebase signInWithCredential error:', fbErr);

        if (fbCode === 'auth/operation-not-allowed' || fbMsg.includes('operation-not-allowed')) {
          throw new Error(
            'Google Sign-In is not enabled in Firebase Console. Go to Firebase Console > Authentication > Sign-in method, click Google, and enable it.'
          );
        }

        if (fbCode === 'auth/invalid-credential') {
          throw new Error(
            'Firebase rejected the Google token. Verify that your SHA-1 fingerprint 55:76:F0:19:51:9D:C6:2D:43:50:97:96:D0:A4:6A:A7:00:39:A7:F9 is added in Firebase Console.'
          );
        }

        throw new Error(`Firebase Authentication failed (Code: ${fbCode || 'unknown'}): ${fbMsg}`);
      }

      const fbUser = userCredential.user;
      currentUser = fbUser;

      return { user: fbUser, accessToken: effectiveToken };
    } else {
      // ---------------- WEB / DESKTOP FALLBACK ----------------
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);

      const token = credential?.accessToken;
      if (token) {
        setCachedAccessToken(token);
      }

      currentUser = result.user;
      return { user: result.user, accessToken: cachedAccessToken || '' };
    }
  } catch (error: unknown) {
    const errCode = (error as { code?: string })?.code || '';
    const errMessage = error instanceof Error ? error.message : String(error);

    // If popup was closed by user or cancelled, handle gracefully
    if (
      errCode === 'auth/popup-closed-by-user' ||
      errCode === 'auth/cancelled-popup-request' ||
      errMessage.toLowerCase().includes('popup-closed-by-user')
    ) {
      console.log('Google Sign-In popup was closed by user.');
      return null;
    }

    console.error('Google Sign In error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Optional Google Drive authorization for disaster recovery export
 */
export const requestDriveToken = async (): Promise<string> => {
  const existing = await getAccessToken();
  if (existing) return existing;

  if (Capacitor.isNativePlatform()) {
    try {
      await GoogleAuth.initialize({
        clientId: WEB_CLIENT_ID,
        scopes: [...SCOPES, ...DRIVE_SCOPES],
        grantOfflineAccess: true,
      });
      googleAuthInitialized = true;
      const res = await GoogleAuth.signIn();
      const token = res.authentication?.accessToken;
      if (token) {
        setCachedAccessToken(token);
        return token;
      }
    } catch (err: unknown) {
      console.warn('Native Drive token request error:', err);
    }
  }

  // On Web, request drive scope via GoogleAuthProvider
  const driveProvider = new GoogleAuthProvider();
  driveProvider.addScope('https://www.googleapis.com/auth/drive.file');
  driveProvider.addScope('https://www.googleapis.com/auth/drive.appdata');

  try {
    const result = await signInWithPopup(auth, driveProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      setCachedAccessToken(credential.accessToken);
      return credential.accessToken;
    }
    throw new Error('Google Drive access was granted, but no access token was returned.');
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (
      msg.includes('403') ||
      msg.includes('access_denied') ||
      msg.includes('verification') ||
      msg.includes('developer-approved')
    ) {
      throw new Error(
        'Google Drive requires developer-approved test user access in Google Cloud Console. However, your records are already safely synced and backed up via Google Cloud Sync (Firestore)!'
      );
    }
    throw error;
  }
};

/**
 * Retrieve active Google Drive access token, with automatic refresh on Android
 */
export const getAccessToken = async (): Promise<string | null> => {
  if (cachedAccessToken) return cachedAccessToken;

  try {
    const saved = localStorage.getItem('tk_cached_drive_token');
    if (saved) {
      cachedAccessToken = saved;
      return saved;
    }
  } catch {
    // ignore
  }

  // On native Android, attempt silent token refresh
  if (Capacitor.isNativePlatform()) {
    try {
      await ensureGoogleAuthInitialized();
      const authRes = await GoogleAuth.refresh();
      if (authRes?.accessToken) {
        cachedAccessToken = authRes.accessToken;
        try {
          localStorage.setItem('tk_cached_drive_token', authRes.accessToken);
        } catch {
          // ignore
        }
        return authRes.accessToken;
      }
    } catch {
      // Token expired or silent refresh unavailable
    }
  }

  return null;
};

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  try {
    if (token) {
      localStorage.setItem('tk_cached_drive_token', token);
    } else {
      localStorage.removeItem('tk_cached_drive_token');
    }
  } catch {
    // ignore
  }
};

export const getCurrentUser = (): User | null => {
  if (currentUser) return currentUser;
  if (auth.currentUser) return auth.currentUser;
  return null;
};

export const logout = async (): Promise<void> => {
  try {
    if (Capacitor.isNativePlatform()) {
      await ensureGoogleAuthInitialized();
      await GoogleAuth.signOut().catch(() => {});
    }
    await signOut(auth).catch(() => {});
  } catch (err) {
    console.warn('Logout warning:', err);
  } finally {
    cachedAccessToken = null;
    currentUser = null;
    try {
      localStorage.removeItem('tk_cached_drive_token');
      localStorage.removeItem('tk_cached_user_uid');
      localStorage.removeItem('tk_cached_user_email');
      localStorage.removeItem('tk_cached_user_name');
    } catch {
      // ignore
    }
  }
};
