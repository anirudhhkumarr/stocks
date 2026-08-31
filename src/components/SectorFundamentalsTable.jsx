import { useState, useMemo } from 'react';
import { SlidersHorizontal, ArrowUpDown, Search, ShieldCheck } from 'lucide-react';
import { VANGUARD_SECTORS, BENCHMARK_ETF, TOTAL_VOO_COVERAGE_PERCENT } from '../utils/sectorData';

const SectorFundamentalsTable = ({ sectorDataMap }) => {
    const [sortField, setSortField] = useState('vooCoveragePercent');
    const [sortDirection, setSortDirection] = useState('desc'); // 'asc' | 'desc'
    const [searchQuery, setSearchQuery] = useState('');

    const allSectors = useMemo(() => {
        const list = [...VANGUARD_SECTORS, BENCHMARK_ETF];

        return list.map(sector => {
            const data = sectorDataMap[sector.symbol];
            const meta = data?.meta || {};

            const livePrice = meta.regularMarketPrice || data?.returns?.latestPrice;
            const high52 = meta.fiftyTwoWeekHigh;
            const low52 = meta.fiftyTwoWeekLow;

            const distFromHigh = (livePrice && high52)
                ? ((livePrice - high52) / high52) * 100
                : null;

            return {
                ...sector,
                livePrice,
                high52,
                low52,
                distFromHigh
            };
        });
    }, [sectorDataMap]);

    const filteredAndSortedSectors = useMemo(() => {
        let result = allSectors.filter(s => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            return (
                s.name.toLowerCase().includes(q) ||
                s.symbol.toLowerCase().includes(q) ||
                s.category.toLowerCase().includes(q) ||
                s.topHoldings.some(h => h.toLowerCase().includes(q))
            );
        });

        result.sort((a, b) => {
            let valA = a[sortField];
            let valB = b[sortField];

            // Benchmarks always stay near top if sorting by weight
            if (sortField === 'vooCoveragePercent') {
                if (a.symbol === 'VOO') return sortDirection === 'desc' ? -1 : 1;
                if (b.symbol === 'VOO') return sortDirection === 'desc' ? 1 : -1;
            }

            if (valA == null) return 1;
            if (valB == null) return -1;

            if (typeof valA === 'string') {
                return sortDirection === 'asc'
                    ? valA.localeCompare(valB)
                    : valB.localeCompare(valA);
            }

            return sortDirection === 'asc' ? valA - valB : valB - valA;
        });

        return result;
    }, [allSectors, searchQuery, sortField, sortDirection]);

    const handleSort = (field) => {
        if (sortField === field) {
            setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    return (
        <div className="card sector-fundamentals-card">
            <div className="fundamentals-header">
                <div className="title-block">
                    <SlidersHorizontal className="section-icon" />
                    <div>
                        <h3>Sector Valuation, P/E Ratio & Fundamental Breakdown</h3>
                        <p className="subtitle">
                            Comparative P/E multiples, dividend yields, expense ratios, and top holdings across US sectors
                        </p>
                    </div>
                </div>

                <div className="search-and-stats">
                    <div className="search-input-wrapper">
                        <Search size={14} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Filter by sector, ticker, or holding (e.g. Apple, NVDA)..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="sector-search-input"
                        />
                    </div>
                    <div className="voo-total-tag">
                        <ShieldCheck size={14} />
                        <span>Total VOO Coverage: <strong>{TOTAL_VOO_COVERAGE_PERCENT}%</strong></span>
                    </div>
                </div>
            </div>

            <div className="table-wrapper responsive-table">
                <table className="fundamentals-table">
                    <thead>
                        <tr>
                            <th onClick={() => handleSort('name')} className="sortable-th">
                                Sector / Vanguard ETF <ArrowUpDown size={12} />
                            </th>
                            <th onClick={() => handleSort('vooCoveragePercent')} className="sortable-th text-right">
                                % of VOO <ArrowUpDown size={12} />
                            </th>
                            <th onClick={() => handleSort('peRatio')} className="sortable-th text-right">
                                Trailing P/E <ArrowUpDown size={12} />
                            </th>
                            <th onClick={() => handleSort('forwardPe')} className="sortable-th text-right">
                                Forward P/E <ArrowUpDown size={12} />
                            </th>
                            <th onClick={() => handleSort('dividendYield')} className="sortable-th text-right">
                                Div Yield <ArrowUpDown size={12} />
                            </th>
                            <th onClick={() => handleSort('expenseRatio')} className="sortable-th text-right">
                                Exp Ratio <ArrowUpDown size={12} />
                            </th>
                            <th onClick={() => handleSort('distFromHigh')} className="sortable-th text-right">
                                From 52W High <ArrowUpDown size={12} />
                            </th>
                            <th className="th-holdings">Top Sector Holdings</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredAndSortedSectors.map(s => {
                            const isBenchmark = s.symbol === 'VOO';
                            return (
                                <tr key={s.symbol} className={isBenchmark ? 'benchmark-row' : ''}>
                                    <td className="td-name-col">
                                        <div className="sector-badge-cell">
                                            <span className="dot" style={{ backgroundColor: s.color }} />
                                            <div>
                                                <div className="symbol-row">
                                                    <strong>{s.symbol}</strong>
                                                    <span className="cat-chip">{s.category}</span>
                                                </div>
                                                <div className="name-sub">{s.name}</div>
                                            </div>
                                        </div>
                                    </td>

                                    <td className="text-right weight-col">
                                        <span className="weight-pill">
                                            {s.vooCoveragePercent ? `${s.vooCoveragePercent}%` : '100%'}
                                        </span>
                                    </td>

                                    <td className="text-right pe-col">
                                        <span className={`pe-tag ${s.peRatio > 30 ? 'high-pe' : s.peRatio < 18 ? 'value-pe' : ''}`}>
                                            {s.peRatio.toFixed(1)}x
                                        </span>
                                    </td>

                                    <td className="text-right">
                                        <span className="forward-pe">{s.forwardPe.toFixed(1)}x</span>
                                    </td>

                                    <td className="text-right yield-col">
                                        <span className={`yield-tag ${s.dividendYield >= 3.0 ? 'high-yield' : ''}`}>
                                            {s.dividendYield.toFixed(2)}%
                                        </span>
                                    </td>

                                    <td className="text-right">
                                        <span className="exp-ratio">{s.expenseRatio.toFixed(2)}%</span>
                                    </td>

                                    <td className="text-right dist-col">
                                        {s.distFromHigh != null ? (
                                            <span className={`dist-tag ${s.distFromHigh >= -3 ? 'near-high' : 'pullback'}`}>
                                                {s.distFromHigh >= 0 ? 'ATH' : `${s.distFromHigh.toFixed(1)}%`}
                                            </span>
                                        ) : (
                                            <span className="text-muted">—</span>
                                        )}
                                    </td>

                                    <td className="td-holdings-col">
                                        <div className="holdings-pills">
                                            {s.topHoldings.slice(0, 4).map((h, i) => (
                                                <span key={i} className="holding-chip">{h}</span>
                                            ))}
                                            {s.topHoldings.length > 4 && (
                                                <span className="holding-chip more">+{s.topHoldings.length - 4}</span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default SectorFundamentalsTable;
