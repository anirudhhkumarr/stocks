import { useState, useEffect, useCallback, useMemo } from 'react';
import MFToolbar from './MFToolbar';
import MFSummary from './MFSummary';
import MFPerformanceChart from './MFPerformanceChart';
import MFPortfolioGrowthChart from './MFPortfolioGrowthChart';
import MFAllocationChart from './MFAllocationChart';
import { fetchStockData } from '../utils/api';
import { FUND_METADATA } from '../utils/mfUtils';

const MFDashboard = () => {
    const [activeMFs, setActiveMFs] = useState(() => {
        try {
            const saved = localStorage.getItem('portfolio_mfs');
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });
    const [mfData, setMfData] = useState({});
    const [usdInr, setUsdInr] = useState({});
    const [range, setRange] = useState('1y');

    useEffect(() => {
        localStorage.setItem('portfolio_mfs', JSON.stringify(activeMFs));
    }, [activeMFs]);

    const handleAddMF = (mf) => {
        setActiveMFs(prev => [...prev, mf]);
    };

    useEffect(() => {
        if (activeMFs.length === 0) return;

        const fetchAll = async () => {
            const newMfData = { ...mfData };
            await Promise.all(activeMFs.map(async (mf) => {
                if (!newMfData[mf.symbol]) {
                    const data = await fetchStockData(mf.symbol);
                    if (data) newMfData[mf.symbol] = data;
                }
            }));

            if (Object.keys(usdInr).length === 0) {
                const rateData = await fetchStockData('INR=X');
                if (rateData) setUsdInr(rateData);
            }

            setMfData(newMfData);
        };

        fetchAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeMFs]);

    // Derived Values
    const getLatestValue = useCallback((symbol, history) => {
        if (!history) return 0;
        const dates = Object.keys(history).sort();
        return history[dates[dates.length - 1]] || 0;
    }, []);

    const latestRate = getLatestValue('INR=X', usdInr) || 84;

    // Filter dates by range
    const allDates = useMemo(() => Object.keys(usdInr).length > 0 ? Object.keys(usdInr).sort() : [], [usdInr]);
    const filteredDates = useMemo(() => {
        if (allDates.length === 0) return [];
        if (range === 'max') return allDates;

        const daysMap = { '1m': 30, '6m': 180, '1y': 365, '2y': 730, '3y': 1095, '5y': 1825 };
        const days = daysMap[range] || 365;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        const cutoffStr = cutoff.toISOString().split('T')[0];

        return allDates.filter(d => d >= cutoffStr);
    }, [allDates, range]);

    // Prepare Performance Data
    const performanceINR = useMemo(() => {
        return allDates.map(date => {
            let v = 0;
            activeMFs.forEach(mf => {
                const hist = mfData[mf.symbol];
                if (hist && hist[date]) v += hist[date] * mf.units;
            });
            return { x: date, y: v };
        }).filter(d => d.y > 0);
    }, [allDates, activeMFs, mfData]);

    const performanceUSD = useMemo(() => {
        return allDates.map(date => {
            let v = 0;
            activeMFs.forEach(mf => {
                const hist = mfData[mf.symbol];
                if (hist && hist[date]) v += hist[date] * mf.units;
            });
            const rate = usdInr[date] || latestRate;
            return { x: date, y: v / rate };
        }).filter(d => d.y > 0);
    }, [allDates, activeMFs, mfData, usdInr, latestRate]);

    // Current Stats Calculation (Reactive to Range)
    const stats = useMemo(() => {
        if (filteredDates.length === 0) return { totalValueINR: 0, gainINR: 0, gainPctINR: 0, totalValueUSD: 0, gainUSD: 0, gainPctUSD: 0 };

        const startDate = filteredDates[0];
        const endDate = filteredDates[filteredDates.length - 1];

        const calculateVal = (date) => {
            let v = 0;
            activeMFs.forEach(mf => {
                const hist = mfData[mf.symbol];
                if (hist && hist[date]) v += hist[date] * mf.units;
            });
            return v;
        };

        const currentINR = calculateVal(endDate);
        const startINR = calculateVal(startDate);
        const gainINR = currentINR - startINR;

        const rateEnd = usdInr[endDate] || latestRate;
        const rateStart = usdInr[startDate] || latestRate;
        const currentUSD = currentINR / rateEnd;
        const startUSD = startINR / rateStart;
        const gainUSD = currentUSD - startUSD;

        return {
            totalValueINR: currentINR,
            gainINR,
            gainPctINR: startINR > 0 ? (gainINR / startINR) * 100 : 0,
            totalValueUSD: currentUSD,
            gainUSD,
            gainPctUSD: startUSD > 0 ? (gainUSD / startUSD) * 100 : 0,
            range
        };
    }, [filteredDates, activeMFs, mfData, usdInr, latestRate, range]);

    // Prepare allocation data
    const allocation = activeMFs.map(mf => {
        const price = getLatestValue(mf.symbol, mfData[mf.symbol]);
        const name = FUND_METADATA.find(f => f.symbol === mf.symbol)?.name || mf.symbol;
        return { name, value: price * mf.units };
    }).filter(d => d.value > 0).sort((a, b) => b.value - a.value);

    if (activeMFs.length === 0) {
        return (
            <div className="empty-state">
                <h2>No Mutual Funds</h2>
                <p>Add your Mutual Funds to see analytics.</p>
                <MFToolbar onAddMF={handleAddMF} />
            </div>
        );
    }

    return (
        <div className="mf-dashboard">
            <MFToolbar onAddMF={handleAddMF} />
            <MFSummary stats={stats} usdRate={latestRate} />

            <div className="charts-grid-full" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(600px, 1fr))', gap: '24px', marginTop: '20px' }}>
                <MFPortfolioGrowthChart inrData={performanceINR} usdData={performanceUSD} range={range} setRange={setRange} />
                <MFPerformanceChart inrData={performanceINR} usdData={performanceUSD} range={range} />
            </div>

            <div className="charts-grid" style={{ marginTop: '20px' }}>
                <MFAllocationChart data={allocation} />
            </div>
        </div>
    );
};

export default MFDashboard;
