import Bluebird from 'bluebird'
import {Web3} from 'web3'
import {ApiPromise, WsProvider} from '@polkadot/api'
import createApiRequest from "../utils/baseApi.js";
import writeFileSync from "../utils/writeFile.js";


const URL_GET_CHAIN = 'https://static-data.subwallet.app/chains'
const CHAIN_TYPE = {
  EVM: 'evm',
  SUBSTRATE: 'substrate',
}
const STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
}

const getChains = async (url = URL_GET_CHAIN) => {

  const fileName = process.env.NODE_ENV === 'production' ? 'list.json' : 'preview.json'
  const {success, data} = await createApiRequest({
    url: `${url}/${fileName}`,
    method: 'GET',
  })
  if (!success) {
    throw new Error(`Cannot get info chain`)
  }

  return data
}

const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
}

const _checkHealthEvmRpc = async (url) => {
  try {
    const web3 = new Web3(url)
    await web3.eth.getBlockNumber()

    return STATUS.ACTIVE
  } catch (err) {

    return STATUS.INACTIVE
  }
}

const checkHealthEvmRpc = async (url, count = 0) => {

  let status = await _checkHealthEvmRpc(url)
  if (++count < 3 && status === STATUS.INACTIVE) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    status = await checkHealthEvmRpc(url, count)
  }

  return status
}

const checkHealthSubstrateRpc = async (url) => {
  try {
    let provider
    if (url.startsWith('light://')) {
      return STATUS.ACTIVE
    } else {
      provider = new WsProvider(url)
    }
    if (!provider) {
      return STATUS.INACTIVE
    }

    const api = await ApiPromise.create({provider})
    await api.rpc.chain.getFinalizedHead()
    await api.disconnect()

    return STATUS.ACTIVE
  } catch (err) {
    console.log("checkHealthSubstrateRpc error", url, err)
    return STATUS.INACTIVE
  }
}

const checkHealthSubstrateRpcWithTimeout = (url, timeout = 60000) => {
  return Promise.race([
    checkHealthSubstrateRpc(url),
    new Promise((resolve) =>
      setTimeout(() => {
        console.log("Timeout reached for", url);
        resolve(STATUS.INACTIVE);
      }, timeout)
    )
  ]);
};

const _checkHealthRpc = async (type = CHAIN_TYPE.SUBSTRATE, url) => {
  console.log("_checkHealthRpc", url)
  if (!isValidUrl(url)) {
    console.log("invalid url", url)
    return STATUS.INACTIVE
  }

  if (type === CHAIN_TYPE.EVM) {
    return checkHealthEvmRpc(url)
  }

  return checkHealthSubstrateRpcWithTimeout(url)
}

const getErrorRpc = async (chainInfo) => {

  if (chainInfo.chainStatus.toLowerCase() !== STATUS.ACTIVE || (!chainInfo.substrateInfo && !chainInfo.evmInfo)) {
    return {}
  }

  const providers = chainInfo.providers
  const rpcs = []
  for (const provider in chainInfo.providers) {
    rpcs.push({name: provider, url: providers[provider]})
  }

  if (!chainInfo.providers) {
    return {}
  }
  const chainType = !!chainInfo.substrateInfo ? CHAIN_TYPE.SUBSTRATE : CHAIN_TYPE.EVM

  const errorRpcs = {}
  await Bluebird.each(rpcs, async (rpc) => {
    const status = await _checkHealthRpc(chainType, rpc.url)
    console.log("Done check checkHealthSubstrateRpc", rpc.url, status)
    if (status === STATUS.INACTIVE) {
      errorRpcs[rpc.name] = rpc.url
    }
  }, {concurrency: 10})

  return Object.fromEntries(Object.entries(errorRpcs).sort())
}

export const checkHealthRpc = async () => {
  try {
    const chains = await getChains()
    const errorChain = []
    await Bluebird.map(chains, async (chainInfo) => {
      const errorRpcs = await getErrorRpc(chainInfo)
      console.log('errorRpcs', chainInfo.name, errorRpcs)
      if (!(Object.entries(errorRpcs).length === 0 && errorRpcs.constructor === Object)) {
        errorChain.push({
          slug: chainInfo.slug,
          name: chainInfo.name,
          status: chainInfo.chainStatus,
          errorRpcs,
        })
      }

    }, {concurrency: 20})

    writeFileSync(errorChain.sort((a, b) => (a.slug > b.slug) ? 1 : ((b.slug > a.slug) ? -1 : 0)), './data/chains/error-rpc.json')
  } catch (err) {
    console.log("Export error Rpc error", err)
  }

}

setImmediate(async () => {

  try {

    await checkHealthRpc()
    process.exit()

  } catch (err) {
    console.error(err)
  }
})
