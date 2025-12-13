// utils.js - Shared Utility Functions

window.charts = {}; // Store chart instances locally per page load

async function fetchStockData(symbol) {
    // Use AllOrigins proxy to bypass CORS for Yahoo Finance
    const cacheWindow = Math.floor(Date.now() / (10 * 60 * 1000));
    // Inject cache buster directly into Target URL to force Proxy re-fetch
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
        timestamps.forEach((ts, i) => {
            if (quotes.close[i]) {
                // Add 12h (43200s) to center the time to noon UTC, preventing date shift 
                // for markets where midnight local time is previous day UTC.
                const date = new Date((ts + 43200) * 1000).toISOString().split('T')[0];
                priceMap[date] = quotes.close[i];
            }
        });
        return priceMap;
    } catch (e) {
        console.warn(`Failed to fetch history for ${symbol}:`, e);
        return null;
    }
}

function destroyChart(id) {
    if (window.charts[id]) {
        window.charts[id].destroy();
        delete window.charts[id];
    }
}

function cleanNum(str) {
    if (!str) return "0";
    return str.replace(/[$,%]/g, '');
}

function formatCurrency(num) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Math.round(num));
}

// Add these to window to ensure global access if strictly needed, 
// though importing this script before others is usually enough.
window.fetchStockData = fetchStockData;
window.destroyChart = destroyChart;
window.cleanNum = cleanNum;
window.formatCurrency = formatCurrency;
