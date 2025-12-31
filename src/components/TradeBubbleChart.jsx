import { useEffect, useRef, useMemo, useState } from 'react';
import * as d3 from 'd3';

const TradeBubbleChart = ({ lots, allLots }) => {
    const svgRef = useRef(null);
    const containerRef = useRef(null);
    const [selectedSymbols, setSelectedSymbols] = useState(null);
    const [isLogScale, setIsLogScale] = useState(true);
    const [isGrouped, setIsGrouped] = useState(false);

    // Snapping values for the slider - used as reference points for interpolation
    const snapValues = useMemo(() => [100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000], []);
    const [minValueIdx, setMinValueIdx] = useState(3); // Default to index 3 ($1,000)

    // Smoothly interpolate between snap points for the actual filter value
    const minValue = useMemo(() => {
        const floorIdx = Math.floor(minValueIdx);
        const ceilIdx = Math.min(floorIdx + 1, snapValues.length - 1);
        if (floorIdx === ceilIdx) return snapValues[floorIdx];
        const factor = minValueIdx - floorIdx;
        return snapValues[floorIdx] * (1 - factor) + snapValues[ceilIdx] * factor;
    }, [minValueIdx, snapValues]);

    // baseChartData contains all possible bubbles for the current grouping/symbol selection
    const baseChartData = useMemo(() => {
        let base = lots;
        if (selectedSymbols) {
            base = base.filter(l => selectedSymbols.has(l.symbol));
        }

        if (isGrouped) {
            const grouped = d3.group(base, d => d.symbol);
            return Array.from(grouped, ([symbol, items]) => {
                const totalCost = d3.sum(items, d => d.costBasis);
                const totalValue = d3.sum(items, d => d.marketValue);
                return {
                    symbol,
                    costBasis: totalCost,
                    marketValue: totalValue,
                    gainLoss: totalValue - totalCost,
                    openDate: 'Multiple',
                    qty: d3.sum(items, d => d.qty),
                    isGrouped: true,
                    tradeCount: items.length,
                    id: `group-${symbol}`
                };
            });
        }

        return base.map((l, i) => ({ ...l, id: `lot-${i}` }));
    }, [lots, selectedSymbols, isGrouped]);

    const symbols = useMemo(() => {
        const sourceLots = allLots || lots;
        const s = new Set(sourceLots.map(l => l.symbol));
        return Array.from(s).sort();
    }, [lots, allLots]);

    const toggleSymbol = (symbol) => {
        setSelectedSymbols(prev => {
            const next = new Set(prev || symbols);
            if (next.has(symbol)) {
                next.delete(symbol);
                if (next.size === 0) return new Set();
            } else {
                next.add(symbol);
            }
            return next;
        });
    };

    // Main D3 logic: Renders the structure and bubbles
    useEffect(() => {
        if (!baseChartData || baseChartData.length === 0) {
            d3.select(svgRef.current).selectAll("*").remove();
            return;
        }

        const renderChart = () => {
            const container = containerRef.current;
            if (!container) return;
            const { width, height } = container.getBoundingClientRect();
            const margin = { top: 40, right: 100, bottom: 60, left: 80 };
            const innerWidth = width - margin.left - margin.right;
            const innerHeight = height - margin.top - margin.bottom;

            d3.select(svgRef.current).selectAll("*").remove();

            const svg = d3.select(svgRef.current)
                .attr('width', width)
                .attr('height', height)
                .append('g')
                .attr('transform', `translate(${margin.left},${margin.top})`);

            // 1. Filter data for scale calculation
            const visibleData = baseChartData.filter(d => d.marketValue >= minValue);
            const scaleData = visibleData.length > 0 ? visibleData : baseChartData;

            // 2. Scales (calculated based on visible data)
            const xExtent = d3.extent(scaleData, d => Math.max(1, d.costBasis));
            const x = isLogScale
                ? d3.scaleLog().domain([xExtent[0] * 0.9, xExtent[1] * 1.1])
                : d3.scaleLinear().domain([0, xExtent[1] * 1.1]);
            x.range([0, innerWidth]);

            const yRaw = scaleData.map(d => d.marketValue / d.costBasis);
            const yExtent = d3.extent(yRaw);
            const y = isLogScale
                ? d3.scaleLog().domain([Math.max(0.01, yExtent[0] * 0.9), yExtent[1] * 1.1])
                : d3.scaleLinear().domain([yExtent[0] - 0.05, yExtent[1] + 0.05]);
            y.range([innerHeight, 0]);

            const r = d3.scaleSqrt().domain([100, 1000000]).range([1, 100]);
            const color = d3.scaleOrdinal(d3.schemeTableau10).domain(symbols);

            // Grid Lines
            svg.append('g').attr('class', 'grid')
                .attr('transform', `translate(0,${innerHeight})`)
                .call(d3.axisBottom(x).ticks(5).tickSize(-innerHeight).tickFormat(''))
                .call(g => g.select(".domain").remove())
                .selectAll('line').attr('stroke', 'rgba(255,255,255,0.05)');

            svg.append('g').attr('class', 'grid')
                .call(d3.axisLeft(y).ticks(5).tickSize(-innerWidth).tickFormat(''))
                .call(g => g.select(".domain").remove())
                .selectAll('line').attr('stroke', 'rgba(255,255,255,0.05)');

            svg.append('line')
                .attr('x1', 0).attr('x2', innerWidth)
                .attr('y1', y(1)).attr('y2', y(1))
                .attr('stroke', 'rgba(255,255,255,0.2)').attr('stroke-width', 1).attr('stroke-dasharray', '4 4');

            // Axes
            svg.append('g')
                .attr('transform', `translate(0,${innerHeight})`)
                .call(d3.axisBottom(x).ticks(5, ".2s"))
                .call(g => g.select(".domain").remove())
                .selectAll('text').style('fill', '#9ca3af').style('font-size', '11px');

            svg.append('g')
                .call(d3.axisLeft(y).ticks(5).tickFormat(d => {
                    const pct = (d - 1) * 100;
                    return (pct >= 0 ? '+' : '') + pct.toFixed(0) + '%';
                }))
                .call(g => g.select(".domain").remove())
                .selectAll('text').style('fill', '#9ca3af').style('font-size', '11px');

            // Axis labels
            svg.append('text').attr('x', innerWidth / 2).attr('y', innerHeight + 45).attr('text-anchor', 'middle')
                .style('fill', '#9ca3af').style('font-size', '12px').style('font-weight', '500')
                .text(`Cost Basis${isLogScale ? ' (Log)' : ''}`);

            svg.append('text').attr('transform', 'rotate(-90)').attr('x', -innerHeight / 2).attr('y', -55).attr('text-anchor', 'middle')
                .style('fill', '#9ca3af').style('font-size', '12px').style('font-weight', '500')
                .text(`Return %${isLogScale ? ' (Log)' : ''}`);

            // Create bubbles for ALL base data but hide ones below minValue
            const bubbles = svg.selectAll('.bubble-group')
                .data(baseChartData, d => d.id)
                .enter()
                .append('g')
                .attr('class', 'bubble-group')
                .style('display', d => d.marketValue >= minValue ? null : 'none')
                .attr('transform', d => {
                    const tx = x(isLogScale ? Math.max(1, d.costBasis) : d.costBasis);
                    const ty = y(d.marketValue / d.costBasis);
                    return `translate(${tx},${ty})`;
                })
                .on('mouseover', function (event, d) {
                    d3.select(this).select('circle').attr('fill-opacity', 0.9).attr('stroke-width', 2);
                    tooltip.style('display', null);
                    const ratio = d.marketValue / d.costBasis;
                    const lines = [
                        `${d.symbol}${d.isGrouped ? ` (${d.tradeCount} trades)` : ` (${d.openDate})`}`,
                        `Qty: ${d.qty.toFixed(2)}`,
                        `Cost: $${d.costBasis.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
                        `Value: $${d.marketValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
                        `Return: ${((ratio - 1) * 100).toFixed(1)}%`
                    ];
                    tooltipText.selectAll('tspan').remove();
                    lines.forEach((line, i) => {
                        tooltipText.append('tspan').attr('x', 12).attr('dy', i === 0 ? 0 : '1.4em')
                            .style('font-weight', i === 0 ? 'bold' : 'normal').style('fill', i === 0 ? color(d.symbol) : '#e5e7eb').text(line);
                    });
                    const bbox = tooltipText.node().getBBox();
                    tooltipBg.attr('width', bbox.width + 24).attr('height', bbox.height + 20);
                    let tx = x(isLogScale ? Math.max(1, d.costBasis) : d.costBasis) + 15;
                    let ty = y(ratio) - bbox.height / 2;
                    if (tx + bbox.width + 40 > innerWidth) tx = x(isLogScale ? Math.max(1, d.costBasis) : d.costBasis) - bbox.width - 35;
                    ty = Math.max(0, Math.min(ty, innerHeight - bbox.height - 10));
                    tooltip.attr('transform', `translate(${tx},${ty})`);
                })
                .on('mouseout', function () {
                    d3.select(this).select('circle').attr('fill-opacity', 0.6).attr('stroke-width', 1.5);
                    tooltip.style('display', 'none');
                });

            bubbles.append('circle')
                .attr('r', d => r(Math.max(1, d.marketValue)))
                .attr('fill', d => color(d.symbol))
                .attr('fill-opacity', 0.6)
                .attr('stroke', d => color(d.symbol))
                .attr('stroke-width', 1.5)
                .style('cursor', 'pointer');

            const tooltip = svg.append('g').attr('class', 'bubble-tooltip').style('display', 'none').style('pointer-events', 'none');
            const tooltipBg = tooltip.append('rect').attr('fill', 'rgba(15, 17, 21, 0.95)').attr('stroke', 'var(--border-color)').attr('stroke-width', 1).attr('rx', 8).attr('ry', 8);
            const tooltipText = tooltip.append('text').attr('fill', '#e5e7eb').style('font-size', '11px').attr('x', 10).attr('y', 20);

        };

        renderChart();
        window.addEventListener('resize', renderChart);
        return () => window.removeEventListener('resize', renderChart);
    }, [baseChartData, symbols, isLogScale, allLots, minValue]);

    const colorScale = d3.scaleOrdinal(d3.schemeTableau10).domain(symbols);

    return (
        <div className="card chart-card trade-bubble-card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <h3>{isGrouped ? 'Symbol Performance' : 'Individual Trade Performance'}</h3>
                        <div className="filter-group" style={{ display: 'flex', gap: '5px' }}>
                            <button className={`filter-btn ${isLogScale ? 'active' : ''}`} onClick={() => setIsLogScale(!isLogScale)} style={{ padding: '2px 10px', fontSize: '10px' }}>Log Axes</button>
                            <button className={`filter-btn ${isGrouped ? 'active' : ''}`} onClick={() => setIsGrouped(!isGrouped)} style={{ padding: '2px 10px', fontSize: '10px' }}>{isGrouped ? 'Show Trades' : 'Group Symbols'}</button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="symbol-filters" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '15px', padding: '0 10px' }}>
                {symbols.map(s => {
                    const isActive = !selectedSymbols || selectedSymbols.has(s);
                    const sColor = colorScale(s);
                    return (
                        <button key={s} onClick={() => toggleSymbol(s)} style={{ padding: '4px 10px', borderRadius: '15px', border: `1px solid ${isActive ? sColor : 'var(--border-color)'}`, background: isActive ? `${sColor}22` : 'transparent', color: isActive ? sColor : 'var(--text-secondary)', fontSize: '11px', fontWeight: isActive ? '600' : '400', cursor: 'pointer', transition: 'all 0.2s' }}>{s}</button>
                    );
                })}
            </div>

            <div className="chart-container" ref={containerRef} style={{ height: '480px', position: 'relative' }}>
                <svg ref={svgRef} />
            </div>

            <div className="slider-container-bottom" style={{ padding: '20px 0', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'visible' }}>
                <div style={{ width: '50%', minWidth: '300px', position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Min Trade Value Filter</span>
                        <span style={{ fontSize: '13px', color: 'var(--accent-primary)', fontWeight: 'bold' }}>${Math.round(minValue).toLocaleString()}</span>
                    </div>
                    <div style={{ position: 'relative', width: '100%', paddingBottom: '25px' }}>
                        <input
                            type="range"
                            className="bubble-slider"
                            min="0"
                            max={snapValues.length - 1}
                            step="0.01"
                            value={minValueIdx}
                            onChange={(e) => setMinValueIdx(parseFloat(e.target.value))}
                            style={{
                                width: '100%',
                                margin: 0,
                                padding: 0,
                                display: 'block',
                                background: 'transparent'
                            }}
                        />
                        <div style={{ position: 'relative', width: '100%', height: '30px', marginTop: '12px', pointerEvents: 'none' }}>
                            {snapValues.map((val, i) => {
                                const percent = (i / (snapValues.length - 1)) * 100;
                                const isClosest = Math.abs(minValueIdx - i) < 0.2;
                                // Thumb-compensated alignment formula (20px thumb)
                                const left = `calc(${percent}% + (${(0.5 - percent / 100) * 20}px))`;
                                return (
                                    <div key={i} style={{ position: 'absolute', left: left, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        <div style={{ width: '1px', height: '6px', background: isClosest ? 'var(--accent-primary)' : 'var(--border-color)', marginBottom: '6px', opacity: isClosest ? 1 : 0.5 }} />
                                        <span style={{ fontSize: '9px', color: isClosest ? 'var(--accent-primary)' : 'var(--text-secondary)', fontWeight: isClosest ? 'bold' : 'normal', whiteSpace: 'nowrap', opacity: isClosest ? 1 : 0.6 }}>
                                            {val >= 1000 ? `${val >= 10000 ? (val / 1000).toFixed(0) : (val / 1000).toFixed(1).replace('.0', '')}k` : `$${val}`}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TradeBubbleChart;
