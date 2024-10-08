import addresses from '../data/addresses.json';
import { AssetAddresses, ProtocolAddresses } from '../types';

export function getAssetAddresses(): AssetAddresses {
  return addresses.assets as unknown as AssetAddresses;
}

export function getProtocolAddresses(): ProtocolAddresses {
  return addresses.protocol as unknown as ProtocolAddresses;
}