import VeriffAPI from "../services/VeriffAPI";

/**
 * Retrieves relevant session data from Veriff APIs.
 * This includes session decision, person information, media list,
 * watchlist screening, INE data, CURP data, and attempts for a session.
 * @param {VeriffAPI} veriffApi - Instance of the Veriff API wrapper.
 * @param {string} sessionId - The ID of the Veriff session.
 * @param {string} version - The version number for data retrieval.
 * @returns {Promise<{
 *   sessionDecision: { status: string, value: any },
 *   personInfo: { status: string, value: any },
 *   mediaList: { status: string, value: any },
 *   watchlistScreening: { status: string, value: any },
 *   ineData: { status: string, value: any },
 *   curpData: { status: string, value: any },
 *   attempts: { status: string, value: any }
 * }>} - A promise resolving to an object containing all the retrieved data.
 */
export const getRelavantSessionData = async (veriffApi: VeriffAPI, sessionId: string, version: string) => {
  const data = await Promise.allSettled([
    veriffApi.getSessionDecision(sessionId),
    veriffApi.getPersonForSession(sessionId),
    veriffApi.getMediaForSession(sessionId),
    veriffApi.getWatchlistScreeningForSession(sessionId),
    veriffApi.getINEDataForSession(sessionId, version),
    veriffApi.getCurpRegistryData(sessionId, version),
    veriffApi.getAttemptsForSession(sessionId)
  ]);

  const [sessionDecision, personInfo, mediaList, watchlistScreening, ineData, curpData, attempts] = data.map(extractValue);

  return {
    sessionDecision,
    personInfo,
    mediaList,
    watchlistScreening,
    ineData,
    curpData,
    attempts
  };
}

/**
 * Safely extracts the value from a settled promise result.
 * @param {PromiseSettledResult<any>} result - The settled promise result.
 * @returns {any} - The value if the promise is fulfilled, otherwise null.
 */
export const extractValue = (result: PromiseSettledResult<any>) => {
  return result.status === 'fulfilled' ? result.value : null;
}