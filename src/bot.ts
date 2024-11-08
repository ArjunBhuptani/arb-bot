import { NetworkType, AssetBalances, Invoice, Asset } from './types';
import { getNetworkConfig } from './config/networkConfig';
import { getAllBalances, checkBalances, getAvailableDeposits } from './services/balanceService';
import { fetchOldInvoices, processInvoices } from './services/invoiceService';
import { logger } from './utils/logger';
import { getProtocolAddresses } from './config/addresses';

export async function initializeBot(networkType: NetworkType, privateKey: string, apiUrl: string) {
  logger.info(`Initializing bot for ${networkType} network`);
  logger.info(`API URL: ${apiUrl}`);

  const chains = getNetworkConfig(networkType);
  const assetsToCheck = ['USDC', 'USDT', 'WETH', 'TEST'] as Asset[]; // You might want to make this configurable

  // Step 1: Get current balances
  const allBalances = await getAllBalances(privateKey, assetsToCheck, chains);
  logger.info("Current balances:", allBalances);

  // Step 2: Fetch old invoices
  const oldInvoices = await fetchOldInvoices(apiUrl);
  logger.info("Invoices older than 6 hours:", oldInvoices);

  // Step 3: Get available deposits on each chain
  const availableDeposits = await getAvailableDeposits(getProtocolAddresses(), assetsToCheck, chains);
  logger.info("Available deposits:", availableDeposits);

  // Step 3 & 4: Process invoices
  await processInvoices(oldInvoices, allBalances, availableDeposits, privateKey, chains, apiUrl);
}
