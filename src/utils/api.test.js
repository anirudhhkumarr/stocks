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

    it('should fetch live data and merge if cache is older than 1 hour', async () => {
        // Pre-populate cache with data older than 1 hour (but < 1 week)
        const oldData = { '2023-01-01': 100 };
        localStorageStore[`stock_cache_${MOCK_SYMBOL}`] = JSON.stringify({
            data: oldData,
            timestamp: Date.now() - (61 * 60 * 1000) // 61 mins old
        });

        const data = await fetchStockData(MOCK_SYMBOL);
        
        // Fetch SHOULD be called to refresh today's price
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
        
        // Should return merged data preserving historical points
        expect(data).toEqual({ '2023-01-01': 100, [MOCK_DATE]: MOCK_PRICE });
    });

    it('should remove cache and re-fetch completely if older than 1 week', async () => {
        const expiredData = { '2023-01-01': 100 };
        localStorageStore[`stock_cache_${MOCK_SYMBOL}`] = JSON.stringify({
            data: expiredData,
            timestamp: Date.now() - (8 * 24 * 60 * 60 * 1000) // 8 days old (> 1 week)
        });

        const data = await fetchStockData(MOCK_SYMBOL);

        // Fetch SHOULD be called
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
        expect(localStorage.removeItem).toHaveBeenCalledWith(`stock_cache_${MOCK_SYMBOL}`);
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

    it('should fetch history back to first buy date when startDate is specified', async () => {
        const startDate = '2015-06-01';
        await fetchStockData(MOCK_SYMBOL, startDate);

        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
        const fetchUrl = decodeURIComponent(globalThis.fetch.mock.calls[0][0]);
        expect(fetchUrl).toContain('period1=');
        // period1 should be before June 2015 timestamp (approx 1433116800 - margin)
        expect(fetchUrl).toContain('/v8/finance/chart/AAPL?period1=');
    });

    it('should re-fetch if cache does not go back far enough for startDate', async () => {
        // Cache only covers 2023-01-01
        localStorageStore[`stock_cache_${MOCK_SYMBOL}`] = JSON.stringify({
            data: { '2023-01-01': 150 },
            timestamp: Date.now()
        });

        // Request requires history back to 2018-05-10
        const data = await fetchStockData(MOCK_SYMBOL, '2018-05-10');

        // Should invalidate old cache and fetch live
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
        expect(data).toEqual({ [MOCK_DATE]: MOCK_PRICE });
    });
});
