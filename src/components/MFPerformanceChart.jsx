import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

const MFPerformanceChart = ({ inrData, usdData, range }) => {
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
            else cutoff.setFullYear(lastDate.getFullYear() - 3); // 3y (Default)

            const filteredINR = inrData.filter(d => new Date(d.x) >= cutoff);
            const filteredUSD = usdData.filter(d => new Date(d.x) >= cutoff);

            if (filteredINR.length === 0 || filteredUSD.length === 0) return;

            // Normalize to 100 at the START of the window
            const startINR = filteredINR[0].y;
            const startUSD = filteredUSD[0].y;

            const normalizedINR = filteredINR.map(d => ({ ...d, val: (d.y / startINR) * 100 }));
            const normalizedUSD = filteredUSD.map(d => ({ ...d, val: (d.y / startUSD) * 100 }));

            const allPoints = [
                ...(visibleSeries.includes('INR') ? normalizedINR : []),
                ...(visibleSeries.includes('USD') ? normalizedUSD : [])
            ];

            if (allPoints.length === 0) return;

            const x = d3.scaleTime()
                .domain(d3.extent(normalizedINR, d => new Date(d.x)))
                .range([0, innerWidth]);

            const y = d3.scaleLinear()
                .domain([
                    d3.min(allPoints, d => d.val) * 0.98,
                    d3.max(allPoints, d => d.val) * 1.02
                ])
                .range([innerHeight, 0]);

            // Grid Lines (Parity with Stocks)
            const drawGrid = (g, scale, axis) => {
                g.attr('class', 'grid')
                    .call(axis(scale).ticks(5).tickSize(-innerWidth).tickFormat(''))
                    .call(g => g.select(".domain").remove())
                    .selectAll('line')
                    .attr('stroke', 'rgba(255, 255, 255, 0.05)');
            };

            svg.append('g').attr('transform', `translate(0,${innerHeight})`).call(g => {
                g.call(d3.axisBottom(x).ticks(innerWidth / 100).tickSize(-innerHeight).tickFormat(''))
                    .call(g => g.select(".domain").remove())
                    .selectAll('line').attr('stroke', 'rgba(255,255,255,0.05)');
            });
            svg.append('g').call(g => drawGrid(g, y, d3.axisLeft));

            // Line Generator
            const line = d3.line()
                .x(d => x(new Date(d.x)))
                .y(d => y(d.val))
                .curve(d3.curveMonotoneX);

            // Shading (Currency headwind visualization)
            if (visibleSeries.includes('INR') && visibleSeries.includes('USD')) {
                const areaGenerator = d3.area()
                    .x(d => x(new Date(d.date)))
                    .y0(d => y(d.inr))
                    .y1(d => y(d.usd))
                    .curve(d3.curveMonotoneX);

                const combinedData = normalizedINR.map((d, i) => ({
                    date: d.x,
                    inr: d.val,
                    usd: i < normalizedUSD.length ? normalizedUSD[i].val : d.val
                }));

                svg.append('path')
                    .datum(combinedData)
                    .attr('fill', 'rgba(255, 255, 255, 0.03)')
                    .attr('d', areaGenerator);
            }

            // Series Rendering
            if (visibleSeries.includes('INR')) {
                svg.append('path').datum(normalizedINR).attr('fill', 'none').attr('stroke', '#10b981').attr('stroke-width', 2).attr('d', line);
            }
            if (visibleSeries.includes('USD')) {
                svg.append('path').datum(normalizedUSD).attr('fill', 'none').attr('stroke', '#3b82f6').attr('stroke-width', 2).attr('d', line);
            }

            // Tracking Components (Shared style)
            const focus = svg.append('g').style('display', 'none');
            focus.append('line').attr('class', 'guide-line').attr('y1', 0).attr('y2', innerHeight).attr('stroke', '#4b5563').attr('stroke-dasharray', '4 4').attr('stroke-width', 1);

            const trackballs = {};
            const labels = {};

            const seriesConfig = [
                { id: 'INR', color: '#10b981' },
                { id: 'USD', color: '#3b82f6' }
            ];

            seriesConfig.forEach(s => {
                if (visibleSeries.includes(s.id)) {
                    trackballs[s.id] = focus.append('circle').attr('r', 4).attr('fill', s.color).attr('stroke', '#1f2937').attr('stroke-width', 2);
                    labels[s.id] = focus.append('text').attr('fill', '#e5e7eb').style('font-size', '11px').style('font-weight', 'bold').style('text-shadow', '0 1px 2px rgba(0,0,0,0.8)');
                }
            });

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
                    const getClosest = (data) => {
                        const i = bisectDate(data, x0, 1);
                        const d0 = data[i - 1];
                        const d1 = data[i];
                        if (d1 && d0) return x0 - new Date(d0.x) > new Date(d1.x) - x0 ? d1 : d0;
                        return d0 || d1;
                    };

                    const dINR = getClosest(normalizedINR);
                    const dUSD = getClosest(normalizedUSD);

                    if (!dINR || !dUSD) return;

                    const tx = x(new Date(dINR.x));
                    focus.attr('transform', `translate(${tx},0)`);

                    seriesConfig.forEach(s => {
                        if (visibleSeries.includes(s.id)) {
                            const d = s.id === 'INR' ? dINR : dUSD;
                            const ball = trackballs[s.id];
                            const label = labels[s.id];
                            const yPos = y(d.val);

                            ball.attr('cy', yPos);
                            label.attr('y', yPos - 8).text((d.val - 100).toFixed(1) + '%');

                            if (tx > innerWidth - 60) label.attr('x', -8).attr('text-anchor', 'end');
                            else label.attr('x', 8).attr('text-anchor', 'start');
                        }
                    });

                    dateLabel.text(d3.timeFormat("%b %d, %Y")(new Date(dINR.x)));
                    if (tx > innerWidth - 100) dateLabel.attr('x', -10).attr('text-anchor', 'end');
                    else dateLabel.attr('x', 10).attr('text-anchor', 'start');
                });

            // Axes (Stocks consistency)
            svg.append('g').attr('transform', `translate(0,${innerHeight})`)
                .call(d3.axisBottom(x).ticks(innerWidth / 100).tickFormat(d3.timeFormat("%b %y")))
                .call(g => g.select(".domain").remove())
                .selectAll('text').style('fill', '#9ca3af').style('font-size', '11px');

            svg.append('g')
                .call(d3.axisLeft(y).ticks(5).tickFormat(d => (d - 100).toFixed(0) + '%'))
                .call(g => g.select(".domain").remove())
                .selectAll('text').style('fill', '#9ca3af').style('font-size', '11px');
        };

        renderChart();
        window.addEventListener('resize', renderChart);
        return () => window.removeEventListener('resize', renderChart);
    }, [inrData, usdData, range, visibleSeries]);

    return (
        <div className="card chart-card">
            <div className="card-header">
                <h3>Portfolio Performance (Relative Return)</h3>
            </div>
            <div className="chart-container" ref={containerRef} style={{ height: '350px', position: 'relative' }}>
                <svg ref={svgRef} />
            </div>
            <div className="chart-legend" style={{ display: 'flex', gap: '20px', padding: '0 60px 15px' }}>
                {[
                    { id: 'INR', label: 'INR Returns', color: '#10b981' },
                    { id: 'USD', label: 'USD Returns', color: '#3b82f6' }
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

export default MFPerformanceChart;
