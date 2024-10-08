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
  logger.debug(`Invoice time: ${invoiceTime}, Current time: ${currentTime}`);
  return (currentTime - invoiceTime) > sixHoursInSeconds;
}

/**
 * Processes a list of invoices by filling them using available balances across chains.
 * 
 * @param invoices Array of invoices to process
 * @param balances Current asset balances
 * @param availableDeposits Available deposits on each chain
 * @param privateKey Private key for signing transactions
 * @param chains Configuration for each chain
 * @param apiUrl API URL for backend interactions
 */
export async function processInvoices(
  invoices: Invoice[],
  balances: AssetBalances,
  availableDeposits: AssetBalances,
  privateKey: string,
  chains: Record<string, ChainConfig>,
  apiUrl: string
) {
  // Sort invoices by oldest first based on hub_invoice_enqueued_timestamp
  const sortedInvoices = invoices.sort((a, b) => {
    const timestampA = parseInt(a.hub_invoice_enqueued_timestamp, 10);
    const timestampB = parseInt(b.hub_invoice_enqueued_timestamp, 10);
    
    if (isNaN(timestampA) || isNaN(timestampB)) {
      logger.warn(`Invalid timestamp found: A: ${a.hub_invoice_enqueued_timestamp}, B: ${b.hub_invoice_enqueued_timestamp}`);
      return 0; // Keep original order if either timestamp is invalid
    }
    
    return timestampA - timestampB;
  });


  for (const invoice of sortedInvoices) {
    logger.info(`Processing invoice: ${invoice.intent_id}`);

    const { origin, destinations, amount, ticker_hash } = invoice;
    
    const asset = getAssetFromTickerHash(ticker_hash);

    if (!asset) {
      logger.warn(`Unknown asset for ticker hash: ${ticker_hash}`);
      continue;
    }

    // Flag to check if invoice has been filled
    let invoiceFilled = false;

    // Iterate through each destination chain of the invoice
    for (const invoiceDestination of destinations) {
      // Check if there's enough balance on this destination chain to fill the invoice
      const hasBalance = hasEnoughBalance(balances, asset, invoiceDestination, amount);

      if (!hasBalance) {
        logger.info(`Sufficient balance on chain ${invoiceDestination} for invoice ${invoice.intent_id}`);

        // Find a fill destination chain with sufficient available deposits
        const fillDestination = findOptimalFillDestination(
          availableDeposits,
          asset,
          amount
        );

        if (fillDestination) {
          logger.info(`Selected fill destination chain ${fillDestination} for invoice ${invoice.intent_id}`);

          try {
            await fillInvoice(apiUrl, invoice, privateKey, invoiceDestination, fillDestination);
            logger.info(`Invoice ${invoice.intent_id} filled on chain ${invoiceDestination} to ${fillDestination}`);
            invoiceFilled = true;
            break; // Move to the next invoice after successful fill
          } catch (error) {
            logger.error(`Error filling invoice ${invoice.intent_id} on chain ${invoiceDestination} to ${fillDestination}: ${error}`);
            // Continue to the next destination if filling fails
          }
        } else {
          logger.info(`No suitable fill destination found for invoice ${invoice.intent_id} on chain ${invoiceDestination}`);
        }
      } else {
        logger.info(`Insufficient balance on chain ${invoiceDestination} for invoice ${invoice.intent_id}`);
      }
    }

    if (!invoiceFilled) {
      logger.warn(`Unable to fill invoice ${invoice.intent_id} due to insufficient balances or deposits.`);
    }
  }
}

export async function fillInvoice(apiUrl: string, invoice: Invoice, privateKey: string, invoiceDestination: string, fillDestination: string): Promise<any> {
  try {
    const wallet = new ethers.Wallet(privateKey);
    const botAddress = await wallet.getAddress();

    logger.info(`Filling invoice with amount: ${invoice.amount} for asset: ${invoice.ticker_hash} on chain: ${invoice.destinations[0]} going to ${invoice.origin}`);

    const response = await axios.post(`${apiUrl}/intents`, {
      origin: invoiceDestination,
      destinations: [fillDestination],
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

/**
 * Finds the optimal fill destination chain based on available deposits and cost considerations.
 * 
 * @param availableDeposits Available deposits on each chain
 * @param asset Asset type to check deposits for
 * @param amount Required amount to fill the invoice
 * @returns Chain ID of the optimal fill destination or null if none found
 */
function findOptimalFillDestination(
  availableDeposits: AssetBalances,
  asset: string,
  amount: string
): string | null {
  logger.info(`Finding optimal fill destination for asset: ${asset}, amount: ${amount}`);
  logger.debug(`Available deposits: ${JSON.stringify(availableDeposits[asset], null, 2)}`);

  const nonEthereumChains = Object.keys(availableDeposits[asset] || {}).filter(
    (chainId) => chainId !== '1' // Use string comparison instead of parseInt
  );
  logger.debug(`Non-Ethereum chains: ${JSON.stringify(nonEthereumChains)}`);

  // Sort chains by availability (descending) to prioritize chains with more deposits
  const sortedChains = nonEthereumChains.sort((a, b) => {
    // Convert decimal strings to BigInt by removing decimal point and trailing zeros
    const depositA = BigNumber.from(availableDeposits[asset][a]);
    const depositB = BigNumber.from(availableDeposits[asset][b]);
    logger.debug(`Comparing deposits: Chain ${a}: ${depositA}, Chain ${b}: ${depositB}`);
    return Number(depositB.gte(depositA)); 
  });

  logger.debug(`Sorted chains: ${JSON.stringify(sortedChains)}`);

  const requiredAmount = BigNumber.from(amount);

  for (const chainId of sortedChains) {
    const availableAmount = BigNumber.from(availableDeposits[asset][chainId]);
    logger.debug(`Checking chain ${chainId}, available: ${availableAmount}, required: ${requiredAmount}`);

    if (availableAmount.gte(requiredAmount)) {
      logger.info(`Suitable fill destination found: Chain ${chainId}`);
      return chainId;
    }
  }

  // If no non-Ethereum chains are suitable, consider Ethereum as a fallback
  if (
    availableDeposits[asset]['1'] &&
    BigNumber.from(availableDeposits[asset]['1']).gte(requiredAmount) 
  ) {
    logger.info(`Using Ethereum (Chain 1) as fallback fill destination`);
    return '1';
  }

  // No suitable fill destination found
  logger.warn(`No suitable fill destination found for asset: ${asset}, amount: ${amount}`);
  return null;
}

// ... (keep the rest of the functions from the original file, but update them to use the logger)