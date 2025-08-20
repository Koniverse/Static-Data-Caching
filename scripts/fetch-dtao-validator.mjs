import createApiRequest from "../utils/baseApi.js";
import writeFileSync from "../utils/writeFile.js";
import cachedFile from "../data/earning/dtao/validator.json" with { type: "json" };
import dotenv from "dotenv";
import path from "path";

dotenv.config();

const CACHE_PATH = path.resolve("./data/earning/dtao/validator.json");

const API_URL = "https://api.taostats.io/api/dtao/validator/latest/v1";
const API_HEADERS = {
  accept: "application/json",
  Authorization: process.env.BITTENSOR_API_KEY || "",
};

// Load cache
function loadFile() {
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
function saveFile(data) {
  const payload = {
    lastUpdated: Date.now(),
    lastUpdatedTimestamp: new Date().toISOString(),
    data,
  };
  writeFileSync(payload, CACHE_PATH);

  console.log(`Save dtao validator data to cache file (${data.length} items)`);

  return payload;
}

// Fetch from API
async function fetchValidatorFromAPI() {
  const validatorResponse = await createApiRequest({
    url: API_URL,
    params: {
      limit: 200, // Adjust limit as needed
    },
    method: "GET",
    headers: API_HEADERS,
  });

  if (!validatorResponse.success) {
    throw new Error(`API request failed: ${validatorResponse.message}`);
  }

  return validatorResponse.data.data;
}

export async function fetchDtaoValidatorData() {
  const freshData = await fetchValidatorFromAPI();
  return saveFile(freshData);
}
