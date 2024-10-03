import 'dotenv/config';
import axios from 'axios';
import { createHash } from 'crypto';
import { ethers } from 'ethers';
import { BigNumber } from '@ethersproject/bignumber';
import addresses from './addresses.json';
import { NetworkType, getNetworkConfig, ChainConfig } from './networkConfig';
import { mockBridgeAggregator } from './mockBridgeAggregator';
import { mockEverclearContract } from './mockEverclearContract';

const privateKey = process.env.PRIVATE_KEY;
const apiUrl = process.env.API_URL;
const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)"
  ];

const networkType: NetworkType = (process.env.NETWORK_TYPE as NetworkType) || 'mainnet';
const chains = getNetworkConfig(networkType);

console.log("Arbitrage Bot Initialized");

// Update the fetchOldInvoices function
async function fetchOldInvoices(apiUrl: string): Promise<any[]> {
  try {
    const response = await axios.get(apiUrl);
    const data = response.data;

    // Filter invoices based on the timestamp only
    const oldInvoices = data.invoices.filter((invoice: any) => {
      return isOlderThanSixHours(invoice.hub_invoice_enqueued_timestamp);
    });

    return oldInvoices;
  } catch (error) {
    console.error('Error fetching invoices:', error);
    throw error;
  }
}

// Check if an invoice is more than 6 hours old
function isOlderThanSixHours(timestamp: string): boolean {
    const sixHoursInMilliseconds = 6 * 60 * 60 * 1000;
    const invoiceTime = new Date(parseInt(timestamp)).getTime();
    const currentTime = Date.now();
    
    return (currentTime - invoiceTime) > sixHoursInMilliseconds;
}

// Define an interface for chainAssets
interface ChainAsset {
  address: string;
  decimals: number;
}

// Define a type for the addresses.assets structure
type AssetAddresses = {
  [asset: string]: {
    [networkType: string]: {
      [chainId: string]: ChainAsset
    }
  }
};

// Assert the type of addresses.assets
const assetAddresses = addresses.assets as AssetAddresses;

// Update the checkBalances function
async function checkBalances(privateKey: string, asset: string) {
  const balances: { [chain: string]: string } = {};

  for (const [chainId, chainConfig] of Object.entries(chains)) {
    try {
      const chainAssets = assetAddresses[asset][networkType][chainId as keyof typeof assetAddresses[typeof asset][typeof networkType]];
      if (!chainAssets) {
        console.log(`No ${asset} information for chain ${chainId} on ${networkType}`);
        continue;
      }

      const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);
      const wallet = new ethers.Wallet(privateKey, provider);
      const tokenContract = new ethers.Contract(chainAssets.address, ERC20_ABI, provider);

      // Fetch the balance
      const balance = BigNumber.from(await tokenContract.balanceOf(wallet.address));
      const formattedBalance = ethers.formatUnits(balance.toString(), chainAssets.decimals);

      balances[chainId] = formattedBalance;
      console.log(`Balance on chain ${chainId}: ${formattedBalance} ${asset}`);
    } catch (error) {
      console.error(`Error fetching balance on chain ${chainId}:`, error);
    }
  }
  
  return balances;
}

// Update the main function
async function main() {
  console.log("Arbitrage Bot Initialized");

  const privateKey = process.env.PRIVATE_KEY || '';
  const networkType = process.env.NETWORK_TYPE as NetworkType || 'mainnet';
  
  const apiUrl = networkType === 'mainnet' 
    ? process.env.API_URL_MAINNET 
    : process.env.API_URL_TESTNET;

  if (!apiUrl) {
    throw new Error(`API URL for ${networkType} is not set in the environment variables.`);
  }

  console.log(`Using ${networkType} network`);
  console.log(`API URL: ${apiUrl}`);

  // Step 1: Get current balances
  const assetsToCheck = Object.keys(addresses.assets);
  const allBalances = await getAllBalances(privateKey, assetsToCheck);
  console.log("Current balances:", allBalances);

  // Step 2: Fetch old invoices
  const oldInvoices = await fetchOldInvoices(apiUrl);
  console.log("Invoices older than 6 hours:", oldInvoices);

  // Step 3 & 4: Process invoices
  await processInvoices(oldInvoices, allBalances, privateKey);
}

// Add this type definition after the existing interface and type definitions
type AssetBalances = {
  [asset: string]: {
    [chain: string]: string
  }
};

// Update the getAllBalances function
async function getAllBalances(privateKey: string, assets: string[]): Promise<AssetBalances> {
  const allBalances: AssetBalances = {};

  for (const asset of assets) {
    console.log(`Checking balances for ${asset}...`);
    allBalances[asset] = await checkBalances(privateKey, asset);
  }

  return allBalances;
}

// Update the processInvoices function signature
async function processInvoices(invoices: any[], balances: AssetBalances, privateKey: string) {
  for (const invoice of invoices) {
    console.log(`Processing invoice: ${invoice.intent_id}`);
    
    const { origin, destinations, amount, ticker_hash } = invoice;
    const asset = getAssetFromTickerHash(ticker_hash);
    
    if (!asset) {
      console.log(`Unknown asset for ticker hash: ${ticker_hash}`);
      continue;
    }

    // Check if we have sufficient balance on the origin chain
    if (hasEnoughBalance(balances, asset, origin, amount)) {
      await fillInvoice(invoice, privateKey);
    } else {
      console.log(`Insufficient balance. Attempting to rebalance...`);
      const rebalanceSuccessful = await rebalanceFunds(balances, asset, origin, amount, privateKey);
      if (rebalanceSuccessful) {
        // After rebalancing, try to fill the invoice again
        if (hasEnoughBalance(balances, asset, origin, amount)) {
          await fillInvoice(invoice, privateKey);
        } else {
          console.log(`Still insufficient balance after rebalancing. Skipping invoice.`);
        }
      } else {
        console.log(`Rebalancing not possible due to insufficient total balance. Skipping invoice.`);
      }
    }
  }
}

// Helper function to get asset from ticker hash (mock implementation)
function getAssetFromTickerHash(tickerHash: string): string | null {
  // In a real implementation, you would have a mapping of ticker hashes to assets
  // For now, we'll just return 'USDC' as an example
  return 'USDC';
}

// Helper function to check if there's enough balance
function hasEnoughBalance(balances: AssetBalances, asset: string, chain: string, amount: string): boolean {
  const balance = balances[asset]?.[chain] || '0';
  try {
    // Convert the balance to wei (assuming 18 decimal places)
    const balanceWei = BigNumber.from(ethers.parseUnits(balance, 18));
    const amountWei = BigNumber.from(amount);
    return balanceWei.gte(amountWei);
  } catch (error) {
    console.warn(`Error comparing balance for ${asset} on chain ${chain}: ${error}`);
    return false;
  }
}

// Function to fill an invoice (mock implementation)
async function fillInvoice(invoice: any, privateKey: string) {
  console.log(`Filling invoice: ${invoice.intent_id}`);
  // Here you would interact with the Everclear contract
  // For now, we'll use a mock function
  await mockEverclearContract.fillInvoice(invoice, privateKey);
}

// Function to rebalance funds
async function rebalanceFunds(balances: AssetBalances, asset: string, targetChain: string, requiredAmount: string, privateKey: string): Promise<boolean> {
  console.log(`Rebalancing funds for ${asset} to chain ${targetChain}`);
  
  try {
    // Check if there's enough total balance across all chains
    const totalBalance = Object.values(balances[asset]).reduce(
      (sum, balance) => {
        try {
          // Convert the balance to a BigNumber
          const balanceBN = BigNumber.from(ethers.parseUnits(balance, 18));
          return sum.add(balanceBN);
        } catch (error) {
          console.warn(`Invalid balance value: ${balance}. Treating as zero.`);
          return sum;
        }
      },
      BigNumber.from(0)
    );

    console.log(`Total balance: ${totalBalance.toString()}`);

    const requiredBN = BigNumber.from(requiredAmount);
    console.log(`Required amount: ${requiredBN.toString()}`);

    if (totalBalance.lt(requiredBN)) {
      console.log(`Insufficient total balance across all chains. Required: ${requiredAmount}, Available: ${totalBalance.toString()}`);
      return false;
    }

    // Find a chain with sufficient balance
    const sourceChain = findChainWithSufficientBalance(balances, asset, requiredAmount);
    
    if (sourceChain) {
      console.log(`Found sufficient balance on chain ${sourceChain}. Bridging to ${targetChain}...`);
      await mockBridgeAggregator.bridge(asset, sourceChain, targetChain, requiredAmount, privateKey);
      return true;
    } else {
      console.log(`No single chain has sufficient balance. Attempting to aggregate funds...`);
      // Implement logic to aggregate funds from multiple chains
      // This could involve multiple bridge transactions
      // For now, we'll just return false to indicate rebalancing wasn't possible
      return false;
    }
  } catch (error) {
    console.error('Error during rebalancing:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack trace:', error.stack);
    }
    return false;
  }
}

// Helper function to find a chain with sufficient balance
function findChainWithSufficientBalance(balances: AssetBalances, asset: string, requiredAmount: string): string | null {
  const requiredBN = BigNumber.from(requiredAmount);
  for (const [chain, balance] of Object.entries(balances[asset])) {
    try {
      const balanceBN = BigNumber.from(ethers.parseUnits(balance, 18));
      if (balanceBN.gte(requiredBN)) {
        return chain;
      }
    } catch (error) {
      console.warn(`Invalid balance for chain ${chain}: ${balance}. Skipping.`);
    }
  }
  return null;
}

// Call the main function
main().catch(console.error);