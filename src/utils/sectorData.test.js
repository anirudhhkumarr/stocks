// src/utils/sectorData.test.js
import { describe, it, expect } from 'vitest';
import {
    VANGUARD_SECTORS,
    BENCHMARK_ETF,
    HISTORICAL_SECTOR_MARKET_CAP,
    calculateTrailingReturns,
    calculateYearlyReturns,
    calculateGrowthTrajectory
} from './sectorData';

describe('sectorData utility', () => {
    it('should define all 11 GICS sectors plus S&P 500 benchmark', () => {
        expect(VANGUARD_SECTORS.length).toBe(11);
        const symbols = VANGUARD_SECTORS.map(s => s.symbol);
        expect(symbols).toContain('VGT');
        expect(symbols).toContain('VHT');
        expect(symbols).toContain('VFH');
        expect(symbols).toContain('VCR');
        expect(symbols).toContain('VOX');
        expect(symbols).toContain('VIS');
        expect(symbols).toContain('VDC');
        expect(symbols).toContain('VDE');
        expect(symbols).toContain('VPU');
        expect(symbols).toContain('VNQ');
        expect(symbols).toContain('VAW');
        expect(BENCHMARK_ETF.symbol).toBe('VOO');
    });

    it('should have historical market cap weights by year summing close to 100%', () => {
        expect(HISTORICAL_SECTOR_MARKET_CAP.length).toBeGreaterThan(5);
        HISTORICAL_SECTOR_MARKET_CAP.forEach(item => {
            const sumWeights = Object.values(item.weights).reduce((a, b) => a + b, 0);
            expect(sumWeights).toBeGreaterThan(97);
            expect(sumWeights).toBeLessThan(103);
        });
    });

    it('should accurately calculate trailing returns (1M, 6M, 1Y, 2Y, 3Y, 5Y, 10Y)', () => {
        const dummyPrices = {
            '2014-01-01': 100,
            '2019-01-01': 150,
            '2021-01-01': 200,
            '2022-01-01': 220,
            '2023-01-01': 250,
            '2023-07-01': 280,
            '2023-12-01': 300,
            '2024-01-01': 300 // latest
        };

        const res = calculateTrailingReturns(dummyPrices);
        expect(res).not.toBeNull();
        expect(res.trailing).toBeDefined();
        expect(res.cagr).toBeDefined();
        expect(res.latestPrice).toBe(300);
        expect(res.trailing['1Y']).toBeCloseTo(((300 - 250) / 250) * 100, 1);
        expect(res.trailing['10Y']).toBeCloseTo(((300 - 100) / 100) * 100, 1);
    });

    it('should calculate calendar year returns correctly from daily prices', () => {
        const dummyPrices = {
            '2022-01-03': 100,
            '2022-12-30': 120, // 2022 return: +20%
            '2023-01-03': 122,
            '2023-12-29': 150  // 2023 return vs 2022 end (120): (150-120)/120 = +25%
        };

        const res = calculateYearlyReturns(dummyPrices);
        expect(res['2022']).toBeCloseTo(20.0, 1);
        expect(res['2023']).toBeCloseTo(25.0, 1);
    });

    it('should calculate growth trajectory indexed to $10,000', () => {
        const dummyPrices = {
            '2023-01-01': 100,
            '2023-06-01': 150,
            '2023-12-31': 200
        };

        const traj = calculateGrowthTrajectory(dummyPrices, 10000);
        expect(traj.length).toBe(3);
        expect(traj[0].value).toBe(10000);
        expect(traj[1].value).toBe(15000);
        expect(traj[2].value).toBe(20000);
    });
});
