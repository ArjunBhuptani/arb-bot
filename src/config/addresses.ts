import addresses from '../data/addresses.json';
import { AssetAddresses } from '../types';

export function getAssetAddresses(): AssetAddresses {
  return addresses.assets as unknown as AssetAddresses;
}