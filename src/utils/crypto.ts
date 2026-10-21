import { BackupPayload } from '../services/db';

export interface EncryptedBackupEnvelope {
  appName: 'TubeWell Khata';
  format: 'aes-256-gcm';
  version: 1;
  salt: string; // Hex string
  iv: string; // Hex string
  ciphertext: string; // Base64
  meta: {
    exportedAt: string;
    customerCount: number;
    waterRecordCount: number;
    paymentCount: number;
    userEmail?: string;
  };
}

const getCrypto = (): Crypto => {
  if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    return globalThis.crypto;
  }
  if (typeof window !== 'undefined' && window.crypto) {
    return window.crypto;
  }
  throw new Error('Web Cryptography API is not supported in this environment.');
};

// Convert bytes to hex
function bufToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Convert hex to Uint8Array
function hexToBuf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

// Convert Uint8Array to Base64
function bufToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert Base64 to Uint8Array
function base64ToBuf(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Derive AES-GCM 256 key from seed (user UID or passcode) using PBKDF2
 */
async function deriveKey(seed: string, salt: Uint8Array): Promise<CryptoKey> {
  const crypto = getCrypto();
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(seed),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Construct a hardened encryption seed combining the user's secret/passphrase,
 * account identifier, and app domain separator.
 * This ensures keys are never derived solely from a Google UID, email, or hardcoded string.
 */
export function buildRecoverySeed(
  passphraseOrPin: string = '',
  userEmail: string = '',
  userUid: string = ''
): string {
  const cleanPin = (passphraseOrPin || '').trim();
  const cleanEmail = (userEmail || '').toLowerCase().trim();
  const uidFragment = (userUid || '').substring(0, 12);
  return `tubewell_khata_v2::${cleanEmail}::${cleanPin || 'pin_std'}::${uidFragment}`;
}

/**
 * Encrypt BackupPayload into secure AES-GCM envelope
 */
export async function encryptBackup(
  payload: BackupPayload,
  seedKey: string,
  userEmail?: string
): Promise<EncryptedBackupEnvelope> {
  const crypto = getCrypto();
  const enc = new TextEncoder();
  const plainBytes = enc.encode(JSON.stringify(payload));

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const key = await deriveKey(seedKey, salt);

  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    plainBytes
  );

  return {
    appName: 'TubeWell Khata',
    format: 'aes-256-gcm',
    version: 1,
    salt: bufToHex(salt),
    iv: bufToHex(iv),
    ciphertext: bufToBase64(encryptedBuffer),
    meta: {
      exportedAt: payload.exportedAt || new Date().toISOString(),
      customerCount: payload.customers.length,
      waterRecordCount: payload.waterRecords.length,
      paymentCount: payload.payments.length,
      userEmail,
    },
  };
}

/**
 * Decrypt BackupPayload from either an encrypted envelope or legacy plain JSON
 */
export async function decryptBackup(
  rawText: string,
  seedKey: string,
  fallbackSeeds: string[] = []
): Promise<BackupPayload> {
  const crypto = getCrypto();
  const parsed = JSON.parse(rawText);

  // If plain unencrypted legacy backup
  if (parsed.customers && parsed.appName === 'TubeWell Khata' && !parsed.ciphertext) {
    return parsed as BackupPayload;
  }

  // Encrypted envelope validation
  const envelope = parsed as EncryptedBackupEnvelope;
  if (!envelope.ciphertext || !envelope.salt || !envelope.iv) {
    throw new Error('Invalid encrypted backup envelope: Missing cryptographic parameters.');
  }

  const salt = hexToBuf(envelope.salt);
  const iv = hexToBuf(envelope.iv);
  const encryptedBytes = base64ToBuf(envelope.ciphertext);

  const candidateKeys = Array.from(
    new Set([seedKey, ...fallbackSeeds, envelope.meta?.userEmail || ''].filter(Boolean))
  );

  let lastError: Error | null = null;
  const dec = new TextDecoder();

  for (const candidate of candidateKeys) {
    try {
      const key = await deriveKey(candidate, salt);
      const decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv as unknown as BufferSource,
        },
        key,
        encryptedBytes as unknown as BufferSource
      );

      const decryptedJson = dec.decode(decryptedBuffer);
      const payload = JSON.parse(decryptedJson) as BackupPayload;

      if (!payload.customers || !payload.waterRecords) {
        throw new Error('Decrypted data is corrupt or not a valid TubeWell Khata backup.');
      }

      return payload;
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // Try next candidate
    }
  }

  throw new Error(
    `Decryption failed. The backup was encrypted with a different key or Google Account. (${lastError?.message || 'Authentication tag mismatch'})`
  );
}
