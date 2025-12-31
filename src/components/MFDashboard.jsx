import { useState, useEffect, useCallback } from 'react';
import MFToolbar from './MFToolbar';
import MFSummary from './MFSummary';
import MFPerformanceChart from './MFPerformanceChart';
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

    let totalValueINR = 0;
    activeMFs.forEach(mf => {
        const price = getLatestValue(mf.symbol, mfData[mf.symbol]);
        totalValueINR += price * mf.units;
    });

    const totalValueUSD = totalValueINR / latestRate;

    // Stats for summary (Mocking start value as 90% of current for now)
    const stats = {
        totalValueINR,
        gainINR: totalValueINR * 0.1,
        gainPctINR: 10,
        totalValueUSD,
        gainUSD: totalValueUSD * 0.1,
        gainPctUSD: 10
    };

    // Prepare allocation data
    const allocation = activeMFs.map(mf => {
        const price = getLatestValue(mf.symbol, mfData[mf.symbol]);
        const name = FUND_METADATA.find(f => f.symbol === mf.symbol)?.name || mf.symbol;
        return { name, value: price * mf.units };
    }).filter(d => d.value > 0).sort((a, b) => b.value - a.value);

    // Prepare performance data INR
    const dates = Object.keys(usdInr).length > 0 ? Object.keys(usdInr).sort() : [];
    const performanceINR = dates.map(date => {
        let v = 0;
        activeMFs.forEach(mf => {
            const hist = mfData[mf.symbol];
            if (hist && hist[date]) v += hist[date] * mf.units;
        });
        return { x: date, y: v };
    }).filter(d => d.y > 0);

    const performanceUSD = dates.map(date => {
        let v = 0;
        activeMFs.forEach(mf => {
            const hist = mfData[mf.symbol];
            if (hist && hist[date]) v += hist[date] * mf.units;
        });
        const rate = usdInr[date] || latestRate;
        return { x: date, y: v / rate };
    }).filter(d => d.y > 0);

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
            <div className="charts-grid-full" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px', marginTop: '20px' }}>
                <MFPerformanceChart inrData={performanceINR} usdData={performanceUSD} />
            </div>
            <div className="charts-grid" style={{ marginTop: '20px' }}>
                <MFAllocationChart data={allocation} />
            </div>
        </div>
    );
};

export default MFDashboard;
