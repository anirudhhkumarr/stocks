import { describe, it, expect } from 'vitest';
import {
    calculateRebalancePlan,
    calculateTotalTax,
    calculateLotTax,
    getTaxRates,
    calculateXIRR,
    formatCurrency,
    formatPercent
} from './calculations.js';

// Seeded PRNG (Mulberry32) for reproducible random portfolio generation
function createRng(seed) {
    let s = seed >>> 0;
    return function () {
        s = (s + 0x6D2B79F5) >>> 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Generate a random test portfolio using a deterministic random seed
function generateRandomPortfolio(seed = 42, options = {}) {
    const rng = createRng(seed);
    const availableSymbols = ['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'AMZN', 'META', 'TSLA'];
    const numSymbols = options.numSymbols || 4;
    const selectedSymbols = availableSymbols.slice(0, numSymbols);

    const activeLots = [];
    const prices = {};

    selectedSymbols.forEach((symbol, symIdx) => {
        const currentPrice = 50 + rng() * 450; // $50 to $500
        prices[symbol] = {
            '2026-01-01': currentPrice * (0.8 + rng() * 0.4),
            '2026-08-27': currentPrice
        };

        const lotCount = options.lotsPerSymbol || Math.floor(1 + rng() * 4); // 1 to 4 lots
        for (let i = 0; i < lotCount; i++) {
            const isLongTerm = rng() > 0.4;
            const buyPrice = currentPrice * (0.6 + rng() * 0.8); // 40% gain to 20% loss
            const qty = Math.round((5 + rng() * 45) * 100) / 100; // 5 to 50 shares
            const marketValue = qty * currentPrice;
            const costBasis = qty * buyPrice;
            const gainLoss = marketValue - costBasis;

            const openDate = isLongTerm
                ? `2024-0${Math.floor(1 + rng() * 9)}-15`
                : `2026-0${Math.floor(1 + rng() * 7)}-10`;

            activeLots.push({
                id: `${symbol}-${symIdx}-${i}`,
                symbol,
                qty,
                price: buyPrice,
                costBasis,
                marketValue,
                gainLoss,
                gainLossPct: costBasis > 0 ? (gainLoss / costBasis) * 100 : 0,
                openDate,
                holdingPeriod: isLongTerm ? 'Long Term' : 'Short Term',
                isLongTerm
            });
        }
    });

    const totalValue = activeLots.reduce((sum, l) => sum + l.marketValue, 0);

    return {
        seed,
        symbols: selectedSymbols,
        activeLots,
        prices,
        totalValue
    };
}

describe('calculations.js - Portfolio Rebalancing & Taxes with Seeded Random Portfolios', () => {
    describe('Reset to Current Allocation', () => {
        // Test across 10 distinct random seeds
        const seeds = [101, 202, 303, 404, 505, 606, 707, 808, 909, 12345];

        seeds.forEach(seed => {
            it(`should generate 0 sales, 0 purchases, and 0 tax when target equals current allocation (seed: ${seed})`, () => {
                const portfolio = generateRandomPortfolio(seed);
                const { activeLots, symbols, totalValue, prices } = portfolio;

                // Compute current allocation
                const currentAllocation = {};
                symbols.forEach(s => {
                    const symVal = activeLots.filter(l => l.symbol === s).reduce((sum, l) => sum + l.marketValue, 0);
                    currentAllocation[s] = (symVal / totalValue) * 100;
                });
                currentAllocation['CASH'] = 0;

                const plan = calculateRebalancePlan(activeLots, currentAllocation, prices, 250000);

                expect(plan.lotsToSell).toHaveLength(0);
                expect(plan.stocksToBuy).toHaveLength(0);
                expect(plan.totalSellProceeds).toBe(0);
                expect(plan.totalEstTax).toBe(0);
                expect(plan.isBalanced).toBe(true);
            });
        });
    });

    describe('Locked Dollar Amounts', () => {
        const seeds = [42, 777, 9999, 54321];

        seeds.forEach(seed => {
            it(`should never generate sales or purchases for a dollar-locked stock at current value (seed: ${seed})`, () => {
                const portfolio = generateRandomPortfolio(seed, { numSymbols: 4 });
                const { activeLots, symbols, totalValue, prices } = portfolio;

                const lockedSymbol = symbols[0];
                const otherSymbol = symbols[1];
                const underSymbol = symbols[2];

                const lockedCurrentVal = activeLots
                    .filter(l => l.symbol === lockedSymbol)
                    .reduce((sum, l) => sum + l.marketValue, 0);

                // Set locked modes & amounts
                const lockedModes = {
                    [lockedSymbol]: 'dollar'
                };
                const lockedDollarAmounts = {
                    [lockedSymbol]: lockedCurrentVal
                };

                // Intentionally make otherSymbol overweight and underSymbol underweight
                const targetAllocations = {
                    [lockedSymbol]: (lockedCurrentVal / totalValue) * 100,
                    [otherSymbol]: 0, // sell all otherSymbol
                    [underSymbol]: 80, // buy underSymbol
                    [symbols[3]]: 10,
                    CASH: 10
                };

                const plan = calculateRebalancePlan(
                    activeLots,
                    targetAllocations,
                    prices,
                    250000,
                    lockedModes,
                    lockedDollarAmounts
                );

                // Check that lockedSymbol has NO sales and NO buys
                const lockedSells = plan.lotsToSell.filter(l => l.symbol === lockedSymbol);
                const lockedBuys = plan.stocksToBuy.filter(b => b.symbol === lockedSymbol);

                expect(lockedSells).toHaveLength(0);
                expect(lockedBuys).toHaveLength(0);

                // Check that other overweight symbol DID generate sales
                const otherSells = plan.lotsToSell.filter(l => l.symbol === otherSymbol);
                expect(otherSells.length).toBeGreaterThan(0);
            });
        });
    });

    describe('Tax & XIRR Calculation Logic', () => {
        it('should correctly calculate federal + CA tax on capital gains', () => {
            const w2 = 250000;
            const rates = getTaxRates(w2);
            expect(rates.fedRate).toBeGreaterThan(0.2);
            expect(rates.caRate).toBeGreaterThan(0.08);

            const ltTax = calculateLotTax(10000, true, rates);
            const stTax = calculateLotTax(10000, false, rates);

            // Short-term tax must be higher than long-term tax
            expect(stTax).toBeGreaterThan(ltTax);

            // Total tax calculation with W2 and netting
            const totalTax = calculateTotalTax(w2, 5000, 10000);
            expect(totalTax).toBeGreaterThan(calculateTotalTax(w2, 0, 0));
        });

        it('should compute valid XIRR on random investment streams', () => {
            const portfolio = generateRandomPortfolio(888);
            const xirr = calculateXIRR(portfolio.activeLots, portfolio.totalValue);
            expect(xirr).not.toBeNull();
            expect(typeof xirr).toBe('number');
            expect(xirr).toBeGreaterThan(-1);
        });

        it('should format currency and percentages cleanly', () => {
            expect(formatCurrency(1234.56)).toBe('$1,235');
            expect(formatCurrency(0)).toBe('$0');
            expect(formatPercent(12.3456)).toBe('12.35%');
        });
    });
});
