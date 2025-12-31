import { useState } from 'react';
import { Plus } from 'lucide-react';
import { FUND_METADATA } from '../utils/mfUtils';

const MFToolbar = ({ onAddMF }) => {
    const [symbol, setSymbol] = useState('');
    const [units, setUnits] = useState('');
    const [cost, setCost] = useState('');
    const [date, setDate] = useState('');

    const handleAdd = () => {
        const parsedUnits = parseFloat(units);
        const parsedCost = parseFloat(cost);
        if (!symbol || isNaN(parsedUnits) || parsedUnits <= 0 || isNaN(parsedCost) || !date) {
            alert('Please enter valid symbol, units, cost, and purchase date.');
            return;
        }
        onAddMF({
            symbol,
            units: parsedUnits,
            costBasis: parsedCost * parsedUnits, // Total cost
            avgCost: parsedCost,
            openDate: date
        });
        setSymbol('');
        setUnits('');
        setCost('');
        setDate('');
    };

    return (
        <div className="actions-toolbar">
            <div className="actions-group">
                <input
                    type="text"
                    placeholder="Fund Symbol (e.g. 0P0000XVJQ.BO)"
                    list="mf-suggestions"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    className="toolbar-input"
                    style={{ width: '250px' }}
                />
                <datalist id="mf-suggestions">
                    {FUND_METADATA.map(f => (
                        <option key={f.symbol} value={f.symbol}>{f.name}</option>
                    ))}
                </datalist>

                <input
                    type="number"
                    placeholder="Units"
                    value={units}
                    onChange={(e) => setUnits(e.target.value)}
                    className="toolbar-input"
                    style={{ width: '100px' }}
                />

                <input
                    type="number"
                    placeholder="Avg Cost (₹)"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    className="toolbar-input"
                    style={{ width: '120px' }}
                />

                <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="toolbar-input"
                    style={{ width: '140px' }}
                />

                <button className="toolbar-btn primary" onClick={handleAdd}>
                    <Plus size={18} />
                    <span>Add Fund</span>
                </button>
            </div>
        </div>
    );
};

export default MFToolbar;
