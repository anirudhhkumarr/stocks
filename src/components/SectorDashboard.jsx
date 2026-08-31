import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    RefreshCw,
    ShieldCheck,
    DollarSign,
    Flame,
    Award,
    Percent
} from 'lucide-react';
import SectorReturnsMatrix from './SectorReturnsMatrix';
import SectorMarketCapBreakdown from './SectorMarketCapBreakdown';
import SectorFundamentalsTable from './SectorFundamentalsTable';
import SectorYearlyReturnsChart from './SectorYearlyReturnsChart';
import SectorDynamicInsights from './SectorDynamicInsights';
import {
    VANGUARD_SECTORS,
    ALL_SECTOR_SYMBOLS,
    TOTAL_VOO_COVERAGE_PERCENT,
    calculateTrailingReturns,
    calculateYearlyReturns,
    fetchSectorEtfData
} from '../utils/sectorData';

const SectorDashboard = () => {
    const [sectorDataMap, setSectorDataMap] = useState({});
    const [loading, setLoading] = useState(true);
    const [progressCount, setProgressCount] = useState(0);
    const [selectedHorizon, setSelectedHorizon] = useState('1Y');
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Initial fetch of all sector ETFs
    const fetchAllSectors = useCallback(async (forceRefresh = false) => {
        setLoading(true);
        setProgressCount(0);
        const map = {};

        if (forceRefresh) {
            ALL_SECTOR_SYMBOLS.forEach(sym => {
                try {
                    localStorage.removeItem(`sector_etf_${sym}`);
                } catch { /* ignore */ }
            });
        }

        let loaded = 0;
        for (const symbol of ALL_SECTOR_SYMBOLS) {
            try {
                const res = await fetchSectorEtfData(symbol);
                if (res && res.priceMap) {
                    const trailingReturns = calculateTrailingReturns(res.priceMap);
                    const yearlyReturns = calculateYearlyReturns(res.priceMap);

                    map[symbol] = {
                        symbol,
                        priceMap: res.priceMap,
                        meta: res.meta,
                        returns: {
                            ...trailingReturns,
                            yearlyReturns
                        }
                    };
                }
            } catch (err) {
                console.warn(`Error fetching ${symbol}:`, err);
            }
            loaded++;
            setProgressCount(loaded);
        }

        setSectorDataMap(map);
        setLoading(false);
        setIsRefreshing(false);
    }, []);

    useEffect(() => {
        fetchAllSectors();
    }, [fetchAllSectors]);

    const handleRefresh = () => {
        setIsRefreshing(true);
        fetchAllSectors(true);
    };

    // Calculate dynamic highlights
    const highlights = useMemo(() => {
        const sectorList = VANGUARD_SECTORS.map(s => {
            const data = sectorDataMap[s.symbol];
            const return1Y = data?.returns?.trailing?.['1Y'] ?? 0;
            const return5Y = data?.returns?.cagr?.['5Y'] ?? 0;
            return {
                ...s,
                return1Y,
                return5Y
            };
        });

        const sortedBy1Y = [...sectorList].sort((a, b) => b.return1Y - a.return1Y);
        const sortedBy5Y = [...sectorList].sort((a, b) => b.return5Y - a.return5Y);
        const sortedByPe = [...sectorList].sort((a, b) => a.peRatio - b.peRatio);
        const sortedByYield = [...sectorList].sort((a, b) => b.dividendYield - a.dividendYield);

        return {
            top1Y: sortedBy1Y[0] || VANGUARD_SECTORS[0],
            top5Y: sortedBy5Y[0] || VANGUARD_SECTORS[0],
            lowestPe: sortedByPe[0] || VANGUARD_SECTORS[7], // VDE
            highestYield: sortedByYield[0] || VANGUARD_SECTORS[9] // VNQ
        };
    }, [sectorDataMap]);

    return (
        <div className="sector-dashboard-container">
            {/* Top Ribbon / Metrics Header */}
            <div className="sector-header-ribbon">
                <div className="summary-card voo-metric-card">
                    <div className="card-top">
                        <span className="card-title">S&P 500 Coverage</span>
                        <ShieldCheck className="card-icon blue-icon" />
                    </div>
                    <div className="card-val">{TOTAL_VOO_COVERAGE_PERCENT}%</div>
                    <div className="card-desc">11 Vanguard ETFs cover 100% of VOO</div>
                </div>

                <div className="summary-card">
                    <div className="card-top">
                        <span className="card-title">1Y Leader</span>
                        <Award className="card-icon green-icon" />
                    </div>
                    <div className="card-val text-green">
                        {highlights.top1Y.symbol}
                        <span className="val-sub">
                            {highlights.top1Y.return1Y >= 0 ? '+' : ''}
                            {highlights.top1Y.return1Y.toFixed(1)}%
                        </span>
                    </div>
                    <div className="card-desc">{highlights.top1Y.name}</div>
                </div>

                <div className="summary-card">
                    <div className="card-top">
                        <span className="card-title">5Y Leader (CAGR)</span>
                        <Flame className="card-icon orange-icon" />
                    </div>
                    <div className="card-val text-orange">
                        {highlights.top5Y.symbol}
                        <span className="val-sub">
                            +{highlights.top5Y.return5Y.toFixed(1)}%/yr
                        </span>
                    </div>
                    <div className="card-desc">{highlights.top5Y.name}</div>
                </div>

                <div className="summary-card">
                    <div className="card-top">
                        <span className="card-title">Best Value Multiple</span>
                        <DollarSign className="card-icon purple-icon" />
                    </div>
                    <div className="card-val text-purple">
                        {highlights.lowestPe.symbol}
                        <span className="val-sub">{highlights.lowestPe.peRatio}x P/E</span>
                    </div>
                    <div className="card-desc">{highlights.lowestPe.name}</div>
                </div>

                <div className="summary-card">
                    <div className="card-top">
                        <span className="card-title">Highest Dividend Yield</span>
                        <Percent className="card-icon teal-icon" />
                    </div>
                    <div className="card-val text-teal">
                        {highlights.highestYield.symbol}
                        <span className="val-sub">{highlights.highestYield.dividendYield}%</span>
                    </div>
                    <div className="card-desc">{highlights.highestYield.name}</div>
                </div>
            </div>

            {/* Refresh Action Bar */}
            <div className="sector-action-bar">
                <div className="status-label">
                    {loading ? (
                        <div className="loading-status">
                            <span className="spinner" />
                            <span>Loading live ETF data ({progressCount}/{ALL_SECTOR_SYMBOLS.length})...</span>
                        </div>
                    ) : (
                        <div className="ready-status">
                            <span className="status-dot green" />
                            <span>All 11 Vanguard Sector ETFs + VOO Benchmark synced</span>
                        </div>
                    )}
                </div>

                <button
                    className={`btn btn-secondary ${isRefreshing ? 'disabled' : ''}`}
                    onClick={handleRefresh}
                    disabled={isRefreshing || loading}
                >
                    <RefreshCw size={14} className={isRefreshing ? 'spin-icon' : ''} />
                    {isRefreshing ? 'Refreshing Data...' : 'Refresh ETF Data'}
                </button>
            </div>

            {/* Section 1: Multi-Horizon Returns Matrix (1M, 6M, 1Y, 2Y, 3Y, 5Y, 10Y) */}
            <SectorReturnsMatrix
                sectorDataMap={sectorDataMap}
                selectedHorizon={selectedHorizon}
                setSelectedHorizon={setSelectedHorizon}
            />

            {/* Section 2: Real-time Quantitative & Valuation Intelligence */}
            <SectorDynamicInsights
                sectorDataMap={sectorDataMap}
                selectedHorizon={selectedHorizon}
            />

            {/* Section 3: Yearly Sector Returns Multi-Line Chart */}
            <SectorYearlyReturnsChart sectorDataMap={sectorDataMap} />

            {/* Section 4: Market Cap Breakdown by Year (100% Stacked) */}
            <SectorMarketCapBreakdown />

            {/* Section 5: Valuation & Fundamentals (P/E, Yield, Holdings) */}
            <SectorFundamentalsTable sectorDataMap={sectorDataMap} />
        </div>
    );
};

export default SectorDashboard;
