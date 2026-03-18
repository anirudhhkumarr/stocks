// src/utils/api.js

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;
const INTER_REQUEST_DELAY_MS = 1500;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get cached stock data from localStorage if it exists and is less than 1 hour old.
 */
function getCached(symbol) {
    try {
        const raw = localStorage.getItem(`stock_cache_${symbol}`);
        if (!raw) return null;
        const { data, timestamp } = JSON.parse(raw);
        if (Date.now() - timestamp < CACHE_TTL_MS) {
            console.log(`Cache hit: ${symbol} (${Math.round((Date.now() - timestamp) / 60000)}m old)`);
            return data;
        }
        localStorage.removeItem(`stock_cache_${symbol}`);
    } catch { /* ignore corrupt cache */ }
    return null;
}

function setCache(symbol, data) {
    try {
        localStorage.setItem(`stock_cache_${symbol}`, JSON.stringify({ data, timestamp: Date.now() }));
    } catch { /* ignore quota errors */ }
}

export async function fetchStockData(symbol) {
    // Check cache first
    const cached = getCached(symbol);
    if (cached) return cached;

    // Attempt to use local Vite proxy first (no CORS issues). Fallback to allorigins.
    const yahooPath = `/v8/finance/chart/${symbol}?interval=1d&range=5y&events=history&includeAdjustedClose=true`;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            if (attempt > 0) {
                const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 500;
                console.warn(`Retrying ${symbol} (attempt ${attempt + 1}/${MAX_RETRIES + 1}) after ${Math.round(delay)}ms...`);
                await sleep(delay);
            } else {
                console.log(`Fetching: ${symbol} [${new Date().toLocaleTimeString()}]`);
            }

            const targetUrl = `https://query1.finance.yahoo.com${yahooPath}`;
            const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;

            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error(`Proxy status ${response.status}`);
            
            const json = await response.json();
            const result = json.chart?.result?.[0];
            if (!result) throw new Error('No chart result in response');

            const quotes = result.indicators.quote[0];
            const timestamps = result.timestamp;

            const priceMap = {};
            if (timestamps) {
                timestamps.forEach((ts, i) => {
                    if (quotes.close[i]) {
                        const date = new Date((ts + 43200) * 1000).toISOString().split('T')[0];
                        priceMap[date] = quotes.close[i];
                    }
                });
            }

            if (Object.keys(priceMap).length === 0) throw new Error('Empty price data');

            setCache(symbol, priceMap);
            return priceMap;
        } catch (e) {
            if (attempt === MAX_RETRIES) {
                console.warn(`Failed to fetch ${symbol} after ${MAX_RETRIES + 1} attempts:`, e);
                return null;
            }
        }
    }
    return null;
}

/**
 * Fetch multiple symbols sequentially with a delay between each request.
 */
export async function fetchStockDataSequential(symbols, existingData = {}) {
    const results = {};
    for (let i = 0; i < symbols.length; i++) {
        const symbol = symbols[i];
        if (existingData[symbol]) continue;

        const data = await fetchStockData(symbol);
        if (data) results[symbol] = data;

        // Add delay between requests (but not after the last one, and not if cache hit)
        if (i < symbols.length - 1 && !getCached(symbols[i + 1])) {
            await sleep(INTER_REQUEST_DELAY_MS);
        }
    }
    return results;
}
