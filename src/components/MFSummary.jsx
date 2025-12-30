import React from 'react';
import { formatCurrency, formatPercent } from '../utils/calculations';

const MFSummary = ({ stats, usdRate }) => {
    const fmtINR = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
    const fmtUSD = (n) => '$' + Math.round(n).toLocaleString('en-US');

    return (
        <section className="summary-ribbon" style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
            <div className="stat-card" style={{ flex: 1 }}>
                <div className="card-title">Value (₹)</div>
                <div className="primary-value">{fmtINR(stats.totalValueINR)}</div>
                <div className="sub-metric">Current Portfolio</div>
            </div>

            <div className="stat-card" style={{ flex: 1 }}>
                <div className="card-title">Return (₹)</div>
                <div className={`primary-value ${stats.gainINR >= 0 ? 'positive' : 'negative'}`}>
                    {stats.gainINR >= 0 ? '+' : ''}{fmtINR(stats.gainINR)}
                </div>
                <div className={`trend-badge ${stats.gainPctINR >= 0 ? 'positive' : 'negative'}`}>
                    {stats.gainPctINR.toFixed(2)}%
                </div>
            </div>

            <div className="stat-card" style={{ flex: 1 }}>
                <div className="card-title">Value ($)</div>
                <div className="primary-value">{fmtUSD(stats.totalValueUSD)}</div>
                <div className="sub-metric">@ 1$ = ₹{usdRate?.toFixed(2) || '--'}</div>
            </div>

            <div className="stat-card" style={{ flex: 1 }}>
                <div className="card-title">Return ($)</div>
                <div className={`primary-value ${stats.gainUSD >= 0 ? 'positive' : 'negative'}`}>
                    {stats.gainUSD >= 0 ? '+' : ''}{fmtUSD(stats.gainUSD)}
                </div>
                <div className={`trend-badge ${stats.gainPctUSD >= 0 ? 'positive' : 'negative'}`}>
                    {stats.gainPctUSD.toFixed(2)}%
                </div>
            </div>
        </section>
    );
};

export default MFSummary;
