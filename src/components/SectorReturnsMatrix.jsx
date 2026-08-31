import { useState, useMemo } from 'react';
import { TrendingUp, ArrowUpRight, ArrowDownRight, Layers, Percent } from 'lucide-react';
import { VANGUARD_SECTORS, BENCHMARK_ETF } from '../utils/sectorData';

const HORIZONS = [
    { key: '1M', label: '1 Month' },
    { key: '6M', label: '6 Months' },
    { key: '1Y', label: '1 Year' },
    { key: '2Y', label: '2 Years' },
    { key: '3Y', label: '3 Years' },
    { key: '5Y', label: '5 Years' },
    { key: '10Y', label: '10 Years' }
];

const SectorReturnsMatrix = ({ sectorDataMap, selectedHorizon, setSelectedHorizon }) => {
    const [viewMode, setViewMode] = useState('cumulative'); // 'cumulative' | 'cagr'

    const allSectorsWithReturns = useMemo(() => {
        const list = [...VANGUARD_SECTORS, BENCHMARK_ETF];

        return list.map(sector => {
            const data = sectorDataMap[sector.symbol];
            const returns = data?.returns;
            const trailing = returns?.trailing || {};
            const cagr = returns?.cagr || {};

            return {
                ...sector,
                trailing,
                cagr,
                currentReturn: (viewMode === 'cagr' && ['2Y', '3Y', '5Y', '10Y'].includes(selectedHorizon))
                    ? (cagr[selectedHorizon] ?? 0)
                    : (trailing[selectedHorizon] ?? 0)
            };
        });
    }, [sectorDataMap, selectedHorizon, viewMode]);

    // Sorted for the currently selected horizon
    const rankedSectors = useMemo(() => {
        return [...allSectorsWithReturns].sort((a, b) => b.currentReturn - a.currentReturn);
    }, [allSectorsWithReturns]);

    const topPerformer = rankedSectors[0];
    const worstPerformer = rankedSectors[rankedSectors.length - 1];

    const getReturnColor = (val) => {
        if (val == null) return 'inherit';
        if (val > 25) return '#10b981'; // vibrant green
        if (val > 0) return '#34d399'; // soft green
        if (val === 0) return '#9ca3af'; // gray
        if (val > -15) return '#f87171'; // soft red
        return '#ef4444'; // deep red
    };

    const getReturnBg = (val) => {
        if (val == null) return 'transparent';
        if (val > 30) return 'rgba(16, 185, 129, 0.18)';
        if (val > 15) return 'rgba(16, 185, 129, 0.12)';
        if (val > 0) return 'rgba(16, 185, 129, 0.06)';
        if (val === 0) return 'transparent';
        if (val > -15) return 'rgba(239, 68, 68, 0.08)';
        return 'rgba(239, 68, 68, 0.18)';
    };

    return (
        <div className="sector-matrix-card card">
            <div className="matrix-header">
                <div className="matrix-title-area">
                    <div className="badge-icon-title">
                        <TrendingUp className="section-icon" />
                        <div>
                            <h3>US Sector Growth & Multi-Horizon Returns</h3>
                            <p className="subtitle">
                                Performance of all 11 Vanguard Sector ETFs across 1M, 6M, 1Y, 2YR, 3YR, 5YR, and 10YR periods
                            </p>
                        </div>
                    </div>
                </div>

                <div className="matrix-controls">
                    <div className="btn-group-toggle">
                        <button
                            className={`toggle-pill-btn ${viewMode === 'cumulative' ? 'active' : ''}`}
                            onClick={() => setViewMode('cumulative')}
                            title="Total percentage gain over the entire period"
                        >
                            <Percent size={14} />
                            Cumulative Return (%)
                        </button>
                        <button
                            className={`toggle-pill-btn ${viewMode === 'cagr' ? 'active' : ''}`}
                            onClick={() => setViewMode('cagr')}
                            title="Compound Annual Growth Rate (Annualized)"
                        >
                            <Layers size={14} />
                            Annualized (CAGR %)
                        </button>
                    </div>

                    <div className="horizon-pills">
                        {HORIZONS.map(h => (
                            <button
                                key={h.key}
                                className={`horizon-btn ${selectedHorizon === h.key ? 'active' : ''}`}
                                onClick={() => setSelectedHorizon(h.key)}
                            >
                                {h.key}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Quick Leaderboard Cards for Selected Horizon */}
            <div className="horizon-summary-ribbon">
                <div className="leaderboard-card winner">
                    <div className="card-label">
                        <ArrowUpRight size={16} /> Top Performer ({selectedHorizon})
                    </div>
                    <div className="sector-headline">
                        <span className="dot" style={{ backgroundColor: topPerformer?.color }} />
                        <strong>{topPerformer?.shortName} ({topPerformer?.symbol})</strong>
                    </div>
                    <div className="return-stat positive">
                        {topPerformer?.currentReturn >= 0 ? '+' : ''}
                        {topPerformer?.currentReturn?.toFixed(2)}%
                        {viewMode === 'cagr' && ['2Y', '3Y', '5Y', '10Y'].includes(selectedHorizon) ? ' /yr' : ''}
                    </div>
                </div>

                <div className="leaderboard-card benchmark">
                    <div className="card-label">S&P 500 Benchmark (VOO)</div>
                    <div className="sector-headline">
                        <span className="dot" style={{ backgroundColor: BENCHMARK_ETF.color }} />
                        <strong>VOO ({selectedHorizon})</strong>
                    </div>
                    <div className={`return-stat ${(sectorDataMap['VOO']?.returns?.trailing?.[selectedHorizon] ?? 0) >= 0 ? 'positive' : 'negative'}`}>
                        {(sectorDataMap['VOO']?.returns?.trailing?.[selectedHorizon] ?? 0) >= 0 ? '+' : ''}
                        {(viewMode === 'cagr' && ['2Y', '3Y', '5Y', '10Y'].includes(selectedHorizon)
                            ? (sectorDataMap['VOO']?.returns?.cagr?.[selectedHorizon] ?? 0)
                            : (sectorDataMap['VOO']?.returns?.trailing?.[selectedHorizon] ?? 0)
                        ).toFixed(2)}%
                    </div>
                </div>

                <div className="leaderboard-card laggard">
                    <div className="card-label">
                        <ArrowDownRight size={16} /> Lowest Performer ({selectedHorizon})
                    </div>
                    <div className="sector-headline">
                        <span className="dot" style={{ backgroundColor: worstPerformer?.color }} />
                        <strong>{worstPerformer?.shortName} ({worstPerformer?.symbol})</strong>
                    </div>
                    <div className={`return-stat ${worstPerformer?.currentReturn >= 0 ? 'positive' : 'negative'}`}>
                        {worstPerformer?.currentReturn >= 0 ? '+' : ''}
                        {worstPerformer?.currentReturn?.toFixed(2)}%
                    </div>
                </div>
            </div>

            {/* Comprehensive Multi-Horizon Heatmap Matrix Table */}
            <div className="table-wrapper responsive-table">
                <table className="matrix-table">
                    <thead>
                        <tr>
                            <th className="th-sector">Sector / Vanguard ETF</th>
                            <th className="th-weight">% of VOO</th>
                            {HORIZONS.map(h => (
                                <th
                                    key={h.key}
                                    className={`th-horizon ${selectedHorizon === h.key ? 'highlighted-col' : ''}`}
                                    onClick={() => setSelectedHorizon(h.key)}
                                    style={{ cursor: 'pointer' }}
                                    title={`Click to sort by ${h.key}`}
                                >
                                    {h.key}
                                    {selectedHorizon === h.key && ' ▼'}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rankedSectors.map((sector, idx) => {
                            const isBenchmark = sector.symbol === 'VOO';
                            return (
                                <tr key={sector.symbol} className={isBenchmark ? 'benchmark-row' : ''}>
                                    <td className="td-sector">
                                        <div className="sector-cell">
                                            <span className="rank-num">#{idx + 1}</span>
                                            <span className="sector-color-bar" style={{ backgroundColor: sector.color }} />
                                            <div className="sector-names">
                                                <div className="symbol-badge">
                                                    <strong>{sector.symbol}</strong>
                                                    <span className="cat-badge">{sector.category}</span>
                                                </div>
                                                <div className="full-name">{sector.name}</div>
                                            </div>
                                        </div>
                                    </td>

                                    <td className="td-weight">
                                        <div className="weight-display">
                                            <span>{sector.vooCoveragePercent ? `${sector.vooCoveragePercent}%` : '100%'}</span>
                                            <div className="mini-weight-track">
                                                <div
                                                    className="mini-weight-fill"
                                                    style={{
                                                        width: `${Math.min(100, (sector.vooCoveragePercent || 100) * 2.8)}%`,
                                                        backgroundColor: sector.color
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </td>

                                    {HORIZONS.map(h => {
                                        const isMultiYear = ['2Y', '3Y', '5Y', '10Y'].includes(h.key);
                                        const val = (viewMode === 'cagr' && isMultiYear)
                                            ? sector.cagr?.[h.key]
                                            : sector.trailing?.[h.key];

                                        const isSelected = selectedHorizon === h.key;

                                        return (
                                            <td
                                                key={h.key}
                                                className={`td-return ${isSelected ? 'highlighted-col' : ''}`}
                                                style={{
                                                    backgroundColor: getReturnBg(val),
                                                    color: getReturnColor(val)
                                                }}
                                            >
                                                {val != null ? (
                                                    <span className="return-value">
                                                        {val >= 0 ? '+' : ''}{val.toFixed(2)}%
                                                    </span>
                                                ) : (
                                                    <span className="no-data">—</span>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default SectorReturnsMatrix;
