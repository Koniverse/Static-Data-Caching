import { VirtualBrowser } from "./lib/VirtualBrowser.mjs";
import { writeJSONFile } from "./lib/utils.mjs";
import oldData from "../data/earning/yield-pools.json" with {type: "json"};

const webRunnerURL = process.env.WEB_RUNNER_URL || 'https://9bb4d86b.swwrc.pages.dev/';

// Pool targets are fetched inside a single page: running all of them at once starves the page's
// event loop (even the per-task timers), so keep a bounded number of them in flight.
const POOL_TARGET_CONCURRENCY = 25;
const POOL_TARGET_TIMEOUT = 60000; // per pool
const POOL_TARGET_BUDGET = 480000; // for the whole phase
const FETCH_TIMEOUT = 900000;

console.log('Fetching data from', webRunnerURL);

const runBrowser = async () => {
  const virtualBrowser = VirtualBrowser.getInstance();

  const page = await virtualBrowser.openPage(webRunnerURL)
  const result = await page.evaluate(async () => {
    try {
      const koniState = await new Promise((resolve) => {
        if (window.SubWalletState) {
          resolve(window.SubWalletState);
        } else {
          const interval = setInterval(() => {
            if (window.SubWalletState) {
              resolve(window.SubWalletState);
              clearInterval(interval);
            }
          }, 1);
        }
      });

      koniState.wakeup(true);

      // Disable online cache only
      koniState.earningService.disableOnlineCacheOnly?.();

      const _STAKING_CHAIN_GROUP = {
        relay: ['polkadot', 'kusama', 'aleph', 'polkadex', 'ternoa', 'alephTest', 'polkadexTest', 'westend', 'kate', 'edgeware', 'creditcoin', 'vara_network', 'goldberg_testnet', 'availTuringTest', 'avail_mainnet', 'vara_testnet', 'dentnet', 'cere', 'paseoTest', 'zkverify', 'zkverify_testnet'],
        assetHub: ['statemine', 'statemint', 'westend_assethub', 'paseo_assethub'],
        para: ['moonbeam', 'moonriver', 'moonbase', 'turing', 'turingStaging', 'bifrost', 'bifrost_testnet', 'calamari_test', 'calamari', 'manta_network', 'polimec'],
        astar: ['astar', 'shiden', 'shibuya'],
        amplitude: ['amplitude', 'amplitude_test', 'pendulum', 'krest_network'], // amplitude and kilt only share some common logic
        nominationPool: ['polkadot', 'kusama', 'westend', 'alephTest', 'aleph', 'kate', 'vara_network', 'goldberg_testnet', 'availTuringTest', 'avail_mainnet', 'vara_testnet', 'cere', 'analog_timechain', 'paseoTest'],
        bifrost: ['bifrost', 'bifrost_testnet'],
        aleph: ['aleph', 'alephTest'], // A0 has distinct tokenomics
        ternoa: ['ternoa'],
        liquidStaking: ['bifrost_dot', 'acala', 'parallel', 'moonbeam'],
        lending: ['interlay'],
        krest_network: ['krest_network'],
        manta: ['manta_network'],
        bittensor: ['bittensor', 'bittensor_testnet'],
        energy: ['energy_web_x_testnet', 'energy_web_x'],
        mythos: ['mythos', 'muse_testnet'],
        tanssi: ['tanssi', 'dancelight']
      };

      const enableChains = Array.from(new Set([
        ...Object.values(_STAKING_CHAIN_GROUP).flat(), // staking chains
        'polkadot_people', 'peopleKusama', // people chains
      ]))

      await koniState.eventService.waitChainReady;
      await koniState.chainService.enableChains(enableChains);
      await koniState.earningService.reloadEarning();

      await new Promise((resolve) => {
        setTimeout(resolve, 5000);
      });

      await koniState.sleep();

      await new Promise((resolve) => {
        setTimeout(resolve, 5000);
      });

      await koniState.wakeup(true);

      await new Promise((resolve) => {
        setTimeout(resolve, 60000);
      });

      return await koniState.earningService.getYieldPoolInfo();
    } catch (e) {
      return false;
    }
  })

  if (!result) {
    throw new Error('Failed to fetch yield pool info');
  }

  const poolInfo = result.reduce((acc, pool) => {
    if (pool.statistic) {
      acc[pool.slug] = pool;
    }

    return acc;
  }, {});

  const finalData = structuredClone(oldData.data);

  for (const [slug, value] of Object.entries(poolInfo)) {
    if (!finalData[slug] || value.lastUpdated > finalData[slug].lastUpdated) {
      const newValue = structuredClone(value);

      if ((newValue.chain === 'bittensor' || newValue.chain === 'bittensor_testnet') && !newValue.metadata.minValidate) { // Avoid Bittensor metadata without minValidate
        newValue.metadata.minValidate = finalData[slug]?.metadata?.minValidate;
      }

      finalData[slug] = newValue;
    }
  }

  // Force remove CAPS___native_staking___ternoa_alphanet
  finalData['CAPS___native_staking___ternoa_alphanet'] && delete finalData['CAPS___native_staking___ternoa_alphanet'];

  // Force remove DOT___native_staking___polkadot, DOT___nomination_pool___polkadot
  finalData['DOT___native_staking___polkadot'] && delete finalData['DOT___native_staking___polkadot'];
  finalData['DOT___nomination_pool___polkadot'] && delete finalData['DOT___nomination_pool___polkadot'];

  const updateDate = new Date();

  await writeJSONFile('earning/yield-pools.json', {
    lastUpdated: updateDate.getTime(),
    lastUpdatedTimestamp: updateDate.toISOString(),
    data: finalData
  });

  const data = await page.evaluate(async (concurrency, taskTimeout, budget) => {
    const koniState = window.SubWalletState;
    const poolInfos = await koniState.earningService.getYieldPoolInfo();

    const deadline = Date.now() + budget;
    const results = [];
    let cursor = 0;

    const runWorker = async () => {
      while (cursor < poolInfos.length) {
        const index = cursor++;
        const pool = poolInfos[index];
        const remaining = deadline - Date.now();

        if (remaining <= 0) { // Out of budget, give up on the rest
          results[index] = [pool.slug, []];

          continue;
        }

        const timeoutPromise = new Promise((resolve) => {
          setTimeout(() => {
            resolve([]);
          }, Math.min(taskTimeout, remaining));
        });

        const promise = (async () => {
          try {
            return await koniState.earningService.getPoolTargets(pool.slug)
          } catch (e) {
            console.error(e);

            return [];
          }
        })();

        results[index] = [pool.slug, await Promise.race([promise, timeoutPromise])];
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, poolInfos.length) }, runWorker);

    await Promise.all(workers);

    return results;
  }, POOL_TARGET_CONCURRENCY, POOL_TARGET_TIMEOUT, POOL_TARGET_BUDGET);

  console.log()

  data.forEach(([slug, targets]) => {

    // Force remove DOT___native_staking___polkadot, DOT___nomination_pool___polkadot
    if (slug === 'DOT___native_staking___polkadot' || slug === 'DOT___nomination_pool___polkadot') {
      return;
    }

    if (targets.length > 0) {
      writeJSONFile(`earning/targets/${slug}.json`, targets);
    }
  });

  await virtualBrowser.close();
};

export const fetchEarning = async () => {
  let errTimeout;

  try {
    // Run browser
    const browserPromise = runBrowser();

    // The timeout below can win the race, so keep this rejection handled either way
    browserPromise.catch(() => undefined);

    await Promise.race([
      browserPromise,
      new Promise((_, reject) => {
        errTimeout = setTimeout(() => {
          reject(new Error(`Failed to fetch data: timed out after ${FETCH_TIMEOUT}ms`));
        }, FETCH_TIMEOUT);
      })
    ]);

    // Wait for 1 second
    await new Promise((resolve) => {
      setTimeout(resolve, 1000);
    });
  } catch (error) {
    console.log("Fetch earning error", error)

    // runBrowser() only closes the browser on its happy path
    await VirtualBrowser.getInstance().close().catch(() => undefined);
  } finally {
    clearTimeout(errTimeout);
  }
};
