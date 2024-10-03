import axios from 'axios';
import { BigNumber } from '@ethersproject/bignumber';
import { ethers } from 'ethers';
import { AssetBalances, Invoice, ChainConfig } from '../types';
import { mockEverclearContract } from '../tests/mocks/mockEverclearContract';
import { mockBridgeAggregator } from '../tests/mocks/mockBridgeAggregator';
import { logger } from '../utils/logger';
import { getAssetFromTickerHash } from './assetService';
import { hasEnoughBalance } from './balanceService';

export async function fetchOldInvoices(apiUrl: string): Promise<Invoice[]> {
  try {
    const response = await axios.get(apiUrl);
    const data = response.data;

    const oldInvoices = data.invoices.filter((invoice: Invoice) => {
      return isOlderThanSixHours(invoice.hub_invoice_enqueued_timestamp);
    });

    return oldInvoices;
  } catch (error) {
    logger.error('Error fetching invoices:', error);
    throw error;
  }
}

function isOlderThanSixHours(timestamp: string): boolean {
  const sixHoursInMilliseconds = 6 * 60 * 60 * 1000;
  const invoiceTime = new Date(parseInt(timestamp)).getTime();
  const currentTime = Date.now();
  return (currentTime - invoiceTime) > sixHoursInMilliseconds;
}

export async function processInvoices(invoices: Invoice[], balances: AssetBalances, privateKey: string, chains: Record<string, ChainConfig>) {
  for (const invoice of invoices) {
    logger.info(`Processing invoice: ${invoice.intent_id}`);
    
    const { origin, destinations, amount, ticker_hash } = invoice;
    const asset = getAssetFromTickerHash(ticker_hash);
    
    if (!asset) {
      logger.warn(`Unknown asset for ticker hash: ${ticker_hash}`);
      continue;
    }

    if (hasEnoughBalance(balances, asset, origin, amount)) {
      await mockEverclearContract.fillInvoice(invoice, privateKey);
    } else {
      logger.info(`Insufficient balance. Attempting to rebalance...`);
      const rebalanceSuccessful = await mockBridgeAggregator.rebalanceFunds(balances, asset, origin, amount, privateKey);
      if (rebalanceSuccessful) {
        if (hasEnoughBalance(balances, asset, origin, amount)) {
          await mockEverclearContract.fillInvoice(invoice, privateKey);
        } else {
          logger.warn(`Still insufficient balance after rebalancing. Skipping invoice.`);
        }
      } else {
        logger.warn(`Rebalancing not possible due to insufficient total balance. Skipping invoice.`);
      }
    }
  }
}

// ... (keep the rest of the functions from the original file, but update them to use the logger)