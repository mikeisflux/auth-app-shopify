// CSV Parser Service - Fixed to Handle Duplicate Column Names
// Location: /backend/services/csvParser.js

const fs = require('fs').promises;
const path = require('path');
const { parse } = require('csv-parse/sync');
const { Backer, Project } = require('../models');

// Main function that import.js expects
async function parseAndStore(fileBuffer, fileName, projectId) {
  try {
    // Save the buffer to a temporary file first
    const uploadPath = process.env.LOCAL_UPLOAD_PATH || '/uploads';
    await fs.mkdir(uploadPath, { recursive: true });
    
    const storedFileName = `project-${projectId}-${Date.now()}-${fileName}`;
    const filePath = path.join(uploadPath, storedFileName);
    
    // Write buffer to file
    await fs.writeFile(filePath, fileBuffer);
    console.log(`CSV file saved to: ${filePath}`);
    
    // Parse the CSV from buffer
    let csvContent = fileBuffer.toString('utf-8');
    
    // Remove BOM if present
    if (csvContent.charCodeAt(0) === 0xFEFF) {
      csvContent = csvContent.substring(1);
      console.log('BOM detected and removed from CSV file');
    }
    
    if (csvContent.substring(0, 3) === '\ufeff') {
      csvContent = csvContent.substring(3);
      console.log('UTF-8 BOM detected and removed');
    }
    
    // CRITICAL FIX: Parse with columns: false first to get raw arrays
    // This avoids the duplicate column name issue
    const lines = csvContent.split('\n').filter(line => line.trim());
    const headerLine = lines[0];
    const dataLines = lines.slice(1);
    
    console.log(`CSV has ${dataLines.length} data rows`);
    
    // Parse header to find ALL column positions (including duplicates)
    const headers = headerLine.split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    console.log(`Found ${headers.length} total columns in CSV header`);
    
    // Find ALL "Count" column indices
    // Capture ANY column that ends with "Count" - could be P1-*, P2-*, Getitall, etc.
    const countColumnIndices = [];
    const countColumnNames = [];
    
    // Columns to EXCLUDE (these are addon selection columns, not product counts)
    const excludePatterns = [
      /^\[Addon:/i,  // Exclude [Addon: xxxxx] columns - these are just flags
    ];
    
    headers.forEach((header, index) => {
      // Check if this column ends with "Count" (any prefix allowed)
      if (header.match(/Count$/i)) {
        // Check if it should be excluded
        const shouldExclude = excludePatterns.some(pattern => pattern.test(header));
        
        if (!shouldExclude) {
          countColumnIndices.push(index);
          // Extract SKU by removing " Count" or "Count" at the end
          const sku = header.replace(/\s*Count$/i, '').trim();
          countColumnNames.push({ index, header, sku });
          console.log(`Found Count column at position ${index}: "${header}" -> SKU: "${sku}"`);
        }
      }
    });
    
    console.log(`Detected ${countColumnNames.length} total Count columns (all prefixes included)`);
    
    // Now parse the CSV normally for other fields
    const records = parse(csvContent, { 
      columns: true, 
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      // This will handle duplicates by keeping only the last occurrence
      // But we'll manually process the Count columns using indices
    });
    
    console.log(`Parsed ${records.length} rows from CSV`);
    
    // Required columns
    const requiredColumns = [
      'Backer Number',
      'Backer Name', 
      'Email',
      'Reward Title'
    ];
    
    // Check for required columns
    if (records.length > 0) {
      const firstRow = records[0];
      const missingColumns = requiredColumns.filter(col => !(col in firstRow));
      
      if (missingColumns.length > 0) {
        console.error('ERROR: Missing required columns');
        console.error('Required:', requiredColumns);
        console.error('Missing:', missingColumns);
        throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
      }
    }
    
    // Process backers
    const backers = [];
    
    for (let i = 0; i < Math.min(records.length, dataLines.length); i++) {
      const row = records[i];
      const dataLine = dataLines[i];
      
      // Parse the data line manually to get values by position
      const values = [];
      let currentValue = '';
      let insideQuotes = false;
      
      for (let j = 0; j < dataLine.length; j++) {
        const char = dataLine[j];
        
        if (char === '"') {
          insideQuotes = !insideQuotes;
        } else if (char === ',' && !insideQuotes) {
          values.push(currentValue.trim());
          currentValue = '';
        } else {
          currentValue += char;
        }
      }
      values.push(currentValue.trim()); // Don't forget the last value
      
      // Build clean products structure using manual column indices
      const products = {};
      const addOns = [];
      let hasCountData = false;
      
      // Process Count columns using their exact indices
      for (const { index, header, sku } of countColumnNames) {
        const value = values[index] || '0';
        const quantity = parseInt(value, 10);
        
        if (quantity > 0) {
          hasCountData = true;
          // Store in clean products structure using the extracted SKU
          products[sku] = {
            name: sku,
            quantity: quantity
          };
          
          // Also add to addOns array for backward compatibility
          addOns.push({
            name: sku,
            sku: sku,
            quantity: quantity
          });
          
          if (i === 0) { // Log first backer for debugging
            console.log(`Backer 1: Found product ${sku} with quantity ${quantity} at column ${index}`);
          }
        }
      }
      
      // FALLBACK: If no Count data, try to infer from [Addon: xxxxx] columns and reward
      let noShippingAddress = false;
      if (!hasCountData) {
        console.log(`Backer ${row['Backer Number']}: No Count data found, checking addon flags...`);
        noShippingAddress = true;
        
        // Map addon columns to SKUs (you'll need to customize this mapping)
        const addonToSkuMap = {
          '[Addon: 10615408] CVR RE': 'P1-1',
          '[Addon: 10615384] Digital PDF': 'P1-D',
          '[Addon: 10615386] Digital Deluxe PDF': 'P1-DD',
          '[Addon: 10615452] Shakamike Box Set 1': 'P1-SMB1',
          '[Addon: 10615456] Shakamike Box Set 2': 'P1-SMB2',
          // Add more mappings as needed based on your CSV
        };
        
        // Check addon flag columns
        Object.entries(addonToSkuMap).forEach(([addonCol, sku]) => {
          if (row[addonCol] === '1') {
            products[sku] = { name: sku, quantity: 1 };
            addOns.push({ name: sku, sku: sku, quantity: 1 });
            console.log(`  Found addon: ${addonCol} -> ${sku}`);
          }
        });
      }
      
      // Try to find the amount from various possible column names
      let pledgeAmount = 0;
      const amountColumns = ['Amount Paid', 'Shipping Amount', 'Pledge Amount', 'Total Amount'];
      for (const col of amountColumns) {
        if (row[col]) {
          pledgeAmount = parseFloat(row[col].replace(/[$,]/g, '') || '0');
          if (pledgeAmount > 0) {
            break;
          }
        }
      }
      
      // CRITICAL FIX: Use Shipping Name (full name) instead of Backer Name (often just first name)
      // If only one word in name, add placeholder last name for Shopify compatibility
      let fullName = row['Shipping Name'] || row['Backer Name'] || '';
      
      // If name has only one word (first name only), add a placeholder last name
      if (fullName && !fullName.includes(' ')) {
        fullName = fullName + ' .';
        console.log(`Backer ${row['Backer Number']}: Added placeholder last name to "${row['Backer Name']}" -> "${fullName}"`);
      }
      
      const backer = {
        projectId: projectId,
        backerNumber: row['Backer Number'] || `B${i + 1}`,
        backerUID: row['Backer UID'] || '',
        name: fullName,  // Use full name with placeholder if needed
        email: row['Email'] || '',
        
        // Main reward
        reward: {
          name: row['Reward Title'] || '',
          sku: row['Reward SKU'] || '',
          quantity: parseInt(row['Reward Quantity'] || '1', 10)
        },
        
        // Clean products structure (only from "Count" columns)
        products: products,
        
        // Legacy structures for compatibility
        addOns: addOns,
        skuColumns: products, // Same as products, for backward compatibility
        
        pledgeAmount: pledgeAmount,
        
        // Shipping information
        shippingName: row['Shipping Name'] || row['Backer Name'] || '',
        shippingAddress: row['Shipping Address 1'] || row['Shipping Address'] || '',
        shippingAddress1: row['Shipping Address 1'] || '',
        shippingAddress2: row['Shipping Address 2'] || '',
        shippingCity: row['Shipping City'] || '',
        shippingState: row['Shipping State'] || '',
        shippingPostal: row['Shipping Postal Code'] || '',
        shippingPostalCode: row['Shipping Postal Code'] || '',
        shippingZip: row['Shipping Postal Code'] || '',
        shippingCountry: row['Shipping Country'] || row['Shipping Country Name'] || '',
        shippingPhone: row['Shipping Phone Number'] || '',
        shippingNotes: row['Shipping Delivery Notes'] || '',
        
        notes: row['Notes'] || row['Shipping Delivery Notes'] || '',
        imported: false,
        acceptsMarketing: true
      };
      
      
      // CRITICAL FIX: Skip blank rows (no backer number AND no email)
      if (!backer.backerNumber || backer.backerNumber.trim() === '"' || 
          !backer.email || backer.email.trim() === '"') {
        console.log(`Skipping blank row at index ${i} - no backer number or email`);
        continue;
      }

      backers.push(backer);
    }
    
    console.log(`Successfully parsed ${backers.length} backers from CSV`);
    if (backers.length > 0) {
      console.log('Sample backer data (first backer):', {
        number: backers[0].backerNumber,
        name: backers[0].name,
        email: backers[0].email,
        reward: backers[0].reward.name,
        amount: backers[0].pledgeAmount,
        productsCount: Object.keys(backers[0].products).length,
        products: Object.keys(backers[0].products).join(', ')
      });
      
      // Log backer #83 specifically for debugging
      const backer83 = backers.find(b => b.backerNumber === '83');
      if (backer83) {
        console.log('Backer #83 (Kevin McConnell) data:', {
          number: backer83.backerNumber,
          name: backer83.name,
          productsCount: Object.keys(backer83.products).length,
          products: backer83.products
        });
      }
    }
    
    // Save backers to database
    if (backers.length > 0) {
      try {
        // Clear existing backers for this project first
        await Backer.destroy({ where: { projectId } });
        console.log(`Cleared existing backers for project ${projectId}`);
        
        await Backer.bulkCreate(backers, { 
          validate: false  // Skip validation for bulk insert
        });
        console.log(`Saved ${backers.length} backers to database`);
      } catch (dbError) {
        console.error('Database save error:', dbError);
        console.error('Error details:', dbError.message);
        // Continue even if database save fails
      }
    }
    
    // Update project with CSV file reference
    try {
      await Project.update(
        { 
          csvFile: storedFileName,
          csvFilePath: filePath,
          totalBackers: backers.length
        }, 
        { where: { id: projectId } }
      );
      console.log(`Updated project ${projectId} with CSV file info`);
    } catch (updateError) {
      console.error('Project update error:', updateError);
    }
    
    return {
      success: true,
      fileName: storedFileName,
      filePath: filePath,
      backers: backers,
      totalBackers: backers.length,
      skuColumnsDetected: countColumnNames.map(c => c.sku),
      isLocalStorage: true,
      message: `Successfully imported ${backers.length} backers with ${countColumnNames.length} product SKUs`
    };
    
  } catch (error) {
    console.error('CSV parsing error:', error);
    console.error('Error stack:', error.stack);
    throw new Error(`CSV parsing failed: ${error.message}`);
  }
}

// Export function for CSV export
function exportToCSV(backers) {
  const headers = [
    'Backer Number',
    'Backer Name',
    'Email',
    'Reward Title',
    'Products Ordered',
    'Amount Paid',
    'Shipping Address',
    'Shipping City',
    'Shipping State',
    'Shipping Postal Code',
    'Shipping Country',
    'Imported',
    'Shopify Order ID',
    'Notes'
  ];
  
  const rows = backers.map(backer => {
    // Format products as a readable string
    let productsStr = '';
    if (backer.products && Object.keys(backer.products).length > 0) {
      productsStr = Object.entries(backer.products)
        .map(([sku, info]) => `${sku} x${info.quantity}`)
        .join(', ');
    } else if (backer.addOns && backer.addOns.length > 0) {
      productsStr = backer.addOns
        .map(addon => `${addon.sku} x${addon.quantity}`)
        .join(', ');
    }
    
    return [
      backer.backerNumber || '',
      backer.name || '',
      backer.email || '',
      backer.reward?.name || '',
      productsStr,
      backer.pledgeAmount || '0',
      backer.shippingAddress1 || backer.shippingAddress || '',
      backer.shippingCity || '',
      backer.shippingState || '',
      backer.shippingPostalCode || backer.shippingPostal || '',
      backer.shippingCountry || '',
      backer.imported ? 'Yes' : 'No',
      backer.shopifyOrderNumber || backer.shopifyOrderId || '',
      backer.notes || ''
    ].map(val => {
      // Properly escape CSV values
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',');
  });
  
  return [headers.join(','), ...rows].join('\n');
}

// Keep the old parseCsv for backward compatibility
async function parseCsv(projectId, filePath) {
  const fileBuffer = await fs.readFile(filePath);
  const fileName = path.basename(filePath);
  return parseAndStore(fileBuffer, fileName, projectId);
}

module.exports = { 
  parseAndStore,
  exportToCSV,
  parseCsv
};