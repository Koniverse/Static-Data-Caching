import writeFileSync from "../utils/writeFile.js";
import path from "path";

// validator.json is for clients released before the extension read Bittensor validators from the chain (10-22): they
// still take their positions' validator names from it (rows with root stake), and once listed root's validators from
// it. It used to come from Taostats' `/api/dtao/validator/latest/v1`, which stops on 2026-11-09. It is now built from
// the Bittensor pool targets the earning job has just fetched, themselves read from the chain: root's list and every
// mainnet subnet's. Same schema and 200 rows as before; no third party, no request of its own.

const CACHE_PATH = path.resolve("./data/earning/dtao/validator.json");

const ROOT_SLUG = 'TAO___native_staking___bittensor';
const SUBNET_SLUG = 'TAO___subnet_staking___bittensor__subnet_';
/** Rows kept, the largest stake weight first, as the Taostats request asked */
const LIMIT = 200;
/**
 * Targets carry root weight, root stake × `TaoWeight`; this is `DefaultTaoWeight`, what mainnet reads (10-21). Clients
 * only test `root_stake > 0`, so the exact weight does not matter
 */
const TAO_WEIGHT_PERCENT = 18n;

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

/**
 * The rows, in Taostats' schema, from the mainnet Bittensor pool targets (`[slug, targets]`). A validator's root weight
 * is the same in every list; its alpha comes from root's list, which sums it over every subnet, or else from the
 * subnets listing it. `global_nominators` adds up the per-subnet counts: a coldkey on two subnets counts twice, and no
 * client shows it for Bittensor.
 */
export function buildValidatorRows(poolTargets) {
  const lists = poolTargets.filter(([slug, targets]) => (slug === ROOT_SLUG || slug.startsWith(SUBNET_SLUG)) && targets.length);
  const rootList = lists.find(([slug]) => slug === ROOT_SLUG)?.[1] ?? [];
  const rootAlpha = new Map(rootList.map((target) => [target.address, BigInt(target.otherStake)]));
  const validators = new Map();

  lists.forEach(([slug, targets]) => {
    targets.forEach((target) => {
      const validator = validators.get(target.address) ?? {
        address: target.address,
        name: target.identity && target.identity !== target.address ? target.identity : null,
        rootWeight: BigInt(target.ownStake),
        subnetAlpha: 0n,
        nominators: 0,
        take: Number(target.commission) / 100
      };

      if (slug !== ROOT_SLUG) {
        validator.subnetAlpha += BigInt(target.otherStake);
      }

      validator.nominators += target.nominatorCount || 0;
      validators.set(target.address, validator);
    });
  });

  return [...validators.values()]
    .map(({ address, name, rootWeight, subnetAlpha, nominators, take }) => {
      const alpha = rootAlpha.get(address) ?? subnetAlpha;

      return {
        hotkey: { ss58: address },
        name,
        root_stake: (rootWeight * 100n / TAO_WEIGHT_PERCENT).toString(),
        weighted_root_stake: rootWeight.toString(),
        global_alpha_stake_as_tao: alpha.toString(),
        global_weighted_stake: (rootWeight + alpha).toString(),
        global_nominators: nominators,
        take: String(take)
      };
    })
    .sort((a, b) => (BigInt(b.global_weighted_stake) > BigInt(a.global_weighted_stake) ? 1 : -1))
    .slice(0, LIMIT);
}

/** Writes validator.json from this run's pool targets; keeps the file as it is when the run brought none back */
export async function fetchDtaoValidatorData(poolTargets) {
  const rows = poolTargets ? buildValidatorRows(poolTargets) : [];

  if (!rows.length) {
    console.log('No Bittensor pool targets this run: dtao validator data kept as it is');

    return;
  }

  return saveFile(rows);
}
