import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

const TaxSimulator = ({ dataPoints, targetAmount, onTargetChange, totalValue }) => {
    const svgRef = useRef(null);
    const containerRef = useRef(null);

    useEffect(() => {
        if (!dataPoints || dataPoints.length === 0) return;

        const renderChart = () => {
            const container = containerRef.current;
            const { width, height } = container.getBoundingClientRect();
            const margin = { top: 10, right: 60, bottom: 40, left: 60 };
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

            const stack = d3.stack().keys(['tax', 'basis', 'gain']);
            const series = stack(stackedData);

            const x = d3.scaleLinear()
                .domain([0, d3.max(dataPoints, d => d.x)])
                .range([0, innerWidth]);

            const y = d3.scaleLinear()
                .domain([0, d3.max(dataPoints, d => d.x) * 1.1])
                .range([innerHeight, 0]);

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

            const effectiveRateData = dataPoints.map(d => ({ x: d.x, y: d.x > 0 ? (d.y / d.x) * 100 : 0 }));

            svg.append('path')
                .datum(effectiveRateData)
                .attr('fill', 'none')
                .attr('stroke', '#f59e0b')
                .attr('stroke-width', 2)
                .attr('stroke-dasharray', '5,5')
                .attr('d', rateLine);

            // Axes
            svg.append('g')
                .attr('transform', `translate(0,${innerHeight})`)
                .call(d3.axisBottom(x).ticks(5).tickFormat(d => '$' + (d / 1000) + 'k'))
                .call(g => g.select(".domain").remove())
                .selectAll('text').style('fill', '#9ca3af').style('font-size', '10px');

            svg.append('g')
                .call(d3.axisLeft(y).ticks(5).tickFormat(d => '$' + (d / 1000) + 'k'))
                .call(g => g.select(".domain").remove())
                .selectAll('text').style('fill', '#9ca3af').style('font-size', '10px');

            svg.append('g')
                .attr('transform', `translate(${innerWidth}, 0)`)
                .call(d3.axisRight(yRate).ticks(5).tickFormat(d => d + '%'))
                .call(g => g.select(".domain").remove())
                .selectAll('text').style('fill', '#9ca3af').style('font-size', '10px');
        };

        renderChart();
        window.addEventListener('resize', renderChart);
        return () => window.removeEventListener('resize', renderChart);
    }, [dataPoints]);

    const sliderPercent = (targetAmount / (totalValue || 1)) * 100;

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
                    <span>Target: ${Math.round(targetAmount).toLocaleString()}</span>
                    <span>${Math.round(totalValue / 1000).toLocaleString()}k</span>
                </div>
            </div>

        </div>
    );
};

export default TaxSimulator;
