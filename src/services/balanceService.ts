import { ethers } from 'ethers';
import { BigNumber } from '@ethersproject/bignumber';
import { AssetBalances, ChainConfig, NetworkType, ChainAsset, Asset } from '../types';
import { getAssetAddresses } from '../config/addresses';
import { logger } from '../utils/logger';
import { getChainAsset } from './assetService';

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)"
];

export async function getAllBalances(privateKey: string, assets: Asset[], chains: Record<string, ChainConfig>): Promise<AssetBalances> {
  const allBalances: AssetBalances = {};

  for (const asset of assets) {
    logger.info(`Checking balances for ${asset}...`);
    allBalances[asset] = await checkBalances(privateKey, asset, chains);
  }

  return allBalances;
}

export async function checkBalances(privateKey: string, asset: Asset, chains: Record<string, ChainConfig>) {
  const balances: { [chain: string]: string } = {};
  const assetAddresses = getAssetAddresses();

  for (const [chainId, chainConfig] of Object.entries(chains)) {
    try {
      const chainAssets = getChainAsset(asset, chainId);
      if (!chainAssets) {
        logger.info(`No ${asset} information for chain ${chainId}`);
        continue;
      }

      const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);
      const wallet = new ethers.Wallet(privateKey, provider);

      if (typeof chainAssets.address === 'string') {
        const tokenContract = new ethers.Contract(chainAssets.address, ERC20_ABI, provider);
        const balance = BigNumber.from(await tokenContract.balanceOf(wallet.address));
        const formattedBalance = ethers.formatUnits(balance.toString(), Number(chainAssets.decimals));

        balances[chainId] = formattedBalance;
        logger.info(`Balance on chain ${chainId}: ${formattedBalance} ${asset}`);
      } else {
        throw new Error('Invalid address: expected string');
      }
    } catch (error) {
      logger.error(`Error fetching balance on chain ${chainId}:`, error);
    }
  }
  
  return balances;
}


export function hasEnoughBalance(balances: AssetBalances, asset: Asset, chain: string, amount: string): boolean {
    const balance = balances[asset]?.[chain];
    if (!balance) {
      return false;
    }
  
    const chainAsset = getChainAsset(asset, chain) || getChainAsset(asset, chain);
    if (!chainAsset) {
      return false;
    }
  
    const balanceBN = BigNumber.from(balance);
    const amountBN = BigNumber.from(amount);
  
    // Convert amount to the asset's decimal places
    const adjustedAmount = amountBN.mul(BigNumber.from(10).pow(chainAsset.decimals));
  
    return balanceBN.gte(adjustedAmount);
  }