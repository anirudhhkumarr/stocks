document.addEventListener('DOMContentLoaded', () => {
    const csvInput = document.getElementById('csvInput');
    const dropZone = document.getElementById('dropZone');
    const dashboard = document.getElementById('dashboard');
    const emptyState = document.getElementById('emptyState');
    const activeFilesContainer = document.getElementById('activeFiles');

    // State
    let storedFiles = {}; // { "filename": "content" }
    let currentFullStats = []; // Store full history for filtering
    let isLogScale = false;
    let isYearlyTicks = false;
    window.charts = {}; // Store chart instances for cleanup (GLOBAL)
    let activeLots = []; // Store active lots with live market values
    // Tax Simulator State
    let cachedSortedLots = null;
    let cachedSimResults = null;

    // Constants for 2024 Tax Brackets (MFJ)
    const FED_BRACKETS = [
        { limit: 23200, rate: 0.10 },
        { limit: 94300, rate: 0.12 },
        { limit: 201050, rate: 0.22 },
        { limit: 383900, rate: 0.24 },
        { limit: 487450, rate: 0.32 },
        { limit: 731200, rate: 0.35 },
        { limit: Infinity, rate: 0.37 }
    ];

    const FED_LTCG_BRACKETS = [
        { limit: 94050, rate: 0.00 },
        { limit: 583750, rate: 0.15 },
        { limit: Infinity, rate: 0.20 }
    ];

    const NIIT_THRESHOLD = 250000;
    const NIIT_RATE = 0.038;

    // CA 2024 Brackets (Approximate)
    const CA_BRACKETS = [
        { limit: 20824, rate: 0.01 },
        { limit: 49368, rate: 0.02 },
        { limit: 77918, rate: 0.04 },
        { limit: 108162, rate: 0.06 },
        { limit: 136700, rate: 0.08 },
        { limit: 349138, rate: 0.093 },
        { limit: 418962, rate: 0.103 },
        { limit: 698272, rate: 0.113 },
        { limit: 1396542, rate: 0.123 },
        { limit: Infinity, rate: 0.133 } // Mental Health handled separately if > 1M
    ];
    const CA_MENTAL_HEALTH_THRESHOLD = 1000000;
    const CA_MENTAL_HEALTH_RATE = 0.01;

    // Init
    // Init
    loadFilesFromStorage();
    setupChartControls();
    setupTaxSimulator();

    // Always call updateUI to set correct initial state
    updateUI();

    // Drag & Drop Handlers
    if (dropZone) {
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            handleFiles(e.dataTransfer.files);
        });
    }

    csvInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });

    function handleFiles(files) {
        if (files.length === 0) return;

        const promises = [];
        for (let file of files) {
            if (file.name.endsWith('.csv')) {
                promises.push(readFile(file));
            }
        }

        Promise.all(promises).then(results => {
            // Merge new files into storage
            results.forEach(f => {
                storedFiles[f.filename] = f.content;
            });
            saveFilesToStorage();
            updateUI();
        });
    }

    function readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                resolve({
                    filename: file.name,
                    content: e.target.result
                });
            };
            reader.readAsText(file);
        });
    }

    function updateUI() {
        const filenames = Object.keys(storedFiles);
        const stocksMain = document.getElementById('stocks-main-content');
        const stocksEmpty = document.getElementById('emptyState');

        // Always 'remove hidden' from activeFilesContainer if there are files
        if (filenames.length > 0) {
            activeFilesContainer.classList.remove('hidden');
            renderActiveFiles(filenames);
        } else {
            activeFilesContainer.classList.add('hidden');
        }

        if (filenames.length === 0) {
            stocksMain.classList.add('hidden');
            stocksEmpty.classList.remove('hidden');
            return;
        }

        try {
            // Process and Render Dashboard
            const filesData = filenames.map(name => ({ filename: name, content: storedFiles[name] }));
            const portfolioData = processData(filesData);

            if (portfolioData.lots.length === 0) {
                console.warn('No valid lots found in processed data.');
            }

            renderDashboard(portfolioData);

            // Show content, Hide empty state
            stocksMain.classList.remove('hidden');
            stocksEmpty.classList.add('hidden');

            // Trigger Async History Fetch
            fetchAndRenderDashboard(portfolioData.lots, portfolioData.summary);
        } catch (e) {
            console.error('Error in updateUI/processData:', e);
            alert('Error processing data. Check console for details.');
        }
    }

    function renderActiveFiles(filenames) {
        activeFilesContainer.innerHTML = '';
        filenames.forEach(name => {
            const chip = document.createElement('div');
            chip.className = 'file-chip';
            chip.innerHTML = `
                <span class="name">${name}</span>
                <button class="remove-btn" title="Remove file">×</button>
            `;

            // Remove handler
            chip.querySelector('.remove-btn').addEventListener('click', () => {
                delete storedFiles[name];
                saveFilesToStorage();
                updateUI();
            });

            activeFilesContainer.appendChild(chip);
        });
    }

    // Storage Functions
    function saveFilesToStorage() {
        try {
            localStorage.setItem('portfolio_files', JSON.stringify(storedFiles));
        } catch (e) {
            alert('Storage quota exceeded. Some files might not be saved strictly locally.');
            console.error('LocalStorage error:', e);
        }
    }

    function loadFilesFromStorage() {
        try {
            const data = localStorage.getItem('portfolio_files');
            if (data) {
                storedFiles = JSON.parse(data);
            }
        } catch (e) {
            console.error('Error loading files:', e);
            storedFiles = {};
        }
    }

    function setupChartControls() {
        // Date Range Buttons
        const buttons = document.querySelectorAll('.filter-btn[data-range]');
        buttons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Update UI
                buttons.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');

                // Filter
                // const range = e.target.dataset.range; // Moved to updateChartRender
                updateChartRender();
            });
        });

        // Log Scale Button
        const logBtn = document.getElementById('logScaleBtn');
        if (logBtn) {
            logBtn.addEventListener('click', () => {
                isLogScale = !isLogScale;
                logBtn.classList.toggle('active', isLogScale);
                updateChartRender();
            });
        }

        // Years Toggle Button
        const annualBtn = document.getElementById('yearlyTicksBtn');
        if (annualBtn) {
            annualBtn.addEventListener('click', () => {
                isYearlyTicks = !isYearlyTicks;
                annualBtn.classList.toggle('active', isYearlyTicks);
                updateChartRender();
            });
        }
    }

    function updateChartRender() {
        const activeRangeBtn = document.querySelector('.filter-btn[data-range].active');
        const range = activeRangeBtn ? activeRangeBtn.dataset.range : 'max';
        filterHistory(range);
    }

    function filterHistory(range) {
        if (!currentFullStats || currentFullStats.length === 0) return;

        let filteredData = [...currentFullStats];

        if (range !== 'max') {
            const now = new Date();
            let cutoffDate = new Date();

            if (range === '1m') cutoffDate.setMonth(now.getMonth() - 1);
            else if (range === '1y') cutoffDate.setFullYear(now.getFullYear() - 1);
            else if (range === '2y') cutoffDate.setFullYear(now.getFullYear() - 2);
            else if (range === '5y') cutoffDate.setFullYear(now.getFullYear() - 5);

            const cutoffStr = cutoffDate.toISOString().split('T')[0];
            filteredData = currentFullStats.filter(d => d.date >= cutoffStr);
        }

        renderAdvancedCumulativeChart(filteredData);
    }

    function processData(filesData) {
        let allLots = [];
        let portfolioSummary = {
            totalValue: 0, // Will be calculated from live data
            totalCost: 0,
            totalGain: 0,
            shortTermGain: 0,
            longTermGain: 0,
            stocks: {}
        };

        filesData.forEach(file => {
            if (!file.content || typeof file.content !== 'string') {
                console.warn(`Skipping invalid file content for: ${file.filename}`, file.content);
                return;
            }

            const symbol = file.filename.replace('.csv', '');
            // Robust split for all newline types
            const lines = file.content.split(/\r\n|\n|\r/);

            // console.log(`Processing ${file.filename}: ${lines.length} lines. Content sample: ${file.content.substring(0, 50)}...`);

            // Find header line (starts with "Open Date")
            let headerIndex = -1;
            for (let i = 0; i < lines.length; i++) {
                // Remove potential quotes just in case
                const cleanLine = lines[i].replace(/"/g, '');
                if (cleanLine.includes('Open Date')) {
                    headerIndex = i;
                    // console.log(`Found header at line ${i}: ${lines[i]}`);
                    break;
                }
            }

            if (headerIndex === -1) {
                console.error(`Could not find header "Open Date" in ${file.filename}. Content dump (first 500 chars):`, file.content.substring(0, 500));
                return;
            }

            // Parse Header to find indices
            const headerCols = parseCSVLine(lines[headerIndex]).map(c => c.replace(/"/g, '').trim());
            // qty: headerCols.indexOf('Quantity'),
            // costBasis: headerCols.indexOf('Cost Basis'),
            // Simplified Map - Only what we need
            const colMap = {
                qty: headerCols.indexOf('Quantity'),
                costBasis: headerCols.indexOf('Cost Basis')
            };

            if (colMap.qty === -1 || colMap.costBasis === -1) {
                console.error(`Missing required columns in ${file.filename}. Found:`, headerCols);
                return;
            }

            // Check enough columns exist (max index)
            const maxColIndex = Math.max(colMap.qty, colMap.costBasis);

            let validRows = 0;

            // Parse rows
            for (let i = headerIndex + 1; i < lines.length; i++) {
                const line = lines[i].trim();
                // Skip empty lines or Total lines
                if (!line || line.toLowerCase().startsWith('"total"') || line.toLowerCase().startsWith('total')) continue;

                // CSV split handling quotes
                const cols = parseCSVLine(line);

                if (cols.length <= maxColIndex) {
                    continue;
                }

                let openDateRaw = cols[0];
                // Normalize date to YYYY-MM-DD
                let openDate = '';
                if (openDateRaw) {
                    const d = new Date(openDateRaw);
                    if (!isNaN(d.getTime())) {
                        openDate = d.toISOString().split('T')[0];
                    }
                }

                if (!openDate) continue;

                const qty = parseFloat(cleanNum(cols[colMap.qty]));
                const costBasis = parseFloat(cleanNum(cols[colMap.costBasis]));

                if (isNaN(qty)) continue;

                // Create lot with minimalistic data.
                // Market Info & Term are populated dynamically later.
                const lot = {
                    symbol,
                    openDate,
                    qty,
                    costBasis,
                    marketValue: 0,
                    gainLoss: 0,
                    holdingPeriod: 'Unknown' // Will be calc'd
                };

                allLots.push(lot);
                validRows++;

                // Aggregation - ONLY Cost Basis from CSV
                portfolioSummary.totalCost += costBasis;
                // portfolioSummary.totalValue += marketValue; // Removed
                // portfolioSummary.totalGain += gainLoss;     // Removed

                if (!portfolioSummary.stocks[symbol]) {
                    portfolioSummary.stocks[symbol] = {
                        marketValue: 0, // Reset to 0
                        costBasis: 0,
                        gainLoss: 0,
                        qty: 0
                    };
                }
                // portfolioSummary.stocks[symbol].marketValue += marketValue;
                portfolioSummary.stocks[symbol].costBasis += costBasis;
                // portfolioSummary.stocks[symbol].gainLoss += gainLoss;
                portfolioSummary.stocks[symbol].qty += qty;
            }
            // console.log(`Parsed ${validRows} valid rows from ${file.filename}`);
        });

        return { lots: allLots, summary: portfolioSummary };
    }

    // --- Historical Data & Advanced Charting ---

    async function fetchAndRenderDashboard(lots, initialSummary) {
        if (lots.length === 0) return;

        const uniqueSymbols = [...new Set(lots.map(l => l.symbol))];

        try {
            const priceHistory = {};
            const currentPrices = {};

            // Parallel Fetch
            await Promise.all(uniqueSymbols.map(async symbol => {
                const data = await fetchStockData(symbol);
                if (data) {
                    priceHistory[symbol] = data;
                    // Get latest price
                    const dates = Object.keys(data).sort();
                    const lastDate = dates[dates.length - 1];
                    currentPrices[symbol] = data[lastDate];
                }
            }));

            // Calculate Live Summary
            const liveSummary = { ...initialSummary }; // Copy structure
            liveSummary.totalValue = 0;
            liveSummary.totalGain = 0;
            liveSummary.shortTermGain = 0;
            liveSummary.longTermGain = 0;
            // liveSummary.totalCost is already correct from CSV

            // We need to re-aggregate stock-level data with live prices
            // First, reset stock summaries that depend on value
            Object.keys(liveSummary.stocks).forEach(sym => {
                liveSummary.stocks[sym].marketValue = 0;
                liveSummary.stocks[sym].gainLoss = 0;
            });

            lots.forEach(lot => {
                const currentPrice = currentPrices[lot.symbol] || 0; // Fallback to 0 if fetch failed
                const marketValue = lot.qty * currentPrice;
                const gainLoss = marketValue - lot.costBasis;

                // Update Lot (optional, if we want to display lot-level details later)
                lot.marketValue = marketValue;
                lot.gainLoss = gainLoss;

                // Recalculate Holding Period based on Date
                const openDate = new Date(lot.openDate);
                const now = new Date();
                const diffTime = now - openDate;
                const diffDays = diffTime / (1000 * 60 * 60 * 24);
                const term = diffDays > 365 ? 'Long Term' : 'Short Term';
                lot.holdingPeriod = term; // Maintain for display/logic

                // Aggregate Global
                liveSummary.totalValue += marketValue;
                liveSummary.totalGain += gainLoss;

                if (term === 'Short Term') {
                    liveSummary.shortTermGain += gainLoss;
                } else {
                    liveSummary.longTermGain += gainLoss;
                }

                // Aggregate Stock Level
                if (liveSummary.stocks[lot.symbol]) {
                    liveSummary.stocks[lot.symbol].marketValue += marketValue;
                    liveSummary.stocks[lot.symbol].gainLoss += gainLoss;
                }
            });

            // Update Global State for Simulator
            activeLots = lots;

            // Re-render Dashboard with Live Data
            renderDashboard({ lots, summary: liveSummary });

            if (Object.keys(priceHistory).length > 0) {
                const series = calculatePortfolioHistory(lots, priceHistory);
                currentFullStats = series; // Save for filtering
                renderAdvancedCumulativeChart(series);
                runTaxSimulation(activeLots); // Trigger Simulator with LIVE lots
            }

        } catch (e) {
            console.error('Data fetch error:', e);
            alert('Failed to load live market data. Dashboard may be incomplete.');
        }
    }

    function calculatePortfolioHistory(lots, priceHistory) {
        // 1. Determine Date Range
        const dates = lots.map(l => new Date(l.openDate));
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(); // Today

        const dateList = [];
        for (let d = new Date(minDate); d <= maxDate; d.setDate(d.getDate() + 1)) {
            dateList.push(d.toISOString().split('T')[0]);
        }

        const stats = [];
        const lastKnownPrices = {}; // Cache for forward filling

        // 2. Iterate Days
        dateList.forEach(dateStr => {
            // Find active lots for this date
            const activeLots = lots.filter(l => l.openDate <= dateStr);

            if (activeLots.length === 0) return;

            let dailyCost = 0;
            let dailyValue = 0;

            activeLots.forEach(lot => {
                dailyCost += lot.costBasis;

                // Update last known price if available for this date
                const prices = priceHistory[lot.symbol];
                if (prices && prices[dateStr]) {
                    lastKnownPrices[lot.symbol] = prices[dateStr];
                }

                // Use last known price (Forward Fill)
                let price = lastKnownPrices[lot.symbol] || 0;

                // Fallback only if no price ever seen (start of chart)
                if (price > 0) {
                    dailyValue += (lot.qty * price);
                } else {
                    dailyValue += lot.costBasis;
                }
            });

            stats.push({
                date: dateStr,
                cost: dailyCost,
                value: dailyValue
            });
        });

        return stats;
    }

    function createStatusElement() {
        const div = document.createElement('div');
        div.id = 'historyStatus';
        div.className = 'history-status';
        document.querySelector('.charts-grid').prepend(div);
        return div;
    }

    // ------------------------------------------

    function parseCSVLine(text) {
        // Simple CSV parser handling quoted fields
        const re_valid = /^\s*(?:'[^'\\]*(?:\\[\S\s][^'\\]*)*'|"[^"\\]*(?:\\[\S\s][^"\\]*)*"|[^,'"\s\\]*(?:\s+[^,'"\s\\]+)*)\s*(?:,\s*(?:'[^'\\]*(?:\\[\S\s][^'\\]*)*'|"[^"\\]*(?:\\[\S\s][^"\\]*)*"|[^,'"\s\\]*(?:\s+[^,'"\s\\]+)*)\s*)*$/;
        const re_value = /(?!\s*$)\s*(?:'([^'\\]*(?:\\[\S\s][^'\\]*)*)'|"([^"\\]*(?:\\[\S\s][^"\\]*)*)"|([^,'"\s\\]*(?:\s+[^,'"\s\\]+)*))\s*(?:,|$)/g;

        const a = [];
        text.replace(re_value, function (m0, m1, m2, m3) {
            if (m1 !== undefined) a.push(m1.replace(/\\'/g, "'"));
            else if (m2 !== undefined) a.push(m2.replace(/\\"/g, '"'));
            else if (m3 !== undefined) a.push(m3);
            return '';
        });
        if (/,\s*$/.test(text)) a.push('');
        return a;
    }

    function formatPercent(num) {
        return num.toFixed(2) + '%';
    }

    function renderDashboard(data) {
        const { summary, lots } = data;

        // 1. Summary Cards
        const isLoading = summary.totalValue === 0 && lots.length > 0;

        if (isLoading) {
            document.getElementById('totalValue').textContent = 'Loading...';
            document.getElementById('totalGain').textContent = '--';
            document.getElementById('totalGain').className = 'primary-value'; // Reset class
            document.getElementById('totalGainPercent').textContent = '--';

            // Reset Trend Badge
            const badge = document.getElementById('trendBadge');
            badge.className = 'trend-badge';

            document.getElementById('totalXirr').textContent = 'Loading...';

            // Reset Bars
            document.getElementById('valueProgressBar').style.width = '0%';
            document.getElementById('barST').style.width = '50%'; // Default
            document.getElementById('barLT').style.width = '50%';

            // Clear or hide chart containers if needed, but for now just don't render
            destroyChart('allocationChart');
            destroyChart('gainsChart');
        } else {
            // 1. Valuation Pillar
            document.getElementById('totalValue').textContent = formatCurrency(summary.totalValue);

            const totalCostEl = document.getElementById('totalCostBasis');
            /* Fix: Ensure element exists before setting */
            if (totalCostEl) totalCostEl.textContent = formatCurrency(summary.totalCost);

            // Value Progress Bar (Cost vs Value)
            // If Value > Cost, Bar is full (100%). If Value < Cost, maybe show ratio? 
            // Let's visualize "Cost as % of Value" if profitable, or full if loss?
            // Actually simplest: Cost / Value. If profitable (Value > Cost), Cost bar is < 100%.
            // If Loss (Value < Cost), Cost bar is 100% (clipped) or maybe we invert logic?
            // "Investment vs Value": Let's show Cost Basis as the filled portion? 
            // No, usually "Progress" implies "How much of the total is X".
            // Let's rely on a simple visual: Width = (Cost / Value) * 100.
            const costPercent = summary.totalValue > 0 ? Math.min((summary.totalCost / summary.totalValue) * 100, 100) : 0;
            document.getElementById('valueProgressBar').style.width = `${costPercent}%`;


            // 2. Performance Pillar
            const totalGainEl = document.getElementById('totalGain');
            totalGainEl.textContent = formatCurrency(summary.totalGain);
            totalGainEl.className = `primary-value ${summary.totalGain >= 0 ? 'positive' : 'negative'}`;

            const totalGainPercent = summary.totalCost ? (summary.totalGain / summary.totalCost) * 100 : 0;
            const totalGainPercentEl = document.getElementById('totalGainPercent');
            totalGainPercentEl.textContent = formatPercent(totalGainPercent);

            // Update Trend Badge Color
            const badge = document.getElementById('trendBadge');
            badge.className = `trend-badge ${totalGainPercent >= 0 ? 'positive' : 'negative'}`;

            // XIRR Calculation
            const xirr = calculateXIRR(lots, summary.totalValue);
            const xirrEl = document.getElementById('totalXirr');
            if (xirr !== null) {
                xirrEl.textContent = formatPercent(xirr * 100);
                // Optional: Color code XIRR tag too?
                // xirrEl.style.color = xirr >= 0 ? 'var(--success-color)' : 'var(--danger-color)';
            } else {
                xirrEl.textContent = '--';
            }


            // 3. Efficiency Pillar (Effective Return populated later by sim, but we set base here)
            // Setup Gain Split Bar
            const totalAbsGain = Math.abs(summary.shortTermGain) + Math.abs(summary.longTermGain);
            if (totalAbsGain > 0) {
                const stPercent = (Math.abs(summary.shortTermGain) / totalAbsGain) * 100;
                const ltPercent = (Math.abs(summary.longTermGain) / totalAbsGain) * 100;
                document.getElementById('barST').style.width = `${stPercent}%`;
                document.getElementById('barLT').style.width = `${ltPercent}%`;
            } else {
                document.getElementById('barST').style.width = '0%';
                document.getElementById('barLT').style.width = '0%';
            }

            // Note: document.getElementById('shortTermGain') no longer exists in DOM, 
            // logic relying on strictly updating text content there should be removed or adapted if we want to show exact numbers.
            // For now, the visual bar replaces the text numbers in the summary card.

            // 2. Charts (Only render when data is ready)
            // renderAllocationChart(summary.stocks); // Removed
        }

        // 3. Cost Basis Chart (Always render, as it relies on static CSV data)
        document.getElementById('totalCostBasis').textContent = formatCurrency(summary.totalCost);
        renderCumulativeChart(lots);
    }

    // XIRR Calculation using Newton-Raphson method
    function calculateXIRR(lots, currentValue) {
        if (!lots || lots.length === 0 || currentValue <= 0) return null;

        // Build cash flows: negative for investments (cost basis at open date), positive for current value today
        const cashFlows = [];
        const today = new Date();

        lots.forEach(lot => {
            if (lot.costBasis > 0 && lot.openDate) {
                cashFlows.push({
                    date: new Date(lot.openDate),
                    amount: -lot.costBasis // Outflow (investment)
                });
            }
        });

        // Add current value as final inflow (today)
        cashFlows.push({
            date: today,
            amount: currentValue
        });

        if (cashFlows.length < 2) return null;

        // Sort by date
        cashFlows.sort((a, b) => a.date - b.date);

        // Reference date for calculating year fractions
        const refDate = cashFlows[0].date;

        // Calculate year fractions from reference date
        const yearFractions = cashFlows.map(cf => {
            const diffMs = cf.date - refDate;
            return diffMs / (365.25 * 24 * 60 * 60 * 1000);
        });

        // Newton-Raphson to find XIRR
        // NPV(r) = sum(cf_i / (1+r)^t_i) = 0
        function npv(rate) {
            let sum = 0;
            for (let i = 0; i < cashFlows.length; i++) {
                sum += cashFlows[i].amount / Math.pow(1 + rate, yearFractions[i]);
            }
            return sum;
        }

        function npvDerivative(rate) {
            let sum = 0;
            for (let i = 0; i < cashFlows.length; i++) {
                sum -= yearFractions[i] * cashFlows[i].amount / Math.pow(1 + rate, yearFractions[i] + 1);
            }
            return sum;
        }

        let rate = 0.1; // Initial guess 10%
        const maxIterations = 100;
        const tolerance = 1e-7;

        for (let i = 0; i < maxIterations; i++) {
            const npvValue = npv(rate);
            const npvDeriv = npvDerivative(rate);

            if (Math.abs(npvDeriv) < 1e-10) break; // Avoid division by zero

            const newRate = rate - npvValue / npvDeriv;

            if (Math.abs(newRate - rate) < tolerance) {
                return newRate;
            }

            rate = newRate;

            // Bound the rate to reasonable values
            if (rate < -0.99) rate = -0.99;
            if (rate > 10) rate = 10;
        }

        // If didn't converge, return the last estimate if reasonable
        if (rate > -0.99 && rate < 10) {
            return rate;
        }

        return null;
    }



    function destroyChart(id) {
        if (charts[id]) {
            charts[id].destroy();
        }
    }



    function renderCumulativeChart(lots) {
        // Initial render: Just Cost Basis (synchronous)
        const ctx = document.getElementById('cumulativeChart').getContext('2d');
        destroyChart('cumulativeChart');

        const sortedLots = [...lots].sort((a, b) => new Date(a.openDate) - new Date(b.openDate));
        const dataPoints = [];
        let runningTotal = 0;
        const dateMap = new Map();

        sortedLots.forEach(lot => {
            const date = new Date(lot.openDate);
            if (isNaN(date)) return;
            const dateStr = date.toISOString().split('T')[0];
            if (!dateMap.has(dateStr)) dateMap.set(dateStr, 0);
            dateMap.set(dateStr, dateMap.get(dateStr) + lot.costBasis);
        });

        const sortedDates = Array.from(dateMap.keys()).sort();
        sortedDates.forEach(date => {
            runningTotal += dateMap.get(date);
            dataPoints.push({ x: date, y: runningTotal });
        });

        charts['cumulativeChart'] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: sortedDates,
                datasets: [{
                    label: 'Cost Basis ($)',
                    data: dataPoints.map(dp => dp.y),
                    borderColor: '#2d3748',
                    backgroundColor: 'rgba(45, 55, 72, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.1,
                    pointRadius: 0,
                    pointHitRadius: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                scales: {
                    y: {
                        grid: { color: '#2d3748' },
                        ticks: {
                            color: '#9ca3af',
                            callback: v => '$' + Math.round(v).toLocaleString()
                        }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#9ca3af', maxTicksLimit: 10 }
                    }
                },
                plugins: {
                    legend: { display: true, labels: { color: '#fff' } },
                    tooltip: {
                        callbacks: { label: c => c.dataset.label + ': $' + Math.round(c.raw).toLocaleString() }
                    }
                }
            }
        });
    }

    function renderAdvancedCumulativeChart(historyData) {
        // Advanced render: Market Value vs Cost Basis
        const ctx = document.getElementById('cumulativeChart').getContext('2d');
        destroyChart('cumulativeChart');

        // Filter for Yearly Mode (Today, Today-1y, Today-2y...)
        let chartData = historyData;
        if (isYearlyTicks && historyData.length > 0) {
            // Get the last available date from data (effectively "Today" or most recent)
            const lastDataPoint = historyData[historyData.length - 1];
            const lastDateObj = new Date(lastDataPoint.date); // e.g. 2024-12-08

            // Generate target dates: [Today, Today-1y, Today-2y...]
            const targetDates = new Set();
            // Start from latest year, go back until minDate
            const minDateStr = historyData[0].date;
            const minYear = new Date(minDateStr).getFullYear();

            let currentCursor = new Date(lastDateObj);

            // Loop backwards
            while (currentCursor.getFullYear() >= minYear) {
                const dateStr = currentCursor.toISOString().split('T')[0];
                targetDates.add(dateStr);

                // Subtract 1 year
                currentCursor.setFullYear(currentCursor.getFullYear() - 1);

                // Safety check: if subtracting year yields same date (e.g. invalid?), stop
                // But setFullYear handles leap years (Feb 29 -> Feb 28/Mar 1).
                // Just ensure we don't loop forever if date logic is weird? 
                // YYYY decreases, loop terminates.
            }

            // Also ensure we include the very start if it's not aligned? 
            // User requested "datapoint for today - 1y...". Not necessarily start date.

            chartData = historyData.filter(d => targetDates.has(d.date));
        }

        const labels = chartData.map(d => d.date);
        const costData = chartData.map(d => d.cost);
        const valueData = chartData.map(d => d.value);

        charts['cumulativeChart'] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Total Portfolio Value',
                        data: valueData,
                        borderColor: '#10b981', // Green
                        backgroundColor: 'transparent',
                        fill: {
                            target: 1,
                            above: 'rgba(16, 185, 129, 0.2)',   // Green area above
                            below: 'rgba(239, 68, 68, 0.2)'     // Red area below
                        },
                        borderWidth: 2,
                        tension: 0.1,
                        pointRadius: isYearlyTicks ? 4 : 0, // Show points on yearly
                        pointHoverRadius: 6,
                        pointHitRadius: 10
                    },
                    {
                        label: 'Invested Capital ($)',
                        data: costData,
                        borderColor: '#3b82f6', // Blue
                        borderWidth: 2,

                        fill: false,
                        tension: 0.1,
                        pointRadius: isYearlyTicks ? 4 : 0,
                        pointHoverRadius: 6,
                        pointHitRadius: 10
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                scales: {
                    y: {
                        type: isLogScale ? 'logarithmic' : 'linear',
                        grid: { color: '#2d3748' },
                        ticks: {
                            color: '#9ca3af',
                            callback: v => '$' + Math.round(v).toLocaleString()
                        }
                    },
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: '#9ca3af',
                            maxTicksLimit: isYearlyTicks ? 20 : 10,
                            // For yearly mode with filtered data, standard ticks are fine as labels are YYYY-MM-DD
                            // Or we can just show Year.
                            callback: function (val, index) {
                                const label = this.getLabelForValue(val);
                                if (isYearlyTicks) {
                                    return label.substring(0, 4); // Just the Year
                                }
                                return label;
                            }
                        }
                    }
                },
                plugins: {
                    legend: { display: true, labels: { color: '#fff' } },
                    tooltip: {
                        callbacks: { label: c => c.dataset.label + ': $' + Math.round(c.raw).toLocaleString() }
                    }
                }
            }
        });
    }



    function renderTable(lots) {
        const tbody = document.querySelector('#holdingsTable tbody');
        tbody.innerHTML = '';

        // Sort by date desc
        lots.sort((a, b) => new Date(b.openDate) - new Date(a.openDate));

        lots.forEach(lot => {
            const tr = document.createElement('tr');
            const percentGain = (lot.gainLoss / lot.costBasis) * 100;

            tr.innerHTML = `
                <td>${lot.symbol}</td>
                <td>${lot.qty.toFixed(3)}</td>
                <td>${formatCurrency(lot.costBasis)}</td>
                <td>${formatCurrency(lot.marketValue)}</td>
                <td class="${lot.gainLoss >= 0 ? 'positive' : 'negative'}">${formatCurrency(lot.gainLoss)}</td>
                <td class="${percentGain >= 0 ? 'positive' : 'negative'}">${formatPercent(percentGain)}</td>
                <td>${lot.holdingPeriod}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // --- Tax Simulator ---

    // Constants for 2024 Tax Brackets (MFJ)




    function setupTaxSimulator() {
        // Load saved state
        const savedW2 = localStorage.getItem('w2Income');
        const savedTarget = localStorage.getItem('targetLiquidation');

        const w2Input = document.getElementById('w2Income');
        const targetInput = document.getElementById('targetLiquidation');

        if (savedW2) w2Input.value = savedW2;
        if (savedTarget) {
            targetInput.value = savedTarget;
        }

        // Debounce helper
        function debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }

        const debouncedRunSim = debounce(() => {
            localStorage.setItem('w2Income', w2Input.value);
            runTaxSimulation();
        }, 500);

        const debouncedUpdatePlan = debounce(() => {
            localStorage.setItem('targetLiquidation', targetInput.value);
            updateLiquidationPlanOnly();
        }, 100);

        // W2 auto-run
        if (w2Input) w2Input.addEventListener('input', debouncedRunSim);

        // Simple helper for slider fill
        const updateSliderFill = (slider) => {
            const val = parseFloat(slider.value) || 0;
            const max = parseFloat(slider.max) || 100;
            const percent = (val / max) * 100;
            slider.style.backgroundImage = `linear-gradient(to right, #10b981 ${percent}%, #e5e7eb ${percent}%)`;

            if (val > 0) slider.classList.add('active');
            else slider.classList.remove('active');
        };

        // Slider Logic (Updates Table Only)
        if (targetInput) {
            targetInput.addEventListener('input', (e) => {
                updateSliderFill(e.target);
                debouncedUpdatePlan();
            });
        }

        // Run once on load if data exists
        if (currentFullStats && currentFullStats.length > 0) {
            runTaxSimulation();
        }
    }

    function runTaxSimulation(latestLots) {
        // Use provided lots (live) or fall back to activeLots state
        let lots = latestLots || activeLots;

        // If we don't have live lots yet, try initial CSV lots (though they may be stale)
        if (!lots || lots.length === 0) {
            const filenames = Object.keys(storedFiles);
            const filesData = filenames.map(name => ({ filename: name, content: storedFiles[name] }));
            const result = processData(filesData); // This uses CSV Market Value!
            lots = result.lots;
        }

        if (!lots || lots.length === 0) return;

        // Make sure we have valid market values. If processData returned 0 values (because we modified it), 
        // and we haven't fetched live data yet, we can't really run the sim.
        // Check total value
        const totalValue = lots.reduce((sum, lot) => sum + lot.marketValue, 0);
        if (totalValue === 0) {
            console.warn('Cannot run tax simulation: Total Market Value is 0 (waiting for live data).');
            return;
        }

        const targetInput = document.getElementById('targetLiquidation');

        if (targetInput && targetInput.getAttribute('max') !== String(totalValue)) {
            targetInput.max = totalValue;
            // Update fill if max changed
            const val = parseFloat(targetInput.value) || 0;
            const percent = (val / totalValue) * 100;
            targetInput.style.backgroundImage = `linear-gradient(to right, #10b981 ${percent}%, #e5e7eb ${percent}%)`;
        }

        const w2Income = parseFloat(document.getElementById('w2Income').value) || 0;

        // Calculate and Cache Sorted Lots
        const results = simulateLiquidation(lots, w2Income);
        // Extract the sorted lots from results data points (which are sorted by efficiency) to avoid re-calc
        cachedSortedLots = results.map(r => r.lot);
        cachedSimResults = results;

        // Update effective return with after-tax metrics
        const effectiveReturnEl = document.getElementById('effectiveReturn');
        const effectiveReturnXirrEl = document.getElementById('effectiveReturnXirr');
        if (results.length > 0 && w2Income > 0) {
            const lastResult = results[results.length - 1];
            const fullTax = lastResult.y;
            const totalProceeds = lastResult.x;
            const totalBasis = lastResult.basis;

            // Effective return = (Proceeds - Tax - Basis) / Basis
            const afterTaxGain = totalProceeds - fullTax - totalBasis;
            const effectiveReturnPct = totalBasis > 0 ? (afterTaxGain / totalBasis) * 100 : 0;
            effectiveReturnEl.textContent = formatPercent(effectiveReturnPct);
            effectiveReturnEl.className = `value ${effectiveReturnPct >= 0 ? 'positive' : 'negative'}`;

            // Calculate XIRR after tax using after-tax liquidation value
            const afterTaxValue = totalProceeds - fullTax;
            const xirrAfterTax = calculateXIRR(lots, afterTaxValue);
            if (xirrAfterTax !== null) {
                effectiveReturnXirrEl.textContent = formatPercent(xirrAfterTax * 100) + ' XIRR';
                effectiveReturnXirrEl.className = `sub-value ${xirrAfterTax >= 0 ? 'positive' : 'negative'}`;
            } else {
                effectiveReturnXirrEl.textContent = '--';
                effectiveReturnXirrEl.className = 'sub-value';
            }
        } else if (w2Income === 0) {
            effectiveReturnEl.textContent = '--';
            effectiveReturnEl.className = 'value';
            effectiveReturnXirrEl.textContent = '--';
            effectiveReturnXirrEl.className = 'sub-value';
        }

        renderTaxChart(results);
        updateLiquidationPlanOnly();
    }

    function updateLiquidationPlanOnly() {
        if (!cachedSortedLots || cachedSortedLots.length === 0) return;

        const targetInput = document.getElementById('targetLiquidation');
        const targetAmount = parseFloat(targetInput.value) || 0;

        if (targetAmount > 0) {
            generateLiquidationPlan(targetAmount);
        } else {
            document.getElementById('liquidationPlan').classList.add('hidden');
            updateSimStats(0); // Clear stats when 0
        }
    }

    function generateLiquidationPlan(targetAmount) {
        if (!cachedSortedLots) return;

        const planLots = [];
        let runningTotal = 0;

        for (let lot of cachedSortedLots) {
            if (runningTotal >= targetAmount) break;
            planLots.push(lot);
            runningTotal += lot.marketValue;
        }

        renderLiquidationTable(planLots);
        updateSimStats(planLots.length);
    }

    function updateSimStats(count) {
        const statsEl = document.getElementById('simStats');

        if (count === 0 || !cachedSimResults) {
            document.getElementById('simTotalValue').textContent = formatCurrency(0);
            document.getElementById('simTotalTax').textContent = formatCurrency(0);
            document.getElementById('simEffectiveRate').textContent = '0.00%';
            statsEl.classList.remove('hidden');
            return;
        }

        // Get cumulative data from the last included lot (index = count - 1)
        const dataPoint = cachedSimResults[count - 1];

        // DataPoint has: x (Proceeds), y (Tax), basis (Basis), lot
        const proceeds = dataPoint.x;
        const tax = dataPoint.y;
        const basis = dataPoint.basis;
        const gain = proceeds - basis; // Or derive from tax calc if cleaner, but this is consistent

        document.getElementById('simTotalValue').textContent = formatCurrency(proceeds - tax);
        document.getElementById('simTotalTax').textContent = formatCurrency(tax);

        // Effective Rate on Liquidation Value
        const effectiveRate = proceeds > 0 ? (tax / proceeds) * 100 : 0;
        document.getElementById('simEffectiveRate').textContent = effectiveRate.toFixed(2) + '%';
        statsEl.classList.remove('hidden');
    }

    function renderLiquidationTable(lots) {
        const container = document.getElementById('liquidationPlan');
        const tbody = document.querySelector('#liquidationTable tbody');
        const totalProceedsEl = document.getElementById('planTotalProceeds');
        const totalTaxEl = document.getElementById('planTotalTax');

        if (!container || !tbody) return;

        tbody.innerHTML = '';
        container.classList.remove('hidden');

        let totalProceeds = 0;
        let totalTax = 0;

        lots.forEach(lot => {
            totalProceeds += lot.marketValue;
            totalTax += lot.estTax;

            const gain = lot.marketValue - lot.costBasis;
            const gainClass = gain >= 0 ? 'positive' : 'negative';
            const efficiencyPercent = (lot.efficiency * 100).toFixed(2) + '%';
            const efficiencyClass = lot.efficiency < 0 ? 'positive' : 'negative';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${lot.symbol}</td>
                <td>${lot.qty.toFixed(3)}</td>
                <td>${formatCurrency(lot.marketValue)}</td>
                <td>${formatCurrency(lot.costBasis)}</td>
                <td class="${gainClass}">${formatCurrency(gain)}</td>
                <td>${lot.holdingPeriod}</td>
                <td class="${efficiencyClass}">${efficiencyPercent}</td>
                <td class="negative">${formatCurrency(lot.estTax)}</td>
                <td>${lot.openDate}</td>
            `;
            tbody.appendChild(tr);
        });

        if (totalProceedsEl) totalProceedsEl.textContent = formatCurrency(totalProceeds);
        if (totalTaxEl) totalTaxEl.textContent = formatCurrency(totalTax);
    }

    function simulateLiquidation(lots, w2Income) {
        // Base Tax (W2 only)
        const baseTax = calculateTotalTax(w2Income, 0);

        // 1. Calculate TRUE Marginal Tax & Efficiency for each lot
        const augmentedLots = lots.map(lot => {
            const gain = lot.gainLoss;
            const isLongTerm = lot.holdingPeriod === 'Long Term';

            // Calculate tax if we sell JUST this lot
            let taxableOrdinary = w2Income;
            let taxableLTCG = 0;

            if (gain >= 0) {
                // Positive gain
                if (isLongTerm) {
                    taxableLTCG = gain;
                } else {
                    taxableOrdinary += gain;
                }
            } else {
                // Loss - deduct from ordinary (no cap for this simulation)
                taxableOrdinary += gain;
            }

            const taxWithLot = calculateTotalTax(taxableOrdinary, taxableLTCG);
            const marginalTax = taxWithLot - baseTax;

            return {
                ...lot,
                estTax: marginalTax,
                efficiency: marginalTax / lot.marketValue
            };
        });

        // Sort: Ascending efficiency (Negative/Losses first, then low tax, then high tax)
        augmentedLots.sort((a, b) => a.efficiency - b.efficiency);

        // Debug: Log sorting results
        // console.log('📊 Lot Sorting (by efficiency):');
        // console.table(augmentedLots.map((lot, idx) => ({
        //    rank: idx + 1,
        //    symbol: lot.symbol,
        //    type: lot.holdingPeriod,
        //    marketValue: lot.marketValue.toFixed(2),
        //    gain: lot.gainLoss.toFixed(2),
        //    marginalTax: lot.estTax.toFixed(2),
        //    efficiency: (lot.efficiency * 100).toFixed(2) + '%'
        // })));

        const dataPoints = [];
        let cumulativeProceeds = 0;
        let cumulativeTax = 0;
        let cumulativeBasis = 0;

        // Cumulative tracking for netting
        let runningShortTerm = 0;
        let runningLongTerm = 0;

        augmentedLots.forEach(lot => {
            cumulativeProceeds += lot.marketValue;
            cumulativeBasis += lot.costBasis;

            const isLongTerm = lot.holdingPeriod === 'Long Term';
            const gain = lot.gainLoss;

            if (isLongTerm) {
                runningLongTerm += gain;
            } else {
                runningShortTerm += gain;
            }

            // Tax Logic with Netting & Limits
            let taxableOrdinary = w2Income;
            let taxableLTCG = 0;

            const totalGain = runningShortTerm + runningLongTerm;

            if (totalGain >= 0) {
                // Net Gain State
                if (runningLongTerm >= 0 && runningShortTerm >= 0) {
                    // Both positive
                    taxableOrdinary += runningShortTerm;
                    taxableLTCG += runningLongTerm;
                } else if (runningLongTerm >= 0 && runningShortTerm < 0) {
                    // LT Gain, ST Loss -> Net is positive (checked by totalGain >= 0)
                    taxableLTCG += totalGain; // ST Loss offsets LT Gain fully
                } else if (runningLongTerm < 0 && runningShortTerm >= 0) {
                    // LT Loss, ST Gain -> Net is positive
                    taxableOrdinary += totalGain; // LT Loss offsets ST Gain fully
                }
            } else {
                // Net Loss State
                // User requested NO CAP on loss deduction (unlimited offset against W2)
                taxableOrdinary += totalGain;
            }

            // Recalculate Total Tax
            const newTotalTax = calculateTotalTax(taxableOrdinary, taxableLTCG);

            // Incremental Tax caused by portfolio
            cumulativeTax = newTotalTax - baseTax;

            dataPoints.push({
                x: cumulativeProceeds,
                y: cumulativeTax,
                basis: cumulativeBasis,
                lot: lot
            });
        });

        return dataPoints;
    }

    function calculateTotalTax(ordinaryIncome, ltcgIncome) {
        // 1. Federal Ordinary
        let fedOrdTax = calculateTaxFromBrackets(ordinaryIncome, FED_BRACKETS);

        // 2. Federal LTCG
        // LTCG is stacked ON TOP of Ordinary
        let fedLtcgTax = 0;
        const totalIncome = ordinaryIncome + ltcgIncome;

        // 0% bucket 
        let remainingLtcg = ltcgIncome;
        let currentStack = ordinaryIncome;

        const limit0 = FED_LTCG_BRACKETS[0].limit;
        if (currentStack < limit0) {
            const space = limit0 - currentStack;
            const taxedAt0 = Math.min(space, remainingLtcg);
            remainingLtcg -= taxedAt0;
            currentStack += taxedAt0;
        }

        // 15% Bucket
        const limit15 = FED_LTCG_BRACKETS[1].limit;
        if (remainingLtcg > 0 && currentStack < limit15) {
            const space = limit15 - currentStack;
            const taxedAt15 = Math.min(space, remainingLtcg);
            fedLtcgTax += taxedAt15 * 0.15;
            remainingLtcg -= taxedAt15;
            currentStack += taxedAt15;
        }

        // 20% Bucket
        if (remainingLtcg > 0) {
            fedLtcgTax += remainingLtcg * 0.20;
        }

        // 3. NIIT (3.8% on lesser of NII or MAGI - Threshold)
        let niitTax = 0;
        if (totalIncome > NIIT_THRESHOLD) {
            const subjectToNiit = Math.min(ltcgIncome, totalIncome - NIIT_THRESHOLD);
            if (subjectToNiit > 0) niitTax = subjectToNiit * NIIT_RATE;
        }

        // 4. CA Tax (Ordinary + LTCG are treated same)
        const caTaxable = totalIncome;
        let caTax = calculateTaxFromBrackets(caTaxable, CA_BRACKETS);

        // CA Mental Health
        if (caTaxable > CA_MENTAL_HEALTH_THRESHOLD) {
            caTax += (caTaxable - CA_MENTAL_HEALTH_THRESHOLD) * CA_MENTAL_HEALTH_RATE;
        }

        return fedOrdTax + fedLtcgTax + niitTax + caTax;
    }

    function calculateTaxFromBrackets(income, brackets) {
        let tax = 0;
        let previousLimit = 0;

        for (let bracket of brackets) {
            if (income > previousLimit) {
                const taxableInBracket = Math.min(income, bracket.limit) - previousLimit;
                tax += taxableInBracket * bracket.rate;
                previousLimit = bracket.limit;
            } else {
                break;
            }
        }
        return tax;
    }

    function calculateEstimatedTax(lot, w2Income) {
        const gain = lot.gainLoss;
        const isLongTerm = lot.holdingPeriod === 'Long Term';

        // Rate Estimate
        let fedRate = 0;
        for (let b of FED_BRACKETS) {
            if (w2Income < b.limit) {
                fedRate = b.rate;
                break;
            }
        }

        let ltcgRate = 0.15;
        if (w2Income > 583750) ltcgRate = 0.20;
        if (w2Income < 94050) ltcgRate = 0.00;

        let caRate = 0.093;
        for (let b of CA_BRACKETS) {
            if (w2Income < b.limit) {
                caRate = b.rate;
                break;
            }
        }

        let totalRate = caRate;
        if (isLongTerm) {
            totalRate += ltcgRate;
        } else {
            totalRate += fedRate;
        }

        if (w2Income > NIIT_THRESHOLD) totalRate += NIIT_RATE;

        return { totalTax: gain * totalRate };
    }


    function renderTaxChart(dataPoints) {
        const ctx = document.getElementById('taxSimChart');
        if (!ctx) return;

        destroyChart('taxSimChart');

        // Prepare Data
        // Stack: Tax (Bottom), Basis (Middle), Net Gain (Top)

        const taxData = dataPoints.map(d => ({
            x: d.x,
            y: d.y, // Tax Paid
            lot: d.lot
        }));

        const basisData = dataPoints.map(d => ({
            x: d.x,
            y: d.basis, // Cost Basis
            lot: d.lot
        }));

        const gainData = dataPoints.map(d => {
            const netGain = d.x - d.basis - d.y;
            return {
                x: d.x,
                y: netGain > 0 ? netGain : 0,
                lot: d.lot
            };
        });

        // Calculate tax rates for secondary axis
        const effectiveRateData = dataPoints.map(d => ({
            x: d.x,
            y: d.x > 0 ? (d.y / d.x) * 100 : 0, // Effective rate = Tax / Proceeds
            lot: d.lot
        }));

        const marginalRateData = dataPoints.map(d => {
            // Cumulative marginal rate = cumulative tax / cumulative gain
            const cumulativeGain = d.x - d.basis; // Proceeds - Cost Basis = Gain
            const rate = cumulativeGain !== 0 ? (d.y / Math.abs(cumulativeGain)) * 100 : 0;
            return {
                x: d.x,
                y: rate,
                lot: d.lot
            };
        }).filter(d => d.y !== 0); // Remove 0% points entirely

        charts['taxSimChart'] = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                datasets: [
                    {
                        label: 'Tax Paid',
                        data: taxData,
                        borderColor: '#ef4444', // Red
                        backgroundColor: 'rgba(239, 68, 68, 0.2)',
                        borderWidth: 2,
                        fill: 'origin',
                        pointRadius: 0,
                        pointHitRadius: 10,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Cost Basis',
                        data: basisData,
                        borderColor: '#3b82f6', // Blue
                        backgroundColor: 'rgba(59, 130, 246, 0.2)',
                        borderWidth: 2,
                        fill: '-1', // Stack on Tax
                        pointRadius: 0,
                        pointHitRadius: 10,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Net Gain',
                        data: gainData,
                        borderColor: '#10b981', // Green
                        backgroundColor: 'rgba(16, 185, 129, 0.2)',
                        borderWidth: 2,
                        fill: '-1', // Stack on Basis
                        pointRadius: 0,
                        pointHitRadius: 10,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Effective Tax Rate',
                        data: effectiveRateData,
                        borderColor: '#f59e0b', // Amber
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        fill: false,
                        pointRadius: 0,
                        pointHitRadius: 10,
                        yAxisID: 'y1'
                    },
                    {
                        label: 'Marginal Tax Rate',
                        data: marginalRateData,
                        borderColor: '#a855f7', // Purple
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        borderDash: [2, 2],
                        fill: false,
                        pointRadius: 0,
                        pointHitRadius: 10,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                },
                scales: {
                    x: {
                        type: 'linear',
                        min: 0,
                        max: dataPoints.length > 0 ? dataPoints[dataPoints.length - 1].x : undefined,
                        grid: { display: false },
                        title: { display: true, text: 'Total Liquidation Amount ($)', color: '#9ca3af' },
                        ticks: {
                            color: '#9ca3af',
                            callback: function (value) { return '$' + Math.round(value).toLocaleString(); }
                        }
                    },
                    y: {
                        stacked: true, // Enables stacking
                        position: 'left',
                        min: 0,
                        grid: { color: '#2d3748' },
                        ticks: { color: '#9ca3af', callback: v => '$' + Math.round(v).toLocaleString() }
                    },
                    y1: {
                        type: 'linear',
                        position: 'right',
                        min: 0,
                        max: 50,
                        grid: { display: false },
                        ticks: {
                            color: '#9ca3af',
                            callback: v => v + '%'
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: c => {
                                if (c.dataset.yAxisID === 'y1') {
                                    return `${c.dataset.label}: ${c.raw.y.toFixed(1)}%`;
                                }
                                return `${c.dataset.label}: $${Math.round(c.raw.y).toLocaleString()}`;
                            },
                            title: c => `Sold: ${c[0].raw.lot.symbol}`
                        }
                    },
                    legend: { labels: { color: '#fff' } }
                }
            },
            plugins: [{
                id: 'sliderAlign',
                afterLayout: (chart) => {
                    const sliderContainer = document.getElementById('sliderContainer');
                    if (sliderContainer) {
                        const { left, width } = chart.scales.x;
                        sliderContainer.style.marginLeft = `${left}px`;
                        sliderContainer.style.width = `${width}px`;
                    }
                }
            }]
        });
    }

});

