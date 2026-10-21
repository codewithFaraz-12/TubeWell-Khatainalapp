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

export const SCOPES = [
  'profile',
  'email',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.appdata',
];

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
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.addScope('https://www.googleapis.com/auth/drive.appdata');

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
      grantOfflineAccess: true,
    });
    googleAuthInitialized = true;
  } catch (err) {
    // Non-fatal warning if on web without GSI script
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
        const errMessage = nativeErr instanceof Error ? nativeErr.message : String(nativeErr);
        console.error('Native GoogleAuth.signIn error:', nativeErr);

        // Handle user cancellation gracefully
        if (
          errMessage.toLowerCase().includes('cancel') ||
          errMessage.includes('12501') ||
          errMessage.toLowerCase().includes('closed')
        ) {
          console.log('Google Sign-In was cancelled by user.');
          return null;
        }

        // Handle Developer Error (Code 10 or 12500)
        if (errMessage.includes('10') || errMessage.includes('DEVELOPER_ERROR') || errMessage.includes('12500')) {
          throw new Error(
            'Google Sign-In configuration error (Developer Error 10). Please verify in Firebase Console: (1) Package name "com.tubewellkhata.app" is registered, (2) SHA-1 fingerprint 55:76:F0:19:51:9D:C6:2D:43:50:97:96:D0:A4:6A:A7:00:39:A7:F9 is added under Android apps, and (3) Google Sign-in provider is enabled under Authentication.'
          );
        }

        throw new Error(`Google Sign-In failed: ${errMessage}`);
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

      const effectiveToken = accessToken || idToken;
      setCachedAccessToken(effectiveToken);

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

        throw new Error(`Firebase Authentication failed: ${fbMsg}`);
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
      await ensureGoogleAuthInitialized();
      const res = await GoogleAuth.signIn();
      const token = res.authentication?.accessToken || res.authentication?.idToken;
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
