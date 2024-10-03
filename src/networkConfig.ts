export type NetworkType = 'mainnet' | 'testnet';

export interface ChainConfig {
  rpcUrl: string;
}

interface NetworkConfig {
  [chainId: string]: ChainConfig;
}

const mainnetConfig: NetworkConfig = {
  '1': { rpcUrl: process.env.RPC_ETHEREUM || '' },
  '10': { rpcUrl: process.env.RPC_OPTIMISM || '' },
  '56': { rpcUrl: process.env.RPC_BSC || '' },
  '42161': { rpcUrl: process.env.RPC_ARBITRUM || '' },
};

const testnetConfig: NetworkConfig = {
  '11155111': { rpcUrl: process.env.RPC_SEPOLIA || '' },
  '11155420': { rpcUrl: process.env.RPC_OPTIMISM_SEPOLIA || '' },
  '97': { rpcUrl: process.env.RPC_BSC_TESTNET || '' },
  '421614': { rpcUrl: process.env.RPC_ARBITRUM_SEPOLIA || '' },
};

export function getNetworkConfig(networkType: NetworkType): NetworkConfig {
  return networkType === 'mainnet' ? mainnetConfig : testnetConfig;
}