import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

const MFPerformanceChart = ({ inrData, usdData }) => {
    const svgRef = useRef(null);
    const containerRef = useRef(null);
    const [range, setRange] = useState('3y');
    const [visibleSeries, setVisibleSeries] = useState(['INR', 'USD']);

    useEffect(() => {
        if (!inrData || inrData.length === 0 || !usdData || usdData.length === 0) return;

        const renderChart = () => {
            const container = containerRef.current;
            const { width, height } = container.getBoundingClientRect();
            const margin = { top: 40, right: 30, bottom: 40, left: 60 };
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
            if (range === '1y') cutoff.setFullYear(lastDate.getFullYear() - 1);
            else if (range === '5y') cutoff.setFullYear(lastDate.getFullYear() - 5);
            else if (range === 'max') cutoff = new Date(0);
            else cutoff.setFullYear(lastDate.getFullYear() - 3); // 3y

            const filteredINR = inrData.filter(d => new Date(d.x) >= cutoff);
            const filteredUSD = usdData.filter(d => new Date(d.x) >= cutoff);

            if (filteredINR.length === 0 || filteredUSD.length === 0) return;

            // Normalize to 100
            const startINR = filteredINR[0].y;
            const startUSD = filteredUSD[0].y;

            const normalizedINR = filteredINR.map(d => ({ ...d, val: (d.y / startINR) * 100, original: d.y }));
            const normalizedUSD = filteredUSD.map(d => ({ ...d, val: (d.y / startUSD) * 100, original: d.y }));

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

            // Grid
            svg.append('g').attr('transform', `translate(0,${innerHeight})`)
                .call(d3.axisBottom(x).ticks(innerWidth / 100).tickSize(-innerHeight).tickFormat(''))
                .selectAll('line').attr('stroke', 'rgba(255,255,255,0.05)');

            svg.append('g')
                .call(d3.axisLeft(y).ticks(5).tickSize(-innerWidth).tickFormat(''))
                .selectAll('line').attr('stroke', 'rgba(255,255,255,0.05)');

            // Area between lines (Currency Impact)
            if (visibleSeries.includes('INR') && visibleSeries.includes('USD')) {
                const areaGenerator = d3.area()
                    .x(d => x(new Date(d.date)))
                    .y0(d => y(d.inr))
                    .y1(d => y(d.usd));

                const combinedData = normalizedINR.map((d, i) => ({
                    date: d.x,
                    inr: d.val,
                    usd: i < normalizedUSD.length ? normalizedUSD[i].val : d.val
                }));

                svg.append('path')
                    .datum(combinedData)
                    .attr('fill', 'rgba(255, 255, 255, 0.05)')
                    .attr('d', areaGenerator);
            }

            // Lines
            const line = d3.line()
                .x(d => x(new Date(d.x)))
                .y(d => y(d.val));

            if (visibleSeries.includes('INR')) {
                svg.append('path')
                    .datum(normalizedINR)
                    .attr('fill', 'none')
                    .attr('stroke', '#10b981')
                    .attr('stroke-width', 2.5)
                    .attr('d', line);
            }

            if (visibleSeries.includes('USD')) {
                svg.append('path')
                    .datum(normalizedUSD)
                    .attr('fill', 'none')
                    .attr('stroke', '#3b82f6')
                    .attr('stroke-width', 2.5)
                    .attr('d', line);
            }

            // Legend
            const legend = svg.append('g')
                .attr('transform', `translate(0, -25)`);

            const seriesInfo = [
                { id: 'INR', label: 'INR Return', color: '#10b981' },
                { id: 'USD', label: 'USD Return', color: '#3b82f6' }
            ];

            let legendX = 0;
            seriesInfo.forEach(s => {
                const group = legend.append('g')
                    .attr('transform', `translate(${legendX}, 0)`)
                    .style('cursor', 'pointer')
                    .on('click', () => {
                        setVisibleSeries(prev =>
                            prev.includes(s.id) ? prev.filter(x => x !== s.id) : [...prev, s.id]
                        );
                    });

                group.append('circle')
                    .attr('r', 4)
                    .attr('fill', visibleSeries.includes(s.id) ? s.color : '#374151');

                group.append('text')
                    .attr('x', 10)
                    .attr('y', 4)
                    .text(s.label)
                    .style('fill', visibleSeries.includes(s.id) ? '#f3f4f6' : '#6b7280')
                    .style('font-size', '12px');

                legendX += 100;
            });

            // Tracking Line and Overlay
            const focus = svg.append('g').style('display', 'none');
            focus.append('line').attr('class', 'x-hover-line').attr('y1', 0).attr('y2', innerHeight).attr('stroke', 'rgba(255,255,255,0.2)').attr('stroke-dasharray', '3,3');

            const tooltip = d3.select(containerRef.current).append('div')
                .attr('class', 'chart-tooltip')
                .style('position', 'absolute')
                .style('display', 'none')
                .style('background', 'rgba(17, 24, 39, 0.95)')
                .style('border', '1px solid rgba(255,255,255,0.1)')
                .style('padding', '12px')
                .style('border-radius', '8px')
                .style('pointer-events', 'none')
                .style('z-index', '10')
                .style('font-size', '12px')
                .style('color', '#fff')
                .style('box-shadow', '0 10px 15px -3px rgba(0, 0, 0, 0.5)');

            const bisectDate = d3.bisector(d => new Date(d.x)).left;

            svg.append('rect')
                .attr('width', innerWidth)
                .attr('height', innerHeight)
                .attr('fill', 'none')
                .attr('pointer-events', 'all')
                .on('mouseover', () => { focus.style('display', null); tooltip.style('display', 'block'); })
                .on('mouseout', () => { focus.style('display', 'none'); tooltip.style('display', 'none'); })
                .on('mousemove', function (event) {
                    const x0 = x.invert(d3.pointer(event)[0]);
                    const i = bisectDate(normalizedINR, x0, 1);
                    const d0 = normalizedINR[i - 1];
                    const d1 = normalizedINR[i];
                    const dINR = x0 - new Date(d0.x) > new Date(d1.x) - x0 ? d1 : d0;

                    const j = bisectDate(normalizedUSD, x0, 1);
                    const u0 = normalizedUSD[j - 1];
                    const u1 = normalizedUSD[j];
                    const dUSD = x0 - new Date(u0.x) > new Date(u1.x) - x0 ? u1 : u0;

                    focus.select('.x-hover-line').attr('transform', `translate(${x(new Date(dINR.x))},0)`);

                    const impact = dINR.val - dUSD.val;
                    const dateStr = d3.timeFormat("%B %d, %Y")(new Date(dINR.x));

                    tooltip.html(`
                        <div style="font-weight:600;margin-bottom:8px;color:#9ca3af">${dateStr}</div>
                        <div style="display:flex;justify-content:space-between;gap:20px;margin:4px 0">
                            <span style="color:#10b981">INR Return:</span>
                            <span style="font-weight:600">${(dINR.val - 100).toFixed(2)}%</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;gap:20px;margin:4px 0">
                            <span style="color:#3b82f6">USD Return:</span>
                            <span style="font-weight:600">${(dUSD.val - 100).toFixed(2)}%</span>
                        </div>
                        <div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.1);display:flex;justify-content:space-between">
                            <span style="color:rgba(255,255,255,0.6)">Currency Impact:</span>
                            <span style="font-weight:600;color:${impact >= 0 ? '#ef4444' : '#10b981'}">${impact.toFixed(2)}%</span>
                        </div>
                    `)
                        .style('left', (event.pageX - containerRef.current.getBoundingClientRect().left + 15) + 'px')
                        .style('top', (event.pageY - containerRef.current.getBoundingClientRect().top - 40) + 'px');
                });

            // Axes
            svg.append('g').attr('transform', `translate(0,${innerHeight})`)
                .call(d3.axisBottom(x).ticks(innerWidth / 100).tickFormat(d3.timeFormat("%b %y")))
                .call(g => g.select(".domain").remove())
                .selectAll('text').style('fill', '#9ca3af').style('font-size', '10px');

            svg.append('g')
                .call(d3.axisLeft(y).ticks(5).tickFormat(d => (d - 100).toFixed(0) + '%'))
                .call(g => g.select(".domain").remove())
                .selectAll('text').style('fill', '#9ca3af').style('font-size', '10px');
        };

        renderChart();
        window.addEventListener('resize', renderChart);
        return () => window.removeEventListener('resize', renderChart);
    }, [inrData, usdData, range, visibleSeries]);

    return (
        <div className="card chart-card">
            <div className="card-header">
                <h3>Currency Impact Visualization (Base 100)</h3>
                <div className="chart-controls">
                    {['1y', '3y', '5y', 'max'].map(r => (
                        <button key={r} className={`filter-btn ${range === r ? 'active' : ''}`} onClick={() => setRange(r)}>
                            {r.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>
            <div className="chart-container" ref={containerRef} style={{ height: '350px', position: 'relative' }}>
                <svg ref={svgRef} />
            </div>
        </div>
    );
};

export default MFPerformanceChart;
