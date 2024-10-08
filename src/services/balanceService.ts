import { ethers } from 'ethers';
import { BigNumber } from '@ethersproject/bignumber';
import { AssetBalances, ChainConfig, NetworkType, ChainAsset, Asset, ProtocolAddresses } from '../types';
import { getAssetAddresses } from '../config/addresses';
import { logger } from '../utils/logger';
import { getChainAsset } from './assetService';
import { normalizeToEighteenDecimals } from './assetService';

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

export async function getAvailableDeposits(protocolAddresses: ProtocolAddresses, assets: Asset[], chains: Record<string, ChainConfig>) {
    const availableDeposits: AssetBalances = {};

    for (const asset of assets) {
      logger.info(`Checking deposits for ${asset}...`);
      availableDeposits[asset] = await checkDeposits(protocolAddresses, asset, chains);
    }

    return availableDeposits;
  }

export async function checkDeposits(protocolAddresses: ProtocolAddresses, asset: Asset, chains: Record<string, ChainConfig>) {
  const availableDeposits: { [chain: string]: string } = {};

  for (const [chainId, chainConfig] of Object.entries(chains)) {
    try {
      const chainAssets = getChainAsset(asset, chainId);
      if (!chainAssets) {
        logger.info(`No ${asset} information for chain ${chainId}`);
        continue;
      }

      const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);

      if (typeof chainAssets.address === 'string') {
        const tokenContract = new ethers.Contract(chainAssets.address, ERC20_ABI, provider);
        const balance = BigNumber.from(await tokenContract.balanceOf(protocolAddresses.spoke[chainId]));
        
        // Normalize the balance to 18 decimals
        const normalizedBalance = normalizeToEighteenDecimals(balance, asset, chainId);
        
        availableDeposits[chainId] = normalizedBalance.toString();
        logger.info(`Normalized balance on chain ${chainId}: ${normalizedBalance.toString()} ${asset}`);
      } else {
        throw new Error('Invalid address: expected string');
      }
    } catch (error) {
      logger.error(`Error fetching balance on chain ${chainId}:`, error);
    }
  }
  
  return availableDeposits;
}

export async function checkBalances(privateKey: string, asset: Asset, chains: Record<string, ChainConfig>) {
  const balances: { [chain: string]: string } = {};

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
        
        // Normalize the balance to 18 decimals
        const normalizedBalance = normalizeToEighteenDecimals(balance, asset, chainId);

        balances[chainId] = normalizedBalance.toString();
        logger.info(`Normalized balance on chain ${chainId}: ${normalizedBalance.toString()} ${asset}`);
      } else {
        throw new Error('Invalid address: expected string');
      }
    } catch (error) {
      logger.error(`Error fetching balance on chain ${chainId}:`, error);
    }
  }
  
  return balances;
}

export function hasEnoughBalance(balances: AssetBalances, asset: string, chain: string, amount: string): boolean {
  try {
    const balance = balances[asset]?.[chain];
    
    if (balance === undefined || balance === null) {
      logger.warn(`No balance found for ${asset} on chain ${chain}`);
      return false;
    }

    logger.info(`amount: ${amount}`);
    // Convert the balance string to a BigNumber, handling decimal points
    const balanceBN = BigNumber.from(ethers.parseUnits(balance, 18));
    const preNormalizedAmountBN = BigNumber.from(ethers.parseUnits(amount, 18));
    const amountBN = normalizeToEighteenDecimals(preNormalizedAmountBN, asset as Asset, chain);

    logger.info(`preNormalizedAmountBN: ${preNormalizedAmountBN.toString()}`);
    logger.info(`Checking balance for ${asset} on chain ${chain}`);
    logger.info(`Balance: ${balanceBN.toString()}, Required: ${amountBN.toString()}`);

    return balanceBN.gte(amountBN);
  } catch (error) {
    logger.error(`Error checking balance: ${error}`);
    return false;
  }
}