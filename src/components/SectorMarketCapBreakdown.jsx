import { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { PieChart, BarChart2, Layers, Info, Percent } from 'lucide-react';
import { VANGUARD_SECTORS, HISTORICAL_SECTOR_MARKET_CAP, TOTAL_VOO_COVERAGE_PERCENT } from '../utils/sectorData';

const SectorMarketCapBreakdown = () => {
    const svgRef = useRef(null);
    const containerRef = useRef(null);
    const donutSvgRef = useRef(null);
    const donutContainerRef = useRef(null);

    const [chartMode, setChartMode] = useState('percent'); // 'percent' (100% stacked) | 'absolute' ($ Trillions)
    const [chartType, setChartType] = useState('area'); // 'area' | 'bar'
    const [selectedYear, setSelectedYear] = useState(2026);
    const [hoveredSector, setHoveredSector] = useState(null);

    const sectorColorMap = useMemo(() => {
        const map = {};
        VANGUARD_SECTORS.forEach(s => {
            map[s.symbol] = s.color;
        });
        return map;
    }, []);

    // Year snapshot data for the selected year
    const selectedYearData = useMemo(() => {
        const yearEntry = HISTORICAL_SECTOR_MARKET_CAP.find(d => d.year === selectedYear) || HISTORICAL_SECTOR_MARKET_CAP[HISTORICAL_SECTOR_MARKET_CAP.length - 1];
        const sectors = VANGUARD_SECTORS.map(s => {
            const weight = yearEntry.weights[s.symbol] || 0;
            const marketCapDollar = ((weight / 100) * yearEntry.totalMarketCap).toFixed(2);
            return {
                ...s,
                weight,
                marketCapDollar
            };
        }).sort((a, b) => b.weight - a.weight);

        return {
            year: yearEntry.year,
            totalMarketCap: yearEntry.totalMarketCap,
            sectors
        };
    }, [selectedYear]);

    // Render Historical Stacked Chart (Area or Bar)
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const renderChart = () => {
            const { width } = container.getBoundingClientRect();
            const height = 380;
            const margin = { top: 20, right: 30, bottom: 40, left: chartMode === 'percent' ? 45 : 55 };
            const innerWidth = width - margin.left - margin.right;
            const innerHeight = height - margin.top - margin.bottom;

            d3.select(svgRef.current).selectAll("*").remove();

            const svg = d3.select(svgRef.current)
                .attr('width', width)
                .attr('height', height)
                .append('g')
                .attr('transform', `translate(${margin.left},${margin.top})`);

            // Prepare Stacked Data
            const keys = VANGUARD_SECTORS.map(s => s.symbol);

            const formattedData = HISTORICAL_SECTOR_MARKET_CAP.map(d => {
                const row = { year: d.year, total: d.totalMarketCap };
                keys.forEach(k => {
                    const w = d.weights[k] || 0;
                    row[k] = chartMode === 'percent' ? w : (w / 100) * d.totalMarketCap;
                });
                return row;
            });

            const stack = d3.stack()
                .keys(keys)
                .order(d3.stackOrderNone)
                .offset(d3.stackOffsetNone);

            const series = stack(formattedData);

            // Scales
            const x = chartType === 'bar'
                ? d3.scaleBand()
                    .domain(formattedData.map(d => d.year))
                    .range([0, innerWidth])
                    .padding(0.25)
                : d3.scaleLinear()
                    .domain(d3.extent(formattedData, d => d.year))
                    .range([0, innerWidth]);

            const yMax = chartMode === 'percent' ? 100 : d3.max(formattedData, d => d.total) * 1.05;
            const y = d3.scaleLinear()
                .domain([0, yMax])
                .range([innerHeight, 0]);

            // Grid Lines
            svg.append('g')
                .attr('class', 'grid')
                .call(d3.axisLeft(y).ticks(5).tickSize(-innerWidth).tickFormat(''))
                .call(g => g.select(".domain").remove())
                .selectAll('line')
                .attr('stroke', 'rgba(255, 255, 255, 0.06)');

            // Area or Bar Rendering
            if (chartType === 'area') {
                const area = d3.area()
                    .x(d => x(d.data.year))
                    .y0(d => y(d[0]))
                    .y1(d => y(d[1]))
                    .curve(d3.curveMonotoneX);

                svg.selectAll('.layer')
                    .data(series)
                    .enter().append('path')
                    .attr('class', 'layer')
                    .attr('d', area)
                    .attr('fill', d => sectorColorMap[d.key])
                    .attr('opacity', d => (hoveredSector && hoveredSector !== d.key ? 0.25 : 0.85))
                    .attr('stroke', '#181b21')
                    .attr('stroke-width', 0.5)
                    .style('cursor', 'pointer')
                    .on('mouseenter', (event, d) => setHoveredSector(d.key))
                    .on('mouseleave', () => setHoveredSector(null));
            } else {
                svg.selectAll('.layer-group')
                    .data(series)
                    .enter().append('g')
                    .attr('class', 'layer-group')
                    .attr('fill', d => sectorColorMap[d.key])
                    .attr('opacity', d => (hoveredSector && hoveredSector !== d.key ? 0.25 : 0.9))
                    .selectAll('rect')
                    .data(d => d.map(item => ({ ...item, key: d.key })))
                    .enter().append('rect')
                    .attr('x', d => x(d.data.year))
                    .attr('y', d => y(d[1]))
                    .attr('height', d => y(d[0]) - y(d[1]))
                    .attr('width', x.bandwidth())
                    .attr('rx', 2)
                    .style('cursor', 'pointer')
                    .on('mouseenter', (event, d) => setHoveredSector(d.key))
                    .on('mouseleave', () => setHoveredSector(null))
                    .on('click', (event, d) => setSelectedYear(d.data.year));
            }

            // X Axis
            const xAxis = chartType === 'bar'
                ? d3.axisBottom(x)
                : d3.axisBottom(x).ticks(formattedData.length).tickFormat(d3.format('d'));

            svg.append('g')
                .attr('transform', `translate(0,${innerHeight})`)
                .call(xAxis)
                .call(g => g.select(".domain").attr('stroke', 'rgba(255, 255, 255, 0.2)'))
                .selectAll('text')
                .attr('fill', '#9ca3af')
                .style('font-size', '12px');

            // Y Axis
            const yAxis = d3.axisLeft(y)
                .ticks(5)
                .tickFormat(d => chartMode === 'percent' ? `${d}%` : `$${d}T`);

            svg.append('g')
                .call(yAxis)
                .call(g => g.select(".domain").remove())
                .selectAll('text')
                .attr('fill', '#9ca3af')
                .style('font-size', '12px');

            // Clickable Year vertical indicator
            if (chartType === 'area') {
                const yearX = x(selectedYear);
                svg.append('line')
                    .attr('x1', yearX)
                    .attr('x2', yearX)
                    .attr('y1', 0)
                    .attr('y2', innerHeight)
                    .attr('stroke', '#ffffff')
                    .attr('stroke-width', 2)
                    .attr('stroke-dasharray', '4 3')
                    .attr('opacity', 0.8);

                svg.append('circle')
                    .attr('cx', yearX)
                    .attr('cy', 8)
                    .attr('r', 5)
                    .attr('fill', '#3b82f6')
                    .attr('stroke', '#ffffff')
                    .attr('stroke-width', 2);
            }
        };

        renderChart();
        window.addEventListener('resize', renderChart);
        return () => window.removeEventListener('resize', renderChart);
    }, [chartMode, chartType, selectedYear, hoveredSector, sectorColorMap]);

    // Render Selected Year Snapshot Donut Chart
    useEffect(() => {
        const container = donutContainerRef.current;
        if (!container) return;

        const renderDonut = () => {
            const { width, height } = container.getBoundingClientRect();
            const radius = Math.min(width, height) / 2 - 15;

            d3.select(donutSvgRef.current).selectAll("*").remove();

            const svg = d3.select(donutSvgRef.current)
                .attr('width', width)
                .attr('height', height)
                .append('g')
                .attr('transform', `translate(${width / 2},${height / 2})`);

            const pie = d3.pie()
                .value(d => d.weight)
                .sort(null);

            const arc = d3.arc()
                .innerRadius(radius * 0.62)
                .outerRadius(radius);

            const hoverArc = d3.arc()
                .innerRadius(radius * 0.60)
                .outerRadius(radius + 6);

            const arcs = svg.selectAll('.donut-arc')
                .data(pie(selectedYearData.sectors))
                .enter().append('g')
                .attr('class', 'donut-arc');

            arcs.append('path')
                .attr('d', arc)
                .attr('fill', d => d.data.color)
                .attr('stroke', '#181b21')
                .attr('stroke-width', 2)
                .attr('opacity', d => (hoveredSector && hoveredSector !== d.data.symbol ? 0.35 : 1))
                .style('cursor', 'pointer')
                .on('mouseenter', function (event, d) {
                    d3.select(this).transition().duration(150).attr('d', hoverArc);
                    setHoveredSector(d.data.symbol);
                })
                .on('mouseleave', function () {
                    d3.select(this).transition().duration(150).attr('d', arc);
                    setHoveredSector(null);
                });

            // Center Text
            const centerText = svg.append('text')
                .attr('text-anchor', 'middle')
                .attr('dy', '-0.2em')
                .attr('fill', '#ffffff')
                .style('font-size', '20px')
                .style('font-weight', '700');

            centerText.text(selectedYear);

            svg.append('text')
                .attr('text-anchor', 'middle')
                .attr('dy', '1.4em')
                .attr('fill', '#9ca3af')
                .style('font-size', '11px')
                .text(`$${selectedYearData.totalMarketCap}T Total`);
        };

        renderDonut();
        window.addEventListener('resize', renderDonut);
        return () => window.removeEventListener('resize', renderDonut);
    }, [selectedYearData, hoveredSector, selectedYear]);

    // Compute 100% dynamic insights from historical dataset and selected year
    const dynamicInsights = useMemo(() => {
        const baseYearEntry = HISTORICAL_SECTOR_MARKET_CAP[0];
        const currentYearEntry = HISTORICAL_SECTOR_MARKET_CAP.find(d => d.year === selectedYear) || HISTORICAL_SECTOR_MARKET_CAP[HISTORICAL_SECTOR_MARKET_CAP.length - 1];

        const sectorShifts = VANGUARD_SECTORS.map(s => {
            const baseW = baseYearEntry.weights[s.symbol] || 0;
            const currW = currentYearEntry.weights[s.symbol] || 0;
            const diff = currW - baseW;
            const currCap = (currW / 100) * currentYearEntry.totalMarketCap;
            return {
                ...s,
                baseW,
                currW,
                diff,
                currCap
            };
        });

        const sortedByDiff = [...sectorShifts].sort((a, b) => b.diff - a.diff);
        const biggestGainer = sortedByDiff[0];
        const biggestDecliner = sortedByDiff[sortedByDiff.length - 1];

        // Top 3 sectors concentration in selected year
        const sortedByCurrentWeight = [...sectorShifts].sort((a, b) => b.currW - a.currW);
        const top3 = sortedByCurrentWeight.slice(0, 3);
        const top3Weight = top3.reduce((sum, s) => sum + s.currW, 0);
        const top3Cap = top3.reduce((sum, s) => sum + s.currCap, 0);

        const marketGrowthPct = baseYearEntry.totalMarketCap > 0
            ? (((currentYearEntry.totalMarketCap - baseYearEntry.totalMarketCap) / baseYearEntry.totalMarketCap) * 100)
            : 0;

        return {
            biggestGainer,
            biggestDecliner,
            top3,
            top3Weight,
            top3Cap,
            marketGrowthPct,
            currentTotalCap: currentYearEntry.totalMarketCap,
            baseYear: baseYearEntry.year
        };
    }, [selectedYear]);

    return (
        <div className="card sector-market-cap-card">
            <div className="section-header-row">
                <div className="title-with-badge">
                    <PieChart className="section-icon" />
                    <div>
                        <h3>US Stock Market Breakdown by Sector (By Year)</h3>
                        <p className="subtitle">
                            Evolution of S&P 500 / US sector market cap share from 2015 to 2026
                        </p>
                    </div>
                </div>

                <div className="voo-coverage-pill">
                    <span className="coverage-badge">VOO Coverage</span>
                    <strong>{TOTAL_VOO_COVERAGE_PERCENT}%</strong>
                    <span className="coverage-sub">11 GICS Sectors</span>
                </div>
            </div>

            {/* Controls */}
            <div className="chart-controls-toolbar">
                <div className="control-group">
                    <span className="control-label">Stack Mode:</span>
                    <div className="btn-group-toggle">
                        <button
                            className={`toggle-pill-btn ${chartMode === 'percent' ? 'active' : ''}`}
                            onClick={() => setChartMode('percent')}
                        >
                            <Percent size={13} />
                            100% Stacked Share (%)
                        </button>
                        <button
                            className={`toggle-pill-btn ${chartMode === 'absolute' ? 'active' : ''}`}
                            onClick={() => setChartMode('absolute')}
                        >
                            <Layers size={13} />
                            Market Cap ($ Trillions)
                        </button>
                    </div>
                </div>

                <div className="control-group">
                    <span className="control-label">Chart Type:</span>
                    <div className="btn-group-toggle">
                        <button
                            className={`toggle-pill-btn ${chartType === 'area' ? 'active' : ''}`}
                            onClick={() => setChartType('area')}
                        >
                            <Layers size={13} />
                            Stacked Area
                        </button>
                        <button
                            className={`toggle-pill-btn ${chartType === 'bar' ? 'active' : ''}`}
                            onClick={() => setChartType('bar')}
                        >
                            <BarChart2 size={13} />
                            Stacked Bar
                        </button>
                    </div>
                </div>

                <div className="control-group year-select-group">
                    <span className="control-label">Inspect Year:</span>
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="year-dropdown"
                    >
                        {HISTORICAL_SECTOR_MARKET_CAP.map(d => (
                            <option key={d.year} value={d.year}>
                                {d.year} (${d.totalMarketCap}T)
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Visual Charts Layout */}
            <div className="market-cap-grid">
                {/* Main Stacked Chart by Year */}
                <div className="stacked-chart-panel">
                    <div className="panel-title">
                        <span>{chartMode === 'percent' ? 'Sector Allocation Over Time (% of Total Market Cap)' : 'Total Market Cap Growth by Sector ($ Trillions)'}</span>
                        <span className="helper-hint">Click on a year or bar to inspect snapshot</span>
                    </div>
                    <div className="chart-container" ref={containerRef} style={{ height: '380px', position: 'relative' }}>
                        <svg ref={svgRef} />
                    </div>
                </div>

                {/* Selected Year Snapshot Donut & Top Breakdown */}
                <div className="year-snapshot-panel">
                    <div className="panel-title">
                        <span>{selectedYear} Sector Distribution</span>
                        <span className="badge-highlight">${selectedYearData.totalMarketCap}T Total</span>
                    </div>

                    <div className="donut-and-list">
                        <div className="donut-box" ref={donutContainerRef} style={{ height: '200px', width: '200px' }}>
                            <svg ref={donutSvgRef} />
                        </div>

                        <div className="sector-ranking-list">
                            {selectedYearData.sectors.map((s, idx) => (
                                <div
                                    key={s.symbol}
                                    className={`sector-rank-item ${hoveredSector === s.symbol ? 'hovered' : ''}`}
                                    onMouseEnter={() => setHoveredSector(s.symbol)}
                                    onMouseLeave={() => setHoveredSector(null)}
                                >
                                    <span className="rank-idx">#{idx + 1}</span>
                                    <span className="color-swatch" style={{ backgroundColor: s.color }} />
                                    <div className="name-and-ticker">
                                        <strong>{s.symbol}</strong>
                                        <span className="short-desc">{s.shortName}</span>
                                    </div>
                                    <div className="share-stats">
                                        <span className="pct-val">{s.weight.toFixed(1)}%</span>
                                        <span className="dlr-val">${s.marketCapDollar}T</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* 100% Dynamic Insights Callout Grid */}
            <div className="dynamic-market-insights-grid">
                <div className="insight-stat-box">
                    <div className="box-title">
                        <Info size={14} className="callout-icon" />
                        <span>Share Expansion ({dynamicInsights.baseYear} → {selectedYear})</span>
                    </div>
                    <div className="box-content">
                        <strong>{dynamicInsights.biggestGainer.name} ({dynamicInsights.biggestGainer.symbol})</strong>
                        <span className="stat-change positive">
                            +{dynamicInsights.biggestGainer.diff.toFixed(1)}% share
                        </span>
                        <p className="box-desc">
                            Expanded from {dynamicInsights.biggestGainer.baseW.toFixed(1)}% to {dynamicInsights.biggestGainer.currW.toFixed(1)}% of the market.
                        </p>
                    </div>
                </div>

                <div className="insight-stat-box">
                    <div className="box-title">
                        <Info size={14} className="callout-icon" />
                        <span>Largest Share Compression</span>
                    </div>
                    <div className="box-content">
                        <strong>{dynamicInsights.biggestDecliner.name} ({dynamicInsights.biggestDecliner.symbol})</strong>
                        <span className="stat-change negative">
                            {dynamicInsights.biggestDecliner.diff.toFixed(1)}% share
                        </span>
                        <p className="box-desc">
                            Shifted from {dynamicInsights.biggestDecliner.baseW.toFixed(1)}% down to {dynamicInsights.biggestDecliner.currW.toFixed(1)}% in {selectedYear}.
                        </p>
                    </div>
                </div>

                <div className="insight-stat-box">
                    <div className="box-title">
                        <Info size={14} className="callout-icon" />
                        <span>{selectedYear} Market Concentration</span>
                    </div>
                    <div className="box-content">
                        <strong>Top 3 Sectors: {dynamicInsights.top3.map(s => s.symbol).join(', ')}</strong>
                        <span className="stat-highlight">
                            {dynamicInsights.top3Weight.toFixed(1)}% Total
                        </span>
                        <p className="box-desc">
                            Accounting for ${dynamicInsights.top3Cap.toFixed(1)}T of the ${dynamicInsights.currentTotalCap}T market.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SectorMarketCapBreakdown;
