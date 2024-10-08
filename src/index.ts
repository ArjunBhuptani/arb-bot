import 'dotenv/config';
import { NetworkType } from './types';
import { initializeBot } from './bot';
import { logger } from './utils/logger';

const networkType: NetworkType = (process.env.NETWORK_TYPE as NetworkType) || 'mainnet';

async function main() {
  logger.info("Arbitrage Bot Initializing");
  
  const privateKey = process.env.PRIVATE_KEY;
  const apiUrl = networkType === 'mainnet' 
    ? process.env.API_URL_MAINNET 
    : process.env.API_URL_TESTNET;

  if (!privateKey || !apiUrl) {
    throw new Error('Missing required environment variables');
  }

  logger.info(`Initializing bot for ${networkType} network`);
  logger.info(`API URL: ${apiUrl}`);

  await initializeBot(networkType, privateKey, apiUrl);
}

main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});