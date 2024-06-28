import createApiRequest from "../utils/baseApi.js";
import writeFileSync from "../utils/writeFile.js";

const fetchPriceApiCacher = async () => {

  const url = process.env.NODE_ENV === 'production' ? 'https://api-cache.subwallet.app/api/price/get' : 'https://api-cache-dev.subwallet.app/api/price/get'
  const {success, data} = await createApiRequest({
    url,
    method: 'GET',
  })
  if (!success) {
    throw new Error(`Cannot get exchange rate`)
  }

  return data.reduce((acc, item) => {
    const {id, ...rest} = item;
    acc[id] = rest;
    return acc;
  }, {})
}

export const fetchPrice = async () => {
  try {
    const exchangeRate = await fetchPriceApiCacher()
    await writeFileSync(exchangeRate, './data/price/data.json')
  } catch (error) {
    console.log("Fetch price error", error)
  }

}

