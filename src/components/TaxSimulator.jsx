import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

const TaxSimulator = ({ dataPoints, targetAmount, onTargetChange, totalValue, isLogScale }) => {
    const svgRef = useRef(null);
    const containerRef = useRef(null);
    const [visibleSeries, setVisibleSeries] = useState({
        basis: true,
        gain: true,
        tax: true,
        rate: true,
        marginal: true
    });

    useEffect(() => {
        if (!dataPoints || dataPoints.length === 0) return;

        const renderChart = () => {
            const container = containerRef.current;
            const { width, height } = container.getBoundingClientRect();
            const margin = { top: 20, right: 60, bottom: 40, left: 60 };
            const innerWidth = width - margin.left - margin.right;
            const innerHeight = height - margin.top - margin.bottom;

            d3.select(svgRef.current).selectAll("*").remove();

            const svg = d3.select(svgRef.current)
                .attr('width', width)
                .attr('height', height)
                .append('g')
                .attr('transform', `translate(${margin.left},${margin.top})`);

            const stackedData = dataPoints.map(d => ({
                x: d.x,
                tax: d.y,
                basis: d.basis,
                gain: Math.max(0, d.x - d.basis - d.y)
            }));

            const activeKeys = ['tax', 'basis', 'gain'].filter(k => visibleSeries[k]);
            const stack = d3.stack().keys(activeKeys);
            const series = stack(stackedData);

            const x = d3.scaleLinear()
                .domain([0, d3.max(dataPoints, d => d.x)])
                .range([0, innerWidth]);

            const y = isLogScale
                ? d3.scaleLog().domain([1, Math.max(10, d3.max(dataPoints, d => d.x) * 1.1)]).range([innerHeight, 0])
                : d3.scaleLinear().domain([0, d3.max(dataPoints, d => d.x) * 1.1]).range([innerHeight, 0]);

            const yRate = d3.scaleLinear()
                .domain([0, 50])
                .range([innerHeight, 0]);

            // Grid Lines
            const drawGrid = (g, scale, axis, size) => {
                g.attr('class', 'grid')
                    .call(axis(scale).ticks(size).tickSize(-innerWidth).tickFormat(''))
                    .call(g => g.select(".domain").remove())
                    .selectAll('line')
                    .attr('stroke', 'rgba(255, 255, 255, 0.05)');
            };

            svg.append('g').attr('transform', `translate(0,${innerHeight})`).call(g => drawGrid(g, x, d3.axisBottom, 5));
            svg.append('g').call(g => drawGrid(g, y, d3.axisLeft, 5));

            // Areas
            const area = d3.area()
                .x(d => x(d.data.x))
                .y0(d => y(d[0]))
                .y1(d => y(d[1]));

            const colors = { tax: '#ef4444', basis: '#3b82f6', gain: '#10b981' };

            svg.selectAll('.layer')
                .data(series)
                .enter().append('path')
                .attr('class', 'layer')
                .attr('d', area)
                .attr('fill', d => colors[d.key])
                .attr('fill-opacity', 0.6);

            // Rate Lines
            const rateLine = d3.line()
                .x(d => x(d.x))
                .y(d => yRate(d.y));

            if (visibleSeries.rate) {
                const effectiveRateData = dataPoints.map(d => ({ x: d.x, y: d.x > 0 ? (d.y / d.x) * 100 : 0 }));

                svg.append('path')
                    .datum(effectiveRateData)
                    .attr('fill', 'none')
                    .attr('stroke', '#f59e0b')
                    .attr('stroke-width', 2)
                    .attr('stroke-dasharray', '5,5')
                    .attr('d', rateLine);
            }

            if (visibleSeries.marginal) {
                const marginalRateData = dataPoints.map(d => ({ x: d.x, y: d.marginalRate || 0 }));

                svg.append('path')
                    .datum(marginalRateData)
                    .attr('fill', 'none')
                    .attr('stroke', '#8b5cf6')
                    .attr('stroke-width', 2)
                    .attr('d', rateLine);
            }

            // Axes (Unconditional)
            svg.append('g')
                .attr('transform', `translate(0,${innerHeight})`)
                .call(d3.axisBottom(x).ticks(5).tickFormat(d => '$' + Math.round(d / 1000) + 'k'))
                .selectAll('text').style('fill', '#9ca3af').style('font-size', '11px');

            svg.append('g')
                .call(d3.axisLeft(y).ticks(5).tickFormat(d => '$' + Math.round(d / 1000) + 'k'))
                .selectAll('text').style('fill', '#9ca3af').style('font-size', '11px');

            svg.append('g')
                .attr('transform', `translate(${innerWidth}, 0)`)
                .call(d3.axisRight(yRate).ticks(5).tickFormat(d => d + '%'))
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

            const seriesColors = { tax: '#ef4444', basis: '#3b82f6', gain: '#10b981', rate: '#f59e0b', marginal: '#8b5cf6' };

            Object.entries(seriesColors).forEach(([key, color]) => {
                if (visibleSeries[key]) {
                    tooltipPoints[key] = tooltip.append('circle')
                        .attr('r', 4)
                        .attr('fill', color)
                        .attr('stroke', '#1f2937')
                        .attr('stroke-width', 2);

                    tooltipTexts[key] = tooltip.append('text')
                        .attr('fill', '#e5e7eb')
                        .style('font-size', '11px')
                        .style('font-weight', 'bold')
                        .style('text-shadow', '0 1px 2px rgba(0,0,0,0.8)');
                }
            });

            // Overlay for mouse events
            svg.append('rect')
                .attr('width', innerWidth)
                .attr('height', innerHeight)
                .attr('fill', 'transparent')
                .on('mouseover', () => tooltip.style('display', null))
                .on('mouseout', () => tooltip.style('display', 'none'))
                .on('mousemove', (event) => {
                    const bisectX = d3.bisector(d => d.x).left;
                    const x0 = x.invert(d3.pointer(event)[0]);
                    const i = bisectX(dataPoints, x0, 1);
                    const d0 = dataPoints[i - 1];
                    const d1 = dataPoints[i];
                    let d = d0;
                    if (d1 && d0) {
                        d = x0 - d0.x > d1.x - x0 ? d1 : d0;
                    }

                    if (!d) return;

                    const tx = x(d.x);
                    tooltip.attr('transform', `translate(${tx},0)`);

                    // Construct data object for current point
                    const currentVals = {
                        basis: d.basis,
                        gain: Math.max(0, d.x - d.basis - d.y),
                        tax: d.y,
                        rate: d.x > 0 ? (d.y / d.x) * 100 : 0,
                        marginal: d.marginalRate || 0
                    };

                    // Stack Logic for Tooltip Dots
                    const stackedPositions = {};
                    let stackAccumulator = 0;
                    // Order must match the stack generation order: tax -> basis -> gain
                    ['tax', 'basis', 'gain'].forEach(key => {
                        if (visibleSeries[key]) {
                            stackAccumulator += currentVals[key];
                            stackedPositions[key] = stackAccumulator;
                        }
                    });

                    Object.entries(tooltipPoints).forEach(([key, circle]) => {
                        const val = currentVals[key];
                        const text = tooltipTexts[key];

                        if (val !== undefined && !isNaN(val)) {
                            let yPos;
                            if (key === 'rate' || key === 'marginal') {
                                yPos = yRate(val);
                            } else {
                                // Use stacked position if available, else individual (shouldn't happen for stacked keys)
                                yPos = y(stackedPositions[key] !== undefined ? stackedPositions[key] : val);
                            }

                            circle.attr('cy', yPos).style('visibility', 'visible');

                            let valStr;
                            if (key === 'rate' || key === 'marginal') {
                                valStr = val.toFixed(1) + '%';
                            } else {
                                valStr = '$' + Math.round(val / 1000) + 'k';
                            }

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
                });
        };

        renderChart();
        window.addEventListener('resize', renderChart);
        return () => window.removeEventListener('resize', renderChart);
    }, [dataPoints, visibleSeries, isLogScale]);

    const sliderPercent = (targetAmount / (totalValue || 1)) * 100;

    // Calculate tax at current target from dataPoints
    let estimatedTax = 0;
    if (dataPoints && dataPoints.length > 0) {
        // Find the closest data point <= targetAmount
        for (let i = dataPoints.length - 1; i >= 0; i--) {
            if (dataPoints[i].x <= targetAmount) {
                estimatedTax = dataPoints[i].y;
                break;
            }
        }
        // If target is beyond all points, use the last one
        if (targetAmount >= dataPoints[dataPoints.length - 1].x) {
            estimatedTax = dataPoints[dataPoints.length - 1].y;
        }
    }
    const netLiquidation = targetAmount - estimatedTax;

    return (
        <div className="card chart-card">
            <div className="card-header">
                <h3>Tax Impact Simulator</h3>
            </div>

            <div className="chart-container" ref={containerRef} style={{ height: '280px', position: 'relative' }}>
                <svg ref={svgRef} />
            </div>

            <div className="slider-wrapper" style={{ padding: '0 60px' }}>
                <input
                    type="range"
                    min="0"
                    max={totalValue || 100}
                    value={targetAmount}
                    onChange={(e) => onTargetChange(parseFloat(e.target.value))}
                    className="tax-slider"
                    style={{
                        backgroundImage: `linear-gradient(to right, #10b981 ${sliderPercent}%, rgba(255,255,255,0.1) ${sliderPercent}%)`
                    }}
                />
                <div className="slider-labels">
                    <span>$0</span>
                    <span>Net Liquidation: ${Math.round(netLiquidation).toLocaleString()}</span>
                    <span>${Math.round(totalValue / 1000).toLocaleString()}k</span>
                </div>
            </div>

            <div className="chart-legend" style={{ display: 'flex', gap: '15px', marginLeft: '60px', marginTop: '10px', marginBottom: '15px' }}>
                {[
                    { key: 'basis', label: 'Capital Invested', color: '#3b82f6' },
                    { key: 'gain', label: 'Net Gain', color: '#10b981' },
                    { key: 'tax', label: 'Tax Liability', color: '#ef4444' },
                    { key: 'rate', label: 'Effective Rate', color: '#f59e0b' },
                    { key: 'marginal', label: 'Marginal Rate', color: '#8b5cf6' }
                ].map(item => (
                    <div key={item.key}
                        onClick={() => setVisibleSeries(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                        style={{
                            display: 'flex', alignItems: 'center', cursor: 'pointer',
                            opacity: visibleSeries[item.key] ? 1 : 0.5
                        }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: item.color, marginRight: 5 }}></div>
                        <span style={{ fontSize: '12px', color: '#9ca3af' }}>{item.label}</span>
                    </div>
                ))}
            </div>

        </div>
    );
};

export default TaxSimulator;
