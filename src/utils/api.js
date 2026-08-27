// src/utils/api.js

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;
const INTER_REQUEST_DELAY_MS = 1500;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get cached stock data from localStorage if it exists, is less than 1 hour old,
 * and covers the requested startDate if specified.
 */
function getCached(symbol, startDate = null) {
    try {
        const raw = localStorage.getItem(`stock_cache_${symbol}`);
        if (!raw) return null;
        const { data, timestamp } = JSON.parse(raw);
        if (Date.now() - timestamp < CACHE_TTL_MS) {
            if (startDate && data) {
                const dates = Object.keys(data).sort();
                const earliestCached = dates[0];
                const reqDateStr = new Date(startDate).toISOString().split('T')[0];
                if (earliestCached && earliestCached > reqDateStr) {
                    // Cached data does not go back far enough for the requested first buy date
                    localStorage.removeItem(`stock_cache_${symbol}`);
                    return null;
                }
            }
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

async function fetchLiveYahoo(symbol, startDate = null) {
    let period1 = 0;
    if (startDate) {
        const t = new Date(startDate).getTime();
        if (!isNaN(t)) {
            // Start 7 days before first buy to ensure we have a trading day price on or before buy date
            period1 = Math.max(0, Math.floor(t / 1000) - (86400 * 7));
        }
    }
    const period2 = Math.floor(Date.now() / 1000) + 86400;
    const yahooPath = `/v8/finance/chart/${symbol}?period1=${period1}&period2=${period2}&interval=1d&events=history&includeAdjustedClose=true`;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            if (attempt > 0) {
                const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 500;
                console.warn(`Retrying ${symbol} (attempt ${attempt + 1}/${MAX_RETRIES + 1}) after ${Math.round(delay)}ms...`);
                await sleep(delay);
            } else {
                console.log(`Fetching live: ${symbol} [${new Date().toLocaleTimeString()}]`);
            }

            const targetUrl = `https://query1.finance.yahoo.com${yahooPath}`;
            const proxyUrl = `https://stocks-proxy.anirudhkumar.workers.dev/?${encodeURIComponent(targetUrl)}`;

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

export async function fetchStockData(symbol, startDate = null) {
    // 1. Session localStorage cache
    const cached = getCached(symbol, startDate);
    if (cached) return cached;

    // 2. Live CORS fallback for symbols not in the baked set
    const live = await fetchLiveYahoo(symbol, startDate);
    if (live) setCache(symbol, live);
    return live;
}

/**
 * Fetch multiple symbols sequentially with a delay between each request.
 */
export async function fetchStockDataSequential(symbols, existingData = {}, startDates = {}) {
    const results = {};
    for (let i = 0; i < symbols.length; i++) {
        const symbol = symbols[i];
        const startDate = startDates[symbol] || null;

        if (existingData[symbol]) {
            if (startDate) {
                const existingDates = Object.keys(existingData[symbol]).sort();
                const earliestDate = existingDates[0];
                const reqDateStr = new Date(startDate).toISOString().split('T')[0];
                if (earliestDate && earliestDate <= reqDateStr) {
                    continue;
                }
            } else {
                continue;
            }
        }

        const data = await fetchStockData(symbol, startDate);
        if (data) results[symbol] = data;

        // Delay only when the next symbol will need a live fetch
        const nextSymbol = symbols[i + 1];
        if (i < symbols.length - 1 && (!existingData[nextSymbol] || !getCached(nextSymbol, startDates[nextSymbol]))) {
            await sleep(INTER_REQUEST_DELAY_MS);
        }
    }
    return results;
}
