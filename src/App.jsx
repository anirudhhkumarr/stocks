import { useState } from 'react';
import { Briefcase } from 'lucide-react';
import StocksDashboard from './components/StocksDashboard';
import MFDashboard from './components/MFDashboard';

function App() {
  const [activeTab, setActiveTab] = useState('stocks');

  return (
    <div className="app-container">
      <header className="main-header">
        <div className="logo">
          <Briefcase className="brand-icon" />
          <span className="brand-name">Portfolio Analytics</span>
        </div>

        <nav className="tab-nav">
          <button
            className={`tab-btn ${activeTab === 'stocks' ? 'active' : ''}`}
            onClick={() => setActiveTab('stocks')}
          >
            Stocks
          </button>
          <button
            className={`tab-btn ${activeTab === 'mfs' ? 'active' : ''}`}
            onClick={() => setActiveTab('mfs')}
          >
            Mutual Funds
          </button>
        </nav>
      </header>

      <main className="container">
        {activeTab === 'stocks' ? <StocksDashboard /> : <MFDashboard />}
      </main>
    </div>
  );
}

export default App;
