import { formatCurrency, formatPercent } from '../utils/calculations';

const SummaryRibbon = ({ stats, netGainStats }) => {
    return (
        <section className="summary-ribbon">
            {/* Pillar 1: Valuation */}
            <div className="stat-card">
                <div className="card-title">Portfolio Valuation</div>
                <div className={`primary-value ${stats.totalValue >= 0 ? 'positive' : 'negative'}`} id="totalValue">
                    {stats.totalValue ? formatCurrency(stats.totalValue) : 'Loading...'}
                </div>
                <div className="valuation-progress">
                    <div className="bar" style={{ width: stats.totalValue > 0 ? '75%' : '0%' }}></div>
                </div>
                <div className="secondary-row">
                    <div className="sub-metric">
                        <span>Cost Basis:</span>
                        <span className="val" id="totalCostBasis">
                            {stats.totalCost ? formatCurrency(stats.totalCost) : '$0'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Pillar 2: Performance */}
            <div className="stat-card">
                <div className="card-title">Performance</div>
                <div className={`primary-value ${stats.totalGain >= 0 ? 'positive' : 'negative'}`} id="totalGainValue">
                    {stats.totalGain ? formatCurrency(stats.totalGain) : 'Loading...'}
                </div>
                <div className="secondary-row">
                    <div className="badge-row">
                        <span className={`trend-badge ${stats.totalGainPct >= 0 ? 'positive' : 'negative'}`} id="totalGainBadge">
                            {stats.totalGainPct >= 0 ? '▲' : '▼'} {stats.totalGainPct ? formatPercent(stats.totalGainPct) : '0%'}
                        </span>
                        <span className="badge-label">Total Gain</span>
                    </div>
                    <div className="metric-row">
                        <span className="metric-label">XIRR:</span>
                        <span className="metric-value" id="currentXIRR">{stats.xirr ? formatPercent(stats.xirr * 100) : '--'}</span>
                    </div>
                </div>
            </div>

            {/* Pillar 3: Net Gain (Post-Tax) */}
            <div className="stat-card">
                <div className="card-title">Net Gain (Post-Tax)</div>
                <div className={`primary-value ${netGainStats.netGain >= 0 ? 'positive' : 'negative'}`} id="netGainValue">
                    {netGainStats.netGain !== undefined ? formatCurrency(netGainStats.netGain) : 'Loading...'}
                </div>
                <div className="secondary-row">
                    <div className="badge-row">
                        <span className={`trend-badge ${netGainStats.netGainPct >= 0 ? 'positive' : 'negative'}`} id="netGainBadge">
                            {netGainStats.netGainPct >= 0 ? '▲' : '▼'} {netGainStats.netGainPct !== undefined ? formatPercent(netGainStats.netGainPct) : '0%'}
                        </span>
                        <span className="badge-label">After-Tax Return</span>
                    </div>
                    <div className="metric-row">
                        <span className="metric-label">Net XIRR:</span>
                        <span className="metric-value" id="netXirr">
                            {netGainStats.netXirr !== undefined ? formatPercent(netGainStats.netXirr * 100) : '--'}
                        </span>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default SummaryRibbon;
