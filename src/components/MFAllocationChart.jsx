import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

const MFAllocationChart = ({ data }) => {
    const svgRef = useRef(null);
    const containerRef = useRef(null);

    useEffect(() => {
        if (!data || data.length === 0) return;

        const renderChart = () => {
            const container = containerRef.current;
            const { width, height } = container.getBoundingClientRect();
            const radius = Math.min(width, height) / 2 - 40;

            d3.select(svgRef.current).selectAll("*").remove();

            const svg = d3.select(svgRef.current)
                .attr('width', width)
                .attr('height', height)
                .append('g')
                .attr('transform', `translate(${width / 2},${height / 2})`);

            const color = d3.scaleOrdinal()
                .domain(data.map(d => d.name))
                .range(['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6']);

            const pie = d3.pie()
                .value(d => d.value)
                .sort(null);

            const arc = d3.arc()
                .innerRadius(radius * 0.6)
                .outerRadius(radius);

            const arcs = svg.selectAll('.arc')
                .data(pie(data))
                .enter().append('g')
                .attr('class', 'arc');

            arcs.append('path')
                .attr('d', arc)
                .attr('fill', d => color(d.data.name))
                .attr('stroke', '#181b21')
                .attr('stroke-width', 2);

            // Legend
            const legend = svg.append('g')
                .attr('transform', `translate(${radius + 20}, -${radius})`);

            data.forEach((d, i) => {
                const lg = legend.append('g').attr('transform', `translate(0, ${i * 20})`);
                lg.append('rect').attr('width', 12).attr('height', 12).attr('fill', color(d.name));
                lg.append('text').attr('x', 18).attr('y', 10).text(d.name).attr('fill', '#9ca3af').style('font-size', '10px');
            });
        };

        renderChart();
        window.addEventListener('resize', renderChart);
        return () => window.removeEventListener('resize', renderChart);
    }, [data]);

    return (
        <div className="card chart-card">
            <div className="card-header">
                <h3>Asset Allocation</h3>
            </div>
            <div className="chart-container" ref={containerRef} style={{ height: '350px', position: 'relative' }}>
                <svg ref={svgRef} />
            </div>
        </div>
    );
};

export default MFAllocationChart;
