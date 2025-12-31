import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { formatINRShort } from '../utils/calculations';

const MFPortfolioGrowthChart = ({ inrData, usdData, range, setRange }) => {
    const svgRef = useRef(null);
    const containerRef = useRef(null);
    const [visibleSeries, setVisibleSeries] = useState(['INR', 'USD']);

    useEffect(() => {
        if (!inrData || inrData.length === 0 || !usdData || usdData.length === 0) return;

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

            // Filter by range
            const lastDataPoint = inrData[inrData.length - 1];
            const lastDate = new Date(lastDataPoint.x);
            let cutoff = new Date(lastDate);
            if (range === '1m') cutoff.setMonth(lastDate.getMonth() - 1);
            else if (range === '6m') cutoff.setMonth(lastDate.getMonth() - 6);
            else if (range === '1y') cutoff.setFullYear(lastDate.getFullYear() - 1);
            else if (range === '2y') cutoff.setFullYear(lastDate.getFullYear() - 2);
            else if (range === '5y') cutoff.setFullYear(lastDate.getFullYear() - 5);
            else if (range === 'max') cutoff = new Date(0);
            else cutoff.setFullYear(lastDate.getFullYear() - 3);

            const filteredINR = inrData.filter(d => new Date(d.x) >= cutoff);
            const filteredUSD = usdData.filter(d => new Date(d.x) >= cutoff);

            if (filteredINR.length === 0 || filteredUSD.length === 0) return;

            // X Scale
            const x = d3.scaleTime()
                .domain(d3.extent(filteredINR, d => new Date(d.x)))
                .range([0, innerWidth]);

            // Y Scales (Dual)
            const yINR = d3.scaleLinear()
                .domain([
                    d3.min(filteredINR, d => d.y) * 0.95,
                    d3.max(filteredINR, d => d.y) * 1.05
                ])
                .range([innerHeight, 0]);

            const yUSD = d3.scaleLinear()
                .domain([
                    d3.min(filteredUSD, d => d.y) * 0.95,
                    d3.max(filteredUSD, d => d.y) * 1.05
                ])
                .range([innerHeight, 0]);

            // Grid Lines (Horizontal only, based on INR axis)
            svg.append('g').attr('class', 'grid')
                .call(d3.axisLeft(yINR).ticks(5).tickSize(-innerWidth).tickFormat(''))
                .call(g => g.select(".domain").remove())
                .selectAll('line').attr('stroke', 'rgba(255, 255, 255, 0.05)');

            // Vertical Grid
            svg.append('g').attr('class', 'grid').attr('transform', `translate(0,${innerHeight})`)
                .call(d3.axisBottom(x).ticks(innerWidth / 100).tickSize(-innerHeight).tickFormat(''))
                .call(g => g.select(".domain").remove())
                .selectAll('line').attr('stroke', 'rgba(255, 255, 255, 0.05)');

            // Lines
            if (visibleSeries.includes('INR')) {
                const lineINR = d3.line()
                    .x(d => x(new Date(d.x)))
                    .y(d => yINR(d.y))
                    .curve(d3.curveMonotoneX);

                svg.append('path').datum(filteredINR).attr('fill', 'none').attr('stroke', '#10b981').attr('stroke-width', 2).attr('d', lineINR);
            }

            if (visibleSeries.includes('USD')) {
                const lineUSD = d3.line()
                    .x(d => x(new Date(d.x)))
                    .y(d => yUSD(d.y))
                    .curve(d3.curveMonotoneX);

                svg.append('path').datum(filteredUSD).attr('fill', 'none').attr('stroke', '#3b82f6').attr('stroke-width', 2).attr('d', lineUSD);
            }

            // Tracking Line & Focus
            const focus = svg.append('g').style('display', 'none');
            focus.append('line').attr('class', 'guide-line').attr('y1', 0).attr('y2', innerHeight).attr('stroke', '#4b5563').attr('stroke-dasharray', '4 4').attr('stroke-width', 1);

            const trackINR = focus.append('circle').attr('r', 4).attr('fill', '#10b981').attr('stroke', '#1f2937').attr('stroke-width', 2);
            const trackUSD = focus.append('circle').attr('r', 4).attr('fill', '#3b82f6').attr('stroke', '#1f2937').attr('stroke-width', 2);

            const labelINR = focus.append('text').attr('fill', '#e5e7eb').style('font-size', '11px').style('font-weight', 'bold');
            const labelUSD = focus.append('text').attr('fill', '#e5e7eb').style('font-size', '11px').style('font-weight', 'bold');
            const dateLabel = focus.append('text').attr('fill', '#9ca3af').style('font-size', '11px').attr('y', -8);

            const bisectDate = d3.bisector(d => new Date(d.x)).left;

            svg.append('rect')
                .attr('width', innerWidth)
                .attr('height', innerHeight)
                .attr('fill', 'none')
                .attr('pointer-events', 'all')
                .on('mouseover', () => focus.style('display', null))
                .on('mouseout', () => focus.style('display', 'none'))
                .on('mousemove', function (event) {
                    const x0 = x.invert(d3.pointer(event)[0]);
                    const i = bisectDate(filteredINR, x0, 1);
                    const d0 = filteredINR[i - 1];
                    const d1 = filteredINR[i];
                    const dI = d1 && d0 ? (x0 - new Date(d0.x) > new Date(d1.x) - x0 ? d1 : d0) : (d0 || d1);

                    const j = bisectDate(filteredUSD, x0, 1);
                    const u0 = filteredUSD[j - 1];
                    const u1 = filteredUSD[j];
                    const dU = u1 && u0 ? (x0 - new Date(u0.x) > new Date(u1.x) - x0 ? u1 : u0) : (u0 || u1);

                    if (!dI || !dU) return;

                    const tx = x(new Date(dI.x));
                    focus.attr('transform', `translate(${tx},0)`);

                    if (visibleSeries.includes('INR')) {
                        const yVal = yINR(dI.y);
                        trackINR.attr('cy', yVal).style('display', null);
                        labelINR.attr('y', yVal - 8).text('₹' + formatINRShort(dI.y)).style('display', null);
                        if (tx > innerWidth - 60) labelINR.attr('x', -8).attr('text-anchor', 'end');
                        else labelINR.attr('x', 8).attr('text-anchor', 'start');
                    } else {
                        trackINR.style('display', 'none');
                        labelINR.style('display', 'none');
                    }

                    if (visibleSeries.includes('USD')) {
                        const yVal = yUSD(dU.y);
                        trackUSD.attr('cy', yVal).style('display', null);
                        labelUSD.attr('y', yVal - 8).text('$' + Math.round(dU.y / 100) / 10 + 'k').style('display', null);
                        if (tx > innerWidth - 60) labelUSD.attr('x', -8).attr('text-anchor', 'end');
                        else labelUSD.attr('x', 8).attr('text-anchor', 'start');
                    } else {
                        trackUSD.style('display', 'none');
                        labelUSD.style('display', 'none');
                    }

                    dateLabel.text(d3.timeFormat("%b %d, %Y")(new Date(dI.x)));
                    if (tx > innerWidth - 100) dateLabel.attr('x', -10).attr('text-anchor', 'end');
                    else dateLabel.attr('x', 10).attr('text-anchor', 'start');
                });

            // Axes
            svg.append('g').attr('transform', `translate(0,${innerHeight})`)
                .call(d3.axisBottom(x).ticks(innerWidth / 100).tickFormat(d3.timeFormat("%b %y")))
                .call(g => g.select(".domain").remove())
                .selectAll('text').style('fill', '#9ca3af').style('font-size', '11px');

            svg.append('g')
                .call(d3.axisLeft(yINR).ticks(5).tickFormat(d => '₹' + formatINRShort(d)))
                .call(g => g.select(".domain").remove())
                .selectAll('text').style('fill', '#10b981').style('font-size', '11px');

            svg.append('g').attr('transform', `translate(${innerWidth}, 0)`)
                .call(d3.axisRight(yUSD).ticks(5).tickFormat(d => '$' + Math.round(d / 1000) + 'k'))
                .call(g => g.select(".domain").remove())
                .selectAll('text').style('fill', '#3b82f6').style('font-size', '11px');
        };

        renderChart();
        window.addEventListener('resize', renderChart);
        return () => window.removeEventListener('resize', renderChart);
    }, [inrData, usdData, range, visibleSeries]);

    return (
        <div className="card chart-card">
            <div className="card-header">
                <h3>Portfolio Growth (INR vs USD)</h3>
                <div className="chart-controls">
                    {['1m', '6m', '1y', '2y', '3y', '5y', 'max'].map(r => (
                        <button key={r} className={`filter-btn ${range === r ? 'active' : ''}`} onClick={() => setRange(r)}>
                            {r.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>
            <div className="chart-container" ref={containerRef} style={{ height: '350px', position: 'relative' }}>
                <svg ref={svgRef} />
            </div>
            <div className="chart-legend" style={{ display: 'flex', gap: '20px', padding: '0 60px 15px' }}>
                {[
                    { id: 'INR', label: 'Market Value (INR)', color: '#10b981' },
                    { id: 'USD', label: 'Market Value (USD)', color: '#3b82f6' }
                ].map(s => (
                    <div key={s.id} className="legend-item" onClick={() => setVisibleSeries(prev => prev.includes(s.id) ? prev.filter(x => x !== s.id) : [...prev, s.id])} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', opacity: visibleSeries.includes(s.id) ? 1 : 0.4 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, marginRight: 8 }} />
                        <span style={{ fontSize: '12px', color: '#9ca3af' }}>{s.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default MFPortfolioGrowthChart;
