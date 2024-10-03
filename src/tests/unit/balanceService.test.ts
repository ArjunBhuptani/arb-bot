import { ethers } from 'ethers';
import { BigNumber } from '@ethersproject/bignumber';
import { getAllBalances, checkBalances, hasEnoughBalance } from '../../services/balanceService';
import { getAssetAddresses } from '../../config/addresses';
import { getChainAsset } from '../../services/assetService';
import { logger } from '../../utils/logger';
import { Asset, ChainConfig, AssetBalances } from '../../types';
// Mock dependencies
jest.mock('ethers');
jest.mock('../../config/addresses');
jest.mock('../../services/assetService');
jest.mock('../../utils/logger');

describe('balanceService', () => {
  const mockPrivateKey = '0x1234567890abcdef';
  const mockAssets: Asset[] = ['WETH', 'USDC', 'USDT'];
  const mockChains: Record<string, ChainConfig> = {
    '1': { rpcUrl: 'https://mainnet.infura.io/v3/YOUR-PROJECT-ID' },
    '137': { rpcUrl: 'https://polygon-rpc.com' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllBalances', () => {
    it('should return balances for all assets', async () => {
      const mockCheckBalances = jest.fn()
        .mockResolvedValueOnce({ '1': '1.5', '137': '2.5' })
        .mockResolvedValueOnce({ '1': '100', '137': '200' });

      (checkBalances as jest.Mock) = mockCheckBalances;

      const result = await getAllBalances(mockPrivateKey, mockAssets, mockChains);

      expect(result).toEqual({
        ETH: { '1': '1.5', '137': '2.5' },
        USDC: { '1': '100', '137': '200' },
        USDT: { '1': '100', '137': '200' },
      });
      expect(mockCheckBalances).toHaveBeenCalledTimes(3);
    });

    it('should handle errors and continue checking other assets', async () => {
      const mockCheckBalances = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ '1': '100', '137': '200' });

      (checkBalances as jest.Mock) = mockCheckBalances;

      const result = await getAllBalances(mockPrivateKey, mockAssets, mockChains);

      expect(result).toEqual({
        USDC: { '1': '100', '137': '200' },
      });
      expect(mockCheckBalances).toHaveBeenCalledTimes(2);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  // Test checkBalances function
  describe('checkBalances', () => {
    it('should return balances for an asset across all chains', async () => {
      (getChainAsset as jest.Mock).mockReturnValue({ address: '0x123', decimals: 18 });
      (ethers.JsonRpcProvider as jest.Mock).mockReturnValue({});
      (ethers.Wallet as unknown as jest.Mock).mockReturnValue({ address: '0xwallet' });
      (ethers.Contract as jest.Mock).mockReturnValue({
        balanceOf: jest.fn().mockResolvedValue(BigNumber.from('1000000000000000000')),
      });

      const result = await checkBalances(mockPrivateKey, 'WETH', mockChains);

      expect(result).toEqual({
        '1': '1.0',
        '137': '1.0',
      });
    });

    it('should handle missing chain asset information', async () => {
      (getChainAsset as jest.Mock).mockReturnValueOnce(null).mockReturnValueOnce({ address: '0x123', decimals: 18 });
      (ethers.JsonRpcProvider as jest.Mock).mockReturnValue({});
      (ethers.Wallet as unknown as jest.Mock).mockReturnValue({ address: '0xwallet' });
      (ethers.Contract as jest.Mock).mockReturnValue({
        balanceOf: jest.fn().mockResolvedValue(BigNumber.from('1000000000000000000')),
      });

      const result = await checkBalances(mockPrivateKey, 'WETH', mockChains);

      expect(result).toEqual({
        '137': '1.0',
      });
      expect(logger.info).toHaveBeenCalledWith('No ETH information for chain 1');
    });

    it('should handle provider errors', async () => {
      (getChainAsset as jest.Mock).mockReturnValue({ address: '0x123', decimals: 18 });
      (ethers.JsonRpcProvider as jest.Mock).mockImplementation(() => {
        throw new Error('Provider error');
      });

      const result = await checkBalances(mockPrivateKey, 'WETH', mockChains);

      expect(result).toEqual({});
      expect(logger.error).toHaveBeenCalledTimes(2);
    });
  });

  describe('hasEnoughBalance', () => {
    const mockBalances: AssetBalances = {
      ETH: {
        '1': '1.5',
        '137': '2.5',
      },
    };

    it('should return true when balance is sufficient', () => {
      (getChainAsset as jest.Mock).mockReturnValue({ decimals: 18 });

      const result = hasEnoughBalance(mockBalances, 'WETH', '1', '1.0');

      expect(result).toBe(true);
    });

    it('should return false when balance is insufficient', () => {
      (getChainAsset as jest.Mock).mockReturnValue({ decimals: 18 });

      const result = hasEnoughBalance(mockBalances, 'WETH', '1', '2.0');

      expect(result).toBe(false);
    });

    it('should return false when balance or chain asset info is missing', () => {
      (getChainAsset as jest.Mock).mockReturnValue(null);

      const result = hasEnoughBalance(mockBalances, 'WETH', '999', '1.0');

      expect(result).toBe(false);
    });
  });
});