import { useState } from 'react';
import { Plus } from 'lucide-react';
import { FUND_METADATA } from '../utils/mfUtils';

const MFToolbar = ({ onAddMF }) => {
    const [symbol, setSymbol] = useState('');
    const [units, setUnits] = useState('');

    const handleAdd = () => {
        const parsedUnits = parseFloat(units);
        if (!symbol || isNaN(parsedUnits) || parsedUnits <= 0) {
            alert('Please enter a valid symbol and units.');
            return;
        }
        onAddMF({ symbol, units: parsedUnits });
        setSymbol('');
        setUnits('');
    };

    return (
        <div className="actions-toolbar">
            <div className="actions-group">
                <div className="input-group">
                    <input
                        type="text"
                        placeholder="Fund Symbol (e.g. 0P0000XVJQ.BO)"
                        list="mf-suggestions"
                        value={symbol}
                        onChange={(e) => setSymbol(e.target.value)}
                        className="toolbar-input"
                        style={{ width: '300px' }}
                    />
                    <datalist id="mf-suggestions">
                        {FUND_METADATA.map(f => (
                            <option key={f.symbol} value={f.symbol}>{f.name}</option>
                        ))}
                    </datalist>
                </div>
                <div className="input-group">
                    <input
                        type="number"
                        placeholder="Units"
                        value={units}
                        onChange={(e) => setUnits(e.target.value)}
                        className="toolbar-input"
                        style={{ width: '120px' }}
                    />
                </div>
                <button className="toolbar-btn primary" onClick={handleAdd}>
                    <Plus size={18} />
                    <span>Add Fund</span>
                </button>
            </div>
        </div>
    );
};

export default MFToolbar;
