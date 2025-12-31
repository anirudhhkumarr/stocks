import { useState, useEffect, useCallback, useMemo } from 'react';
import Toolbar from './Toolbar';
import SummaryRibbon from './SummaryRibbon';
import PortfolioChart from './PortfolioChart';
import TaxSimulator from './TaxSimulator';
import LiquidationTable from './LiquidationTable';
import TradeBubbleChart from './TradeBubbleChart';
import { processPortfolioData } from '../utils/dataProcessor';
import { fetchStockData } from '../utils/api';
import { calculateXIRR, getTaxRates, calculateLotTax } from '../utils/calculations';

const StocksDashboard = () => {
    const [files, setFiles] = useState(() => {
        try {
            const saved = localStorage.getItem('portfolio_files');
            return saved ? JSON.parse(saved) : {};
        } catch { return {}; }
    });
    const [portfolio, setPortfolio] = useState({ lots: [], summary: { totalCost: 0, stocks: {} } });
    const [prices, setPrices] = useState({});
    const [w2Income, setW2Income] = useState(() => parseFloat(localStorage.getItem('w2Income')) || 175000);
    const [targetAmount, setTargetAmount] = useState(() => parseFloat(localStorage.getItem('targetLiquidation')) || 0);
    const [historyData, setHistoryData] = useState([]);
    const [taxSimData, setTaxSimData] = useState([]);
    const [range, setRange] = useState('1y');
    const [isLogScale, setIsLogScale] = useState(false);
    const [isYearlyTicks, setIsYearlyTicks] = useState(false);

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
    const symbolsKey = Object.keys(portfolio.summary.stocks).sort().join(',');
    useEffect(() => {
        const symbols = symbolsKey.split(',').filter(s => s);
        if (symbols.length === 0) return;

        const fetchAll = async () => {
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
        };

        fetchAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [symbolsKey]);

    // Helper to get latest price for a symbol
    const getLatestPrice = useCallback((symbol) => {
        const history = prices[symbol];
        if (!history) return 0;
        const dates = Object.keys(history).sort();
        return history[dates[dates.length - 1]] || 0;
    }, [prices]);

    // Calculate Derivatives
    const activeLots = useMemo(() => {
        return portfolio.lots.map(lot => {
            const currentPrice = getLatestPrice(lot.symbol);
            const marketValue = currentPrice * lot.qty;
            const gainLoss = marketValue - lot.costBasis;

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

    // Tax Sim Logic
    const lotsCount = activeLots.length;
    useEffect(() => {
        if (lotsCount === 0 || totalValue === 0) return;

        const rates = getTaxRates(w2Income);

        const augmentedLots = activeLots.map(lot => {
            const tax = calculateLotTax(lot.gainLoss, lot.holdingPeriod === 'Long Term', rates);
            return {
                ...lot,
                estTax: tax,
                efficiency: tax / lot.marketValue
            };
        }).sort((a, b) => a.efficiency - b.efficiency);

        const points = [];
        let cumP = 0, cumB = 0, cumT = 0;
        augmentedLots.forEach(lot => {
            cumP += lot.marketValue;
            cumB += lot.costBasis;
            cumT += lot.estTax;

            const cumGain = cumP - cumB;
            const marginalRate = cumGain > 0 ? (cumT / cumGain) * 100 : 0;

            points.push({
                x: cumP,
                y: cumT,
                basis: cumB,
                lot,
                marginalRate
            });
        });
        setTaxSimData(points);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lotsCount, totalValue, w2Income]);

    // Combined Stats
    const stats = {
        totalValue,
        totalCost,
        totalGain,
        totalGainPct,
        xirr: calculateXIRR(activeLots, totalValue) || 0,
        totalTax: taxSimData.length > 0 ? taxSimData[taxSimData.length - 1].y : 0
    };

    const netGain = totalValue - stats.totalTax - totalCost;
    const netGainStats = {
        netGain,
        netGainPct: totalCost > 0 ? (netGain / totalCost) * 100 : 0,
        netXirr: calculateXIRR(activeLots, totalValue - stats.totalTax) || 0
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

        const rates = getTaxRates(w2Income);
        const firstSymbol = Object.keys(prices)[0];
        let dates = Object.keys(prices[firstSymbol] || {}).sort();

        const earliestDate = activeLots.reduce((min, lot) => {
            return !min || lot.openDate < min ? lot.openDate : min;
        }, null);

        if (earliestDate) {
            dates = dates.filter(d => d >= earliestDate);
        }

        const hist = dates.map(date => {
            let v = 0, c = 0, tax = 0;
            const dateObj = new Date(date);

            activeLots.forEach(lot => {
                let p = (prices[lot.symbol] && prices[lot.symbol][date]);
                if (p === undefined || p === null) {
                    p = getLatestPrice(lot.symbol);
                }
                if (typeof p !== 'number' || isNaN(p)) p = 0;

                if (lot.openDate <= date) {
                    const cost = lot.costBasis || 0;
                    const qty = lot.qty || 0;
                    const lotValue = p * qty;
                    const gain = Math.max(0, lotValue - cost);

                    // Determine if long term at this date
                    const openDate = new Date(lot.openDate);
                    const diffYears = (dateObj - openDate) / (1000 * 60 * 60 * 24 * 365.25);
                    const isLongTerm = diffYears >= 1;

                    // Calculate tax for this lot using the same centralized utility
                    tax += calculateLotTax(gain, isLongTerm, rates);

                    if (!isNaN(cost)) c += cost;
                    if (!isNaN(lotValue)) v += lotValue;
                }
            });
            return { date, value: v || 0, cost: c || 0, netValue: (v || 0) - tax };
        });
        setHistoryData(hist);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pricesCount, lotsCount, w2Income]);

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

            <div className="filter-ribbon card" style={{ marginTop: '1rem', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
                <div className="filter-group" style={{ display: 'flex', gap: '5px' }}>
                    <button className={`filter-btn ${isLogScale ? 'active' : ''}`} onClick={() => setIsLogScale(!isLogScale)}>Log</button>
                    <button className={`filter-btn ${isYearlyTicks ? 'active' : ''}`} onClick={() => setIsYearlyTicks(!isYearlyTicks)}>Yearly</button>
                </div>
                <div className="divider" style={{ width: '1px', height: '20px', background: 'var(--border-color)' }} />
                <div className="filter-group" style={{ display: 'flex', gap: '5px' }}>
                    {['1m', '6m', '1y', '2y', '3y', '5y', 'max'].map(r => (
                        <button key={r} className={`filter-btn ${range === r ? 'active' : ''}`} onClick={() => setRange(r)}>
                            {r.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            <div className="charts-grid" style={{ marginTop: '2rem' }}>
                <PortfolioChart
                    historyData={historyData}
                    range={range}
                    setRange={setRange}
                    isLogScale={isLogScale}
                    isYearlyTicks={isYearlyTicks}
                />
                <TaxSimulator
                    dataPoints={taxSimData}
                    targetAmount={targetAmount}
                    onTargetChange={setTargetAmount}
                    totalValue={totalValue}
                    isLogScale={isLogScale}
                />
            </div>

            <div className="charts-grid-full" style={{ marginTop: '2rem' }}>
                <TradeBubbleChart
                    lots={planLots}
                    allLots={activeLots}
                    prices={prices}
                    range={range}
                    isLogScale={isLogScale}
                    isYearlyTicks={isYearlyTicks}
                />
            </div>

            <LiquidationTable lots={planLots} targetAmount={targetAmount} />
        </div>
    );
};

export default StocksDashboard;
