import { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { Activity, CheckSquare, Square } from 'lucide-react';
import { VANGUARD_SECTORS, BENCHMARK_ETF } from '../utils/sectorData';

const RANGES = [
    { key: '1Y', label: '1Y' },
    { key: '2Y', label: '2Y' },
    { key: '3Y', label: '3Y' },
    { key: '5Y', label: '5Y' },
    { key: '10Y', label: '10Y' },
    { key: 'max', label: 'Max' }
];

const SectorYearlyReturnsChart = ({ sectorDataMap }) => {
    const svgRef = useRef(null);
    const containerRef = useRef(null);

    const allSectors = useMemo(() => [...VANGUARD_SECTORS, BENCHMARK_ETF], []);

    // Enabled sectors set (default: all sectors + benchmark enabled)
    const [enabledSectors, setEnabledSectors] = useState(() => {
        const set = new Set(allSectors.map(s => s.symbol));
        return set;
    });

    const [chartMode, setChartMode] = useState('yearly'); // 'yearly' (% return per year) | 'growth' (cumulative $10k growth)
    const [timeRange, setTimeRange] = useState('max'); // '1Y' | '2Y' | '3Y' | '5Y' | '10Y' | 'max'
    const [isLogScale, setIsLogScale] = useState(false);
    const [hoveredYear, setHoveredYear] = useState(null);
    const [hoveredSymbol, setHoveredSymbol] = useState(null);

    // Compute dynamic sector rankings based on active timeRange and live data
    const { dynamicTop3Performers, dynamicTop3Weight, dynamicBottom3 } = useMemo(() => {
        const rangeKey = timeRange === 'max' ? '10Y' : timeRange;

        const sectorsWithMetrics = VANGUARD_SECTORS.map(s => {
            const data = sectorDataMap[s.symbol];
            const returnVal = data?.returns?.trailing?.[rangeKey] ?? data?.returns?.cagr?.[rangeKey] ?? 0;
            return {
                ...s,
                returnVal
            };
        });

        // Top 3 by live return in this timeframe
        const sortedByReturn = [...sectorsWithMetrics].sort((a, b) => b.returnVal - a.returnVal);
        const top3Perf = sortedByReturn.slice(0, 3);
        const bot3Perf = sortedByReturn.slice(-3).reverse();

        // Top 3 by market cap weight
        const sortedByWeight = [...sectorsWithMetrics].sort((a, b) => b.weight - a.weight);
        const top3Wt = sortedByWeight.slice(0, 3);

        return {
            dynamicTop3Performers: top3Perf,
            dynamicTop3Weight: top3Wt,
            dynamicBottom3: bot3Perf
        };
    }, [sectorDataMap, timeRange]);

    // Dynamic Presets List
    const dynamicPresets = useMemo(() => {
        const top3PerfSymbols = dynamicTop3Performers.map(s => s.symbol);
        const top3WtSymbols = dynamicTop3Weight.map(s => s.symbol);
        const bot3Symbols = dynamicBottom3.map(s => s.symbol);

        return [
            { key: 'all', label: 'All Sectors', symbols: allSectors.map(s => s.symbol) },
            {
                key: 'top3_perf',
                label: `Top 3 Performers (${top3PerfSymbols.join(', ')})`,
                symbols: [...top3PerfSymbols, 'VOO']
            },
            {
                key: 'top3_weight',
                label: `Top 3 Weight (${top3WtSymbols.join(', ')})`,
                symbols: [...top3WtSymbols, 'VOO']
            },
            {
                key: 'bottom3_perf',
                label: `Laggards 3 (${bot3Symbols.join(', ')})`,
                symbols: [...bot3Symbols, 'VOO']
            },
            {
                key: 'growth',
                label: 'Growth / Cyclical',
                symbols: ['VGT', 'VCR', 'VOX', 'VIS', 'VOO']
            },
            {
                key: 'defensive',
                label: 'Defensive Sectors',
                symbols: ['VDC', 'VHT', 'VPU', 'VOO']
            },
            {
                key: 'benchmark',
                label: 'VOO Benchmark Only',
                symbols: ['VOO', dynamicTop3Performers[0]?.symbol || 'VGT']
            }
        ];
    }, [allSectors, dynamicTop3Performers, dynamicTop3Weight, dynamicBottom3]);

    // Toggle individual sector
    const toggleSector = (symbol) => {
        setEnabledSectors(prev => {
            const next = new Set(prev);
            if (next.has(symbol)) {
                if (next.size > 1) next.delete(symbol);
            } else {
                next.add(symbol);
            }
            return next;
        });
    };

    // Apply preset
    const applyPreset = (preset) => {
        if (preset.symbols) {
            setEnabledSectors(new Set(preset.symbols));
        }
    };

    // Filter years based on timeRange
    const filteredYears = useMemo(() => {
        // Collect all available years
        const allYearsSet = new Set();
        allSectors.forEach(s => {
            const returns = sectorDataMap[s.symbol]?.returns?.yearlyReturns || {};
            Object.keys(returns).forEach(yr => allYearsSet.add(Number(yr)));
        });

        const sorted = Array.from(allYearsSet).sort((a, b) => a - b);
        if (sorted.length === 0) return [];

        const countMap = {
            '1Y': 2,
            '2Y': 3,
            '3Y': 4,
            '5Y': 6,
            '10Y': 11,
            'max': sorted.length
        };

        const count = countMap[timeRange] || sorted.length;
        return sorted.slice(-count);
    }, [allSectors, sectorDataMap, timeRange]);

    // Prepare Yearly Series Data
    const yearlySeriesData = useMemo(() => {
        const series = [];
        const activeYearsSet = new Set(filteredYears);

        allSectors.forEach(sector => {
            if (!enabledSectors.has(sector.symbol)) return;
            const returns = sectorDataMap[sector.symbol]?.returns?.yearlyReturns || {};

            const points = filteredYears.map(yr => ({
                year: yr,
                value: returns[yr] != null ? returns[yr] : 0
            })).filter(p => activeYearsSet.has(p.year) && returns[p.year] != null);

            if (points.length > 0) {
                series.push({
                    symbol: sector.symbol,
                    name: sector.name,
                    shortName: sector.shortName,
                    color: sector.color,
                    isBenchmark: sector.symbol === 'VOO',
                    points
                });
            }
        });

        return series;
    }, [allSectors, enabledSectors, sectorDataMap, filteredYears]);

    // Prepare Growth Trajectory Data ($10k)
    const growthSeriesData = useMemo(() => {
        if (chartMode !== 'growth') return [];
        const series = [];

        const daysMap = {
            '1Y': 365,
            '2Y': 730,
            '3Y': 1095,
            '5Y': 1825,
            '10Y': 3650,
            'max': 0
        };
        const days = daysMap[timeRange] || 0;

        allSectors.forEach(sector => {
            if (!enabledSectors.has(sector.symbol)) return;
            const priceMap = sectorDataMap[sector.symbol]?.priceMap;
            if (!priceMap) return;

            const allDates = Object.keys(priceMap).sort();
            if (allDates.length === 0) return;

            const latestDate = allDates[allDates.length - 1];
            let cutoffDateStr = allDates[0];

            if (days > 0) {
                const cutoffTime = new Date(latestDate).getTime() - days * 86400 * 1000;
                cutoffDateStr = new Date(cutoffTime).toISOString().split('T')[0];
            }

            const inRangeDates = allDates.filter(d => d >= cutoffDateStr);
            if (inRangeDates.length === 0) return;

            // Baseline price at the start of the selected window
            const basePrice = priceMap[inRangeDates[0]];
            if (!basePrice || basePrice <= 0) return;

            // Sample every few points for smooth rendering
            const step = inRangeDates.length > 500 ? 5 : inRangeDates.length > 200 ? 2 : 1;
            const points = [];

            inRangeDates.forEach((d, i) => {
                if (i % step === 0 || i === inRangeDates.length - 1) {
                    points.push({
                        date: new Date(d),
                        value: (priceMap[d] / basePrice) * 10000
                    });
                }
            });

            series.push({
                symbol: sector.symbol,
                name: sector.name,
                shortName: sector.shortName,
                color: sector.color,
                isBenchmark: sector.symbol === 'VOO',
                points
            });
        });

        return series;
    }, [allSectors, enabledSectors, sectorDataMap, chartMode, timeRange]);

    // D3 Chart Rendering
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const renderChart = () => {
            const { width } = container.getBoundingClientRect();
            const height = 450;
            const margin = { top: 25, right: 35, bottom: 45, left: 60 };
            const innerWidth = width - margin.left - margin.right;
            const innerHeight = height - margin.top - margin.bottom;

            d3.select(svgRef.current).selectAll("*").remove();

            const svg = d3.select(svgRef.current)
                .attr('width', width)
                .attr('height', height)
                .append('g')
                .attr('transform', `translate(${margin.left},${margin.top})`);

            if (chartMode === 'yearly') {
                if (yearlySeriesData.length === 0 || filteredYears.length === 0) return;

                // X Scale
                const x = d3.scaleLinear()
                    .domain([d3.min(filteredYears), d3.max(filteredYears)])
                    .range([0, innerWidth]);

                // Y Scale (% return)
                const allValues = yearlySeriesData.flatMap(s => s.points.map(p => p.value));
                const minVal = Math.min(-20, (d3.min(allValues) || 0) * 1.1);
                const maxVal = Math.max(30, (d3.max(allValues) || 0) * 1.1);

                const y = isLogScale
                    ? d3.scaleSymlog().constant(10).domain([minVal, maxVal]).range([innerHeight, 0])
                    : d3.scaleLinear().domain([minVal, maxVal]).range([innerHeight, 0]);

                // Horizontal Zero Line
                svg.append('line')
                    .attr('x1', 0)
                    .attr('x2', innerWidth)
                    .attr('y1', y(0))
                    .attr('y2', y(0))
                    .attr('stroke', 'rgba(255, 255, 255, 0.4)')
                    .attr('stroke-dasharray', '4 3')
                    .attr('stroke-width', 1.5);

                // Grid Lines
                svg.append('g')
                    .attr('class', 'grid')
                    .call(d3.axisLeft(y).ticks(8).tickSize(-innerWidth).tickFormat(''))
                    .call(g => g.select(".domain").remove())
                    .selectAll('line')
                    .attr('stroke', 'rgba(255, 255, 255, 0.05)');

                // Line Generator
                const lineGen = d3.line()
                    .x(d => x(d.year))
                    .y(d => y(d.value))
                    .curve(d3.curveMonotoneX);

                // Draw Lines for Each Sector
                yearlySeriesData.forEach(series => {
                    const isHovered = hoveredSymbol === series.symbol;
                    const isDimmed = hoveredSymbol && !isHovered;

                    svg.append('path')
                        .datum(series.points)
                        .attr('fill', 'none')
                        .attr('stroke', series.color)
                        .attr('stroke-width', series.isBenchmark ? 2.5 : isHovered ? 3.5 : 2.0)
                        .attr('stroke-dasharray', series.isBenchmark ? '6 4' : null)
                        .attr('opacity', isDimmed ? 0.2 : 0.9)
                        .attr('d', lineGen);

                    // Dots for points
                    svg.selectAll(`.dot-${series.symbol}`)
                        .data(series.points)
                        .enter().append('circle')
                        .attr('class', `dot-${series.symbol}`)
                        .attr('cx', d => x(d.year))
                        .attr('cy', d => y(d.value))
                        .attr('r', isHovered ? 5 : 3.5)
                        .attr('fill', series.color)
                        .attr('stroke', '#181b21')
                        .attr('stroke-width', 1.5)
                        .attr('opacity', isDimmed ? 0.2 : 0.95);
                });

                // X Axis
                const xAxis = d3.axisBottom(x)
                    .ticks(filteredYears.length)
                    .tickFormat(d3.format('d'));

                svg.append('g')
                    .attr('transform', `translate(0,${innerHeight})`)
                    .call(xAxis)
                    .call(g => g.select(".domain").attr('stroke', 'rgba(255, 255, 255, 0.2)'))
                    .selectAll('text')
                    .attr('fill', '#9ca3af')
                    .style('font-size', '12px');

                // Y Axis
                const yAxis = d3.axisLeft(y)
                    .ticks(8)
                    .tickFormat(d => `${d >= 0 ? '+' : ''}${Math.round(d)}%`);

                svg.append('g')
                    .call(yAxis)
                    .call(g => g.select(".domain").remove())
                    .selectAll('text')
                    .attr('fill', '#9ca3af')
                    .style('font-size', '12px');

                // Invisible overlay for year crosshair interaction
                const overlay = svg.append('rect')
                    .attr('width', innerWidth)
                    .attr('height', innerHeight)
                    .attr('fill', 'transparent')
                    .style('cursor', 'crosshair');

                const crosshair = svg.append('line')
                    .attr('class', 'crosshair')
                    .attr('y1', 0)
                    .attr('y2', innerHeight)
                    .attr('stroke', 'rgba(255, 255, 255, 0.4)')
                    .attr('stroke-dasharray', '3 3')
                    .style('display', 'none');

                overlay.on('mousemove', function (event) {
                    const [mx] = d3.pointer(event);
                    const yearHovered = Math.round(x.invert(mx));
                    if (filteredYears.includes(yearHovered)) {
                        crosshair
                            .style('display', null)
                            .attr('x1', x(yearHovered))
                            .attr('x2', x(yearHovered));
                        setHoveredYear(yearHovered);
                    }
                });

                overlay.on('mouseleave', function () {
                    crosshair.style('display', 'none');
                    setHoveredYear(null);
                });

            } else {
                // Growth Mode
                if (growthSeriesData.length === 0) return;

                const allPoints = growthSeriesData.flatMap(s => s.points);
                const xDomain = d3.extent(allPoints, d => d.date);
                const minVal = Math.max(100, (d3.min(allPoints, d => d.value) || 10000) * 0.95);
                const maxVal = (d3.max(allPoints, d => d.value) || 10000) * 1.05;

                const x = d3.scaleTime()
                    .domain(xDomain)
                    .range([0, innerWidth]);

                const y = isLogScale
                    ? d3.scaleLog().domain([minVal, maxVal]).range([innerHeight, 0])
                    : d3.scaleLinear().domain([minVal, maxVal]).range([innerHeight, 0]);

                // Grid
                svg.append('g')
                    .attr('class', 'grid')
                    .call(d3.axisLeft(y).ticks(6).tickSize(-innerWidth).tickFormat(''))
                    .call(g => g.select(".domain").remove())
                    .selectAll('line')
                    .attr('stroke', 'rgba(255, 255, 255, 0.05)');

                const lineGen = d3.line()
                    .x(d => x(d.date))
                    .y(d => y(d.value))
                    .curve(d3.curveMonotoneX);

                growthSeriesData.forEach(series => {
                    const isHovered = hoveredSymbol === series.symbol;
                    const isDimmed = hoveredSymbol && !isHovered;

                    svg.append('path')
                        .datum(series.points)
                        .attr('fill', 'none')
                        .attr('stroke', series.color)
                        .attr('stroke-width', series.isBenchmark ? 2.5 : isHovered ? 3.5 : 2.0)
                        .attr('stroke-dasharray', series.isBenchmark ? '6 4' : null)
                        .attr('opacity', isDimmed ? 0.2 : 0.9)
                        .attr('d', lineGen);
                });

                // X Axis
                svg.append('g')
                    .attr('transform', `translate(0,${innerHeight})`)
                    .call(d3.axisBottom(x).ticks(innerWidth / 90))
                    .call(g => g.select(".domain").attr('stroke', 'rgba(255, 255, 255, 0.2)'))
                    .selectAll('text')
                    .attr('fill', '#9ca3af')
                    .style('font-size', '12px');

                // Y Axis
                svg.append('g')
                    .call(d3.axisLeft(y).ticks(6).tickFormat(d => `$${(d / 1000).toFixed(1)}k`))
                    .call(g => g.select(".domain").remove())
                    .selectAll('text')
                    .attr('fill', '#9ca3af')
                    .style('font-size', '12px');
            }
        };

        renderChart();
        window.addEventListener('resize', renderChart);
        return () => window.removeEventListener('resize', renderChart);
    }, [yearlySeriesData, growthSeriesData, chartMode, hoveredSymbol, filteredYears, isLogScale]);

    // Compute hovered year ranking list for tooltip
    const hoveredYearRankings = useMemo(() => {
        if (!hoveredYear || chartMode !== 'yearly') return [];

        const list = [];
        yearlySeriesData.forEach(s => {
            const point = s.points.find(p => p.year === hoveredYear);
            if (point) {
                list.push({
                    symbol: s.symbol,
                    shortName: s.shortName,
                    color: s.color,
                    isBenchmark: s.isBenchmark,
                    value: point.value
                });
            }
        });

        list.sort((a, b) => b.value - a.value);
        return list;
    }, [hoveredYear, yearlySeriesData, chartMode]);

    return (
        <div className="card sector-chart-card">
            <div className="chart-header-row">
                <div className="title-area">
                    <Activity className="section-icon" />
                    <div>
                        <h3>Yearly Sector Returns Comparison Chart</h3>
                        <p className="subtitle">
                            Annual percentage return (% per calendar year) and cumulative growth across US sectors
                        </p>
                    </div>
                </div>

                <div className="chart-header-controls">
                    {/* Time Range Selector */}
                    <div className="range-pills-bar">
                        {RANGES.map(r => (
                            <button
                                key={r.key}
                                className={`range-pill-btn ${timeRange === r.key ? 'active' : ''}`}
                                onClick={() => setTimeRange(r.key)}
                            >
                                {r.label}
                            </button>
                        ))}
                    </div>

                    {/* Log Scale Toggle */}
                    <button
                        className={`log-toggle-btn ${isLogScale ? 'active' : ''}`}
                        onClick={() => setIsLogScale(prev => !prev)}
                        title="Toggle logarithmic scaling on Y-axis"
                    >
                        Log Scale
                    </button>

                    {/* Chart Mode Toggles */}
                    <div className="btn-group-toggle">
                        <button
                            className={`toggle-pill-btn ${chartMode === 'yearly' ? 'active' : ''}`}
                            onClick={() => setChartMode('yearly')}
                        >
                            Yearly Return (%)
                        </button>
                        <button
                            className={`toggle-pill-btn ${chartMode === 'growth' ? 'active' : ''}`}
                            onClick={() => setChartMode('growth')}
                        >
                            Growth of $10,000
                        </button>
                    </div>
                </div>
            </div>

            {/* Presets and Filter Pills */}
            <div className="filter-presets-bar">
                <div className="presets-list">
                    <span className="filter-label">Presets:</span>
                    {dynamicPresets.map(p => (
                        <button
                            key={p.key}
                            className="preset-btn"
                            onClick={() => applyPreset(p)}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>

                <div className="quick-actions">
                    <button
                        className="text-btn"
                        onClick={() => applyPreset(dynamicPresets[0])}
                    >
                        <CheckSquare size={13} /> Select All
                    </button>
                    <button
                        className="text-btn"
                        onClick={() => setEnabledSectors(new Set(['VOO']))}
                    >
                        <Square size={13} /> Reset
                    </button>
                </div>
            </div>

            {/* Sector Ticker Selector Pills */}
            <div className="sector-pills-selector">
                {allSectors.map(s => {
                    const isSelected = enabledSectors.has(s.symbol);
                    const isHovered = hoveredSymbol === s.symbol;

                    return (
                        <button
                            key={s.symbol}
                            className={`sector-chip ${isSelected ? 'active' : 'inactive'} ${isHovered ? 'highlighted' : ''}`}
                            onClick={() => toggleSector(s.symbol)}
                            onMouseEnter={() => setHoveredSymbol(s.symbol)}
                            onMouseLeave={() => setHoveredSymbol(null)}
                            style={{
                                borderColor: isSelected ? s.color : 'rgba(255,255,255,0.1)'
                            }}
                        >
                            <span
                                className="color-indicator"
                                style={{
                                    backgroundColor: s.color,
                                    opacity: isSelected ? 1 : 0.3
                                }}
                            />
                            <strong>{s.symbol}</strong>
                            <span className="chip-name">{s.shortName}</span>
                        </button>
                    );
                })}
            </div>

            {/* Chart Canvas and Tooltip Overlay */}
            <div className="chart-canvas-layout">
                <div className="chart-container" ref={containerRef} style={{ height: '450px', position: 'relative' }}>
                    <svg ref={svgRef} />
                </div>

                {/* Floating Hover Tooltip for Calendar Year Ranking */}
                {hoveredYear && hoveredYearRankings.length > 0 && (
                    <div className="hover-rankings-panel">
                        <div className="rankings-header">
                            <span className="yr-title">{hoveredYear} Annual Performance</span>
                            <span className="cnt-badge">{hoveredYearRankings.length} Sectors</span>
                        </div>
                        <div className="rankings-body">
                            {hoveredYearRankings.map((item, idx) => (
                                <div
                                    key={item.symbol}
                                    className={`ranking-row ${item.isBenchmark ? 'benchmark-item' : ''}`}
                                    onMouseEnter={() => setHoveredSymbol(item.symbol)}
                                    onMouseLeave={() => setHoveredSymbol(null)}
                                >
                                    <span className="r-pos">#{idx + 1}</span>
                                    <span className="r-dot" style={{ backgroundColor: item.color }} />
                                    <strong className="r-symbol">{item.symbol}</strong>
                                    <span className="r-name">{item.shortName}</span>
                                    <span className={`r-val ${item.value >= 0 ? 'pos' : 'neg'}`}>
                                        {item.value >= 0 ? '+' : ''}{item.value.toFixed(1)}%
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SectorYearlyReturnsChart;
