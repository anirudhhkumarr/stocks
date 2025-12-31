

const MFSummary = ({ stats, usdRate }) => {
    const fmtINR = (n) => '₹' + Math.round(n).toLocaleString('en-IN');

    const rangeLabel = stats.range ? stats.range.toUpperCase() : '1Y';

    return (
        <section className="summary-ribbon" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
            {/* Pillar 1: INR Valuation */}
            <div className="stat-card">
                <div className="card-title">Portfolio Valuation (INR)</div>
                <div className="primary-value" style={{ color: '#10b981' }}>{fmtINR(stats.totalValueINR)}</div>
                <div className="secondary-row" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
                    <span className={`trend-badge ${stats.gainINR >= 0 ? 'positive' : 'negative'}`} style={{ padding: '4px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: '600' }}>
                        {stats.gainPctINR >= 0 ? '▲' : '▼'} {Math.abs(stats.gainPctINR).toFixed(1)}%
                    </span>
                    <span style={{ color: '#6b7280', fontSize: '12px' }}>{rangeLabel} Performance</span>
                </div>
            </div>

            {/* Pillar 2: USD Valuation */}
            <div className="stat-card">
                <div className="card-title">Portfolio Valuation (USD)</div>
                <div className="primary-value" style={{ color: '#3b82f6' }}>${stats.totalValueUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
                <div className="secondary-row" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
                    <span className={`trend-badge ${stats.gainUSD >= 0 ? 'positive' : 'negative'}`} style={{ padding: '4px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: '600' }}>
                        {stats.gainPctUSD >= 0 ? '▲' : '▼'} {Math.abs(stats.gainPctUSD).toFixed(1)}%
                    </span>
                    <span style={{ color: '#6b7280', fontSize: '12px' }}>{rangeLabel} Performance</span>
                </div>
            </div>

            {/* Pillar 3: Returns & Context */}
            <div className="stat-card">
                <div className="card-title">{rangeLabel} Net Return</div>
                <div className={`primary-value ${stats.gainINR >= 0 ? 'positive' : 'negative'}`} style={{ fontSize: '24px' }}>
                    {stats.gainINR >= 0 ? '+' : ''}{fmtINR(stats.gainINR)}
                </div>
                <div className="metric-row" style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                    <span style={{ color: '#9ca3af', fontSize: '12px' }}>1 USD = {fmtINR(usdRate)}</span>
                    <span style={{ color: '#3b82f6', fontSize: '12px', fontWeight: '600' }}>Live Forex</span>
                </div>
            </div>
        </section>
    );
};

export default MFSummary;
