import {VirtualBrowser} from "./lib/VirtualBrowser.mjs";
import {writeJSONFile} from "./lib/utils.mjs";
import oldData from "../data/earning/yield-pools.json" assert {type: "json"};

const webRunnerURL = process.env.WEB_RUNNER_URL || 'https://2830f585.swwrc.pages.dev/';

console.log('Fetching data from', webRunnerURL);

const runBrowser = async () => {
  console.log('whats wrong here', oldData.data['xcDOT___liquid_staking___stellaswap'])
  const virtualBrowser = VirtualBrowser.getInstance();
  const page = await virtualBrowser.openPage(webRunnerURL)
  console.log('page', page)
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

      // Disable online cache only
      koniState.earningService.disableOnlineCacheOnly && koniState.earningService.disableOnlineCacheOnly();

      await koniState.eventService.waitChainReady;
      await koniState.chainService.enableChains(['mythos', 'muse_testnet', 'analog_timechain', 'cere', 'bittensor', 'bittensor_testnet', 'polkadot', 'kusama', 'aleph', 'polkadex', 'ternoa', 'alephTest', 'polkadexTest', 'westend', 'kate', 'edgeware', 'creditcoin', 'vara_network', 'goldberg_testnet', 'moonbeam', 'moonriver', 'moonbase', 'turing', 'turingStaging', 'bifrost', 'bifrost_testnet', 'calamari_test', 'calamari', 'manta_network', 'astar', 'shiden', 'shibuya', 'amplitude', 'amplitude_test', 'kilt', 'kilt_peregrine', 'pendulum', 'bifrost_dot', 'acala', 'parallel', 'interlay', 'krest_network', 'polimec', 'availTuringTest', 'avail_mainnet', 'dentnet']);

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

  const finalData = {
    ...oldData.data,
    ...poolInfo
  }

  // Force remove CAPS___native_staking___ternoa_alphanet
  finalData['CAPS___native_staking___ternoa_alphanet'] && delete finalData['CAPS___native_staking___ternoa_alphanet'];

  const updateDate = new Date();
  console.log('finalData', JSON.stringify(finalData));

  await writeJSONFile('earning/yield-pools.json', {
    lastUpdated: updateDate.getTime(),
    lastUpdatedTimestamp: updateDate.toISOString(),
    data: finalData
  });
  console.log('was here');
  
  const data = await page.evaluate(async () => {
    const koniState = window.SubWalletState;
    const poolInfos = await koniState.earningService.getYieldPoolInfo();

    const promiseList = poolInfos.map((pool) => {
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => {
          resolve([]);
        }, 60000);
      });

      const promise = (async () => {
        try {
          return await koniState.earningService.getPoolTargets(pool.slug)
        } catch (e) {
          console.error(e);

          return [];
        }
      })();

      return Promise.race([promise, timeoutPromise]).then((rs) => [pool.slug, rs]);
    });

    return await Promise.all(promiseList);
  });

  data.forEach(([slug, targets]) => {
    if (targets.length > 0) {
      writeJSONFile(`earning/targets/${slug}.json`, targets);
    }
  });

  await virtualBrowser.close();
};

export const fetchEarning = async () => {
  try {
    const errTimeout = setTimeout(() => {
      throw new Error('Failed to fetch data');
    }, 180000);

    // Run browser
    await runBrowser();

    // Wait for 1 second
    await new Promise((resolve) => {
      setTimeout(resolve, 1000);
    });

    clearTimeout(errTimeout);
  } catch (error) {
    console.log("Fetch earning error", error)
  }
};
