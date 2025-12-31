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
                    {stats.totalGain >= 0 ? '+' : ''}{stats.totalGain ? formatCurrency(stats.totalGain) : 'Loading...'}
                </div>
                <div className="secondary-row" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                    <span className={`trend-badge ${stats.totalGainPct >= 0 ? 'positive' : 'negative'}`} id="totalGainBadge" style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '13px', fontWeight: '600' }}>
                        {stats.totalGainPct >= 0 ? '▲' : '▼'} {stats.totalGainPct ? formatPercent(stats.totalGainPct) : '0%'}
                    </span>
                    <span style={{ color: '#6b7280', fontSize: '12px' }}>Total Return</span>
                </div>
                <div className="metric-row" style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                    <span style={{ color: '#9ca3af', fontSize: '12px' }}>XIRR (Annualized)</span>
                    <span style={{ color: '#10b981', fontSize: '14px', fontWeight: '600' }} id="currentXIRR">{stats.xirr ? formatPercent(stats.xirr * 100) : '--'}</span>
                </div>
            </div>

            {/* Pillar 3: Net Gain (Post-Tax) */}
            <div className="stat-card">
                <div className="card-title">Net Gain (Post-Tax)</div>
                <div className={`primary-value ${netGainStats.netGain >= 0 ? 'positive' : 'negative'}`} id="netGainValue">
                    {netGainStats.netGain >= 0 ? '+' : ''}{netGainStats.netGain !== undefined ? formatCurrency(netGainStats.netGain) : 'Loading...'}
                </div>
                <div className="secondary-row" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                    <span className={`trend-badge ${netGainStats.netGainPct >= 0 ? 'positive' : 'negative'}`} id="netGainBadge" style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '13px', fontWeight: '600' }}>
                        {netGainStats.netGainPct >= 0 ? '▲' : '▼'} {netGainStats.netGainPct !== undefined ? formatPercent(netGainStats.netGainPct) : '0%'}
                    </span>
                    <span style={{ color: '#6b7280', fontSize: '12px' }}>After-Tax Return</span>
                </div>
                <div className="metric-row" style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                    <span style={{ color: '#9ca3af', fontSize: '12px' }}>Net XIRR</span>
                    <span style={{ color: netGainStats.netXirr >= 0 ? '#10b981' : '#ef4444', fontSize: '14px', fontWeight: '600' }} id="netXirr">
                        {netGainStats.netXirr !== undefined ? formatPercent(netGainStats.netXirr * 100) : '--'}
                    </span>
                </div>
            </div>
        </section>
    );
};

export default SummaryRibbon;
