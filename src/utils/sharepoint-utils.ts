import axios, { isAxiosError } from 'axios';
import querystring from 'querystring';
import dotenv from 'dotenv';
dotenv.config();

const { TENANT_ID, CLIENT_ID, CLIENT_SECRET, RESOURCE, SITE_DOMAIN, SUBSITE } = process.env;

/**
 * Get the access token from SharePoint using client credentials.
 * @returns {Promise<string>} - Promise that resolves with the access token.
 * @throws {Error} - If there is an error while fetching the access token.
 */
export const getAccessToken = async () => {
  try {
    const url = `https://accounts.accesscontrol.windows.net/${TENANT_ID}/tokens/OAuth/2`;

    const data = querystring.stringify({
      grant_type: 'client_credentials',
      client_id: `${CLIENT_ID}@${TENANT_ID}`,
      client_secret: CLIENT_SECRET,
      resource: `${RESOURCE}/${SITE_DOMAIN}@${TENANT_ID}`,
    });

    const response = await axios.post(url, data, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (response.status === 200 && response.data && response.data.access_token) {
      return response.data.access_token;
    } else {
      throw new Error('Failed to fetch access token from SharePoint.');
    }
  } catch (error) {
    handleAxiosError(error, 'fetching access token');
  }
}

/**
 * Get the Form Digest Value from SharePoint using the access token.
 * @param {string} accessToken - The access token obtained from SharePoint.
 * @returns {Promise<string>} - Promise that resolves with the Form Digest Value.
 * @throws {Error} - If there is an error while fetching the Form Digest Value.
 */
export const getFormDigestValue = async (accessToken: string) => {
  try {
    const url = `https://${SITE_DOMAIN}/sites/${SUBSITE}/_api/contextinfo`;

    const response = await axios.post(url, undefined, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (response.status === 200 && response.data && response.data.FormDigestValue) {
      return response.data.FormDigestValue.split(',')[0];
    } else {
      throw new Error('Failed to fetch Form Digest Value from SharePoint.');
    }
  } catch (error) {
    handleAxiosError(error, 'fetching form digest value');
  }
}

/**
 * Check if a folder exists on SharePoint.
 * @param {string} path - Path of the folder.
 * @param {string} accessToken - Access token for SharePoint.
 * @param {string} formDigestValue - Form Digest Value for SharePoint.
 * @returns {Promise<boolean>} - Returns a Promise that resolves to a boolean indicating whether the folder exists.
 * @throws {Error} - Throws an error if there's an issue with the request or if the folder existence cannot be determined.
 */
export const checkFolderExistsInSharepoint = async (path: string, accessToken: string, formDigestValue: string) => {
  try {
    const url = `https://${SITE_DOMAIN}/sites/${SUBSITE}/_api/web/GetFolderByServerRelativeUrl('${path}')/Exists`;
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'X-RequestDigest': formDigestValue
      }
    });
    return response.data.value;
  } catch (error) {
    handleAxiosError(error, 'checking folder existence');
  }
}

/**
 * Creates a folder in SharePoint.
 * @param {string} path - Full path of the folder to create.
 * @param {string} accessToken - Access token for SharePoint.
 * @param {string} formDigestValue - Form Digest Value for SharePoint.
 * @returns {Promise<void>} - Returns a Promise that resolves when the folder is successfully created.
 * @throws {Error} - Throws an error if there's an issue with the request or if the folder creation fails.
 */
export const createFolderInSharepoint = async (path: string, accessToken: string, formDigestValue: string) => {
  try {
    const url = `https://${SITE_DOMAIN}/sites/${SUBSITE}/_api/web/Folders/add('${SUBSITE}/${path}')`;

    await axios.post(url, undefined, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json;odata=verbose',
        'Content-Type': 'application/json;odata=verbose',
        'X-RequestDigest': formDigestValue
      }
    });
  } catch (error) {
    handleAxiosError(error, 'creating folder');
  }
}

/**
 * Upload a file to the specified SharePoint folder.
 * @param {string} fileName - The name of the file (including the file extension).
 * @param {Buffer} stream - The readable stream of the file to be uploaded.
 * @param {string} contentType - The MIME type of the file to be uploaded.
 * @param {string} accessToken - The access token obtained from SharePoint.
 * @param {string} formDigestValue - The form digest obtained from SharePoint.
 * @param {string} folderPath - The path to the folder where the file will be uploaded.
 * @returns {Promise<void>} - Promise that resolves when the file is uploaded successfully.
 * @throws {Error} - If there is an error during the file upload.
 */
export const uploadFileToSharepoint = async (fileName: string, stream: any, contentType: string, accessToken: string, formDigestValue: string, folderPath: string) => {
  try {
    const url = `https://${SITE_DOMAIN}/sites/${SUBSITE}/_api/web/GetFolderByServerRelativeUrl('${SUBSITE}/${folderPath}')/Files/Add(url='${fileName}', overwrite=true)`;
    const binaryData = await streamToBuffer(stream);
    await axios.post(url, binaryData, {
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-RequestDigest': formDigestValue,
        'Accept': 'application/json;odata=verbose',
        'Content-Type': contentType,
      },
    });

    console.log(`File ${fileName} uploaded successfully.`);
  } catch (error) {
    handleAxiosError(error, 'uploading media file');
  }
}

/**
 * Uploads an object as a JSON file to SharePoint.
 * @param {string} accessToken - The access token for SharePoint API.
 * @param {string} formDigestValue - The form digest value for SharePoint API.
 * @param {string} fileName - The name of the JSON file to be created.
 * @param {object} data - The object to be stored in the JSON file.
 * @param {string} folderPath - The path to the folder where the file will be uploaded.
 * @returns {Promise<void>} - Promise that resolves when the JSON file is uploaded successfully.
 */
export const uploadObjectAsJSON = async (accessToken: string, formDigestValue: string, fileName: string, data: any, folderPath: string) => {
  try {
    if (!data) {
      console.log(`Cannot upload empty file: ${fileName}`);
      return;
    }
    const fileContent = JSON.stringify(data);

    const createFileUrl = `https://${SITE_DOMAIN}/sites/${SUBSITE}/_api/web/GetFolderByServerRelativeUrl('${SUBSITE}/${folderPath}')/files/add(url='${fileName}', overwrite=true)`;
    await axios.post(createFileUrl, fileContent, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-RequestDigest': formDigestValue,
        'Accept': 'application/json;odata=verbose',
        'Content-Type': 'application/json',
      },
    });

    console.log(`Object uploaded as JSON file: ${fileName}`);
  } catch (error) {
    handleAxiosError(error, 'uploading JSON file');
  }
}

/**
 * Creates a folder in Sharepoint if it doesn't exist.
 * @param {string} path - Path of the folder.
 * @param {string} accessToken - Access token for SharePoint.
 * @param {string} formDigestValue - Form Digest Value for SharePoint.
 */
export const createFolderIfNotExistInSharepoint = async (path: string, accessToken: string, formDigestValue: string) => {
  if (!await checkFolderExistsInSharepoint(path, accessToken, formDigestValue)) {
    await createFolderInSharepoint(path, accessToken, formDigestValue);
  }
}

/**
 * Convert a Readable stream to a Buffer.
 * @param {ReadableStream} stream - The Readable stream to convert.
 * @returns {Promise<Buffer>} - Promise that resolves with the Buffer containing the entire data of the stream.
 */
const streamToBuffer = async (stream: any): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', (error: Error) => reject(error));
  });
}

/**
 * Handles Axios errors.
 * @param {Error} error - The Axios error.
 * @param {string} operation - The operation where the error occurred.
 * @throws {Error} - Throws the appropriate error message based on the Axios error.
 */
const handleAxiosError = (error: any, operation: string): void => {
  if (isAxiosError(error) && error.response && error.response.data && error.response.data.error) {
    const errorMessage = error.response.data.error.message.value;
    throw new Error(`SharePoint API error while ${operation}: ${errorMessage}`);
  } else {
    throw error;
  }
}