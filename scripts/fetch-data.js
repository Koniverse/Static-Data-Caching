import {fetchEarning} from "./fetch-earning.mjs";
import {fetchPrice} from "./fetch-price.js";

const main = async () => {
  await Promise.all([
    fetchEarning(),
    fetchPrice(),
  ])
}

main().catch(console.error)