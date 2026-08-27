import { useState, useEffect, useMemo } from 'react';
import { RefreshCw, TrendingDown, TrendingUp, CheckCircle, AlertTriangle, Scale, DollarSign, Wallet, Lock, Unlock } from 'lucide-react';
import { formatCurrency, formatPercent, calculateRebalancePlan } from '../utils/calculations';

const PortfolioRebalancer = ({ activeLots, prices, w2Income, totalValue }) => {
    // Collect all unique symbols in the active portfolio
    const symbols = useMemo(() => {
        const set = new Set();
        (activeLots || []).forEach(l => {
            if (l.symbol) set.add(l.symbol);
        });
        return Array.from(set).sort();
    }, [activeLots]);

    // Calculate current breakdown by symbol
    const currentAllocation = useMemo(() => {
        const map = {};
        symbols.forEach(s => { map[s] = 0; });
        (activeLots || []).forEach(l => {
            map[l.symbol] = (map[l.symbol] || 0) + (l.marketValue || 0);
        });
        const result = {};
        symbols.forEach(s => {
            result[s] = totalValue > 0 ? ((map[s] || 0) / totalValue) * 100 : 0;
        });
        return result;
    }, [activeLots, symbols, totalValue]);

    // Target allocations state (includes stock symbols and 'CASH')
    // Target allocations state (includes stock symbols and 'CASH')
    const [targetAllocations, setTargetAllocations] = useState(() => {
        try {
            const saved = localStorage.getItem('portfolio_target_allocations');
            return saved ? JSON.parse(saved) : {};
        } catch {
            return {};
        }
    });

    // Track lock mode per symbol: 'none' | 'percent' | 'dollar'
    const [lockedModes, setLockedModes] = useState(() => {
        try {
            const saved = localStorage.getItem('portfolio_target_locked_modes');
            if (saved) return JSON.parse(saved);
            const old = localStorage.getItem('portfolio_target_locked');
            if (old) {
                const parsed = JSON.parse(old);
                const converted = {};
                Object.keys(parsed).forEach(k => {
                    if (parsed[k]) converted[k] = 'percent';
                });
                return converted;
            }
            return {};
        } catch {
            return {};
        }
    });

    // Fixed dollar amount when locked by $
    const [lockedDollarAmounts, setLockedDollarAmounts] = useState(() => {
        try {
            const saved = localStorage.getItem('portfolio_locked_dollars');
            return saved ? JSON.parse(saved) : {};
        } catch {
            return {};
        }
    });

    const toggleLock = (symbol) => {
        setLockedModes(prev => {
            const current = prev[symbol] || 'none';
            let nextMode = 'none';
            if (current === 'none') nextMode = 'percent';
            else if (current === 'percent') nextMode = 'dollar';
            else if (current === 'dollar') nextMode = 'none';

            const updated = { ...prev, [symbol]: nextMode };
            localStorage.setItem('portfolio_target_locked_modes', JSON.stringify(updated));

            if (nextMode === 'dollar') {
                const currentPct = parseFloat(targetAllocations[symbol]) || 0;
                const dVal = Math.round((currentPct / 100) * totalValue);
                setLockedDollarAmounts(dPrev => {
                    const dUpdated = { ...dPrev, [symbol]: dVal };
                    localStorage.setItem('portfolio_locked_dollars', JSON.stringify(dUpdated));
                    return dUpdated;
                });
            }

            return updated;
        });
    };

    // Initialize targets when symbols or current allocations load (default to current allocations)
    useEffect(() => {
        if (symbols.length === 0 || totalValue <= 0) return;
        setTargetAllocations(prev => {
            const keys = Object.keys(prev);
            const isUninitialized = keys.length === 0 || keys.every(k => !prev[k] || prev[k] === 0);

            if (isUninitialized) {
                const initial = { CASH: 0 };
                symbols.forEach(s => {
                    initial[s] = currentAllocation[s] || 0;
                });
                localStorage.setItem('portfolio_target_allocations', JSON.stringify(initial));
                return initial;
            }

            const updated = { ...prev };
            let hasMissing = false;
            symbols.forEach(s => {
                if (updated[s] === undefined || isNaN(updated[s])) {
                    updated[s] = currentAllocation[s] || 0;
                    hasMissing = true;
                }
            });
            if (updated['CASH'] === undefined || isNaN(updated['CASH'])) {
                updated['CASH'] = 0;
                hasMissing = true;
            }
            if (hasMissing) {
                localStorage.setItem('portfolio_target_allocations', JSON.stringify(updated));
                return updated;
            }
            return prev;
        });
    }, [symbols, currentAllocation, totalValue]);

    // Save target allocations from percentage input
    const updateTarget = (symbol, val) => {
        const parsed = isNaN(val) ? 0 : Math.max(0, Math.min(100, val));
        const updated = { ...targetAllocations, [symbol]: parsed };
        const dVal = totalValue > 0 ? (parsed / 100) * totalValue : 0;
        const updatedDollars = { ...lockedDollarAmounts, [symbol]: dVal };
        setTargetAllocations(updated);
        setLockedDollarAmounts(updatedDollars);
        localStorage.setItem('portfolio_target_allocations', JSON.stringify(updated));
        localStorage.setItem('portfolio_locked_dollars', JSON.stringify(updatedDollars));
    };

    // Save target allocations from dollar input
    const updateTargetDollar = (symbol, dollarVal) => {
        const parsed = isNaN(dollarVal) ? 0 : Math.max(0, dollarVal);
        const pctVal = totalValue > 0 ? (parsed / totalValue) * 100 : 0;
        const updated = { ...targetAllocations, [symbol]: pctVal };
        const updatedDollars = { ...lockedDollarAmounts, [symbol]: parsed };
        setTargetAllocations(updated);
        setLockedDollarAmounts(updatedDollars);
        localStorage.setItem('portfolio_target_allocations', JSON.stringify(updated));
        localStorage.setItem('portfolio_locked_dollars', JSON.stringify(updatedDollars));
    };

    // Preset: Reset to current
    const handleResetToCurrent = () => {
        const updated = { CASH: 0 };
        const updatedDollars = { CASH: 0 };
        symbols.forEach(s => {
            const pct = currentAllocation[s] || 0;
            updated[s] = pct;
            updatedDollars[s] = totalValue > 0 ? (pct / 100) * totalValue : 0;
        });
        setTargetAllocations(updated);
        setLockedDollarAmounts(updatedDollars);
        setLockedModes({});
        localStorage.setItem('portfolio_target_allocations', JSON.stringify(updated));
        localStorage.setItem('portfolio_locked_dollars', JSON.stringify(updatedDollars));
        localStorage.setItem('portfolio_target_locked_modes', JSON.stringify({}));
    };

    // Preset: Normalize targets to 100% respecting % and $ locked values
    const handleNormalize = () => {
        const allKeys = [...symbols, 'CASH'];
        const lockedPctKeys = allKeys.filter(k => lockedModes[k] === 'percent');
        const lockedDollarKeys = allKeys.filter(k => lockedModes[k] === 'dollar');
        const unlockedKeys = allKeys.filter(k => !lockedModes[k] || lockedModes[k] === 'none');

        // If all are locked, nothing can adjust
        if (unlockedKeys.length === 0) return;

        const lockedPctSum = lockedPctKeys.reduce((acc, k) => acc + (parseFloat(targetAllocations[k]) || 0), 0);
        const lockedDollarSum = lockedDollarKeys.reduce((acc, k) => {
            const dVal = lockedDollarAmounts[k] !== undefined
                ? lockedDollarAmounts[k]
                : ((parseFloat(targetAllocations[k]) || 0) / 100) * totalValue;
            return acc + dVal;
        }, 0);

        const lockedDollarPct = totalValue > 0 ? (lockedDollarSum / totalValue) * 100 : 0;
        const totalLockedPct = lockedPctSum + lockedDollarPct;
        const remainingPct = Math.max(0, 100 - totalLockedPct);

        const unlockedCurrentSum = unlockedKeys.reduce((acc, k) => acc + (parseFloat(targetAllocations[k]) || 0), 0);

        const updated = { ...targetAllocations };
        const updatedLockedDollars = { ...lockedDollarAmounts };

        // Ensure dollar-locked items maintain their exact fixed dollar amount
        lockedDollarKeys.forEach(k => {
            const dVal = lockedDollarAmounts[k] !== undefined
                ? lockedDollarAmounts[k]
                : ((parseFloat(targetAllocations[k]) || 0) / 100) * totalValue;
            const pct = totalValue > 0 ? (dVal / totalValue) * 100 : 0;
            updated[k] = parseFloat(pct.toFixed(2));
            updatedLockedDollars[k] = dVal;
        });

        // Ensure percent-locked items update their dollar amount
        lockedPctKeys.forEach(k => {
            const pct = parseFloat(targetAllocations[k]) || 0;
            updated[k] = pct;
            updatedLockedDollars[k] = (pct / 100) * totalValue;
        });

        if (unlockedCurrentSum <= 0) {
            // Distribute remaining equally among unlocked
            const equalShare = parseFloat((remainingPct / unlockedKeys.length).toFixed(2));
            let runningShare = 0;
            unlockedKeys.forEach((k, idx) => {
                if (idx === unlockedKeys.length - 1) {
                    const finalShare = parseFloat((remainingPct - runningShare).toFixed(2));
                    updated[k] = Math.max(0, finalShare);
                } else {
                    updated[k] = equalShare;
                    runningShare += equalShare;
                }
                updatedLockedDollars[k] = (updated[k] / 100) * totalValue;
            });
        } else {
            // Distribute remaining proportionally to unlocked items
            let runningSum = 0;
            unlockedKeys.forEach((k, idx) => {
                if (idx === unlockedKeys.length - 1) {
                    const finalVal = parseFloat((remainingPct - runningSum).toFixed(2));
                    updated[k] = Math.max(0, finalVal);
                } else {
                    const currentVal = parseFloat(targetAllocations[k]) || 0;
                    const normVal = parseFloat(((currentVal / unlockedCurrentSum) * remainingPct).toFixed(2));
                    updated[k] = normVal;
                    runningSum += normVal;
                }
                updatedLockedDollars[k] = (updated[k] / 100) * totalValue;
            });
        }

        setTargetAllocations(updated);
        setLockedDollarAmounts(updatedLockedDollars);
        localStorage.setItem('portfolio_target_allocations', JSON.stringify(updated));
        localStorage.setItem('portfolio_locked_dollars', JSON.stringify(updatedLockedDollars));
    };

    // Total target sum (stocks + CASH)
    const totalTargetPct = symbols.reduce((acc, s) => acc + (parseFloat(targetAllocations[s]) || 0), 0) + (parseFloat(targetAllocations['CASH']) || 0);
    const isSumValid = Math.abs(totalTargetPct - 100) < 0.05;

    // Calculate rebalance plan
    const rebalancePlan = useMemo(() => {
        return calculateRebalancePlan(activeLots, targetAllocations, prices, w2Income, lockedModes, lockedDollarAmounts);
    }, [activeLots, targetAllocations, prices, w2Income, lockedModes, lockedDollarAmounts]);

    if (!activeLots || activeLots.length === 0 || symbols.length === 0) {
        return null;
    }

    const {
        stockAllocations,
        cashAllocation,
        lotsToSell,
        stocksToBuy,
        totalSellProceeds,
        targetCashReserve,
        netCashToDeploy,
        totalBuyAmount,
        totalEstTax,
        totalRealizedGain,
        effectivePortfolioValue
    } = rebalancePlan;

    const targetCashVal = parseFloat(targetAllocations['CASH']) || 0;
    const cashLockMode = lockedModes['CASH'] || 'none';
    const cashDollarVal = targetCashVal > 0 && totalValue > 0 ? Math.round((targetCashVal / 100) * totalValue) : 0;

    return (
        <section className="portfolio-rebalancer" style={{ marginTop: '2.5rem' }}>
            {/* Header */}
            <div className="card rebalancer-header-card" style={{ marginBottom: '1.5rem', padding: '1.5rem 2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Scale size={24} style={{ color: 'var(--accent-color)' }} />
                            <h2 style={{ fontSize: '1.4rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                                Portfolio Rebalancer
                            </h2>
                            <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '600' }}>
                                Tax-Efficient Lot Selection
                            </span>
                        </div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
                            Set your target asset & cash allocations. The engine identifies optimal lots to liquidate, pays taxes from proceeds, retains target cash reserves, and deploys the rest into underweight assets.
                        </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <button
                            className="rebalance-btn-secondary"
                            onClick={handleResetToCurrent}
                            title="Reset all targets to current allocation (0% cash)"
                        >
                            <RefreshCw size={14} />
                            <span>Reset to Current</span>
                        </button>
                        <button
                            className="rebalance-btn-primary"
                            onClick={handleNormalize}
                            title="Scale targets so sum equals 100%"
                        >
                            <span>Normalize to 100%</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Target Allocations Grid & Controls */}
            <div className="card allocation-settings-card" style={{ padding: '1.5rem 2rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '10px' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '600' }}>Target Allocations (Stocks & Cash)</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Target Sum:</span>
                        <span className={`target-sum-badge ${isSumValid ? 'valid' : 'invalid'}`}>
                            {isSumValid ? (
                                <>
                                    <CheckCircle size={14} />
                                    <span>{totalTargetPct.toFixed(1)}% (Balanced)</span>
                                </>
                            ) : (
                                <>
                                    <AlertTriangle size={14} />
                                    <span>{totalTargetPct.toFixed(1)}% (Must equal 100%)</span>
                                </>
                            )}
                        </span>
                    </div>
                </div>

                <div className="table-wrapper">
                    <table className="data-table rebalance-input-table">
                        <thead>
                            <tr>
                                <th>Asset</th>
                                <th>Current Value</th>
                                <th>Current %</th>
                                <th style={{ minWidth: '240px' }}>Target Allocation %</th>
                                <th style={{ minWidth: '120px' }}>Target Value ($)</th>
                                <th>Rebalance Action</th>
                                <th>Post-Rebalance %</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* Stock Rows */}
                            {stockAllocations.map(stock => {
                                const isOverweight = stock.diffValue < -0.01;
                                const isUnderweight = stock.diffValue > 0.01;
                                const isExact = !isOverweight && !isUnderweight;
                                const targetVal = parseFloat(targetAllocations[stock.symbol]) || 0;
                                const lockMode = lockedModes[stock.symbol] || 'none';
                                const targetDollarVal = targetVal > 0 && totalValue > 0 ? Math.round((targetVal / 100) * totalValue) : 0;

                                return (
                                    <tr key={stock.symbol}>
                                        <td>
                                            <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>{stock.symbol}</strong>
                                            {stock.latestPrice > 0 && (
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                    ${stock.latestPrice.toFixed(2)}/sh
                                                </div>
                                            )}
                                        </td>
                                        <td>{formatCurrency(stock.currentValue)}</td>
                                        <td>
                                            <span style={{ fontWeight: '600' }}>{formatPercent(stock.currentPct)}</span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <button
                                                    type="button"
                                                    className={`rebalance-lock-btn ${lockMode === 'percent' ? 'locked-pct' : lockMode === 'dollar' ? 'locked-dollar' : ''}`}
                                                    onClick={() => toggleLock(stock.symbol)}
                                                    title={
                                                        lockMode === 'percent'
                                                            ? "Locked by Percentage (%) - Click to switch to Dollar ($) lock"
                                                            : lockMode === 'dollar'
                                                            ? "Locked by Dollar Amount ($) - Click to unlock"
                                                            : "Unlocked (Scales on Normalize) - Click to lock %"
                                                    }
                                                    aria-label={`Lock toggle for ${stock.symbol}`}
                                                >
                                                    {lockMode === 'percent' ? (
                                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                                                            <Lock size={12} />
                                                            <span style={{ fontSize: '10px', fontWeight: '800' }}>%</span>
                                                        </span>
                                                    ) : lockMode === 'dollar' ? (
                                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                                                            <Lock size={12} />
                                                            <span style={{ fontSize: '10px', fontWeight: '800' }}>$</span>
                                                        </span>
                                                    ) : (
                                                        <Unlock size={13} />
                                                    )}
                                                </button>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="100"
                                                    step="0.5"
                                                    value={targetVal}
                                                    onChange={(e) => updateTarget(stock.symbol, parseFloat(e.target.value))}
                                                    className="rebalance-slider"
                                                    style={{ flex: 1 }}
                                                />
                                                <div style={{ position: 'relative', width: '85px', flexShrink: 0 }}>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        step="0.1"
                                                        value={targetVal}
                                                        onChange={(e) => updateTarget(stock.symbol, parseFloat(e.target.value))}
                                                        className="rebalance-num-input"
                                                    />
                                                    <span style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: '12px' }}>%</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ position: 'relative', width: '110px' }}>
                                                <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: '12px' }}>$</span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="100"
                                                    value={targetDollarVal}
                                                    onChange={(e) => updateTargetDollar(stock.symbol, parseFloat(e.target.value))}
                                                    className="rebalance-num-input"
                                                    style={{ paddingLeft: '18px', paddingRight: '8px', textAlign: 'right' }}
                                                    title={`Target dollar amount for ${stock.symbol}`}
                                                />
                                            </div>
                                        </td>
                                        <td>
                                            {isOverweight && (
                                                <span className="rebalance-tag sell">
                                                    <TrendingDown size={13} />
                                                    Sell {formatCurrency(Math.abs(stock.diffValue))}
                                                </span>
                                            )}
                                            {isUnderweight && (
                                                <span className="rebalance-tag buy">
                                                    <TrendingUp size={13} />
                                                    Buy {formatCurrency(stock.diffValue)}
                                                </span>
                                            )}
                                            {isExact && (
                                                <span className="rebalance-tag balanced">
                                                    ✓ Balanced
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            <strong style={{ color: 'var(--accent-color)' }}>
                                                {formatPercent(stock.postPct)}
                                            </strong>
                                        </td>
                                    </tr>
                                );
                            })}

                            {/* Cash Allocation Row */}
                            <tr style={{ background: 'rgba(20, 184, 166, 0.04)', borderTop: '2px solid rgba(20, 184, 166, 0.2)' }}>
                                <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Wallet size={16} style={{ color: '#14b8a6' }} />
                                        <strong style={{ fontSize: '1.05rem', color: '#14b8a6' }}>CASH (USD)</strong>
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                        Liquidity Reserve
                                    </div>
                                </td>
                                <td>$0</td>
                                <td>
                                    <span style={{ fontWeight: '600', color: 'var(--text-secondary)' }}>0.00%</span>
                                </td>
                                <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <button
                                            type="button"
                                            className={`rebalance-lock-btn ${cashLockMode === 'percent' ? 'locked-pct' : cashLockMode === 'dollar' ? 'locked-dollar' : ''}`}
                                            onClick={() => toggleLock('CASH')}
                                            title={
                                                cashLockMode === 'percent'
                                                    ? "Locked by Percentage (%) - Click to switch to Dollar ($) lock"
                                                    : cashLockMode === 'dollar'
                                                    ? "Locked by Dollar Amount ($) - Click to unlock"
                                                    : "Unlocked (Scales on Normalize) - Click to lock %"
                                            }
                                            aria-label="Lock toggle for CASH"
                                        >
                                            {cashLockMode === 'percent' ? (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                                                    <Lock size={12} />
                                                    <span style={{ fontSize: '10px', fontWeight: '800' }}>%</span>
                                                </span>
                                            ) : cashLockMode === 'dollar' ? (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                                                    <Lock size={12} />
                                                    <span style={{ fontSize: '10px', fontWeight: '800' }}>$</span>
                                                </span>
                                            ) : (
                                                <Unlock size={13} />
                                            )}
                                        </button>
                                        <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            step="0.5"
                                            value={targetCashVal}
                                            onChange={(e) => updateTarget('CASH', parseFloat(e.target.value))}
                                            className="rebalance-slider cash-slider"
                                            style={{ flex: 1 }}
                                        />
                                        <div style={{ position: 'relative', width: '85px', flexShrink: 0 }}>
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                step="0.1"
                                                value={targetCashVal}
                                                onChange={(e) => updateTarget('CASH', parseFloat(e.target.value))}
                                                className="rebalance-num-input"
                                            />
                                            <span style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: '12px' }}>%</span>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <div style={{ position: 'relative', width: '110px' }}>
                                        <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#14b8a6', fontSize: '12px' }}>$</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="100"
                                            value={cashDollarVal}
                                            onChange={(e) => updateTargetDollar('CASH', parseFloat(e.target.value))}
                                            className="rebalance-num-input"
                                            style={{ paddingLeft: '18px', paddingRight: '8px', textAlign: 'right', borderColor: 'rgba(20, 184, 166, 0.4)', color: '#14b8a6' }}
                                            title="Target cash reserve dollar amount"
                                        />
                                    </div>
                                </td>
                                <td>
                                    {targetCashReserve > 0 ? (
                                        <span className="rebalance-tag cash">
                                            <DollarSign size={13} />
                                            Hold {formatCurrency(targetCashReserve)}
                                        </span>
                                    ) : (
                                        <span className="rebalance-tag balanced">
                                            0% Cash
                                        </span>
                                    )}
                                </td>
                                <td>
                                    <strong style={{ color: '#14b8a6' }}>
                                        {formatPercent(cashAllocation?.postPct || targetCashVal)}
                                    </strong>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Visual Allocation Breakdown */}
            <div className="card" style={{ padding: '1.5rem 2rem', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem' }}>Allocation Comparison (Current vs Target)</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {stockAllocations.map(stock => {
                        const targetPct = parseFloat(targetAllocations[stock.symbol]) || 0;
                        return (
                            <div key={stock.symbol} style={{ display: 'grid', gridTemplateColumns: '80px 1fr', alignItems: 'center', gap: '15px' }}>
                                <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>{stock.symbol}</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {/* Current Bar */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{ fontSize: '11px', color: '#9ca3af', width: '55px' }}>Current</span>
                                        <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: '4px', height: '14px', overflow: 'hidden' }}>
                                            <div
                                                style={{
                                                    width: `${Math.min(100, Math.max(0, stock.currentPct))}%`,
                                                    background: '#3b82f6',
                                                    height: '100%',
                                                    borderRadius: '4px',
                                                    transition: 'width 0.3s ease'
                                                }}
                                            />
                                        </div>
                                        <span style={{ fontSize: '12px', width: '50px', textAlign: 'right', fontWeight: '600' }}>
                                            {formatPercent(stock.currentPct)}
                                        </span>
                                    </div>

                                    {/* Target Bar */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{ fontSize: '11px', color: '#10b981', width: '55px' }}>Target</span>
                                        <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: '4px', height: '14px', overflow: 'hidden' }}>
                                            <div
                                                style={{
                                                    width: `${Math.min(100, Math.max(0, targetPct))}%`,
                                                    background: '#10b981',
                                                    height: '100%',
                                                    borderRadius: '4px',
                                                    transition: 'width 0.3s ease'
                                                }}
                                            />
                                        </div>
                                        <span style={{ fontSize: '12px', width: '50px', textAlign: 'right', fontWeight: '600', color: '#10b981' }}>
                                            {formatPercent(targetPct)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* Cash Visual Bar */}
                    {targetCashVal > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', alignItems: 'center', gap: '15px', paddingTop: '6px', borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
                            <div style={{ fontWeight: '600', fontSize: '0.95rem', color: '#14b8a6' }}>CASH</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ fontSize: '11px', color: '#9ca3af', width: '55px' }}>Current</span>
                                    <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: '4px', height: '14px', overflow: 'hidden' }}>
                                        <div style={{ width: '0%', height: '100%' }} />
                                    </div>
                                    <span style={{ fontSize: '12px', width: '50px', textAlign: 'right', fontWeight: '600', color: '#9ca3af' }}>0.00%</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ fontSize: '11px', color: '#14b8a6', width: '55px' }}>Target</span>
                                    <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: '4px', height: '14px', overflow: 'hidden' }}>
                                        <div
                                            style={{
                                                width: `${Math.min(100, Math.max(0, targetCashVal))}%`,
                                                background: '#14b8a6',
                                                height: '100%',
                                                borderRadius: '4px',
                                                transition: 'width 0.3s ease'
                                            }}
                                        />
                                    </div>
                                    <span style={{ fontSize: '12px', width: '50px', textAlign: 'right', fontWeight: '600', color: '#14b8a6' }}>
                                        {formatPercent(targetCashVal)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Summary Metrics Bar */}
            <div className="rebalance-metrics-grid" style={{ marginBottom: '1.5rem' }}>
                <div className="stat-card">
                    <div className="card-title">Gross Cash Generated (Sells)</div>
                    <div className="primary-value" style={{ color: totalSellProceeds > 0 ? '#ef4444' : '#9ca3af' }}>
                        {formatCurrency(totalSellProceeds)}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '4px' }}>
                        From {lotsToSell.length} optimal lot{lotsToSell.length === 1 ? '' : 's'}
                    </div>
                </div>

                <div className="stat-card">
                    <div className="card-title">Estimated Tax (Paid from Sells)</div>
                    <div className="primary-value negative">
                        -{formatCurrency(totalEstTax)}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '4px' }}>
                        Tax drag: {totalSellProceeds > 0 ? formatPercent((totalEstTax / totalSellProceeds) * 100) : '0.00%'}
                    </div>
                </div>

                <div className="stat-card">
                    <div className="card-title">Cash Reserve (Held)</div>
                    <div className="primary-value" style={{ color: targetCashReserve > 0 ? '#14b8a6' : '#9ca3af' }}>
                        {formatCurrency(targetCashReserve || 0)}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '4px' }}>
                        {targetCashVal > 0 ? `${formatPercent(targetCashVal)} target allocation` : '0% cash target'}
                    </div>
                </div>

                <div className="stat-card">
                    <div className="card-title">Net Cash to Deploy (Buys)</div>
                    <div className="primary-value" style={{ color: totalBuyAmount > 0 ? '#10b981' : '#9ca3af' }}>
                        {formatCurrency(netCashToDeploy || totalBuyAmount)}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '4px' }}>
                        Across {stocksToBuy.length} underweight stock{stocksToBuy.length === 1 ? '' : 's'}
                    </div>
                </div>

                <div className="stat-card">
                    <div className="card-title">Post-Tax Portfolio Target Value</div>
                    <div className="primary-value" style={{ color: '#60a5fa' }}>
                        {formatCurrency(effectivePortfolioValue || totalValue)}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '4px' }}>
                        Realized Gain: {totalRealizedGain >= 0 ? '+' : ''}{formatCurrency(totalRealizedGain)}
                    </div>
                </div>
            </div>

            {/* Execution Plan: Lots to Sell */}
            <div className="card table-card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h3 style={{ fontSize: '1.15rem' }}>Step 1: Specific Lots to Sell (Tax-Optimal Order)</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '2px' }}>
                            Sorted by lowest tax drag percentage (highest efficiency first) to minimize capital gains taxes.
                        </p>
                    </div>
                    {lotsToSell.length > 0 && (
                        <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: '600' }}>
                            {lotsToSell.length} Lot{lotsToSell.length === 1 ? '' : 's'} Selected
                        </span>
                    )}
                </div>

                {lotsToSell.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        <CheckCircle size={32} style={{ color: '#10b981', margin: '0 auto 10px', display: 'block' }} />
                        <p style={{ fontSize: '1rem', color: 'var(--text-primary)', fontWeight: '600' }}>No lots need to be sold.</p>
                        <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>Portfolio allocations match your targets or no overweight assets require liquidation.</p>
                    </div>
                ) : (
                    <div className="table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Symbol</th>
                                    <th>Open Date</th>
                                    <th>Shares to Sell</th>
                                    <th>Sale Proceeds</th>
                                    <th>Cost Basis</th>
                                    <th>Gain / Loss</th>
                                    <th>Holding Period</th>
                                    <th>Tax Efficiency</th>
                                    <th>Est. Tax</th>
                                </tr>
                            </thead>
                            <tbody>
                                {lotsToSell.map((lot, idx) => {
                                    const effPct = (lot.efficiency || 0) * 100;
                                    return (
                                        <tr key={idx}>
                                            <td><strong>{lot.symbol}</strong></td>
                                            <td>{lot.openDate}</td>
                                            <td>
                                                <span style={{ fontWeight: '600' }}>{lot.sellQty.toFixed(3)}</span>
                                                {lot.isPartial && (
                                                    <span style={{ fontSize: '11px', color: '#f59e0b', marginLeft: '6px' }}>
                                                        (part of {lot.totalQty.toFixed(3)})
                                                    </span>
                                                )}
                                            </td>
                                            <td><strong>{formatCurrency(lot.marketValue)}</strong></td>
                                            <td>{formatCurrency(lot.costBasis)}</td>
                                            <td className={lot.gainLoss >= 0 ? 'positive' : 'negative'}>
                                                {lot.gainLoss >= 0 ? '+' : ''}{formatCurrency(lot.gainLoss)}
                                            </td>
                                            <td>
                                                <span className={`badge ${lot.holdingPeriod === 'Long Term' ? 'badge-lt' : 'badge-st'}`}>
                                                    {lot.holdingPeriod}
                                                </span>
                                            </td>
                                            <td>
                                                <span style={{ fontWeight: '600', color: effPct < 10 ? '#10b981' : effPct < 20 ? '#f59e0b' : '#ef4444' }}>
                                                    {effPct.toFixed(2)}%
                                                </span>
                                            </td>
                                            <td className="negative">
                                                {formatCurrency(lot.estTax || 0)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan="3"><strong>Total Sells</strong></td>
                                    <td><strong>{formatCurrency(totalSellProceeds)}</strong></td>
                                    <td><strong>{formatCurrency(lotsToSell.reduce((s, l) => s + l.costBasis, 0))}</strong></td>
                                    <td className={totalRealizedGain >= 0 ? 'positive' : 'negative'}>
                                        <strong>{totalRealizedGain >= 0 ? '+' : ''}{formatCurrency(totalRealizedGain)}</strong>
                                    </td>
                                    <td colSpan="2"></td>
                                    <td className="negative"><strong>{formatCurrency(totalEstTax)}</strong></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>

            {/* Execution Plan: Stocks to Buy & Cash Retained */}
            <div className="card table-card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h3 style={{ fontSize: '1.15rem' }}>Step 2: Deploy Proceeds & Retain Cash</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '2px' }}>
                            Reinvest liquidation proceeds into underweight assets and retain your desired cash balance.
                        </p>
                    </div>
                    {stocksToBuy.length > 0 && (
                        <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: '600' }}>
                            {stocksToBuy.length} Buy Order{stocksToBuy.length === 1 ? '' : 's'}
                        </span>
                    )}
                </div>

                {targetCashReserve > 0 && (
                    <div style={{ margin: '1rem 1.5rem', padding: '1rem 1.25rem', background: 'rgba(20, 184, 166, 0.08)', border: '1px solid rgba(20, 184, 166, 0.25)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Wallet size={24} style={{ color: '#14b8a6', flexShrink: 0 }} />
                        <div>
                            <div style={{ color: '#14b8a6', fontWeight: '600', fontSize: '0.95rem' }}>
                                Cash Reserve Allocation: Retain {formatCurrency(targetCashReserve)} in Cash
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                {formatPercent(targetCashVal)} of post-tax portfolio is preserved as uninvested cash liquidity from liquidation proceeds.
                            </div>
                        </div>
                    </div>
                )}

                {stocksToBuy.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        <CheckCircle size={32} style={{ color: '#10b981', margin: '0 auto 10px', display: 'block' }} />
                        <p style={{ fontSize: '1rem', color: 'var(--text-primary)', fontWeight: '600' }}>No stock purchases required.</p>
                        <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>No underweight assets detected.</p>
                    </div>
                ) : (
                    <div className="table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Symbol</th>
                                    <th>Current Price</th>
                                    <th>Target Buy Amount</th>
                                    <th>Approx. Shares to Buy</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stocksToBuy.map(order => (
                                    <tr key={order.symbol}>
                                        <td><strong style={{ fontSize: '1.05rem' }}>{order.symbol}</strong></td>
                                        <td>{order.latestPrice > 0 ? `$${order.latestPrice.toFixed(2)}` : '--'}</td>
                                        <td><strong style={{ color: '#10b981' }}>{formatCurrency(order.buyAmount)}</strong></td>
                                        <td>
                                            <span style={{ fontWeight: '600', fontSize: '1.05rem' }}>
                                                {order.buyShares > 0 ? order.buyShares.toFixed(3) : '--'}
                                            </span>
                                            <span style={{ fontSize: '12px', color: '#9ca3af', marginLeft: '4px' }}>shares</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan="2"><strong>Total Stock Purchases</strong></td>
                                    <td style={{ color: '#10b981' }}><strong>{formatCurrency(totalBuyAmount)}</strong></td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>
        </section>
    );
};

export default PortfolioRebalancer;
