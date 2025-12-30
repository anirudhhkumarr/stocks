import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

const PortfolioChart = ({ historyData }) => {
    const svgRef = useRef(null);
    const containerRef = useRef(null);
    const [visibleSeries, setVisibleSeries] = useState({
        value: true,
        netValue: true,
        cost: true,
        tax: false
    });
    const [isLogScale, setIsLogScale] = useState(false);
    const [range, setRange] = useState('max');

    useEffect(() => {
        if (!historyData || historyData.length === 0) return;

        const renderChart = () => {
            const container = containerRef.current;
            const { width, height } = container.getBoundingClientRect();
            const margin = { top: 20, right: 30, bottom: 60, left: 60 };
            const innerWidth = width - margin.left - margin.right;
            const innerHeight = height - margin.top - margin.bottom;

            // Clear previous
            d3.select(svgRef.current).selectAll("*").remove();

            const svg = d3.select(svgRef.current)
                .attr('width', width)
                .attr('height', height)
                .append('g')
                .attr('transform', `translate(${margin.left},${margin.top})`);

            // Filter data by range
            let filteredData = historyData;
            if (range !== 'max') {
                const daysMap = { '1m': 30, '6m': 180, '1y': 365, '2y': 730, '3y': 1095, '5y': 1825 };
                const days = daysMap[range] || 0;
                const cutoff = new Date();
                cutoff.setDate(cutoff.getDate() - days);
                const cutoffStr = cutoff.toISOString().split('T')[0];
                filteredData = historyData.filter(d => d.date >= cutoffStr);
            }

            if (filteredData.length === 0) return;

            // Scales
            const x = d3.scaleTime()
                .domain(d3.extent(filteredData, d => new Date(d.date)))
                .range([0, innerWidth]);

            const yDomain = [
                d3.min(filteredData, d => Math.min(d.value, d.cost, d.netValue)) * 0.95,
                d3.max(filteredData, d => Math.max(d.value, d.cost, d.netValue)) * 1.05
            ];

            const y = isLogScale
                ? d3.scaleLog().domain([Math.max(1, yDomain[0]), yDomain[1]]).range([innerHeight, 0])
                : d3.scaleLinear().domain([Math.max(0, yDomain[0]), yDomain[1]]).range([innerHeight, 0]);

            // Grid Lines
            const drawGrid = (g, scale, axis, size) => {
                g.attr('class', 'grid')
                    .call(axis(scale).ticks(size).tickSize(-innerWidth).tickFormat(''))
                    .call(g => g.select(".domain").remove())
                    .selectAll('line')
                    .attr('stroke', 'rgba(255, 255, 255, 0.05)');
            };

            svg.append('g').attr('transform', `translate(0,${innerHeight})`).call(g => drawGrid(g, x, d3.axisBottom, innerWidth / 100));
            svg.append('g').call(g => drawGrid(g, y, d3.axisLeft, 5));

            // Shading
            const taxArea = d3.area()
                .x(d => x(new Date(d.date)))
                .y0(d => y(d.value))
                .y1(d => y(d.netValue));

            const gainArea = d3.area()
                .x(d => x(new Date(d.date)))
                .y0(d => y(d.netValue))
                .y1(d => y(d.cost));

            if (visibleSeries.tax && visibleSeries.value && visibleSeries.netValue) {
                svg.append('path')
                    .datum(filteredData)
                    .attr('fill', 'rgba(239, 68, 68, 0.1)')
                    .attr('d', taxArea);
            }

            if (visibleSeries.cost && visibleSeries.netValue) {
                svg.append('path')
                    .datum(filteredData)
                    .attr('fill', 'rgba(16, 185, 129, 0.1)')
                    .attr('d', gainArea);
            }

            // Lines
            const line = (key) => d3.line()
                .x(d => x(new Date(d.date)))
                .y(d => y(d[key]));

            const colors = { value: '#10b981', netValue: '#f59e0b', cost: '#3b82f6' };

            Object.entries(colors).forEach(([key, color]) => {
                if (visibleSeries[key]) {
                    svg.append('path')
                        .datum(filteredData)
                        .attr('fill', 'none')
                        .attr('stroke', color)
                        .attr('stroke-width', 2)
                        .attr('d', line(key));
                }
            });

            // Axes
            svg.append('g')
                .attr('transform', `translate(0,${innerHeight})`)
                .call(d3.axisBottom(x).ticks(innerWidth / 100).tickFormat(d3.timeFormat("%b %y")))
                .call(g => g.select(".domain").remove())
                .selectAll('text').style('fill', '#9ca3af').style('font-size', '11px');

            svg.append('g')
                .call(d3.axisLeft(y).ticks(5).tickFormat(d => '$' + (d / 1000) + 'k'))
                .call(g => g.select(".domain").remove())
                .selectAll('text').style('fill', '#9ca3af').style('font-size', '11px');
        };

        renderChart();
        window.addEventListener('resize', renderChart);
        return () => window.removeEventListener('resize', renderChart);
    }, [historyData, visibleSeries, isLogScale, range]);

    return (
        <div className="card chart-card">
            <div className="card-header">
                <h3>Portfolio History</h3>
                <div className="chart-controls">
                    <button className={`filter-btn ${isLogScale ? 'active' : ''}`} onClick={() => setIsLogScale(!isLogScale)}>Log</button>
                    <div className="divider" />
                    {['1m', '6m', '1y', 'max'].map(r => (
                        <button key={r} className={`filter-btn ${range === r ? 'active' : ''}`} onClick={() => setRange(r)}>
                            {r.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>
            <div className="chart-container" ref={containerRef} style={{ height: '350px', position: 'relative' }}>
                <svg ref={svgRef} />
            </div>
            <div className="legend">
                {[
                    { key: 'value', label: 'Market Value', color: '#10b981' },
                    { key: 'netValue', label: 'Net Liquidation', color: '#f59e0b' },
                    { key: 'cost', label: 'Capital Invested', color: '#3b82f6' },
                    { key: 'tax', label: 'Tax Liability', color: 'rgba(239, 68, 68, 0.7)' }
                ].map(item => (
                    <div
                        key={item.key}
                        className={`legend-item ${visibleSeries[item.key] ? 'active' : ''}`}
                        onClick={() => setVisibleSeries(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                    >
                        <span className="dot" style={{ backgroundColor: item.color }} />
                        <span className="label">{item.label}</span>
                    </div>
                ))}
            </div>

        </div>
    );
};

export default PortfolioChart;
