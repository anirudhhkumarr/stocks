import { formatCurrency } from '../utils/calculations';

const LiquidationTable = ({ lots, targetAmount }) => {
  if (!lots || lots.length === 0 || targetAmount <= 0) return null;

  let totalProceeds = 0;
  let totalTax = 0;

  return (
    <div className="card table-card" style={{ marginTop: '2rem' }}>
      <div className="card-header">
        <h3>Optimal Liquidation Plan</h3>
      </div>
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Qty</th>
              <th>Proceeds</th>
              <th>Basis</th>
              <th>Gain/Loss</th>
              <th>Period</th>
              <th>Efficiency</th>
              <th>Est. Tax</th>
              <th>Open Date</th>
            </tr>
          </thead>
          <tbody>
            {lots.map((lot, i) => {
              totalProceeds += lot.marketValue;
              totalTax += lot.estTax || 0;
              const gain = lot.marketValue - lot.costBasis;
              const efficiencyPct = (lot.efficiency || 0) * 100;

              return (
                <tr key={i}>
                  <td>{lot.symbol}</td>
                  <td>{lot.qty.toFixed(3)}</td>
                  <td>{formatCurrency(lot.marketValue)}</td>
                  <td>{formatCurrency(lot.costBasis)}</td>
                  <td className={gain >= 0 ? 'positive' : 'negative'}>{formatCurrency(gain)}</td>
                  <td>{lot.holdingPeriod}</td>
                  <td className={lot.efficiency < 0 ? 'positive' : 'negative'}>{efficiencyPct.toFixed(2)}%</td>
                  <td className="negative">{formatCurrency(lot.estTax || 0)}</td>
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
