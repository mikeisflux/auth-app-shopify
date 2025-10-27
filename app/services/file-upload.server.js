import FormData from 'form-data';

export class FileUploadService {
  constructor(session) {
    this.session = session;
    this.shop = session.shop;
    this.accessToken = session.accessToken;
    this.apiVersion = '2024-10';
  }

  /**
   * Upload a file to Shopify Files
   * @param {Buffer} fileBuffer - The file buffer from multer
   * @param {string} filename - Original filename
   * @param {string} mimeType - MIME type of the file
   * @returns {Promise<{url: string, id: string}>}
   */
  async uploadFile(fileBuffer, filename, mimeType) {
    try {
      // Step 1: Create staged upload
      const stagedUpload = await this.createStagedUpload(filename, mimeType, fileBuffer.length);

      if (!stagedUpload) {
        throw new Error('Failed to create staged upload');
      }

      // Step 2: Upload file to staged URL
      await this.uploadToStagedUrl(
        stagedUpload.url,
        stagedUpload.parameters,
        fileBuffer,
        filename,
        mimeType
      );

      // Step 3: Create file record in Shopify
      const fileRecord = await this.createFileRecord(stagedUpload.resourceUrl, filename);

      return {
        url: fileRecord.url,
        id: fileRecord.id,
        alt: fileRecord.alt
      };
    } catch (error) {
      console.error('File upload error:', error);
      throw error;
    }
  }

  /**
   * Step 1: Create a staged upload URL
   */
  async createStagedUpload(filename, mimeType, fileSize) {
    const mutation = `
      mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets {
            url
            resourceUrl
            parameters {
              name
              value
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      input: [{
        resource: 'FILE',
        filename: filename,
        mimeType: mimeType,
        fileSize: fileSize.toString(),
        httpMethod: 'POST'
      }]
    };

    const response = await this.graphqlRequest(mutation, variables);

    if (response.data.stagedUploadsCreate.userErrors.length > 0) {
      throw new Error(response.data.stagedUploadsCreate.userErrors[0].message);
    }

    const target = response.data.stagedUploadsCreate.stagedTargets[0];
    return {
      url: target.url,
      resourceUrl: target.resourceUrl,
      parameters: target.parameters
    };
  }

  /**
   * Step 2: Upload file to the staged URL
   */
  async uploadToStagedUrl(url, parameters, fileBuffer, filename, mimeType) {
    const formData = new FormData();

    // IMPORTANT: Add parameters FIRST, then file LAST
    // Shopify requires this specific order
    parameters.forEach(param => {
      formData.append(param.name, param.value);
    });

    // File must be LAST
    formData.append('file', fileBuffer, {
      filename: filename,
      contentType: mimeType
    });

    // Use form-data's submit method for proper multipart handling
    return new Promise((resolve, reject) => {
      formData.submit(url, (err, res) => {
        if (err) {
          reject(new Error(`Failed to upload to staged URL: ${err.message}`));
          return;
        }

        if (res.statusCode !== 200 && res.statusCode !== 201) {
          let errorText = '';
          res.on('data', chunk => errorText += chunk);
          res.on('end', () => {
            reject(new Error(`Failed to upload to staged URL: ${res.statusCode} ${errorText}`));
          });
        } else {
          res.resume(); // Consume the response
          resolve(res);
        }
      });
    });
  }

  /**
   * Step 3: Create the file record in Shopify
   * Returns immediately with file ID - URL will be available after processing
   */
  async createFileRecord(resourceUrl, filename) {
    const mutation = `
      mutation fileCreate($files: [FileCreateInput!]!) {
        fileCreate(files: $files) {
          files {
            ... on GenericFile {
              id
              url
              alt
            }
            ... on MediaImage {
              id
              image {
                url
              }
              alt
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      files: [{
        originalSource: resourceUrl,
        alt: filename
      }]
    };

    const response = await this.graphqlRequest(mutation, variables);

    if (response.data.fileCreate.userErrors.length > 0) {
      throw new Error(response.data.fileCreate.userErrors[0].message);
    }

    const file = response.data.fileCreate.files[0];

    console.log('📝 File record created:', JSON.stringify(file, null, 2));

    // Return immediately with file ID
    // URL will be fetched later after Shopify processes the image
    const result = {
      id: file.id,
      url: null,
      alt: file.alt,
      needsProcessing: file.id.includes('MediaImage')
    };

    // Try to get URL if immediately available (for GenericFile or already processed)
    if (file.image && file.image.url) {
      console.log('✓ URL immediately available:', file.image.url);
      result.url = file.image.url;
      result.needsProcessing = false;
    } else if (file.url) {
      console.log('✓ URL immediately available:', file.url);
      result.url = file.url;
      result.needsProcessing = false;
    } else {
      console.log('⏳ URL not ready yet - needs processing');
    }

    return result;
  }

  /**
   * Query a file by ID to get its URL (with retry logic for processing delays)
   */
  async getFileById(fileId, maxRetries = 3) {
    const query = `
      query getFile($id: ID!) {
        node(id: $id) {
          ... on GenericFile {
            id
            url
            alt
          }
          ... on MediaImage {
            id
            image {
              url
            }
            alt
          }
        }
      }
    `;

    const variables = { id: fileId };

    // Retry with delays to wait for Shopify to process the image
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const response = await this.graphqlRequest(query, variables);

      if (!response.data.node) {
        console.warn(`⚠️ File not found by ID (attempt ${attempt}/${maxRetries}):`, fileId);
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // 1s, 2s, 3s delays
          continue;
        }
        return null;
      }

      const file = response.data.node;
      console.log(`📊 File query response (attempt ${attempt}/${maxRetries}):`, JSON.stringify(file, null, 2));

      // Extract URL based on file type
      if (file.image && file.image.url) {
        console.log(`✓ Got URL on attempt ${attempt}:`, file.image.url);
        return {
          id: file.id,
          url: file.image.url,
          alt: file.alt
        };
      } else if (file.url) {
        console.log(`✓ Got URL on attempt ${attempt}:`, file.url);
        return {
          id: file.id,
          url: file.url,
          alt: file.alt
        };
      }

      // No URL yet - retry if we have attempts left
      if (attempt < maxRetries) {
        console.log(`⏳ No URL yet, waiting ${attempt}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      } else {
        console.warn('❌ Max retries reached, URL still not available');
      }
    }

    return null;
  }

  /**
   * Make a GraphQL request to Shopify Admin API
   */
  async graphqlRequest(query, variables = {}) {
    const url = `https://${this.shop}/admin/api/${this.apiVersion}/graphql.json`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': this.accessToken
      },
      body: JSON.stringify({
        query,
        variables
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GraphQL request failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();

    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    return result;
  }
}
