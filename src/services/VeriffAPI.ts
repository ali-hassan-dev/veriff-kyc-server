import axios, { AxiosInstance, ResponseType, isAxiosError } from 'axios';
import crypto from 'crypto';
import { KeyPair } from '../types';

/**
 * Veriff API wrapper class for making secure API requests.
 */
class VeriffAPI {
  private currentIndex: number;
  private veriffAPI!: AxiosInstance;

  /**
   * Initialize the Veriff API wrapper with the API keys and base URL.
   * @param {KeyPair[]} apiKeyPairs - Array of Veriff API key pairs.
   * @param {string} baseUrl - Base URL of the Veriff API.
   */
  constructor(private apiKeyPairs: KeyPair[], private baseUrl: string) {
    this.currentIndex = 0;
    this.init();
  }

  /**
   * Initialize Axios instance and request interceptor.
   */
  private init() {
    const { apiKey } = this.getCurrentKeyPair();

    this.veriffAPI = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'X-AUTH-CLIENT': apiKey,
      },
    });

    this.veriffAPI.interceptors.request.use((config) => {
      const { url } = config;
      const id = this.extractIdFromUrl(url || '');
      const signature = this.generateSignature(id);
      config.headers['X-HMAC-SIGNATURE'] = signature;
      return config;
    });
  }

  /**
   * Get current API key pair.
   * @returns {KeyPair} - Current API key pair.
   */
  private getCurrentKeyPair() {
    return this.apiKeyPairs[this.currentIndex];
  }

  /**
   * Perform API request with automatic key rotation.
   * @param {string} url - API endpoint URL.
   * @param {ResponseType} responseType - Response type (default: 'json').
   * @param {string} method - HTTP method (default: 'get').
   * @returns {Promise<any>} - Promise with API response data.
   */
  private async performRequest(url: string, responseType: ResponseType = 'json', method = 'get') {
    let attemptsLeft = this.apiKeyPairs.length;
    while (attemptsLeft > 0) {
      try {
        const response = await this.veriffAPI.request({ url, responseType, method });
        if (responseType === 'stream') {
          return response;
        }
        return response.data;
      } catch (error) {
        if (isAxiosError(error) && error.response && error.response.status && error.response.data) {
          this.switchToNextKeyPair();
          attemptsLeft--;
          console.error(`Request to Veriff API failed with status: ${error.response.status} and error message: ${JSON.stringify(error.response.data)}`);
          if (attemptsLeft === 0) {
            console.error(`All key pairs failed for ${url}`);
            return null;
          }
        } else {
          console.error(`Request failed for ${url}:`, error);
        }
      }
    }
  }

  /**
   * Switch to the next API key pair for key rotation.
   */
  private switchToNextKeyPair() {
    this.currentIndex = (this.currentIndex + 1) % this.apiKeyPairs.length;
    this.init();
  }

  /**
   * Get the list of attempt objects for the provided session ID.
   * @param {string} sessionId - ID of the Veriff session.
   * @returns {any[]} - List of JSON objects identifying the attempts associated with the sessionId.
   */
  public async getAttemptsForSession(sessionId: string) {
    const url = `/sessions/${sessionId}/attempts`;
    const response = await this.performRequest(url);
    return response.verifications;
  }

  /**
   * Get the session decision for the provided session ID.
   * @param {string} sessionId - ID of the Veriff session.
   * @returns {Object | null} - Verification request session decision object. Null if decision is not available yet.
   */
  public async getSessionDecision(sessionId: string) {
    const url = `/sessions/${sessionId}/decision`;
    return await this.performRequest(url);
  }

  /**
   * Get personal information objects about a person associated with the specific sessionId.
   * @param {string} sessionId - ID of the Veriff session.
   * @returns {Object} - Personal information object about a person associated with the sessionId.
   */
  public async getPersonForSession(sessionId: string) {
    const url = `/sessions/${sessionId}/person`;
    const response = await this.performRequest(url);
    return response.person;
  }

  /**
   * Get a list of media objects for the provided session ID.
   * @param {string} sessionId - ID of the Veriff session.
   * @returns {Object} - List of media objects for the session.
   */
  public async getMediaForSession(sessionId: string) {
    const url = `/sessions/${sessionId}/media`;
    return await this.performRequest(url);
  }

  /**
   * Get the watchlist screening data for the provided session ID.
   * @param {string} sessionId - ID of the Veriff session.
   * @returns {Object} - List of data objects from PEP and Sanctions services associated with the sessionId.
   */
  public async getWatchlistScreeningForSession(sessionId: string) {
    const url = `/sessions/${sessionId}/watchlist-screening`;
    return await this.performRequest(url);
  }

  /**
   * Get a list of media objects for the provided attempt ID.
   * @param {string} attemptId - ID of the Veriff attempt.
   * @returns {Object} - List of media objects for the attempt.
   */
  public async getMediaForAttempt(attemptId: string) {
    const url = `/attempts/${attemptId}/media`;
    return await this.performRequest(url);
  }

  /**
   * Get the media file for the provided media ID.
   * @param {string} mediaId - ID of the Veriff media file.
   * @returns {any} - Media stream (image/video) for the provided media ID.
   */
  public async getMediaById(mediaId: string) {
    const url = `/media/${mediaId}`;
    const response = await this.performRequest(url, 'stream');
    if (response) {
      const media = response.data;
      const contentType = response.headers['content-type'];
      return { media, contentType };
    }
  }

  /**
   * Get data about the INE identification number for the provided session ID.
   * @param {string} sessionId - ID of the Veriff session.
   * @param {string} version - The version number of the check (required query parameter).
   * @returns {Object} - Data about the INE identification number.
   */
  public async getINEDataForSession(sessionId: string, version: string) {
    const encodedVersion = encodeURIComponent(version);
    const url = `/sessions/${sessionId}/decision/ine-registry?version=${encodedVersion}`;
    return await this.performRequest(url);
  }

  /**
   * Get data about the CURP (Unique Population Registry Code) identification number and status.
   * @param {string} sessionId - The ID of the Veriff session.
   * @param {string} version - The version number of the check (e.g., '1.0.0').
   * @returns {Object} - The response data containing the CURP identification number and status.
   */
  public async getCurpRegistryData(sessionId: string, version: string) {
    const encodedVersion = encodeURIComponent(version);
    const url = `/sessions/${sessionId}/decision/curp-registry?version=${encodedVersion}`;
    return await this.performRequest(url);
  }

  /**
   * Fetch a list of media objects with the given addressId for Proof of Address sessions.
   * @param {string} addressId - Address ID for which media objects are requested.
   * @returns {any[]} - The list of media (images/videos) objects.
   */
  public async getAddressMedia(addressId: string) {
    const url = `/address/${addressId}/media`;
    return await this.performRequest(url);
  }

  /**
   * Fetch the media for Proof of Address with the given mediaId.
   * @param {string} mediaId - Media ID for which media is requested.
   * @returns {any} - The media stream (image/video) for the provided media ID..
   */
  public async getAddressMediaById(mediaId: string) {
    const url = `/address-media/${mediaId}`;
    const response = await this.performRequest(url, 'stream');
    if (response) {
      const media = response.data;
      const contentType = response.headers['content-type'];
      return { media, contentType };
    }
  }

  /**
   * Extract the sessionId, attemptId, mediaId, or addressId from the URL.
   * @param {string} url - The URL of the request.
   * @returns {string} - The sessionId, attemptId, mediaId, or addressId extracted from the URL.
   */
  private extractIdFromUrl(url: string) {
    const regex = /\/(?:sessions|attempts|media|address|address-media|transportation-registry)\/([^/]+)/;
    const match = url.match(regex);
    return match ? match[1] : '';
  }

  /**
   * Verify the webhook signature to check if the request originates from Veriff.
   * @param {Object} options - Object containing the signature, sharedSecretKey, and payload.
   * @param {string} options.signature - The X-HMAC-SIGNATURE header value received in the webhook request.
   * @param {Object} options.payload - The payload received in the webhook request (Object or JSON string).
   * @returns {boolean} - Returns true if the signature is valid; otherwise, returns false.
   */
  public isSignatureValid({ signature, payload }: { signature: string, payload: any }) {
    if (typeof payload === 'object') {
      payload = JSON.stringify(payload);
    }

    if (!Buffer.isBuffer(payload)) {
      payload = Buffer.from(payload, 'utf8');
    }

    for (const apiKeyPair of this.apiKeyPairs) {
      const { sharedSecretKey } = apiKeyPair;
      const digest = crypto.createHmac('sha256', sharedSecretKey).update(payload).digest('hex');
      if (digest === signature) {
        return true;
      }
    }

    return false;
  }

  /**
   * Helper function to generate the signature for a given ID using the shared secret key.
   * @param {string} id - ID (sessionId, attemptId, mediaId, addressId) for which the signature needs to be generated.
   * @returns {string} - The generated signature.
   */
  private generateSignature(id: string) {
    const { sharedSecretKey } = this.getCurrentKeyPair();
    const hmac = crypto.createHmac('sha256', sharedSecretKey).update(id).digest('hex');
    return hmac;
  }
}

export default VeriffAPI;