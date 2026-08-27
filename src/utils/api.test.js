import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { fetchStockData, fetchStockDataSequential } from './api.js';

const MOCK_SYMBOL = 'AAPL';
const MOCK_PRICE = 150.5;
const MOCK_TIMESTAMP = 1600000000;
const MOCK_DATE = new Date((MOCK_TIMESTAMP + 43200) * 1000).toISOString().split('T')[0];

const MOCK_YAHOO_RESPONSE = {
    chart: {
        result: [{
            timestamp: [MOCK_TIMESTAMP],
            indicators: {
                quote: [{
                    close: [MOCK_PRICE]
                }]
            }
        }]
    }
};

describe('api.js', () => {
    let localStorageStore = {};
    
    beforeEach(() => {
        localStorageStore = {};
        
        // Mock localStorage
        vi.stubGlobal('localStorage', {
            getItem: vi.fn((key) => localStorageStore[key] || null),
            setItem: vi.fn((key, value) => {
                localStorageStore[key] = value.toString();
            }),
            removeItem: vi.fn((key) => {
                delete localStorageStore[key];
            }),
        });

        // Mock fetch
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => MOCK_YAHOO_RESPONSE,
        }));
        
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('should fetch live data if cache is empty and store it in localStorage', async () => {
        const data = await fetchStockData(MOCK_SYMBOL);
        
        // Check fetch was called
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
        const fetchUrl = globalThis.fetch.mock.calls[0][0];
        expect(fetchUrl).toContain(MOCK_SYMBOL);
        
        // Check returned data
        expect(data).toEqual({ [MOCK_DATE]: MOCK_PRICE });
        
        // Check localStorage was populated
        expect(localStorage.setItem).toHaveBeenCalledWith(
            `stock_cache_${MOCK_SYMBOL}`, 
            expect.any(String)
        );
        
        const cachedStr = localStorageStore[`stock_cache_${MOCK_SYMBOL}`];
        expect(cachedStr).toBeDefined();
        
        const cachedObj = JSON.parse(cachedStr);
        expect(cachedObj.data).toEqual({ [MOCK_DATE]: MOCK_PRICE });
        expect(cachedObj.timestamp).toBeDefined();
    });

    it('should return cached data if available and less than 1 hour old', async () => {
        // Pre-populate cache
        const mockData = { '2023-01-01': 100 };
        localStorageStore[`stock_cache_${MOCK_SYMBOL}`] = JSON.stringify({
            data: mockData,
            timestamp: Date.now() - (30 * 60 * 1000) // 30 mins old
        });

        const data = await fetchStockData(MOCK_SYMBOL);
        
        // Fetch should NOT be called
        expect(globalThis.fetch).not.toHaveBeenCalled();
        
        // Should return cached data
        expect(data).toEqual(mockData);
    });

    it('should fetch live data if cache is older than 1 hour', async () => {
        // Pre-populate cache with old data
        const oldData = { '2023-01-01': 100 };
        localStorageStore[`stock_cache_${MOCK_SYMBOL}`] = JSON.stringify({
            data: oldData,
            timestamp: Date.now() - (61 * 60 * 1000) // 61 mins old
        });

        const data = await fetchStockData(MOCK_SYMBOL);
        
        // Fetch SHOULD be called
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
        
        // Old cache should be removed before setting new
        expect(localStorage.removeItem).toHaveBeenCalledWith(`stock_cache_${MOCK_SYMBOL}`);
        
        // Should return newly fetched data
        expect(data).toEqual({ [MOCK_DATE]: MOCK_PRICE });
    });

    it('should fetch multiple symbols sequentially and respect cache', async () => {
        // Cache AAPL, but not MSFT
        localStorageStore['stock_cache_AAPL'] = JSON.stringify({
            data: { '2023-01-01': 100 },
            timestamp: Date.now()
        });

        const symbols = ['AAPL', 'MSFT'];
        
        // We need to run timers since fetchStockDataSequential uses sleep()
        const promise = fetchStockDataSequential(symbols);
        await vi.runAllTimersAsync();
        const results = await promise;
        
        // AAPL should come from cache, MSFT from fetch
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
        expect(globalThis.fetch.mock.calls[0][0]).toContain('MSFT');
        
        expect(results).toEqual({
            'AAPL': { '2023-01-01': 100 },
            'MSFT': { [MOCK_DATE]: MOCK_PRICE }
        });
    });
});
