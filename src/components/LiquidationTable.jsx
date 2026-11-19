import { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, RotateCcw } from 'lucide-react';
import { formatCurrency } from '../utils/calculations';

const LiquidationTable = ({ lots, targetAmount }) => {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

  const getLotEstTax = (lot) => {
    const gain = (lot.marketValue || 0) - (lot.costBasis || 0);
    return gain < 0 ? 0 : Math.max(0, lot.estTax || 0);
  };

  const { totalProceeds, totalTax } = useMemo(() => {
    return (lots || []).reduce(
      (acc, lot) => {
        acc.totalProceeds += lot.marketValue || 0;
        acc.totalTax += getLotEstTax(lot);
        return acc;
      },
      { totalProceeds: 0, totalTax: 0 }
    );
  }, [lots]);

  const sortedLots = useMemo(() => {
    if (!lots || lots.length === 0) return [];
    if (!sortConfig.key) return lots;

    const copy = [...lots];
    const { key, direction } = sortConfig;
    const modifier = direction === 'asc' ? 1 : -1;

    return copy.sort((a, b) => {
      let valA, valB;

      switch (key) {
        case 'symbol':
          return modifier * (a.symbol || '').localeCompare(b.symbol || '');
        case 'qty':
          valA = a.qty || 0;
          valB = b.qty || 0;
          break;
        case 'marketValue':
          valA = a.marketValue || 0;
          valB = b.marketValue || 0;
          break;
        case 'costBasis':
          valA = a.costBasis || 0;
          valB = b.costBasis || 0;
          break;
        case 'gain':
          valA = (a.marketValue || 0) - (a.costBasis || 0);
          valB = (b.marketValue || 0) - (b.costBasis || 0);
          break;
        case 'holdingPeriod':
          return modifier * (a.holdingPeriod || '').localeCompare(b.holdingPeriod || '');
        case 'efficiency':
          valA = a.efficiency || 0;
          valB = b.efficiency || 0;
          break;
        case 'estTax':
          valA = getLotEstTax(a);
          valB = getLotEstTax(b);
          break;
        case 'openDate':
          valA = new Date(a.openDate).getTime() || 0;
          valB = new Date(b.openDate).getTime() || 0;
          break;
        default:
          return 0;
      }

      if (valA < valB) return -1 * modifier;
      if (valA > valB) return 1 * modifier;
      return 0;
    });
  }, [lots, sortConfig]);

  if (!lots || lots.length === 0 || targetAmount <= 0) return null;

  const handleSort = (key) => {
    setSortConfig((prev) => {
      const defaultDesc = ['openDate', 'marketValue', 'costBasis', 'gain', 'estTax', 'qty', 'efficiency'].includes(key);
      const firstDir = defaultDesc ? 'desc' : 'asc';
      const secondDir = defaultDesc ? 'asc' : 'desc';

      if (prev.key !== key) {
        return { key, direction: firstDir };
      }
      if (prev.direction === firstDir) {
        return { key, direction: secondDir };
      }
      // Third click resets to default (as today / liquidation order)
      return { key: null, direction: null };
    });
  };

  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return <ArrowUpDown size={12} style={{ opacity: 0.4 }} />;
    }
    return sortConfig.direction === 'asc' ? (
      <ArrowUp size={12} style={{ opacity: 1, color: 'var(--accent-color, #3b82f6)' }} />
    ) : (
      <ArrowDown size={12} style={{ opacity: 1, color: 'var(--accent-color, #3b82f6)' }} />
    );
  };

  return (
    <div className="card table-card" style={{ marginTop: '2rem' }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Optimal Liquidation Plan</h3>
        {sortConfig.key && (
          <button
            onClick={() => setSortConfig({ key: null, direction: null })}
            className="filter-btn"
            style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}
            title="Reset to default optimal liquidation order"
          >
            <RotateCcw size={12} />
            <span>Reset to Default</span>
          </button>
        )}
      </div>
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('symbol')} className="sortable-th">
                Symbol {renderSortIcon('symbol')}
              </th>
              <th onClick={() => handleSort('qty')} className="sortable-th">
                Qty {renderSortIcon('qty')}
              </th>
              <th onClick={() => handleSort('marketValue')} className="sortable-th">
                Proceeds {renderSortIcon('marketValue')}
              </th>
              <th onClick={() => handleSort('costBasis')} className="sortable-th">
                Basis {renderSortIcon('costBasis')}
              </th>
              <th onClick={() => handleSort('gain')} className="sortable-th">
                Gain/Loss {renderSortIcon('gain')}
              </th>
              <th onClick={() => handleSort('holdingPeriod')} className="sortable-th">
                Period {renderSortIcon('holdingPeriod')}
              </th>
              <th onClick={() => handleSort('efficiency')} className="sortable-th">
                Efficiency {renderSortIcon('efficiency')}
              </th>
              <th onClick={() => handleSort('estTax')} className="sortable-th">
                Est. Tax {renderSortIcon('estTax')}
              </th>
              <th onClick={() => handleSort('openDate')} className="sortable-th">
                Open Date {renderSortIcon('openDate')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedLots.map((lot, i) => {
              const gain = (lot.marketValue || 0) - (lot.costBasis || 0);
              const estTax = getLotEstTax(lot);
              const efficiencyPct = (lot.efficiency || 0) * 100;

              return (
                <tr key={lot.id || `${lot.symbol}-${lot.openDate}-${i}`}>
                  <td>{lot.symbol}</td>
                  <td>{lot.qty.toFixed(3)}</td>
                  <td>{formatCurrency(lot.marketValue)}</td>
                  <td>{formatCurrency(lot.costBasis)}</td>
                  <td className={gain >= 0 ? 'positive' : 'negative'}>{formatCurrency(gain)}</td>
                  <td>{lot.holdingPeriod}</td>
                  <td className={lot.efficiency < 0 ? 'positive' : 'negative'}>{efficiencyPct.toFixed(2)}%</td>
                  <td className={estTax > 0 ? 'negative' : ''}>{formatCurrency(estTax)}</td>
                  <td>{lot.openDate}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan="2"><strong>Totals</strong></td>
              <td><strong>{formatCurrency(totalProceeds)}</strong></td>
              <td colSpan="4"></td>
              <td className="negative"><strong>{formatCurrency(totalTax)}</strong></td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default LiquidationTable;
