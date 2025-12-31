import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

const PortfolioChart = ({ historyData, range, isLogScale, isYearlyTicks }) => {
    const svgRef = useRef(null);
    const containerRef = useRef(null);
    const [visibleSeries, setVisibleSeries] = useState({
        value: true,
        netValue: true,
        cost: true,
        tax: true
    });

    useEffect(() => {
        if (!historyData || historyData.length === 0) return;

        const renderChart = () => {
            const container = containerRef.current;
            const { width, height } = container.getBoundingClientRect();
            const margin = { top: 20, right: 60, bottom: 40, left: 60 };
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

            // Yearly Ticks Logic (Original Implementation)
            if (isYearlyTicks && historyData.length > 0) {
                const lastDataPoint = historyData[historyData.length - 1];
                const lastDateObj = new Date(lastDataPoint.date);
                const targetDates = new Set();
                const minYear = new Date(historyData[0].date).getFullYear();

                let currentCursor = new Date(lastDateObj);

                // Keep adding dates as long as we haven't gone past the start year
                while (currentCursor.getFullYear() >= minYear) {
                    const dateStr = currentCursor.toISOString().split('T')[0];
                    targetDates.add(dateStr);
                    currentCursor.setFullYear(currentCursor.getFullYear() - 1);
                }

                filteredData = historyData.filter(d => targetDates.has(d.date));
            }
            else if (range !== 'max') {
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

            // Curve Factory
            const curve = d3.curveMonotoneX; // Smooth lines generally
            // For Yearly ticks, maybe linear is better? But original used standard.

            taxArea.curve(curve);
            gainArea.curve(curve);

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
                .y(d => y(d[key]))
                .curve(curve);

            const colors = { value: '#10b981', netValue: '#f59e0b', cost: '#3b82f6' };

            Object.entries(colors).forEach(([key, color]) => {
                if (visibleSeries[key]) {
                    svg.append('path')
                        .datum(filteredData)
                        .attr('fill', 'none')
                        .attr('stroke', color)
                        .attr('stroke-width', 2)
                        .attr('d', line(key));

                    // Add points for Yearly View
                    if (isYearlyTicks) {
                        svg.selectAll(`.point-${key}`)
                            .data(filteredData)
                            .enter()
                            .append('circle')
                            .attr('class', `point-${key}`)
                            .attr('cx', d => x(new Date(d.date)))
                            .attr('cy', d => y(d[key]))
                            .attr('r', 4)
                            .attr('fill', color)
                            .attr('stroke', '#1f2937')
                            .attr('stroke-width', 1);
                    }
                }
            });

            // Axes
            svg.append('g')
                .attr('transform', `translate(0,${innerHeight})`)
                .call(d3.axisBottom(x).ticks(innerWidth / 100).tickFormat(d3.timeFormat(isYearlyTicks ? "%Y" : "%b %y")))
                .selectAll('text').style('fill', '#9ca3af').style('font-size', '11px');

            svg.append('g')
                .call(d3.axisLeft(y).ticks(5).tickFormat(d => '$' + Math.round(d / 1000) + 'k'))
                .selectAll('text').style('fill', '#9ca3af').style('font-size', '11px');

            // Tooltip Interactions
            const tooltip = svg.append('g').attr('class', 'tooltip').style('display', 'none');

            // Vertical Guide Line
            tooltip.append('line')
                .attr('class', 'guide-line')
                .attr('y1', 0)
                .attr('y2', innerHeight)
                .attr('stroke', '#4b5563')
                .attr('stroke-dasharray', '4 4')
                .attr('stroke-width', 1);

            // Points and Labels
            const tooltipPoints = {};
            const tooltipTexts = {};

            Object.entries(colors).forEach(([key, color]) => {
                if (visibleSeries[key]) {
                    // Circle
                    tooltipPoints[key] = tooltip.append('circle')
                        .attr('r', 4)
                        .attr('fill', color)
                        .attr('stroke', '#1f2937')
                        .attr('stroke-width', 2);

                    // Value Text
                    tooltipTexts[key] = tooltip.append('text')
                        .attr('fill', '#e5e7eb')
                        .style('font-size', '11px')
                        .style('font-weight', 'bold')
                        .style('text-shadow', '0 1px 2px rgba(0,0,0,0.8)');
                }
            });

            // Tooltip Card (Date Label + Values)
            // Simplified: Just showing Date label near top for now, or near cursor
            const tooltipLabel = tooltip.append('text')
                .attr('x', 10)
                .attr('y', 0) // slightly above
                .attr('fill', '#e5e7eb')
                .style('font-size', '12px')
                .style('font-weight', 'bold');

            // Overlay for capturing events
            svg.append('rect')
                .attr('width', innerWidth)
                .attr('height', innerHeight)
                .attr('fill', 'transparent')
                .on('mouseover', () => tooltip.style('display', null))
                .on('mouseout', () => tooltip.style('display', 'none'))
                .on('mousemove', (event) => {
                    const bisectDate = d3.bisector(d => new Date(d.date)).left;
                    const x0 = x.invert(d3.pointer(event)[0]);
                    const i = bisectDate(filteredData, x0, 1);
                    const d0 = filteredData[i - 1];
                    const d1 = filteredData[i];
                    let d = d0;
                    if (d1 && d0) {
                        d = x0 - new Date(d0.date) > new Date(d1.date) - x0 ? d1 : d0;
                    }

                    if (!d) return;

                    const tx = x(new Date(d.date));
                    tooltip.attr('transform', `translate(${tx},0)`);

                    // Update points and texts
                    Object.entries(tooltipPoints).forEach(([key, circle]) => {
                        const val = d[key];
                        const text = tooltipTexts[key];

                        // Safety check for NaN
                        if (val !== undefined && !isNaN(val)) {
                            const yPos = y(val);
                            circle.attr('cy', yPos).style('visibility', 'visible');

                            const valStr = '$' + Math.round(val / 1000) + 'k';
                            text.attr('y', yPos - 8)
                                .attr('x', 8)
                                .text(valStr)
                                .style('visibility', 'visible');

                            if (tx > innerWidth - 60) {
                                text.attr('x', -8).attr('text-anchor', 'end');
                            } else {
                                text.attr('x', 8).attr('text-anchor', 'start');
                            }
                        } else {
                            circle.style('visibility', 'hidden');
                            text.style('visibility', 'hidden');
                        }
                    });

                    // Update label
                    // Adjust label position to not go off screen?
                    // For now simple left/right logic
                    const dateStr = d3.timeFormat("%b %d, %Y")(new Date(d.date));
                    tooltipLabel.text(dateStr);

                    if (tx > innerWidth - 100) {
                        tooltipLabel.attr('text-anchor', 'end').attr('x', -10);
                    } else {
                        tooltipLabel.attr('text-anchor', 'start').attr('x', 10);
                    }
                });
        };

        renderChart();
        window.addEventListener('resize', renderChart);
        return () => window.removeEventListener('resize', renderChart);
    }, [historyData, visibleSeries, isLogScale, range, isYearlyTicks]);

    return (
        <div className="card chart-card">
            <div className="card-header">
                <h3>Portfolio History</h3>
            </div>
            <div className="chart-container" ref={containerRef} style={{ height: '350px', position: 'relative' }}>
                <svg ref={svgRef} />
            </div>
            <div className="chart-legend" style={{ display: 'flex', gap: '15px', marginTop: '10px', marginLeft: '60px' }}>
                {[
                    { key: 'value', label: 'Market Value', color: '#10b981' },
                    { key: 'netValue', label: 'Net Liquidation', color: '#f59e0b' },
                    { key: 'cost', label: 'Capital Invested', color: '#3b82f6' },
                    { key: 'tax', label: 'Tax Liability', color: 'rgba(239, 68, 68, 0.7)' }
                ].map(item => (
                    <div
                        key={item.key}
                        onClick={() => setVisibleSeries(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                        style={{
                            display: 'flex', alignItems: 'center', cursor: 'pointer',
                            opacity: visibleSeries[item.key] ? 1 : 0.5
                        }}
                    >
                        <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: item.color, marginRight: 5 }}></div>
                        <span style={{ fontSize: '12px', color: '#9ca3af' }}>{item.label}</span>
                    </div>
                ))}
            </div>


        </div>
    );
};

export default PortfolioChart;
