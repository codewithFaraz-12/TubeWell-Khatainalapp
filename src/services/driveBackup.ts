export interface DriveBackupFile {
  id: string;
  name: string;
  size?: string;
  createdTime: string;
  modifiedTime?: string;
  description?: string;
  properties?: {
    customerCount?: string;
    waterRecordCount?: string;
    paymentCount?: string;
    exportedAt?: string;
    appName?: string;
    version?: string;
    userEmail?: string;
  };
}

const DRIVE_FILES_ENDPOINT = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_ENDPOINT = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

/**
 * List all TubeWell Khata backup files from Google Drive
 * Queries both standard Drive storage and the dedicated private appDataFolder
 */
export async function listBackupsFromDrive(accessToken: string): Promise<DriveBackupFile[]> {
  const query = encodeURIComponent("name contains 'tubewell_khata_backup' and trashed = false");
  const fields = encodeURIComponent('files(id, name, size, createdTime, modifiedTime, description, properties, spaces, parents)');
  const url = `${DRIVE_FILES_ENDPOINT}?q=${query}&spaces=drive,appDataFolder&fields=${fields}&orderBy=createdTime desc&pageSize=30`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    if (response.status === 401) {
      throw new Error('Google Drive access token expired. Please tap Sign in with Google to reconnect.');
    }
    throw new Error(
      errorData.error?.message || `Failed to fetch Google Drive backups (Status ${response.status})`
    );
  }

  const data = await response.json();
  return (data.files || []) as DriveBackupFile[];
}

/**
 * Upload a versioned encrypted backup to Google Drive and strictly VERIFY the upload.
 * Prefers the private 'appDataFolder' for secure app-isolated storage with fallback to root.
 */
export async function uploadBackupToDrive(
  accessToken: string,
  content: string,
  fileName: string,
  metadataProps: Record<string, string> = {}
): Promise<{ file: DriveBackupFile; verified: boolean }> {
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  // First try uploading to the secure appDataFolder (requires drive.appdata scope)
  const attemptUpload = async (useAppDataFolder: boolean) => {
    const metadata: Record<string, unknown> = {
      name: fileName,
      mimeType: 'application/json',
      description: 'TubeWell Khata Verified Cloud Backup (AES-256-GCM Encrypted)',
      properties: {
        appName: 'TubeWell Khata',
        version: '1',
        ...metadataProps,
      },
    };

    if (useAppDataFolder) {
      metadata.parents = ['appDataFolder'];
    }

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      content +
      closeDelimiter;

    return await fetch(DRIVE_UPLOAD_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    });
  };

  let uploadResponse = await attemptUpload(true);

  // If appDataFolder is rejected due to scope limitation, fallback to general drive upload
  if (!uploadResponse.ok && (uploadResponse.status === 403 || uploadResponse.status === 404)) {
    console.warn('appDataFolder upload failed, falling back to standard drive upload...');
    uploadResponse = await attemptUpload(false);
  }

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text().catch(() => '');
    if (uploadResponse.status === 401) {
      throw new Error('Google Drive access token expired. Please re-authenticate.');
    }
    throw new Error(`Google Drive upload failed (${uploadResponse.status}): ${errorText}`);
  }

  const uploadedFile = (await uploadResponse.json()) as DriveBackupFile;

  if (!uploadedFile.id) {
    throw new Error('Upload succeeded but no Google Drive file ID returned.');
  }

  // ---------------- CRITICAL VERIFICATION STEP ----------------
  // Never show Backup Successful until the upload has been explicitly verified on Google Drive servers.
  const verifyUrl = `${DRIVE_FILES_ENDPOINT}/${uploadedFile.id}?fields=id,name,size,createdTime,properties&supportsAllDrives=true`;
  const verifyResponse = await fetch(verifyUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!verifyResponse.ok) {
    throw new Error(
      `Backup upload verification failed with Google Drive API status ${verifyResponse.status}.`
    );
  }

  const verifiedFile = (await verifyResponse.json()) as DriveBackupFile;

  if (verifiedFile.id !== uploadedFile.id) {
    throw new Error('Backup verification mismatch: Retrieved file ID does not match uploaded file ID.');
  }

  const fileSize = Number(verifiedFile.size || 0);
  if (fileSize <= 0) {
    throw new Error('Backup verification failed: Uploaded Google Drive file size is 0 bytes.');
  }

  return {
    file: verifiedFile,
    verified: true,
  };
}

/**
 * Download raw backup content from Google Drive
 */
export async function downloadBackupFromDrive(
  accessToken: string,
  fileId: string
): Promise<string> {
  const url = `${DRIVE_FILES_ENDPOINT}/${fileId}?alt=media&supportsAllDrives=true`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    if (response.status === 401) {
      throw new Error('Google Drive access token expired. Please reconnect your account.');
    }
    throw new Error(`Failed to download backup from Google Drive (${response.status}): ${errorText}`);
  }

  return await response.text();
}

/**
 * Delete a specific backup file from Google Drive
 */
export async function deleteBackupFromDrive(
  accessToken: string,
  fileId: string
): Promise<void> {
  const url = `${DRIVE_FILES_ENDPOINT}/${fileId}?supportsAllDrives=true`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok && response.status !== 404) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Failed to delete backup from Google Drive (${response.status}): ${errorText}`);
  }
}
