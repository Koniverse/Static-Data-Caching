import createApiRequest from "../utils/baseApi.js";
import writeFileSync from "../utils/writeFile.js";

const fetchExchangeRateOnline = async () => {
    const {success, data} = await createApiRequest({
        url: `https://v6.exchangerate-api.com/v6/${process.env.EXCHANGE_RATE_API_KEY}/latest/USD`,
        method: 'GET',
    })
    if (!success) {
        throw new Error(`Cannot get exchange rate`)
    }

    return data
}

export const fetchExchangeRate = async () => {
    try {
        const exchangeRate = await fetchExchangeRateOnline()
        await writeFileSync(exchangeRate, './data/exchange-rate/data.json')
    } catch (error) {
        console.log("Fetch exchange rate error", error)
    }
}

setImmediate(async () => {

    try {

        await fetchExchangeRate()
        process.exit()

    } catch (err) {
        console.error(err)
    }
})
