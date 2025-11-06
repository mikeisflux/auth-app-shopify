//Parse uploaded Kickstarter CSV files
//Location /services

const fs = require('fs');
const { parse } = require('csv-parse');
const AWS = require('aws-sdk');
const { Backer } = require('../models');

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
});

async function parseCsv(projectId, filePath) {
  const parser = fs.createReadStream(filePath).pipe(parse({ columns: true }));
  const backers = [];

  for await (const row of parser) {
    const backer = {
      projectId,
      name: row['Customer Name'],
      email: row['Email'],
      backerNumber: row['Backer #'],
      reward: { name: row['Reward'], quantity: parseInt(row['Reward (quantities)']), sku: row['SKU'] },
      addOns: row['Add-ons'] ? JSON.parse(row['Add-ons']) : [], // Adjust based on CSV format
      pledgeAmount: parseFloat(row['Pledge Amount']),
      notes: row['Notes'],
    };
    backers.push(backer);
  }

  // Store in database
  await Backer.bulkCreate(backers);

  // Upload CSV to S3
  const s3Key = `csvs/project-${projectId}-${Date.now()}.csv`;
  await s3.upload({
    Bucket: process.env.S3_BUCKET,
    Key: s3Key,
    Body: fs.createReadStream(filePath),
  }).promise();

  return { backers, s3Key };
}

module.exports = { parseCsv };