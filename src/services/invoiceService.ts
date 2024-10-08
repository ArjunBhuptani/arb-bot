import axios from 'axios';
import { BigNumber } from '@ethersproject/bignumber';
import { ethers } from 'ethers';
import { AssetBalances, Invoice, ChainConfig } from '../types';
import { mockEverclearContract } from '../tests/mocks/mockEverclearContract';
import { mockBridgeAggregator } from '../tests/mocks/mockBridgeAggregator';
import { logger } from '../utils/logger';
import { getAssetFromTickerHash, getChainAsset } from './assetService';
import { hasEnoughBalance } from './balanceService';
import { log } from 'console';

export async function fetchOldInvoices(apiUrl: string): Promise<Invoice[]> {
  try {
    const response = await axios.get(`${apiUrl}/invoices`);
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
  const sixHoursInSeconds = 6 * 60 * 60;
  const invoiceTime = parseInt(timestamp);
  const currentTime = Math.floor(Date.now() / 1000);
  logger.info(`Invoice time: ${invoiceTime}, Current time: ${currentTime}`);
  return (currentTime - invoiceTime) > sixHoursInSeconds;
}

export async function processInvoices(invoices: Invoice[], balances: AssetBalances, privateKey: string, chains: Record<string, ChainConfig>, apiUrl: string) {
  for (const invoice of invoices) {
    logger.info(`Processing invoice: ${invoice.intent_id}`);
    
    const { origin, destinations, amount, ticker_hash } = invoice;
    const asset = getAssetFromTickerHash(ticker_hash);
    
    if (!asset) {
      logger.warn(`Unknown asset for ticker hash: ${ticker_hash}`);
      continue;
    }

    // TODO check this for any of the destinations
    if (!hasEnoughBalance(balances, asset, origin, amount)) {
      await fillInvoice(apiUrl, invoice, privateKey);
    } else {
      logger.info(`Insufficient balance. Attempting to rebalance...`);
      const rebalanceSuccessful = await mockBridgeAggregator.rebalanceFunds(balances, asset, origin, amount, privateKey);
      if (rebalanceSuccessful) {
        if (hasEnoughBalance(balances, asset, origin, amount)) {
          await fillInvoice(apiUrl, invoice, privateKey);
        } else {
          logger.warn(`Still insufficient balance after rebalancing. Skipping invoice.`);
        }
      } else {
        logger.warn(`Rebalancing not possible due to insufficient total balance. Skipping invoice.`);
      }
    }
  }
}

export async function fillInvoice(apiUrl: string, invoice: Invoice, privateKey: string): Promise<any> {
  try {
    const wallet = new ethers.Wallet(privateKey);
    const botAddress = await wallet.getAddress();

    logger.info(`Filling invoice with amount: ${invoice.amount} for asset: ${invoice.ticker_hash}`);

    // TODO calculate correct destinations. For now just use origin

    const response = await axios.post(`${apiUrl}/intents`, {
      origin: invoice.destinations[0],
      destinations: [invoice.origin],
      to: botAddress, 
      inputAsset: getChainAsset(getAssetFromTickerHash(invoice.ticker_hash)!, invoice.destinations[0])?.address,
      amount: invoice.amount,
      callData: '',
      maxFee: BigInt(1).toString() // TODO: Calculate maxFee based on invoice amount and network
    }, {
      headers: {
        "Content-Type": "application/json"
      }
    });
    logger.info(`Intent created: ${JSON.stringify(response.data)}`);
    return response.data;
  } catch (error) {
    logger.error('Error creating intent:', error);
    throw error;
  }
}

// ... (keep the rest of the functions from the original file, but update them to use the logger)