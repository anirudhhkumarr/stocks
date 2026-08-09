/**
 * Fetches Yahoo Finance price histories and writes public/data/prices.json.
 * Personal portfolio CSVs are never read or uploaded — only public market data.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'public', 'data', 'prices.json');

/** Tickers baked into the static site (extend as needed). */
export const DEFAULT_SYMBOLS = [
    // Common US equities / ETFs
    'NVDA',
    'VGT',
    'VOO',
    'VTI',
    'SPY',
    'QQQ',
    // FX for mutual-fund INR conversion
    'INR=X',
    // Yahoo mutual-fund symbols used by MF dashboard
    '0P0000XVJQ.BO',
    '0P0000XW8F.BO',
    '0P0000XVAE.BO',
    '0P0000XW7T.BO',
    '0P0000XW7U.BO',
    '0P0000XVWL.BO',
    '0P0000XVYC.BO',
    '0P0000XVWD.BO',
];

const UA = 'Mozilla/5.0 (compatible; StocksDashboard/1.0; +https://github.com/anirudhhkumarr/stocks)';
const RANGE = '5y';
const INTERVAL = '1d';
const DELAY_MS = 800;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
    return res.json();
}

async function fetchYahoo(symbol) {
    const url =
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
        `?interval=${INTERVAL}&range=${RANGE}&events=history&includeAdjustedClose=true`;
    console.log(`[data] Yahoo ${symbol}`);
    const json = await fetchJson(url);
    const result = json?.chart?.result?.[0];
    if (!result) throw new Error(`Malformed Yahoo response for ${symbol}`);
    const quotes = result.indicators?.quote?.[0];
    const timestamps = result.timestamp || [];
    const priceMap = {};
    timestamps.forEach((ts, i) => {
        const price = quotes?.close?.[i];
        if (price == null) return;
        const date = new Date((ts + 43200) * 1000).toISOString().slice(0, 10);
        priceMap[date] = price;
    });
    if (Object.keys(priceMap).length === 0) throw new Error(`Empty price data for ${symbol}`);
    return priceMap;
}

async function main() {
    const series = {};
    const errors = [];

    for (let i = 0; i < DEFAULT_SYMBOLS.length; i += 1) {
        const symbol = DEFAULT_SYMBOLS[i];
        try {
            series[symbol] = await fetchYahoo(symbol);
            console.log(`  → ${symbol}: ${Object.keys(series[symbol]).length} pts`);
        } catch (e) {
            console.error(`  ✗ ${symbol}: ${e.message}`);
            errors.push(symbol);
        }
        if (i < DEFAULT_SYMBOLS.length - 1) await sleep(DELAY_MS);
    }

    if (Object.keys(series).length === 0) {
        console.error('[data] No series fetched — aborting');
        process.exit(1);
    }

    const payload = {
        generatedAt: new Date().toISOString(),
        range: RANGE,
        interval: INTERVAL,
        series,
        errors,
    };

    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, JSON.stringify(payload));
    const kb = (Buffer.byteLength(JSON.stringify(payload)) / 1024).toFixed(1);
    console.log(`[data] Wrote ${OUT} (${kb} KB)${errors.length ? ` missing: ${errors.join(', ')}` : ''}`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
