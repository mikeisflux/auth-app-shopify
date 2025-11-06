//Handles CSV file uploads to AWS S3.
// Location /backend/services/

const AWS = require('aws-sdk');
require('dotenv').config();

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
});

async function uploadCsv(projectId, filePath) {
  const s3Key = `csvs/project-${projectId}-${Date.now()}.csv`;
  try {
    const result = await s3
      .upload({
        Bucket: process.env.S3_BUCKET,
        Key: s3Key,
        Body: require('fs').createReadStream(filePath),
      })
      .promise();
    return s3Key;
  } catch (error) {
    throw new Error(`S3 upload failed: ${error.message}`);
  }
}

module.exports = { uploadCsv };