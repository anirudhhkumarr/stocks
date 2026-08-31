// src/utils/sectorData.js

export const VANGUARD_SECTORS = [
    {
        symbol: 'VGT',
        name: 'Information Technology',
        shortName: 'InfoTech',
        category: 'Technology',
        color: '#3b82f6', // Electric Blue
        description: 'Software, semiconductors, hardware, and IT infrastructure leaders.',
        vooCoveragePercent: 32.4, // % of VOO (S&P 500)
        weight: 32.4, // % S&P 500 Market Cap
        marketCap: '$20.8T',
        peRatio: 35.2,
        forwardPe: 28.4,
        dividendYield: 0.65,
        expenseRatio: 0.10,
        topHoldings: ['NVIDIA (NVDA)', 'Apple (AAPL)', 'Microsoft (MSFT)', 'Broadcom (AVGO)', 'AMD']
    },
    {
        symbol: 'VFH',
        name: 'Financials',
        shortName: 'Financials',
        category: 'Value / Cyclical',
        color: '#f59e0b', // Amber / Gold
        description: 'Diversified banks, investment management, insurance, and payment networks.',
        vooCoveragePercent: 13.4,
        weight: 13.4,
        marketCap: '$8.6T',
        peRatio: 17.5,
        forwardPe: 15.2,
        dividendYield: 1.85,
        expenseRatio: 0.10,
        topHoldings: ['Berkshire Hathaway (BRK.B)', 'JPMorgan Chase (JPM)', 'Visa (V)', 'Mastercard (MA)', 'Bank of America (BAC)']
    },
    {
        symbol: 'VHT',
        name: 'Health Care',
        shortName: 'Health Care',
        category: 'Defensive / Growth',
        color: '#10b981', // Emerald Green
        description: 'Pharmaceuticals, biotechnology, healthcare devices, and managed care.',
        vooCoveragePercent: 11.2,
        weight: 11.2,
        marketCap: '$7.2T',
        peRatio: 26.8,
        forwardPe: 19.5,
        dividendYield: 1.45,
        expenseRatio: 0.10,
        topHoldings: ['Eli Lilly (LLY)', 'UnitedHealth (UNH)', 'Johnson & Johnson (JNJ)', 'AbbVie (ABBV)', 'Merck (MRK)']
    },
    {
        symbol: 'VCR',
        name: 'Consumer Discretionary',
        shortName: 'Cons. Discretionary',
        category: 'Growth / Cyclical',
        color: '#ec4899', // Vivid Pink
        description: 'E-commerce, automotive, retail, restaurants, and entertainment.',
        vooCoveragePercent: 10.0,
        weight: 10.0,
        marketCap: '$6.4T',
        peRatio: 29.4,
        forwardPe: 24.1,
        dividendYield: 0.80,
        expenseRatio: 0.10,
        topHoldings: ['Amazon (AMZN)', 'Tesla (TSLA)', 'Home Depot (HD)', "McDonald's (MCD)", 'Nike (NKE)']
    },
    {
        symbol: 'VOX',
        name: 'Communication Services',
        shortName: 'Comm Services',
        category: 'Growth / Media',
        color: '#8b5cf6', // Violet Purple
        description: 'Interactive digital media, social networks, telecom, and streaming platforms.',
        vooCoveragePercent: 9.3,
        weight: 9.3,
        marketCap: '$6.0T',
        peRatio: 24.2,
        forwardPe: 20.1,
        dividendYield: 1.10,
        expenseRatio: 0.10,
        topHoldings: ['Alphabet Class A (GOOGL)', 'Meta Platforms (META)', 'Netflix (NFLX)', 'Disney (DIS)', 'Comcast (CMCSA)']
    },
    {
        symbol: 'VIS',
        name: 'Industrials',
        shortName: 'Industrials',
        category: 'Cyclical',
        color: '#06b6d4', // Cyan
        description: 'Aerospace & defense, industrial machinery, freight transportation, and electricals.',
        vooCoveragePercent: 8.3,
        weight: 8.3,
        marketCap: '$5.3T',
        peRatio: 24.0,
        forwardPe: 21.2,
        dividendYield: 1.35,
        expenseRatio: 0.10,
        topHoldings: ['GE Aerospace (GE)', 'Caterpillar (CAT)', 'Union Pacific (UNP)', 'RTX Corp (RTX)', 'Honeywell (HON)']
    },
    {
        symbol: 'VDC',
        name: 'Consumer Staples',
        shortName: 'Cons. Staples',
        category: 'Defensive',
        color: '#84cc16', // Lime Green
        description: 'Food & beverage manufacturing, household essentials, and discount hypermarkets.',
        vooCoveragePercent: 5.4,
        weight: 5.4,
        marketCap: '$3.5T',
        peRatio: 22.6,
        forwardPe: 19.8,
        dividendYield: 2.45,
        expenseRatio: 0.10,
        topHoldings: ['Procter & Gamble (PG)', 'Costco Wholesale (COST)', 'Walmart (WMT)', 'Coca-Cola (KO)', 'PepsiCo (PEP)']
    },
    {
        symbol: 'VDE',
        name: 'Energy',
        shortName: 'Energy',
        category: 'Cyclical / Commodity',
        color: '#f97316', // Orange
        description: 'Integrated oil & gas majors, exploration, refining, and energy infrastructure.',
        vooCoveragePercent: 3.4,
        weight: 3.4,
        marketCap: '$2.2T',
        peRatio: 13.2,
        forwardPe: 12.1,
        dividendYield: 3.15,
        expenseRatio: 0.10,
        topHoldings: ['ExxonMobil (XOM)', 'Chevron (CVX)', 'ConocoPhillips (COP)', 'EOG Resources (EOG)', 'Schlumberger (SLB)']
    },
    {
        symbol: 'VPU',
        name: 'Utilities',
        shortName: 'Utilities',
        category: 'Defensive / Income',
        color: '#14b8a6', // Teal
        description: 'Regulated electric utilities, natural gas distribution, and clean energy producers.',
        vooCoveragePercent: 2.3,
        weight: 2.3,
        marketCap: '$1.5T',
        peRatio: 21.5,
        forwardPe: 18.2,
        dividendYield: 3.20,
        expenseRatio: 0.10,
        topHoldings: ['NextEra Energy (NEE)', 'Southern Company (SO)', 'Duke Energy (DUK)', 'Constellation Energy (CEG)']
    },
    {
        symbol: 'VNQ',
        name: 'Real Estate',
        shortName: 'Real Estate',
        category: 'Income / Real Assets',
        color: '#e11d48', // Rose Red
        description: 'Commercial, data center, industrial warehouse, and residential REITs.',
        vooCoveragePercent: 2.2,
        weight: 2.2,
        marketCap: '$1.4T',
        peRatio: 32.5,
        forwardPe: 28.0,
        dividendYield: 3.85,
        expenseRatio: 0.12,
        topHoldings: ['Prologis (PLD)', 'American Tower (AMT)', 'Equinix (EQIX)', 'Welltower (WELL)', 'Public Storage (PSA)']
    },
    {
        symbol: 'VAW',
        name: 'Materials',
        shortName: 'Materials',
        category: 'Cyclical / Commodity',
        color: '#a855f7', // Purple
        description: 'Specialty chemicals, industrial gases, metals & mining, and sustainable packaging.',
        vooCoveragePercent: 2.1,
        weight: 2.1,
        marketCap: '$1.3T',
        peRatio: 22.8,
        forwardPe: 19.4,
        dividendYield: 1.75,
        expenseRatio: 0.10,
        topHoldings: ['Linde (LIN)', 'Sherwin-Williams (SHW)', 'Freeport-McMoRan (FCX)', 'Air Products (APD)', 'Ecolab (ECL)']
    }
];

export const TOTAL_VOO_COVERAGE_PERCENT = 100.0;

export const BENCHMARK_ETF = {
    symbol: 'VOO',
    name: 'S&P 500 Benchmark',
    shortName: 'S&P 500',
    category: 'Broad Market',
    color: '#ffffff', // White
    description: 'Vanguard S&P 500 ETF representing the core US large-cap equity market.',
    weight: 100.0,
    marketCap: '$64.2T',
    peRatio: 27.5,
    forwardPe: 22.0,
    dividendYield: 1.25,
    expenseRatio: 0.03,
    topHoldings: ['Microsoft (MSFT)', 'Apple (AAPL)', 'NVIDIA (NVDA)', 'Amazon (AMZN)', 'Meta (META)']
};

export const ALL_SECTOR_SYMBOLS = [...VANGUARD_SECTORS.map(s => s.symbol), BENCHMARK_ETF.symbol];

/**
 * Historical US S&P 500 Market Cap ($ Trillions) and Sector Weight Breakdown (%) by Year (2015 - 2026)
 * Source: S&P Dow Jones Indices & FactSet historical GICS weights
 */
export const HISTORICAL_SECTOR_MARKET_CAP = [
    {
        year: 2015,
        totalMarketCap: 18.0, // $ Trillions
        weights: { VGT: 20.7, VFH: 16.5, VHT: 15.2, VCR: 12.9, VOX: 2.4, VIS: 10.0, VDC: 10.1, VDE: 6.5, VNQ: 0.0, VPU: 3.0, VAW: 2.8 }
    },
    {
        year: 2016,
        totalMarketCap: 19.5,
        weights: { VGT: 20.8, VFH: 14.8, VHT: 13.6, VCR: 12.0, VOX: 2.7, VIS: 10.3, VDC: 9.4, VDE: 7.6, VNQ: 2.9, VPU: 3.2, VAW: 2.8 }
    },
    {
        year: 2017,
        totalMarketCap: 23.5,
        weights: { VGT: 23.8, VFH: 14.8, VHT: 13.8, VCR: 12.2, VOX: 2.1, VIS: 10.3, VDC: 8.2, VDE: 6.1, VNQ: 2.9, VPU: 2.9, VAW: 3.0 }
    },
    {
        year: 2018,
        totalMarketCap: 21.0,
        weights: { VGT: 20.1, VFH: 13.3, VHT: 15.5, VCR: 10.2, VOX: 9.9, VIS: 9.2, VDC: 7.4, VDE: 5.3, VNQ: 2.7, VPU: 3.3, VAW: 2.7 }
    },
    {
        year: 2019,
        totalMarketCap: 27.0,
        weights: { VGT: 23.2, VFH: 13.0, VHT: 14.2, VCR: 10.2, VOX: 10.4, VIS: 9.1, VDC: 7.2, VDE: 4.4, VNQ: 2.9, VPU: 3.3, VAW: 2.7 }
    },
    {
        year: 2020,
        totalMarketCap: 31.6,
        weights: { VGT: 27.6, VFH: 10.4, VHT: 13.5, VCR: 12.7, VOX: 10.8, VIS: 8.4, VDC: 6.5, VDE: 2.3, VNQ: 2.4, VPU: 2.8, VAW: 2.6 }
    },
    {
        year: 2021,
        totalMarketCap: 40.3,
        weights: { VGT: 29.2, VFH: 10.7, VHT: 13.3, VCR: 12.5, VOX: 10.2, VIS: 7.8, VDC: 5.9, VDE: 2.7, VNQ: 2.6, VPU: 2.5, VAW: 2.6 }
    },
    {
        year: 2022,
        totalMarketCap: 32.1,
        weights: { VGT: 25.7, VFH: 11.7, VHT: 15.8, VCR: 9.8, VOX: 7.3, VIS: 8.7, VDC: 7.2, VDE: 5.2, VNQ: 2.7, VPU: 3.2, VAW: 2.7 }
    },
    {
        year: 2023,
        totalMarketCap: 40.0,
        weights: { VGT: 28.9, VFH: 13.0, VHT: 12.6, VCR: 10.5, VOX: 8.9, VIS: 8.8, VDC: 6.2, VDE: 3.9, VNQ: 2.5, VPU: 2.3, VAW: 2.4 }
    },
    {
        year: 2024,
        totalMarketCap: 48.5,
        weights: { VGT: 31.0, VFH: 13.1, VHT: 11.9, VCR: 10.3, VOX: 9.1, VIS: 8.5, VDC: 5.9, VDE: 3.7, VNQ: 2.3, VPU: 2.3, VAW: 2.2 }
    },
    {
        year: 2025,
        totalMarketCap: 53.0,
        weights: { VGT: 31.8, VFH: 13.3, VHT: 11.6, VCR: 10.1, VOX: 9.2, VIS: 8.4, VDC: 5.6, VDE: 3.5, VNQ: 2.3, VPU: 2.3, VAW: 2.1 }
    },
    {
        year: 2026,
        totalMarketCap: 57.5,
        weights: { VGT: 32.4, VFH: 13.4, VHT: 11.2, VCR: 10.0, VOX: 9.3, VIS: 8.3, VDC: 5.4, VDE: 3.4, VNQ: 2.2, VPU: 2.3, VAW: 2.1 }
    }
];

/**
 * Calculate Trailing Returns (1M, 6M, 1Y, 2Y, 3Y, 5Y, 10Y) from a priceMap
 * @param {Object} priceMap - { "2024-01-02": 120.5, ... }
 * @returns {Object} { trailing: { '1M': ..., '6M': ..., '1Y': ..., '2Y': ..., '3Y': ..., '5Y': ..., '10Y': ... }, cagr: { ... } }
 */
export function calculateTrailingReturns(priceMap) {
    if (!priceMap || Object.keys(priceMap).length === 0) return null;
    const dates = Object.keys(priceMap).sort();
    const latestDate = dates[dates.length - 1];
    const latestPrice = priceMap[latestDate];
    if (!latestPrice || latestPrice <= 0) return null;

    function getPriceDaysAgo(daysAgo) {
        const latestTime = new Date(latestDate).getTime();
        const targetTime = latestTime - daysAgo * 86400 * 1000;
        const targetDateStr = new Date(targetTime).toISOString().split('T')[0];

        // Find nearest date on or before targetDateStr
        for (let i = dates.length - 1; i >= 0; i--) {
            if (dates[i] <= targetDateStr) {
                return priceMap[dates[i]];
            }
        }
        return priceMap[dates[0]];
    }

    const periods = [
        { key: '1M', days: 30, years: 30 / 365.25 },
        { key: '6M', days: 182, years: 182 / 365.25 },
        { key: '1Y', days: 365, years: 1.0 },
        { key: '2Y', days: 730, years: 2.0 },
        { key: '3Y', days: 1095, years: 3.0 },
        { key: '5Y', days: 1825, years: 5.0 },
        { key: '10Y', days: 3650, years: 10.0 }
    ];

    const trailing = {};
    const cagr = {};

    periods.forEach(p => {
        const pastPrice = getPriceDaysAgo(p.days);
        if (pastPrice && pastPrice > 0) {
            const cumReturn = ((latestPrice - pastPrice) / pastPrice) * 100;
            trailing[p.key] = cumReturn;
            if (p.years >= 1.0) {
                cagr[p.key] = (Math.pow(latestPrice / pastPrice, 1 / p.years) - 1) * 100;
            } else {
                cagr[p.key] = cumReturn;
            }
        } else {
            trailing[p.key] = 0;
            cagr[p.key] = 0;
        }
    });

    return { trailing, cagr, latestPrice, latestDate };
}

/**
 * Calculate Calendar Year Returns from a daily priceMap
 * @param {Object} priceMap - { "YYYY-MM-DD": price }
 * @returns {Object} { "2016": 12.2, "2017": 37.1, ... }
 */
export function calculateYearlyReturns(priceMap) {
    if (!priceMap || Object.keys(priceMap).length === 0) return {};
    const dates = Object.keys(priceMap).sort();
    if (dates.length === 0) return {};

    const yearsMap = {};
    dates.forEach(d => {
        const yr = d.split('-')[0];
        if (!yearsMap[yr]) yearsMap[yr] = [];
        yearsMap[yr].push({ date: d, price: priceMap[d] });
    });

    const sortedYears = Object.keys(yearsMap).sort();
    const yearlyReturns = {};

    sortedYears.forEach((yr, idx) => {
        const yrPoints = yearsMap[yr];
        const endPrice = yrPoints[yrPoints.length - 1].price;
        let startPrice;

        if (idx > 0) {
            // Prior year's final close price is the true baseline for this year's return
            const prevYrPoints = yearsMap[sortedYears[idx - 1]];
            startPrice = prevYrPoints[prevYrPoints.length - 1].price;
        } else {
            startPrice = yrPoints[0].price;
        }

        if (startPrice > 0) {
            yearlyReturns[yr] = ((endPrice - startPrice) / startPrice) * 100;
        }
    });

    return yearlyReturns;
}

/**
 * Calculate Normalized Cumulative Growth of $10,000 across history
 */
export function calculateGrowthTrajectory(priceMap, initialAmount = 10000) {
    if (!priceMap) return [];
    const dates = Object.keys(priceMap).sort();
    if (dates.length === 0) return [];

    const basePrice = priceMap[dates[0]];
    if (!basePrice || basePrice <= 0) return [];

    return dates.map(d => ({
        date: d,
        value: (priceMap[d] / basePrice) * initialAmount
    }));
}

/**
 * Fetch sector ETF historical data from Yahoo Finance via the Cloudflare Proxy
 * with tiered cache support:
 * - 1 week (7 days) liveness for older historical data
 * - 1 hour liveness for today's price updates
 */
export async function fetchSectorEtfData(symbol) {
    const CACHE_KEY = `sector_etf_${symbol}`;
    const TODAY_CACHE_TTL = 3600 * 1000; // 1 hour
    const HISTORY_CACHE_TTL = 7 * 24 * 3600 * 1000; // 1 week (7 days)

    let cached = null;
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            const age = Date.now() - parsed.timestamp;
            if (age < TODAY_CACHE_TTL) {
                return parsed.data;
            }
            if (age < HISTORY_CACHE_TTL && parsed.data?.priceMap && Object.keys(parsed.data.priceMap).length > 200) {
                cached = parsed.data;
            }
        }
    } catch { /* ignore */ }

    // If we have valid 1-week historical cache, only fetch recent 5 days to refresh today's price
    const range = cached ? '5d' : '12y';
    const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${range}&interval=1d&events=history&includeAdjustedClose=true`;
    const proxyUrl = `https://stocks-proxy.anirudhkumar.workers.dev/?${encodeURIComponent(targetUrl)}`;

    try {
        const res = await fetch(proxyUrl);
        if (!res.ok) throw new Error(`Proxy error ${res.status}`);
        const json = await res.json();
        const result = json.chart?.result?.[0];
        if (!result) throw new Error('No chart data');

        const quotes = result.indicators.quote[0];
        const adjclose = result.indicators.adjclose?.[0]?.adjclose || quotes.close;
        const timestamps = result.timestamp;
        const recentMap = {};

        if (timestamps) {
            timestamps.forEach((ts, i) => {
                const p = adjclose[i] != null ? adjclose[i] : quotes.close[i];
                if (p != null) {
                    const dateStr = new Date((ts + 43200) * 1000).toISOString().split('T')[0];
                    recentMap[dateStr] = p;
                }
            });
        }

        const mergedPriceMap = cached?.priceMap ? { ...cached.priceMap, ...recentMap } : recentMap;
        const data = {
            symbol,
            priceMap: mergedPriceMap,
            meta: result.meta || cached?.meta || {}
        };

        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
        } catch { /* ignore */ }

        return data;
    } catch (err) {
        console.warn(`Failed to fetch sector ETF ${symbol}:`, err);
        return cached || null;
    }
}
