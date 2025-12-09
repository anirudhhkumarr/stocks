// mfs.js - Mutual Funds Logic

const FUND_METADATA = [
    { symbol: "0P0000XVJQ.BO", name: "SBI Large Cap Fund" },
    { symbol: "0P0000XW8F.BO", name: "HDFC Mid Cap Fund" },
    { symbol: "0P0000XVAE.BO", name: "HDFC Large and Mid Cap Fund" },
    { symbol: "0P0000XW7T.BO", name: "HDFC Nifty 50 Index Fund" },
    { symbol: "0P0000XW7U.BO", name: "HDFC BSE Sensex Index Fund" },
    { symbol: "0P0000XVWL.BO", name: "Aditya Birla Sun Life Large Cap Fund" },
    { symbol: "0P0000XVYC.BO", name: "Aditya Birla Sun Life ELSS Tax Saver Fund" },
    { symbol: "0P0000XVWD.BO", name: "Aditya Birla Sun Life Flexi Cap Fund" }
];

let activeMFs = []; // { symbol: "0P...", units: 100 }
let mfDataCache = {}; // { symbol: { date: price } }
let usdinrHistory = null; // { date: rate }
let mfChartRanges = { INR: '3y', USD: '3y' };

document.addEventListener('DOMContentLoaded', () => {
    loadMFsFromStorage();
    setupMFListeners();
    updateMFDashboard();
});

function loadMFsFromStorage() {
    try {
        const data = localStorage.getItem('portfolio_mfs');
        if (data && JSON.parse(data).length > 0) {
            activeMFs = JSON.parse(data);

            // Filter out garbage ticker if present
            activeMFs = activeMFs.filter(mf => mf.symbol !== '0P0000X619.BO');
        } else {
            activeMFs = [];
        }
        renderActiveMFs();
    } catch (e) {
        console.error('Error loading MFs:', e);
        activeMFs = [];
        renderActiveMFs();
    }
}


function saveMFsToStorage() {
    localStorage.setItem('portfolio_mfs', JSON.stringify(activeMFs));
}

function setupMFListeners() {
    const addBtn = document.getElementById('addMfBtn');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            const symbolInput = document.getElementById('mfSymbol');
            const unitsInput = document.getElementById('mfUnits');

            const symbol = symbolInput.value.trim();
            let rawUnits = unitsInput.value;
            // Remove spaces, commas, currency symbols
            rawUnits = rawUnits.replace(/[^\d.]/g, '');
            const units = parseFloat(rawUnits);

            if (!symbol || isNaN(units) || units <= 0) {
                alert('Please enter a valid symbol and units.');
                return;
            }

            // Remove cost logic, just symbol and units
            activeMFs.push({ symbol, units });
            saveMFsToStorage();
            renderActiveMFs();
            updateMFDashboard();

            // Clear inputs
            symbolInput.value = '';
            unitsInput.value = '';
        });
    }

    // Filter Buttons
    document.querySelectorAll('.mf-filter').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const currency = e.target.dataset.currency;
            const range = e.target.dataset.range;

            // Update State
            mfChartRanges[currency] = range;

            // Update UI
            document.querySelectorAll(`.mf-filter[data-currency="${currency}"]`).forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            // Re-render
            renderMetrics();
            renderMFCharts();
        });
    });
}

function renderActiveMFs() {
    const container = document.getElementById('activeMFs');
    if (!container) return;

    container.innerHTML = '';
    activeMFs.forEach((mf, index) => {
        const chip = document.createElement('div');
        chip.className = 'file-chip';
        // Find name in SEED or use symbol
        const seed = FUND_METADATA.find(s => s.symbol === mf.symbol);
        const displayName = seed ? seed.name : mf.symbol;

        chip.innerHTML = `
            <span class="name">${displayName}</span>
            <button class="remove-btn" title="Remove fund">×</button>
        `;
        chip.querySelector('.remove-btn').addEventListener('click', () => {
            activeMFs.splice(index, 1);
            saveMFsToStorage();
            renderActiveMFs();
            updateMFDashboard();
        });
        container.appendChild(chip);
    });
}

// Global update function
async function updateMFDashboard() {
    const mfMain = document.getElementById('mf-main-content');
    const mfEmpty = document.getElementById('mf-emptyState');

    if (activeMFs.length === 0) {
        if (mfMain) mfMain.classList.add('hidden');
        if (mfEmpty) mfEmpty.classList.remove('hidden');
        return;
    }

    if (mfMain) mfMain.classList.remove('hidden');
    if (mfEmpty) mfEmpty.classList.add('hidden');

    // 1. Fetch Data
    try {
        if (typeof fetchStockData === 'undefined') {
            console.error('fetchStockData is not defined. Ensure utils.js is loaded.');
            return;
        }

        await Promise.all(activeMFs.map(async mf => {
            if (!mfDataCache[mf.symbol]) {
                const data = await fetchStockData(mf.symbol);
                if (data) mfDataCache[mf.symbol] = data;
            }
        }));

        if (!usdinrHistory) {
            const data = await fetchStockData('INR=X');
            if (data) {
                usdinrHistory = data;
                console.log('USDINR Data Success:', Object.keys(usdinrHistory).length, 'points');
            } else {
                console.warn('USDINR Data Failed to Load');
            }
        }

        renderMetrics();
        renderMFCharts();
    } catch (e) {
        console.error('MF Data Fetch Error:', e);
    }
}

// Helper to determine start date based on range
function getStartDateForRange(range, lastDate) {
    const cutoff = new Date(lastDate);
    if (range === '1y') cutoff.setFullYear(lastDate.getFullYear() - 1);
    else if (range === '3y') cutoff.setFullYear(lastDate.getFullYear() - 3);
    else if (range === '5y') cutoff.setFullYear(lastDate.getFullYear() - 5);
    else if (range === 'max') return new Date(0); // Epoch
    return cutoff;
}

function renderMetrics() {
    // Current Logic: Calculate value NOW vs value at START of selected INR Range
    const range = mfChartRanges['INR'];

    // 1. Get Sorted Dates Global
    const allDates = new Set();
    activeMFs.forEach(mf => {
        const history = mfDataCache[mf.symbol];
        if (history) Object.keys(history).forEach(d => allDates.add(d));
    });
    const sortedDates = Array.from(allDates).sort();
    if (sortedDates.length === 0) return;

    const lastDateStr = sortedDates[sortedDates.length - 1];
    const lastDate = new Date(lastDateStr);
    const startDate = getStartDateForRange(range, lastDate);

    // 2. Calc Current Value
    let currentValue = 0;
    activeMFs.forEach(mf => {
        const history = mfDataCache[mf.symbol];
        if (history && history[lastDateStr]) {
            currentValue += history[lastDateStr] * mf.units;
        }
    });

    // 3. Calc Start Value (closest available date after or on startDate)
    // Find closest date in sortedDates >= startDate
    let closestStartStr = sortedDates.find(d => new Date(d) >= startDate);
    if (!closestStartStr) closestStartStr = sortedDates[0]; // Fallback to earliest

    let startValue = 0;
    let startValueUSD = 0;

    // Get Rate at Start Date
    let startRate = 84;
    if (usdinrHistory) {
        // Find close rate
        const rateDate = Object.keys(usdinrHistory).find(d => new Date(d) >= startDate) || Object.keys(usdinrHistory)[0];
        if (rateDate) startRate = usdinrHistory[rateDate];
    }

    activeMFs.forEach(mf => {
        const history = mfDataCache[mf.symbol];
        if (history) {
            const price = history[closestStartStr];
            if (price) {
                const val = price * mf.units;
                startValue += val;
                if (startRate) startValueUSD += val / startRate;
            }
        }
    });

    const gain = currentValue - startValue;
    const percent = startValue > 0 ? (gain / startValue) * 100 : 0;

    // Updates
    const fmtINR = (n) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
    const fmtUSD = (n) => '$' + n.toLocaleString('en-US', { maximumFractionDigits: 2 });

    const elVal = document.getElementById('mfTotalValue');
    const elGainLabel = document.querySelector('#mfTotalGain').parentElement.querySelector('.card-title');
    const elGain = document.getElementById('mfTotalGain');
    const elPct = document.getElementById('mfTotalReturnPercent');

    // Update Labels based on Range
    if (elGainLabel) {
        elGainLabel.textContent = `Return (₹) ${range.toUpperCase()}`;
    }

    if (elVal) elVal.textContent = fmtINR(currentValue);

    if (elGain) {
        elGain.textContent = (gain >= 0 ? '+' : '') + fmtINR(gain);
        elGain.className = 'primary-value ' + (gain >= 0 ? 'positive' : 'negative');
    }
    if (elPct) {
        elPct.textContent = (percent >= 0 ? '+' : '') + percent.toFixed(2) + '%';
        const badge = document.getElementById('mfTrendBadge');
        if (badge) {
            if (percent >= 0) badge.style.color = '#10b981';
            else badge.style.color = '#ef4444';
        }
    }

    // USD
    let currentRate = 84;
    if (usdinrHistory) {
        const rDates = Object.keys(usdinrHistory).sort();
        const lastRateDate = rDates[rDates.length - 1];
        currentRate = usdinrHistory[lastRateDate] || 84;
    }
    const valUSD = currentValue / currentRate;

    const gainUSD = valUSD - startValueUSD;
    const percentUSD = startValueUSD > 0 ? (gainUSD / startValueUSD) * 100 : 0;

    const elValUSD = document.getElementById('mfTotalValueUSD');
    const elRate = document.getElementById('usdRate');
    const elGainUSD = document.getElementById('mfTotalGainUSD');
    const elPctUSD = document.getElementById('mfTotalReturnPercentUSD');
    const elGainLabelUSD = document.querySelector('#mfTotalGainUSD')?.parentElement?.querySelector('.card-title');

    if (elGainLabelUSD) {
        elGainLabelUSD.textContent = `Return ($) ${range.toUpperCase()}`;
    }

    if (elValUSD) elValUSD.textContent = fmtUSD(valUSD);
    if (elRate) elRate.textContent = `1$ = ₹${currentRate.toFixed(2)}`;

    if (elGainUSD) {
        elGainUSD.textContent = (gainUSD >= 0 ? '+' : '') + fmtUSD(gainUSD);
        elGainUSD.className = 'primary-value ' + (gainUSD >= 0 ? 'positive' : 'negative');
    }

    if (elPctUSD) {
        elPctUSD.textContent = (percentUSD >= 0 ? '+' : '') + percentUSD.toFixed(2) + '%';
        const badgeUSD = document.getElementById('mfTrendBadgeUSD');
        if (badgeUSD) {
            if (percentUSD >= 0) badgeUSD.style.color = '#10b981';
            else badgeUSD.style.color = '#ef4444';
        }
    }
}

function filterDataByRange(data, range) {
    if (range === 'max' || data.length === 0) return data;

    const lastDate = new Date(data[data.length - 1].x);
    let cutoffDate = getStartDateForRange(range, lastDate);

    return data.filter(d => new Date(d.x) >= cutoffDate);
}

function renderMFCharts() {
    const canvasINR = document.getElementById('mfChartINR');
    const canvasUSD = document.getElementById('mfChartUSD');

    if (!canvasINR || !canvasUSD) return;

    const ctxINR = canvasINR.getContext('2d');
    const ctxUSD = canvasUSD.getContext('2d');

    const allDates = new Set();
    activeMFs.forEach(mf => {
        const history = mfDataCache[mf.symbol];
        if (history) {
            Object.keys(history).forEach(d => allDates.add(d));
        }
    });

    if (usdinrHistory) {
        Object.keys(usdinrHistory).forEach(d => allDates.add(d));
    }

    const sortedDates = Array.from(allDates).sort();
    const fullDataINR = [];
    const fullDataUSD = [];
    let lastKnownRate = 84;

    sortedDates.forEach(date => {
        let totalINR = 0;
        activeMFs.forEach(mf => {
            const history = mfDataCache[mf.symbol];
            const priceINR = history ? (history[date]) : 0;
            if (priceINR) {
                totalINR += priceINR * mf.units;
            }
        });

        if (usdinrHistory && usdinrHistory[date]) {
            lastKnownRate = usdinrHistory[date];
        }

        if (totalINR > 0) {
            fullDataINR.push({ x: date, y: totalINR });
            if (lastKnownRate > 0) {
                fullDataUSD.push({ x: date, y: totalINR / lastKnownRate });
            }
        }
    });

    // Apply Filter
    const dataPointsINR = filterDataByRange(fullDataINR, mfChartRanges['INR']);
    const dataPointsUSD = filterDataByRange(fullDataUSD, mfChartRanges['USD']);

    const chartStore = window.charts || {};

    const createChart = (id, ctx, label, data, color) => {
        if (window.charts && window.charts[id]) {
            window.charts[id].destroy();
        }

        window.charts = window.charts || {};
        window.charts[id] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(d => d.x),
                datasets: [{
                    label: label,
                    data: data.map(d => d.y),
                    borderColor: color,
                    backgroundColor: color.replace('1)', '0.1)').replace(')', ', 0.1)'),
                    borderWidth: 2,
                    fill: true,
                    tension: 0.1,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: (ctx) => (id.includes('USD') ? '$' : '₹') + ctx.raw.toFixed(2)
                        }
                    }
                },
                scales: {
                    x: { grid: { display: false, color: '#2d3748' }, ticks: { color: '#9ca3af' } },
                    y: { grid: { color: '#2d3748' }, ticks: { color: '#9ca3af' } }
                }
            }
        });
    };

    createChart('mfChartINR', ctxINR, 'Portfolio Value (₹)', dataPointsINR, '#10b981');
    createChart('mfChartUSD', ctxUSD, 'Portfolio Value ($)', dataPointsUSD, '#3b82f6');

    // Allocation Chart
    renderAllocationChart();
}

function renderAllocationChart() {
    const canvas = document.getElementById('mfChartAllocation');
    if (!canvas) return;

    // Destroy existing
    if (window.charts && window.charts['mfAllocation']) {
        window.charts['mfAllocation'].destroy();
    }

    const labels = [];
    const data = [];
    const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6'];

    // Sort by Value Descending
    const fundValues = activeMFs.map(mf => {
        const history = mfDataCache[mf.symbol];
        // Get last available price
        let price = 0;
        if (history) {
            const dates = Object.keys(history).sort();
            if (dates.length > 0) price = history[dates[dates.length - 1]];
        }

        // Find name
        const seed = FUND_METADATA.find(s => s.symbol === mf.symbol);
        const name = seed ? seed.name : mf.symbol;

        return {
            name: name,
            value: price * mf.units
        };
    }).sort((a, b) => b.value - a.value); // Descending

    fundValues.forEach(item => {
        if (item.value > 0) {
            labels.push(item.name);
            data.push(item.value);
        }
    });

    const ctx = canvas.getContext('2d');
    window.charts = window.charts || {};
    window.charts['mfAllocation'] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors.slice(0, data.length),
                borderColor: '#181b21', // Card BG
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { color: '#9ca3af', font: { size: 10 }, boxWidth: 10 }
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const val = ctx.raw;
                            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                            const pct = ((val / total) * 100).toFixed(1) + '%';
                            return ` ₹${val.toLocaleString()} (${pct})`;
                        }
                    }
                }
            }
        }
    });
}
