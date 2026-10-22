import {fetchEarning} from "./fetch-earning.mjs";
import {fetchPrice} from "./fetch-price.js";
import { fetchDtaoValidatorData } from "./fetch-dtao-validator.mjs";

const main = async () => {
  await Promise.all([
    // validator.json is built from the Bittensor pool targets the earning run brings back
    fetchEarning().then(fetchDtaoValidatorData),
    fetchPrice()
  ])
}

main().catch(console.error)