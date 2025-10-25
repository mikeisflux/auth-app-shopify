// Shopify Files API service - handles image uploads to merchant's store
import shopify from "../shopify.server";

export class ShopifyFilesService {
  constructor(session) {
    this.session = session;
    this.client = new shopify.api.clients.Graphql({ session });
  }

  /**
   * Upload an image file to Shopify Files
   * @param {Buffer|string} fileContent - File content as buffer or base64
   * @param {string} filename - Name of the file
   * @param {string} mimeType - MIME type (e.g., 'image/jpeg')
   * @returns {Promise<{fileId: string, url: string}>}
   */
  async uploadImage(fileContent, filename, mimeType = 'image/jpeg') {
    try {
      // Step 1: Generate staged upload parameters
      const stagedUploadsCreate = `
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

      const stagedUploadInput = {
        resource: 'FILE',
        filename,
        mimeType,
        httpMethod: 'POST',
        fileSize: Buffer.byteLength(fileContent).toString()
      };

      const stagedResponse = await this.client.query({
        data: {
          query: stagedUploadsCreate,
          variables: {
            input: [stagedUploadInput]
          }
        }
      });

      const { stagedTargets, userErrors } = 
        stagedResponse.body.data.stagedUploadsCreate;

      if (userErrors && userErrors.length > 0) {
        throw new Error(userErrors[0].message);
      }

      const stagedTarget = stagedTargets[0];

      // Step 2: Upload file to staged URL
      const formData = new FormData();
      
      // Add all parameters from Shopify
      stagedTarget.parameters.forEach(param => {
        formData.append(param.name, param.value);
      });

      // Add the file
      const blob = new Blob([fileContent], { type: mimeType });
      formData.append('file', blob, filename);

      const uploadResponse = await fetch(stagedTarget.url, {
        method: 'POST',
        body: formData
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }

      // Step 3: Create file in Shopify
      const fileCreateMutation = `
        mutation fileCreate($files: [FileCreateInput!]!) {
          fileCreate(files: $files) {
            files {
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

      const fileCreateResponse = await this.client.query({
        data: {
          query: fileCreateMutation,
          variables: {
            files: [{
              alt: filename,
              contentType: 'IMAGE',
              originalSource: stagedTarget.resourceUrl
            }]
          }
        }
      });

      const { files, userErrors: createErrors } = 
        fileCreateResponse.body.data.fileCreate;

      if (createErrors && createErrors.length > 0) {
        throw new Error(createErrors[0].message);
      }

      const file = files[0];

      return {
        fileId: file.id,
        url: file.image.url
      };
    } catch (error) {
      console.error('Error uploading file to Shopify:', error);
      throw error;
    }
  }

  /**
   * Delete a file from Shopify
   * @param {string} fileId - Shopify file ID (gid://shopify/MediaImage/...)
   * @returns {Promise<boolean>}
   */
  async deleteFile(fileId) {
    try {
      const mutation = `
        mutation fileDelete($input: [ID!]!) {
          fileDelete(fileIds: $input) {
            deletedFileIds
            userErrors {
              field
              message
            }
          }
        }
      `;

      const response = await this.client.query({
        data: {
          query: mutation,
          variables: {
            input: [fileId]
          }
        }
      });

      const { deletedFileIds, userErrors } = 
        response.body.data.fileDelete;

      if (userErrors && userErrors.length > 0) {
        throw new Error(userErrors[0].message);
      }

      return deletedFileIds && deletedFileIds.length > 0;
    } catch (error) {
      console.error('Error deleting file from Shopify:', error);
      throw error;
    }
  }

  /**
   * Get file details
   * @param {string} fileId - Shopify file ID
   * @returns {Promise<object>}
   */
  async getFile(fileId) {
    try {
      const query = `
        query getFile($id: ID!) {
          node(id: $id) {
            ... on MediaImage {
              id
              image {
                url
                width
                height
              }
              alt
              createdAt
            }
          }
        }
      `;

      const response = await this.client.query({
        data: {
          query,
          variables: { id: fileId }
        }
      });

      return response.body.data.node;
    } catch (error) {
      console.error('Error getting file from Shopify:', error);
      throw error;
    }
  }

  /**
   * Convert base64 image to buffer
   * @param {string} base64String - Base64 encoded image
   * @returns {Buffer}
   */
  static base64ToBuffer(base64String) {
    // Remove data URL prefix if present
    const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
    return Buffer.from(base64Data, 'base64');
  }

  /**
   * Validate image file
   * @param {Buffer} fileBuffer - File buffer
   * @param {number} maxSizeMB - Maximum file size in MB
   * @returns {boolean}
   */
  static validateImage(fileBuffer, maxSizeMB = 10) {
    const sizeMB = fileBuffer.length / (1024 * 1024);
    return sizeMB <= maxSizeMB;
  }
}