import { useEffect, useRef, useMemo, useState } from 'react';
import * as d3 from 'd3';

const TradeBubbleChart = ({ lots, allLots, prices, range, isLogScale, isYearlyTicks }) => {
    const svgRef = useRef(null);
    const containerRef = useRef(null);
    const [selectedSymbols, setSelectedSymbols] = useState(null);
    const [isGrouped, setIsGrouped] = useState(false);


    // baseChartData contains all possible bubbles for the current grouping/symbol selection
    const baseChartData = useMemo(() => {
        let base = lots;
        if (selectedSymbols) {
            base = base.filter(l => selectedSymbols.has(l.symbol));
        }

        if (isYearlyTicks) {
            const grouped = d3.group(base, d => new Date(d.openDate).getFullYear());
            return Array.from(grouped, ([year, items]) => {
                const totalCost = d3.sum(items, d => d.costBasis);
                const totalValue = d3.sum(items, d => d.marketValue);
                return {
                    symbol: `Year ${year}`,
                    costBasis: totalCost,
                    marketValue: totalValue,
                    gainLoss: totalValue - totalCost,
                    openDate: new Date(year, 0, 1),
                    qty: d3.sum(items, d => d.qty),
                    isGrouped: true,
                    tradeCount: items.length,
                    id: `year-${year}`
                };
            });
        }

        if (isGrouped) {
            const grouped = d3.group(base, d => d.symbol);
            return Array.from(grouped, ([symbol, items]) => {
                const totalCost = d3.sum(items, d => d.costBasis);
                const totalValue = d3.sum(items, d => d.marketValue);
                // For grouped view, use the earliest trade date as the reference
                const dates = items.map(d => new Date(d.openDate)).filter(d => !isNaN(d));
                const minDate = dates.length > 0 ? d3.min(dates) : new Date();

                return {
                    symbol,
                    costBasis: totalCost,
                    marketValue: totalValue,
                    gainLoss: totalValue - totalCost,
                    openDate: minDate,
                    qty: d3.sum(items, d => d.qty),
                    isGrouped: true,
                    tradeCount: items.length,
                    id: `group-${symbol}`
                };
            });
        }

        return base.map((l, i) => ({
            ...l,
            id: `lot-${i}`,
            openDate: new Date(l.openDate)
        }));
    }, [lots, selectedSymbols, isGrouped, isYearlyTicks]);

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

            // 0. Filter data by range if not 'max'
            let cutoffDate = null;
            if (range && range !== 'max') {
                const daysMap = { '1m': 30, '6m': 180, '1y': 365, '2y': 730, '3y': 1095, '5y': 1825 };
                const days = daysMap[range] || 0;
                cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - days);
            }

            // 1. Data for scale calculation
            const scaleData = cutoffDate
                ? baseChartData.filter(d => d.openDate >= cutoffDate)
                : baseChartData;

            if (scaleData.length === 0 && baseChartData.length > 0) {
                // If no data in range, fallback to showing nothing or a message
                d3.select(svgRef.current).selectAll("*").remove();
                return;
            }

            // 2. Scales (calculated based on visible data)
            const xExtent = d3.extent(scaleData, d => d.openDate);
            const x = d3.scaleTime()
                .domain([xExtent[0], xExtent[1]])
                .range([0, innerWidth])
                .nice();

            // Calculate base prices for normalization (at the earliest date of the chart)
            const basePrices = {};
            if (prices) {
                Object.entries(prices).forEach(([symbol, history]) => {
                    const sortedDates = Object.keys(history).sort();
                    // Find the price at or just before the start date
                    const startDateStr = xExtent[0].toISOString().split('T')[0];
                    let baseDate = sortedDates.find(d => d >= startDateStr) || sortedDates[0];
                    basePrices[symbol] = history[baseDate];
                });
            }

            // Calculate Y Extent based on normalized price history and bubbles
            let yDomain = [-10, 10]; // Default
            const historyPoints = [];
            if (prices) {
                symbols.forEach(symbol => {
                    const history = prices[symbol];
                    const base = basePrices[symbol];
                    if (!history || !base) return;
                    Object.keys(history).forEach(dateStr => {
                        const d = new Date(dateStr);
                        if (d >= xExtent[0] && d <= xExtent[1]) {
                            historyPoints.push((history[dateStr] / base - 1) * 100);
                        }
                    });
                });
            }

            baseChartData.forEach(d => {
                const base = basePrices[d.symbol];
                if (base) {
                    historyPoints.push(((d.costBasis / d.qty) / base - 1) * 100);
                }
            });

            if (historyPoints.length > 0) {
                const extent = d3.extent(historyPoints);
                yDomain = [extent[0] - 5, extent[1] + 5];
            }

            const yScaleType = isLogScale ? d3.scaleLog : d3.scaleLinear;
            const yOffset = isLogScale ? 100.1 : 0; // Avoid 0/neg in log for percentages

            const y = yScaleType()
                .domain(isLogScale
                    ? [Math.max(1, yDomain[0] + 100), yDomain[1] + 100]
                    : yDomain)
                .range([innerHeight, 0])
                .nice();

            const r = d3.scaleSqrt().domain([1, 500000]).range([2, 80]);
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
                .attr('y1', y(isLogScale ? 100 : 0)).attr('y2', y(isLogScale ? 100 : 0))
                .attr('stroke', 'rgba(255,255,255,0.2)').attr('stroke-width', 1).attr('stroke-dasharray', '4 4');

            // Axes
            svg.append('g')
                .attr('transform', `translate(0,${innerHeight})`)
                .call(d3.axisBottom(x).ticks(5).tickFormat(d3.timeFormat("%b %y")))
                .call(g => g.select(".domain").remove())
                .selectAll('text').style('fill', '#9ca3af').style('font-size', '11px');

            svg.append('g')
                .call(d3.axisLeft(y).ticks(5).tickFormat(d => {
                    const actualD = isLogScale ? d - 100 : d;
                    return (actualD >= 0 ? '+' : '') + actualD.toFixed(0) + '%';
                }))
                .call(g => g.select(".domain").remove())
                .selectAll('text').style('fill', '#9ca3af').style('font-size', '11px');

            // Axis labels
            svg.append('text').attr('x', innerWidth / 2).attr('y', innerHeight + 45).attr('text-anchor', 'middle')
                .style('fill', '#9ca3af').style('font-size', '12px').style('font-weight', '500')
                .text('Trade Date');

            svg.append('text').attr('transform', 'rotate(-90)').attr('x', -innerHeight / 2).attr('y', -55).attr('text-anchor', 'middle')
                .style('fill', '#9ca3af').style('font-size', '12px').style('font-weight', '500')
                .text(`Stock Return %${isLogScale ? ' (Log Offset)' : ''}`);

            // Price History Lines (Background)
            if (prices) {
                const activeSymbols = selectedSymbols ? Array.from(selectedSymbols) : symbols;
                activeSymbols.forEach(symbol => {
                    const history = prices[symbol];
                    const base = basePrices[symbol];
                    if (!history || !base) return;

                    const dates = Object.keys(history).sort();
                    const lineData = dates
                        .map(dateStr => ({
                            date: new Date(dateStr),
                            perf: (history[dateStr] / base - 1) * 100
                        }))
                        .filter(d => d.date >= xExtent[0] && d.date <= xExtent[1]);

                    const lineGen = d3.line()
                        .x(d => x(d.date))
                        .y(d => y(isLogScale ? d.perf + 100 : d.perf))
                        .curve(d3.curveMonotoneX);

                    svg.append('path')
                        .datum(lineData)
                        .attr('fill', 'none')
                        .attr('stroke', color(symbol))
                        .attr('stroke-width', 2)
                        .attr('opacity', 0.2)
                        .attr('d', lineGen);
                });
            }

            // Create bubbles for ALL base data but hide ones below minValue
            const bubbles = svg.selectAll('.bubble-group')
                .data(baseChartData, d => d.id)
                .enter()
                .append('g')
                .attr('class', 'bubble-group')
                .style('display', d => cutoffDate && d.openDate < cutoffDate ? 'none' : null)
                .attr('transform', d => {
                    const base = basePrices[d.symbol] || basePrices[d.symbol.replace('Year ', '')];
                    const tx = x(d.openDate);
                    const perf = base ? ((d.costBasis / d.qty) / base - 1) * 100 : 0;
                    const ty = y(isLogScale ? perf + 100 : perf);
                    return `translate(${tx},${ty})`;
                })
                .on('mouseover', function (event, d) {
                    d3.select(this).select('circle').attr('fill-opacity', 0.9).attr('stroke-width', 2);
                    tooltip.style('display', null);
                    const ratio = d.marketValue / d.costBasis;
                    const dateStr = d.isGrouped ? 'Various' : d.openDate.toLocaleDateString();
                    const lines = [
                        `${d.symbol}${d.isGrouped ? ` (${d.tradeCount} trades)` : ` (${dateStr})`}`,
                        `Qty: ${d.qty.toFixed(2)}`,
                        `Cost/Sh: $${(d.costBasis / d.qty).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
                        `Value: $${d.marketValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
                        `Total Ret: ${((ratio - 1) * 100).toFixed(1)}%`
                    ];
                    tooltipText.selectAll('tspan').remove();
                    lines.forEach((line, i) => {
                        tooltipText.append('tspan').attr('x', 12).attr('dy', i === 0 ? 0 : '1.4em')
                            .style('font-weight', i === 0 ? 'bold' : 'normal').style('fill', i === 0 ? color(d.symbol) : '#e5e7eb').text(line);
                    });
                    const bbox = tooltipText.node().getBBox();
                    tooltipBg.attr('width', bbox.width + 24).attr('height', bbox.height + 20);
                    const base = basePrices[d.symbol] || basePrices[d.symbol.replace('Year ', '')];
                    const tx = x(d.openDate) + 15;
                    const perf = base ? ((d.costBasis / d.qty) / base - 1) * 100 : 0;
                    const ty = y(isLogScale ? perf + 100 : perf) - bbox.height / 2;
                    let finalTx = tx;
                    if (tx + bbox.width + 40 > innerWidth) finalTx = x(d.openDate) - bbox.width - 35;
                    const finalTy = Math.max(0, Math.min(ty, innerHeight - bbox.height - 10));
                    tooltip.attr('transform', `translate(${finalTx},${finalTy})`);
                })
                .on('mouseout', function () {
                    d3.select(this).select('circle').attr('fill-opacity', 0.6).attr('stroke-width', 1.5);
                    tooltip.style('display', 'none');
                });

            bubbles.append('circle')
                .attr('r', d => r(Math.max(1, Math.abs(d.marketValue - d.costBasis))))
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
    }, [baseChartData, symbols, allLots, prices, selectedSymbols, range, isLogScale, isYearlyTicks]);

    const colorScale = d3.scaleOrdinal(d3.schemeTableau10).domain(symbols);

    return (
        <div className="card chart-card trade-bubble-card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <h3>{isGrouped ? 'Symbol Performance' : 'Individual Trade Performance'}</h3>
                        <div className="filter-group" style={{ display: 'flex', gap: '5px' }}>
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

        </div>
    );
};

export default TradeBubbleChart;
