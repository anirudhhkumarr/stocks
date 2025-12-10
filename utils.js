// utils.js - Shared Utility Functions

window.charts = {}; // Store chart instances locally per page load

async function fetchStockData(symbol) {
    // Use AllOrigins proxy to bypass CORS for Yahoo Finance
    const cacheWindow = Math.floor(Date.now() / (10 * 60 * 1000));
    const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=max&interval=1d&cache_window=${cacheWindow}`;
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;

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
                const date = new Date(ts * 1000).toISOString().split('T')[0];
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
