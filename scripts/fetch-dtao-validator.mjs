import path from "path";
import createApiRequest from "../utils/baseApi.js";
import writeFileSync from "../utils/writeFile.js";
import cachedFile from "../data/earning/dtao/validator.json" assert { type: "json" };

const CACHE_PATH = path.resolve("./data/earning/dtao/validator.json");
const CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 hours

const API_URL = "https://api.taostats.io/api/dtao/validator/latest/v1";
const API_HEADERS = {
  accept: "application/json",
  Authorization: process.env.BITTENSOR_API_KEY,
};

// Load cache
function loadCache() {
  try {
    if (
      cachedFile.lastUpdated &&
      Date.now() - cachedFile.lastUpdated < CACHE_DURATION
    ) {
      console.log("Load dtao validator data from cached");
      return cachedFile;
    }
  } catch (e) {
    // error import json => return null
  }
  return null;
}

// Save cache
function saveCache(data) {
  const payload = {
    lastUpdated: Date.now(),
    lastUpdatedTimestamp: new Date().toISOString(),
    data,
  };
  writeFileSync(payload, CACHE_PATH);
  return payload;
}

// Fetch from API
async function fetchValidatorFromAPI() {
  const validatorResponse = await createApiRequest({
    url: API_URL,
    method: "GET",
    headers: API_HEADERS,
  });

  if (!validatorResponse.success) {
    throw new Error(`API request failed: ${validatorResponse.message}`);
  }

  return validatorResponse.data;
}

export async function fetchDtaoValidatorData() {
  const cached = loadCache();
  if (cached) return cached;

  const freshData = await fetchValidatorFromAPI();
  return saveCache(freshData);
}
