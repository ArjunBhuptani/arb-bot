export type NetworkType = 'mainnet' | 'testnet';

export type Asset = 'USDC' | 'USDT' | 'WETH';

export interface ChainConfig {
  rpcUrl: string;
}

export interface ChainAsset {
  decimals: number;
  address: string;
}

export type AssetAddresses = {
  assets: {
    [asset: string]: AssetData;
  }
};

export type AssetData = {
  tickerHash: string;
  [chainId: string]: ChainAsset | string;
};

export type AssetBalances = {
  [asset: string]: {
    [chain: string]: string
  }
};

export interface Invoice {
  intent_id: string;
  origin: string;
  destinations: string[];
  amount: string;
  ticker_hash: string;
  hub_invoice_enqueued_timestamp: string;
}