import { describe, it, expect } from 'vitest';
import * as d3 from 'd3';

// Helper function implementing the TradeBubbleChart grouping logic
function prepareTradeBubbleData(lots, selectedSymbols, isYearlyTicks) {
    let base = lots;
    if (selectedSymbols) {
        base = base.filter(l => selectedSymbols.has(l.symbol));
    }

    if (isYearlyTicks) {
        // Group lots by (symbol, year) so each stock has its own aggregated bubble per year
        const grouped = d3.group(
            base,
            d => d.symbol,
            d => new Date(d.openDate).getFullYear()
        );

        const result = [];
        grouped.forEach((yearsMap, symbol) => {
            yearsMap.forEach((items, year) => {
                const totalCost = d3.sum(items, d => d.costBasis);
                const totalValue = d3.sum(items, d => d.marketValue);
                const totalQty = d3.sum(items, d => d.qty);

                // Cost-weighted average buy date (fallback to share-weighted or mean date if costBasis is 0)
                const rawTime = totalCost > 0
                    ? d3.sum(items, d => new Date(d.openDate).getTime() * d.costBasis) / totalCost
                    : totalQty > 0
                        ? d3.sum(items, d => new Date(d.openDate).getTime() * d.qty) / totalQty
                        : d3.mean(items, d => new Date(d.openDate).getTime());

                const weightedTime = Math.round(rawTime);

                result.push({
                    symbol,
                    year: Number(year),
                    costBasis: totalCost,
                    marketValue: totalValue,
                    gainLoss: totalValue - totalCost,
                    openDate: new Date(weightedTime),
                    qty: totalQty,
                    isGrouped: true,
                    tradeCount: items.length,
                    id: `${symbol}-${year}`
                });
            });
        });

        return result;
    }

    return base.map((l, i) => ({
        ...l,
        id: `lot-${i}`,
        openDate: new Date(l.openDate)
    }));
}

describe('TradeBubbleChart - Data Grouping Logic', () => {
    const mockLots = [
        { symbol: 'AAPL', qty: 10, costBasis: 1500, marketValue: 2000, openDate: '2021-03-15' },
        { symbol: 'AAPL', qty: 5, costBasis: 800, marketValue: 1000, openDate: '2021-08-20' },
        { symbol: 'AAPL', qty: 8, costBasis: 1400, marketValue: 1600, openDate: '2022-01-10' },
        { symbol: 'NVDA', qty: 20, costBasis: 2000, marketValue: 10000, openDate: '2021-06-01' },
        { symbol: 'MSFT', qty: 15, costBasis: 3000, marketValue: 4500, openDate: '2022-05-12' },
        { symbol: 'MSFT', qty: 10, costBasis: 2200, marketValue: 3000, openDate: '2022-09-18' }
    ];

    it('should return individual lots when isYearlyTicks is false', () => {
        const data = prepareTradeBubbleData(mockLots, null, false);
        expect(data).toHaveLength(6);
        expect(data[0].id).toBe('lot-0');
        expect(data[0].symbol).toBe('AAPL');
        expect(data[0].costBasis).toBe(1500);
    });

    it('should group lots per stock per year when isYearlyTicks is true', () => {
        const data = prepareTradeBubbleData(mockLots, null, true);

        // Expected groups:
        // AAPL-2021 (2 trades: 15 shares, cost: 2300, value: 3000)
        // AAPL-2022 (1 trade: 8 shares, cost: 1400, value: 1600)
        // NVDA-2021 (1 trade: 20 shares, cost: 2000, value: 10000)
        // MSFT-2022 (2 trades: 25 shares, cost: 5200, value: 7500)
        expect(data).toHaveLength(4);

        const aapl2021 = data.find(d => d.symbol === 'AAPL' && d.year === 2021);
        expect(aapl2021).toBeDefined();
        expect(aapl2021.tradeCount).toBe(2);
        expect(aapl2021.qty).toBe(15);
        expect(aapl2021.costBasis).toBe(2300);
        expect(aapl2021.marketValue).toBe(3000);
        expect(aapl2021.gainLoss).toBe(700);
        expect(aapl2021.isGrouped).toBe(true);

        // Verify dollar-weighted average buy date
        const t1 = new Date('2021-03-15').getTime();
        const t2 = new Date('2021-08-20').getTime();
        const expectedTime = Math.round((1500 * t1 + 800 * t2) / 2300);
        expect(aapl2021.openDate.getTime()).toBe(expectedTime);

        const nvda2021 = data.find(d => d.symbol === 'NVDA' && d.year === 2021);
        expect(nvda2021).toBeDefined();
        expect(nvda2021.symbol).toBe('NVDA');
        expect(nvda2021.tradeCount).toBe(1);
        expect(nvda2021.qty).toBe(20);

        const msft2022 = data.find(d => d.symbol === 'MSFT' && d.year === 2022);
        expect(msft2022).toBeDefined();
        expect(msft2022.tradeCount).toBe(2);
        expect(msft2022.qty).toBe(25);
        expect(msft2022.costBasis).toBe(5200);
    });

    it('should filter by selectedSymbols when isYearlyTicks is true', () => {
        const selected = new Set(['AAPL']);
        const data = prepareTradeBubbleData(mockLots, selected, true);

        expect(data).toHaveLength(2); // AAPL-2021, AAPL-2022
        expect(data.every(d => d.symbol === 'AAPL')).toBe(true);
    });
});
