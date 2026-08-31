// src/utils/api.js

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;
const INTER_REQUEST_DELAY_MS = 1500;
const TODAY_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour for today's price updates
const HISTORY_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 1 week for historical data

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get cached stock data from localStorage.
 * - If less than 1 hour old and covers startDate: fresh cache hit.
 * - If between 1 hour and 1 week old: returns cached data with isFresh: false (older history preserved).
 * - If older than 1 week: invalidates cache.
 */
function getCached(symbol, startDate = null) {
    try {
        const raw = localStorage.getItem(`stock_cache_${symbol}`);
        if (!raw) return null;
        const { data, timestamp } = JSON.parse(raw);
        const age = Date.now() - timestamp;

        // Invalidate if older than 1 week (7 days)
        if (age >= HISTORY_CACHE_TTL_MS) {
            localStorage.removeItem(`stock_cache_${symbol}`);
            return null;
        }

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

        if (age < TODAY_CACHE_TTL_MS) {
            console.log(`Cache hit: ${symbol} (${Math.round(age / 60000)}m old)`);
            return { data, isFresh: true };
        }

        return { data, isFresh: false };
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
    const cached = getCached(symbol, startDate);
    if (cached && cached.isFresh) {
        return cached.data;
    }

    // If we have older cached history (< 1 week old), only fetch recent 7 days to refresh today
    let fetchStartDate = startDate;
    if (cached && !cached.isFresh && cached.data) {
        const recentDate = new Date();
        recentDate.setDate(recentDate.getDate() - 7);
        fetchStartDate = recentDate.toISOString().split('T')[0];
    }

    const live = await fetchLiveYahoo(symbol, fetchStartDate);
    if (live) {
        const merged = (cached && cached.data) ? { ...cached.data, ...live } : live;
        setCache(symbol, merged);
        return merged;
    }

    if (cached && cached.data) {
        return cached.data;
    }

    return null;
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
        const nextCached = getCached(nextSymbol, startDates[nextSymbol]);
        if (i < symbols.length - 1 && (!existingData[nextSymbol] || (!nextCached || !nextCached.isFresh))) {
            await sleep(INTER_REQUEST_DELAY_MS);
        }
    }
    return results;
}
