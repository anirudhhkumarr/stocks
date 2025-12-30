// src/utils/api.js

export async function fetchStockData(symbol) {
    // Use AllOrigins proxy to bypass CORS for Yahoo Finance
    const nowEpoch = Math.floor(Date.now() / 1000) + 86400; // Add 1 day buffer
    const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=0&period2=${nowEpoch}&interval=1d&events=history&includeAdjustedClose=true&_cb=${Date.now()}`;
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;

    console.log(`Fetching: ${symbol} [${new Date().toLocaleTimeString()}]`);

    try {
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error('Network response was not ok');
        const json = await response.json();

        const result = json.chart.result[0];
        const quotes = result.indicators.quote[0];
        const timestamps = result.timestamp;

        // Map: DateString (YYYY-MM-DD) -> ClosePrice
        const priceMap = {};
        if (timestamps) {
            timestamps.forEach((ts, i) => {
                if (quotes.close[i]) {
                    const date = new Date((ts + 43200) * 1000).toISOString().split('T')[0];
                    priceMap[date] = quotes.close[i];
                }
            });
        }
        return priceMap;
    } catch (e) {
        console.warn(`Failed to fetch history for ${symbol}:`, e);
        return null;
    }
}
