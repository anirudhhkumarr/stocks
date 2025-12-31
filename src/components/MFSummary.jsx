

const MFSummary = ({ stats, usdRate }) => {
    const fmtINR = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
    const fmtUSD = (n) => '$' + Math.round(n).toLocaleString('en-US');

    return (
        <section className="summary-ribbon" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
            {/* INR Card */}
            <div className="stat-card">
                <div className="card-title">Portfolio Value (INR)</div>
                <div className="primary-value">{fmtINR(stats.totalValueINR)}</div>
                <div className="secondary-row" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
                    <span className={`trend-badge ${stats.gainINR >= 0 ? 'positive' : 'negative'}`} style={{ padding: '4px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: '600' }}>
                        {stats.gainINR >= 0 ? '+' : ''}{stats.gainPctINR.toFixed(2)}%
                    </span>
                    <span style={{ color: '#6b7280', fontSize: '12px' }}>Net Return</span>
                </div>
            </div>

            {/* USD Card */}
            <div className="stat-card">
                <div className="card-title">Portfolio Value (USD)</div>
                <div className="primary-value">{fmtUSD(stats.totalValueUSD)}</div>
                <div className="secondary-row" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
                    <span className={`trend-badge ${stats.gainUSD >= 0 ? 'positive' : 'negative'}`} style={{ padding: '4px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: '600' }}>
                        {stats.gainUSD >= 0 ? '+' : ''}{stats.gainPctUSD.toFixed(2)}%
                    </span>
                    <span style={{ color: '#6b7280', fontSize: '12px' }}>Total Return</span>
                </div>
            </div>

            {/* Currency Context Card */}
            <div className="stat-card">
                <div className="card-title">Currency context</div>
                <div className="primary-value" style={{ fontSize: '20px', color: '#9ca3af' }}>1 USD = {fmtINR(usdRate)}</div>
                <div className="metric-row" style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                    <span style={{ color: '#9ca3af', fontSize: '12px' }}>Forex Rate</span>
                    <span style={{ color: '#3b82f6', fontSize: '14px', fontWeight: '600' }}>Live</span>
                </div>
            </div>
        </section>
    );
};

export default MFSummary;
