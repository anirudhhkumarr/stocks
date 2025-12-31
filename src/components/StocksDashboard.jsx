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

    // Calculate Derivatives
    const activeLots = React.useMemo(() => {
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

        // Original Script Logic: Independent Lot Calculation based on W2 Bracket rates
        const FED_BRACKETS = [
            { limit: 23200, rate: 0.10 },
            { limit: 94300, rate: 0.12 },
            { limit: 201050, rate: 0.22 },
            { limit: 383900, rate: 0.24 },
            { limit: 487450, rate: 0.32 },
            { limit: 731200, rate: 0.35 },
            { limit: Infinity, rate: 0.37 }
        ];

        const CA_BRACKETS = [
            { limit: 20824, rate: 0.01 },
            { limit: 49368, rate: 0.02 },
            { limit: 77918, rate: 0.04 },
            { limit: 108162, rate: 0.06 },
            { limit: 136700, rate: 0.08 },
            { limit: 349138, rate: 0.093 },
            { limit: 418962, rate: 0.103 },
            { limit: 698272, rate: 0.113 },
            { limit: 1396542, rate: 0.123 },
            { limit: Infinity, rate: 0.133 }
        ];

        let fedRate = 0;
        for (let b of FED_BRACKETS) {
            if (w2Income < b.limit) {
                fedRate = b.rate;
                break;
            }
        }

        let ltcgRate = 0.15;
        if (w2Income > 583750) ltcgRate = 0.20;
        if (w2Income < 94050) ltcgRate = 0.00;

        let caRate = 0.093;
        for (let b of CA_BRACKETS) {
            if (w2Income < b.limit) {
                caRate = b.rate;
                break;
            }
        }

        const NIIT_THRESHOLD = 250000;
        const NIIT_RATE = 0.038;

        const getLotTax = (lot) => {
            const gain = Math.max(0, lot.gainLoss);
            const isLongTerm = lot.holdingPeriod === 'Long Term';
            let totalRate = caRate;

            if (isLongTerm) {
                totalRate += ltcgRate;
            } else {
                totalRate += fedRate;
            }

            if (w2Income > NIIT_THRESHOLD) totalRate += NIIT_RATE;
            return gain * totalRate;
        };

        const augmentedLots = activeLots.map(lot => {
            const tax = getLotTax(lot);
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
            // Original Logic: (Cumulative Tax / Cumulative Gain) * 100
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

        const firstSymbol = Object.keys(prices)[0];
        let dates = Object.keys(prices[firstSymbol] || {}).sort();

        const earliestDate = activeLots.reduce((min, lot) => {
            return !min || lot.openDate < min ? lot.openDate : min;
        }, null);

        if (earliestDate) {
            dates = dates.filter(d => d >= earliestDate);
        }

        const hist = dates.map(date => {
            let v = 0, c = 0;
            activeLots.forEach(lot => {
                let p = (prices[lot.symbol] && prices[lot.symbol][date]);
                if (p === undefined || p === null) {
                    p = getLatestPrice(lot.symbol);
                }
                if (typeof p !== 'number' || isNaN(p)) p = 0;

                if (lot.openDate <= date) {
                    const cost = lot.costBasis || 0;
                    const qty = lot.qty || 0;
                    if (!isNaN(cost)) c += cost;
                    if (!isNaN(p) && !isNaN(qty)) v += p * qty;
                }
            });
            return { date, value: v || 0, cost: c || 0, netValue: (v || 0) * 0.85 };
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
