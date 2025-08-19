import {fetchEarning} from "./fetch-earning.mjs";
import {fetchPrice} from "./fetch-price.js";
import { fetchDtaoValidatorData } from "./fetch-dtao-validator.mjs";

const main = async () => {
  await Promise.all([
    fetchEarning(),
    fetchPrice(),
    fetchDtaoValidatorData()
  ])
}

main().catch(console.error)