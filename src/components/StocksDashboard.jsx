import React, { useState, useEffect, useCallback } from 'react';
import Toolbar from './Toolbar';
import SummaryRibbon from './SummaryRibbon';
import PortfolioChart from './PortfolioChart';
import TaxSimulator from './TaxSimulator';
import LiquidationTable from './LiquidationTable';
import { processPortfolioData } from '../utils/dataProcessor';
import { fetchStockData } from '../utils/api';
import { calculateTotalTax, calculateXIRR } from '../utils/calculations';

const StocksDashboard = () => {
    const [files, setFiles] = useState(() => {
        try {
            const saved = localStorage.getItem('portfolio_files');
            return saved ? JSON.parse(saved) : {};
        } catch (e) { return {}; }
    });
    const [portfolio, setPortfolio] = useState({ lots: [], summary: { totalCost: 0, stocks: {} } });
    const [prices, setPrices] = useState({});
    const [w2Income, setW2Income] = useState(() => parseFloat(localStorage.getItem('w2Income')) || 175000);
    const [targetAmount, setTargetAmount] = useState(() => parseFloat(localStorage.getItem('targetLiquidation')) || 0);
    const [loading, setLoading] = useState(false);
    const [historyData, setHistoryData] = useState([]);
    const [taxSimData, setTaxSimData] = useState([]);

    // Persistence
    useEffect(() => {
        localStorage.setItem('portfolio_files', JSON.stringify(files));
        localStorage.setItem('w2Income', w2Income);
        localStorage.setItem('targetLiquidation', targetAmount);
    }, [files, w2Income, targetAmount]);

    const handleFileUpload = (newFilesList) => {
        const newFilesMap = { ...files };
        let processedCount = 0;

        newFilesList.forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                newFilesMap[file.name] = e.target.result;
                processedCount++;
                if (processedCount === newFilesList.length) {
                    setFiles(newFilesMap);
                }
            };
            reader.onerror = (err) => {
                console.error('Error reading file:', file.name, err);
            };
            reader.readAsText(file);
        });
    };

    const handleFileRemove = (filename) => {
        const newFiles = { ...files };
        delete newFiles[filename];
        setFiles(newFiles);
    };

    // Re-process portfolio when files change
    useEffect(() => {
        const filesData = Object.entries(files).map(([filename, content]) => ({ filename, content }));
        const result = processPortfolioData(filesData);
        setPortfolio(result);
    }, [files]);

    // Fetch prices when portfolio symbols change
    // Use stringified symbols as dependency to avoid infinite loop from object reference changes
    const symbolsKey = Object.keys(portfolio.summary.stocks).sort().join(',');
    useEffect(() => {
        const symbols = symbolsKey.split(',').filter(s => s);
        if (symbols.length === 0) return;

        const fetchAll = async () => {
            setLoading(true);
            const newPrices = {};
            await Promise.all(symbols.map(async (symbol) => {
                if (!prices[symbol]) {
                    const data = await fetchStockData(symbol);
                    if (data) newPrices[symbol] = data;
                }
            }));
            if (Object.keys(newPrices).length > 0) {
                setPrices(prev => ({ ...prev, ...newPrices }));
            }
            setLoading(false);
        };

        fetchAll();
    }, [symbolsKey]);

    // Helper to get latest price for a symbol
    const getLatestPrice = useCallback((symbol) => {
        const history = prices[symbol];
        if (!history) return 0;
        const dates = Object.keys(history).sort();
        return history[dates[dates.length - 1]] || 0;
    }, [prices]);

    // Calculate Derivatives (memoized to prevent infinite loops)
    const activeLots = React.useMemo(() => {
        return portfolio.lots.map(lot => {
            const currentPrice = getLatestPrice(lot.symbol);
            const marketValue = currentPrice * lot.qty;
            const gainLoss = marketValue - lot.costBasis;

            // Holding period
            const openDate = new Date(lot.openDate);
            const today = new Date();
            const diffYears = (today - openDate) / (1000 * 60 * 60 * 24 * 365.25);
            const holdingPeriod = diffYears >= 1 ? 'Long Term' : 'Short Term';

            return { ...lot, marketValue, gainLoss, holdingPeriod };
        });
    }, [portfolio.lots, getLatestPrice]);

    const totalValue = activeLots.reduce((sum, l) => sum + l.marketValue, 0);
    const totalCost = activeLots.reduce((sum, l) => sum + l.costBasis, 0);
    const totalGain = totalValue - totalCost;
    const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

    // Tax Sim Logic - use primitive count as dependency to avoid infinite loop
    const lotsCount = activeLots.length;
    useEffect(() => {
        if (lotsCount === 0 || totalValue === 0) return;

        const baseTax = calculateTotalTax(w2Income, 0);
        const augmentedLots = activeLots.map(lot => {
            const isLongTerm = lot.holdingPeriod === 'Long Term';
            const taxWithLot = calculateTotalTax(w2Income + (isLongTerm ? 0 : lot.gainLoss), isLongTerm ? Math.max(0, lot.gainLoss) : 0);
            const marginalTax = taxWithLot - baseTax;
            return { ...lot, estTax: marginalTax, efficiency: marginalTax / lot.marketValue };
        }).sort((a, b) => a.efficiency - b.efficiency);

        const points = [];
        let cumP = 0, cumT = 0, cumB = 0;
        augmentedLots.forEach(lot => {
            cumP += lot.marketValue;
            cumB += lot.costBasis;
            cumT += lot.estTax;
            points.push({ x: cumP, y: cumT, basis: cumB, lot });
        });
        setTaxSimData(points);
    }, [lotsCount, totalValue, w2Income]);

    // Combined Stats
    const stats = {
        totalValue,
        totalCost,
        totalGain,
        totalGainPct,
        xirr: calculateXIRR(activeLots, totalValue),
        totalTax: taxSimData.length > 0 ? taxSimData[taxSimData.length - 1].y : 0
    };

    const netGain = totalValue - stats.totalTax - totalCost;
    const netGainStats = {
        netGain,
        netGainPct: totalCost > 0 ? (netGain / totalCost) * 100 : 0,
        netXirr: calculateXIRR(activeLots, totalValue - stats.totalTax)
    };

    const planLots = [];
    let running = 0;
    for (let pt of taxSimData) {
        if (running >= targetAmount) break;
        planLots.push(pt.lot);
        running += pt.lot.marketValue;
    }

    // History Data Prep
    const pricesCount = Object.keys(prices).length;
    useEffect(() => {
        if (pricesCount === 0 || lotsCount === 0) return;

        const firstSymbol = Object.keys(prices)[0];
        const dates = Object.keys(prices[firstSymbol] || {}).sort();
        const hist = dates.map(date => {
            let v = 0, c = 0;
            activeLots.forEach(lot => {
                const p = (prices[lot.symbol] && prices[lot.symbol][date]) || getLatestPrice(lot.symbol);
                v += p * lot.qty;
                c += lot.costBasis;
            });
            return { date, value: v, cost: c, netValue: v * 0.85 }; // netValue mock
        });
        setHistoryData(hist);
    }, [pricesCount, lotsCount]);

    return (
        <div className="stocks-dashboard">
            <Toolbar
                w2Income={w2Income}
                setW2Income={setW2Income}
                files={files}
                onFileUpload={handleFileUpload}
                onFileRemove={handleFileRemove}
            />

            <SummaryRibbon stats={stats} netGainStats={netGainStats} />

            <div className="charts-grid" style={{ marginTop: '2rem' }}>
                <PortfolioChart historyData={historyData} />
                <TaxSimulator
                    dataPoints={taxSimData}
                    targetAmount={targetAmount}
                    onTargetChange={setTargetAmount}
                    totalValue={totalValue}
                />
            </div>

            <LiquidationTable lots={planLots} targetAmount={targetAmount} />
        </div>
    );
};

export default StocksDashboard;
