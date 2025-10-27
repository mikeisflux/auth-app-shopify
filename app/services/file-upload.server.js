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

    // For MediaImage, the URL might not be immediately available
    // Query the file again to get the processed URL
    if (file.id && file.id.includes('MediaImage')) {
      console.log('🔄 MediaImage detected, querying for URL...');
      const fileWithUrl = await this.getFileById(file.id);
      if (fileWithUrl && fileWithUrl.url) {
        console.log('✓ Got URL from file query:', fileWithUrl.url);
        return fileWithUrl;
      }
    }

    // Handle different file types (GenericFile vs MediaImage)
    if (file.image && file.image.url) {
      console.log('✓ MediaImage with URL:', file.image.url);
      return {
        id: file.id,
        url: file.image.url,
        alt: file.alt
      };
    } else if (file.url) {
      console.log('✓ GenericFile with URL:', file.url);
      return {
        id: file.id,
        url: file.url,
        alt: file.alt
      };
    } else {
      console.error('❌ No URL found in file response');
      return {
        id: file.id,
        url: null,
        alt: file.alt
      };
    }
  }

  /**
   * Query a file by ID to get its URL
   */
  async getFileById(fileId) {
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

    const response = await this.graphqlRequest(query, variables);

    if (!response.data.node) {
      console.warn('⚠️ File not found by ID:', fileId);
      return null;
    }

    const file = response.data.node;

    // Extract URL based on file type
    if (file.image && file.image.url) {
      return {
        id: file.id,
        url: file.image.url,
        alt: file.alt
      };
    } else if (file.url) {
      return {
        id: file.id,
        url: file.url,
        alt: file.alt
      };
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
