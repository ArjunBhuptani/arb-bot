import { BigNumber } from '@ethersproject/bignumber';
import { ethers } from 'ethers';
import { AssetBalances, Invoice, ChainConfig } from '../types';
import { mockEverclearContract } from '../mocks/mockEverclearContract';
import { mockBridgeAggregator } from '../mocks/mockBridgeAggregator';
import { logger } from '../utils/logger';
import { getAssetFromTickerHash } from './assetService';
import { hasEnoughBalance } from './balanceService';

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