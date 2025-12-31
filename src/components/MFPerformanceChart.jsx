import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

const MFPerformanceChart = ({ data, currency }) => {
    const svgRef = useRef(null);
    const containerRef = useRef(null);
    const [range, setRange] = useState('3y');

    useEffect(() => {
        if (!data || data.length === 0) return;

        const renderChart = () => {
            const container = containerRef.current;
            const { width, height } = container.getBoundingClientRect();
            const margin = { top: 20, right: 30, bottom: 40, left: 60 };
            const innerWidth = width - margin.left - margin.right;
            const innerHeight = height - margin.top - margin.bottom;

            d3.select(svgRef.current).selectAll("*").remove();

            const svg = d3.select(svgRef.current)
                .attr('width', width)
                .attr('height', height)
                .append('g')
                .attr('transform', `translate(${margin.left},${margin.top})`);

            // Filter by range
            const lastDate = new Date(data[data.length - 1].x);
            let cutoff = new Date(lastDate);
            if (range === '1y') cutoff.setFullYear(lastDate.getFullYear() - 1);
            else if (range === '5y') cutoff.setFullYear(lastDate.getFullYear() - 5);
            else if (range === 'max') cutoff = new Date(0);
            else cutoff.setFullYear(lastDate.getFullYear() - 3); // 3y

            const filtered = data.filter(d => new Date(d.x) >= cutoff);
            if (filtered.length === 0) return;

            const x = d3.scaleTime()
                .domain(d3.extent(filtered, d => new Date(d.x)))
                .range([0, innerWidth]);

            const y = d3.scaleLinear()
                .domain([d3.min(filtered, d => d.y) * 0.95, d3.max(filtered, d => d.y) * 1.05])
                .range([innerHeight, 0]);

            // Grid
            svg.append('g').attr('transform', `translate(0,${innerHeight})`)
                .call(d3.axisBottom(x).ticks(innerWidth / 100).tickSize(-innerHeight).tickFormat(''))
                .selectAll('line').attr('stroke', 'rgba(255,255,255,0.05)');

            svg.append('g')
                .call(d3.axisLeft(y).ticks(5).tickSize(-innerWidth).tickFormat(''))
                .selectAll('line').attr('stroke', 'rgba(255,255,255,0.05)');

            // Line
            const line = d3.line()
                .x(d => x(new Date(d.x)))
                .y(d => y(d.y));

            svg.append('path')
                .datum(filtered)
                .attr('fill', 'none')
                .attr('stroke', currency === 'INR' ? '#10b981' : '#3b82f6')
                .attr('stroke-width', 2)
                .attr('d', line);

            // Area
            const area = d3.area()
                .x(d => x(new Date(d.x)))
                .y0(innerHeight)
                .y1(d => y(d.y));

            svg.append('path')
                .datum(filtered)
                .attr('fill', currency === 'INR' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)')
                .attr('d', area);

            // Axes
            svg.append('g').attr('transform', `translate(0,${innerHeight})`)
                .call(d3.axisBottom(x).ticks(innerWidth / 100).tickFormat(d3.timeFormat("%b %y")))
                .call(g => g.select(".domain").remove())
                .selectAll('text').style('fill', '#9ca3af').style('font-size', '10px');

            svg.append('g')
                .call(d3.axisLeft(y).ticks(5).tickFormat(d => (currency === 'INR' ? '₹' : '$') + Math.round(d).toLocaleString()))
                .call(g => g.select(".domain").remove())
                .selectAll('text').style('fill', '#9ca3af').style('font-size', '10px');
        };

        renderChart();
        window.addEventListener('resize', renderChart);
        return () => window.removeEventListener('resize', renderChart);
    }, [data, currency, range]);

    return (
        <div className="card chart-card">
            <div className="card-header">
                <h3>Performance ({currency})</h3>
                <div className="chart-controls">
                    {['1y', '3y', '5y', 'max'].map(r => (
                        <button key={r} className={`filter-btn ${range === r ? 'active' : ''}`} onClick={() => setRange(r)}>
                            {r.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>
            <div className="chart-container" ref={containerRef} style={{ height: '300px', position: 'relative' }}>
                <svg ref={svgRef} />
            </div>
        </div>
    );
};

export default MFPerformanceChart;
