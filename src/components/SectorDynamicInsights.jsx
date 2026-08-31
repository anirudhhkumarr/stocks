import { useMemo } from 'react';
import { Sparkles, TrendingUp, Scale, DollarSign, Target } from 'lucide-react';
import { VANGUARD_SECTORS, BENCHMARK_ETF } from '../utils/sectorData';

const SectorDynamicInsights = ({ sectorDataMap, selectedHorizon }) => {
    const liveInsights = useMemo(() => {
        const sectors = VANGUARD_SECTORS.map(s => {
            const data = sectorDataMap[s.symbol];
            const meta = data?.meta || {};
            const returns = data?.returns?.trailing || {};
            const horizonReturn = returns[selectedHorizon] ?? 0;
            const livePrice = meta.regularMarketPrice || data?.returns?.latestPrice;
            const high52 = meta.fiftyTwoWeekHigh;
            const distFromHigh = (livePrice && high52) ? ((livePrice - high52) / high52) * 100 : 0;

            return {
                ...s,
                horizonReturn,
                livePrice,
                high52,
                distFromHigh
            };
        });

        // 1. Growth vs Defensive Performance Spread
        const growthSymbols = ['VGT', 'VCR', 'VOX'];
        const defensiveSymbols = ['VHT', 'VDC', 'VPU'];

        const growthSectors = sectors.filter(s => growthSymbols.includes(s.symbol));
        const defensiveSectors = sectors.filter(s => defensiveSymbols.includes(s.symbol));

        const growthAvg = growthSectors.reduce((sum, s) => sum + s.horizonReturn, 0) / (growthSectors.length || 1);
        const defensiveAvg = defensiveSectors.reduce((sum, s) => sum + s.horizonReturn, 0) / (defensiveSectors.length || 1);
        const styleSpread = growthAvg - defensiveAvg;

        // 2. Valuation Multiple Spread
        const sortedByPe = [...sectors].sort((a, b) => b.peRatio - a.peRatio);
        const highestPe = sortedByPe[0];
        const lowestPe = sortedByPe[sortedByPe.length - 1];
        const peSpreadRatio = lowestPe?.peRatio > 0 ? (highestPe?.peRatio / lowestPe.peRatio) : 1;

        // 3. Dividend Yield Opportunity
        const sortedByYield = [...sectors].sort((a, b) => b.dividendYield - a.dividendYield);
        const highestYield = sortedByYield[0];
        const vooYield = BENCHMARK_ETF.dividendYield;
        const yieldSpread = highestYield.dividendYield - vooYield;

        // 4. ATH Proximity & Breadth
        const nearHighCount = sectors.filter(s => s.distFromHigh >= -5.0).length;
        const sortedByReturn = [...sectors].sort((a, b) => b.horizonReturn - a.horizonReturn);
        const topPerformer = sortedByReturn[0];
        const bottomPerformer = sortedByReturn[sortedByReturn.length - 1];

        return {
            growthAvg,
            defensiveAvg,
            styleSpread,
            highestPe,
            lowestPe,
            peSpreadRatio,
            highestYield,
            yieldSpread,
            nearHighCount,
            totalCount: sectors.length,
            topPerformer,
            bottomPerformer
        };
    }, [sectorDataMap, selectedHorizon]);

    return (
        <div className="card dynamic-intelligence-card">
            <div className="intelligence-header">
                <Sparkles className="section-icon text-purple" />
                <div>
                    <h3>Dynamic Sector Intelligence ({selectedHorizon} Horizon)</h3>
                    <p className="subtitle">
                        Real-time quantitative signals, valuation spreads, and momentum breadth computed from live data
                    </p>
                </div>
            </div>

            <div className="intelligence-grid">
                {/* Growth vs Defensive Divergence */}
                <div className="intel-card">
                    <div className="intel-card-header">
                        <Scale size={15} className="intel-icon" />
                        <span className="intel-label">Growth vs Defensive Divergence</span>
                    </div>
                    <div className="intel-main-stat">
                        <span className={`stat-num ${liveInsights.styleSpread >= 0 ? 'text-green' : 'text-orange'}`}>
                            {liveInsights.styleSpread >= 0 ? '+' : ''}{liveInsights.styleSpread.toFixed(1)}% Spread
                        </span>
                    </div>
                    <p className="intel-explanation">
                        {liveInsights.styleSpread >= 0 ? (
                            <>
                                <strong>Growth sectors</strong> (Tech, Consumer Discretionary, Comm Services) averaged <strong>+{liveInsights.growthAvg.toFixed(1)}%</strong>, outperforming <strong>Defensives</strong> (Health, Staples, Utilities at +{liveInsights.defensiveAvg.toFixed(1)}%).
                            </>
                        ) : (
                            <>
                                <strong>Defensive sectors</strong> averaged <strong>+{liveInsights.defensiveAvg.toFixed(1)}%</strong>, leading over <strong>Growth sectors</strong> (+{liveInsights.growthAvg.toFixed(1)}%).
                            </>
                        )}
                    </p>
                </div>

                {/* Valuation Multiple Dispersion */}
                <div className="intel-card">
                    <div className="intel-card-header">
                        <DollarSign size={15} className="intel-icon" />
                        <span className="intel-label">Valuation Multiple Spread</span>
                    </div>
                    <div className="intel-main-stat">
                        <span className="stat-num text-purple">
                            {liveInsights.peSpreadRatio.toFixed(2)}x Multiple Spread
                        </span>
                    </div>
                    <p className="intel-explanation">
                        <strong>{liveInsights.highestPe.symbol}</strong> ({liveInsights.highestPe.peRatio}x P/E) trades at a <strong>{liveInsights.peSpreadRatio.toFixed(1)}x premium</strong> over the lowest multiple sector <strong>{liveInsights.lowestPe.symbol}</strong> ({liveInsights.lowestPe.peRatio}x P/E).
                    </p>
                </div>

                {/* Income & Dividend Premium */}
                <div className="intel-card">
                    <div className="intel-card-header">
                        <TrendingUp size={15} className="intel-icon" />
                        <span className="intel-label">Dividend Income Premium</span>
                    </div>
                    <div className="intel-main-stat">
                        <span className="stat-num text-teal">
                            +{liveInsights.yieldSpread.toFixed(2)}% vs S&P 500
                        </span>
                    </div>
                    <p className="intel-explanation">
                        <strong>{liveInsights.highestYield.name} ({liveInsights.highestYield.symbol})</strong> yields <strong>{liveInsights.highestYield.dividendYield}%</strong>, providing a +{liveInsights.yieldSpread.toFixed(2)}% income spread over VOO ({BENCHMARK_ETF.dividendYield}%).
                    </p>
                </div>

                {/* Momentum Breadth */}
                <div className="intel-card">
                    <div className="intel-card-header">
                        <Target size={15} className="intel-icon" />
                        <span className="intel-label">Market Breadth & Highs</span>
                    </div>
                    <div className="intel-main-stat">
                        <span className="stat-num text-blue">
                            {liveInsights.nearHighCount} / {liveInsights.totalCount} Sectors Near ATH
                        </span>
                    </div>
                    <p className="intel-explanation">
                        <strong>{liveInsights.nearHighCount} of 11 sectors</strong> are currently trading within 5% of their 52-week highs, led by <strong>{liveInsights.topPerformer.symbol}</strong> ({liveInsights.topPerformer.horizonReturn >= 0 ? '+' : ''}{liveInsights.topPerformer.horizonReturn.toFixed(1)}% {selectedHorizon}).
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SectorDynamicInsights;
