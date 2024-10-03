import addresses from '../data/addresses.json';
import { NetworkType, ChainAsset, AssetAddresses, AssetData, Asset } from '../types';
import { BigNumber } from '@ethersproject/bignumber';

const assetMap: Record<Asset, AssetData> = addresses.assets as Record<Asset, AssetData>;

export function getAssetFromTickerHash(tickerHash: string): Asset | null {
  for (const [asset, data] of Object.entries(assetMap)) {
    if (data.tickerHash.toLowerCase() === tickerHash.toLowerCase()) {
      return asset as Asset;
    }
  }
  return null;
}

export function getTickerHashFromAsset(asset: Asset): string | null {
  const assetData = assetMap[asset];
  return assetData ? assetData.tickerHash : null;
}

export function getAssetData(asset: Asset): AssetData | null {
  return assetMap[asset] || null;
}

export function getAllAssets(): Asset[] {
  return Object.keys(assetMap) as Asset[];
}

export function getAssetAddresses(): AssetAddresses {
  return {
    assets: assetMap
  };
}

export function getChainAsset(asset: Asset, chainId: string): ChainAsset | null {
  const assetData = getAssetData(asset);
  if (!assetData) return null;

    const chainAsset = assetData[chainId];
    if (typeof chainAsset === 'object' && chainAsset !== null) {
        return chainAsset as ChainAsset;
    }

  return null;
}