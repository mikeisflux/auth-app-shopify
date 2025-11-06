const SMB2 = require('@marsaud/smb2');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

// Check if we're in local mode (for development offsite)
const USE_LOCAL_STORAGE = process.env.NAS_MODE === 'local';
const LOCAL_UPLOAD_DIR = path.join(__dirname, '../../uploads');

// Ensure local uploads directory exists
if (USE_LOCAL_STORAGE && !fs.existsSync(LOCAL_UPLOAD_DIR)) {
  fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
}

// Initialize SMB2 client for UGREEN NAS (only if not in local mode)
let smbClient;
if (!USE_LOCAL_STORAGE) {
  smbClient = new SMB2({
    share: `\\\\${process.env.NAS_HOST}\\${process.env.NAS_SHARE}`,
    domain: process.env.NAS_DOMAIN || 'WORKGROUP',
    username: process.env.NAS_USERNAME,
    password: process.env.NAS_PASSWORD,
    port: 445,
    autoCloseTimeout: 0,
  });
}

/**
 * Upload a CSV file to the NAS
 * @param {number} projectId - The project ID
 * @param {string} filePath - Local path to the CSV file
 * @returns {Promise<string>} - The NAS file key/path
 */
async function uploadCsv(projectId, filePath) {
  const fileName = `project-${projectId}-${Date.now()}.csv`;
  
  // LOCAL MODE - Store files locally
  if (USE_LOCAL_STORAGE) {
    logger.info(`[LOCAL MODE] Storing CSV locally: ${fileName}`);
    const destPath = path.join(LOCAL_UPLOAD_DIR, fileName);
    fs.copyFileSync(filePath, destPath);
    const localUrl = `file://${destPath}`;
    logger.info(`Successfully stored CSV locally: ${localUrl}`);
    return localUrl;
  }
  
  // NAS MODE - Upload to NAS via SMB
  return new Promise((resolve, reject) => {
    const remotePath = `${fileName}`;
    logger.info(`Uploading CSV to NAS: ${remotePath}`);

    // Read the local file
    const fileBuffer = fs.readFileSync(filePath);

    // Write to NAS
    smbClient.writeFile(remotePath, fileBuffer, (error) => {
      if (error) {
        logger.error(`Failed to upload CSV to NAS: ${error.message}`);
        return reject(new Error(`NAS upload failed: ${error.message}`));
      }

      const nasUrl = `smb://${process.env.NAS_HOST}/${process.env.NAS_SHARE}/${remotePath}`;
      logger.info(`Successfully uploaded CSV to NAS: ${nasUrl}`);
      resolve(nasUrl);
    });
  });
}

/**
 * Download a CSV file from the NAS
 * @param {string} nasKey - The NAS file path (e.g., "project-123-1234567890.csv")
 * @param {string} localPath - Local path to save the file
 * @returns {Promise<void>}
 */
async function downloadCsv(nasKey, localPath) {
  return new Promise((resolve, reject) => {
    // Extract just the filename from the full SMB URL if needed
    const fileName = nasKey.includes('smb://') 
      ? nasKey.split('/').pop() 
      : nasKey;

    logger.info(`Downloading CSV from NAS: ${fileName}`);

    smbClient.readFile(fileName, (error, data) => {
      if (error) {
        logger.error(`Failed to download CSV from NAS: ${error.message}`);
        return reject(new Error(`NAS download failed: ${error.message}`));
      }

      try {
        fs.writeFileSync(localPath, data);
        logger.info(`Successfully downloaded CSV from NAS to: ${localPath}`);
        resolve();
      } catch (writeError) {
        logger.error(`Failed to write downloaded CSV: ${writeError.message}`);
        reject(new Error(`File write failed: ${writeError.message}`));
      }
    });
  });
}

/**
 * Delete a CSV file from the NAS
 * @param {string} nasKey - The NAS file path
 * @returns {Promise<void>}
 */
async function deleteCsv(nasKey) {
  return new Promise((resolve, reject) => {
    // Extract just the filename from the full SMB URL if needed
    const fileName = nasKey.includes('smb://') 
      ? nasKey.split('/').pop() 
      : nasKey;

    logger.info(`Deleting CSV from NAS: ${fileName}`);

    smbClient.unlink(fileName, (error) => {
      if (error) {
        logger.error(`Failed to delete CSV from NAS: ${error.message}`);
        return reject(new Error(`NAS delete failed: ${error.message}`));
      }
      
      logger.info(`Successfully deleted CSV from NAS: ${fileName}`);
      resolve();
    });
  });
}

/**
 * Test NAS connection
 * @returns {Promise<boolean>}
 */
async function testConnection() {
  return new Promise((resolve) => {
    logger.info('Testing NAS connection...');
    
    smbClient.readdir('/', (error, files) => {
      if (error) {
        logger.error(`NAS connection test failed: ${error.message}`);
        resolve(false);
      } else {
        logger.info(`NAS connection successful. Found ${files ? files.length : 0} items.`);
        resolve(true);
      }
    });
  });
}

module.exports = {
  uploadCsv,
  downloadCsv,
  deleteCsv,
  testConnection,
};