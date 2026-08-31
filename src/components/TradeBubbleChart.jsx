import { useEffect, useRef, useMemo, useState } from 'react';
import * as d3 from 'd3';

const TradeBubbleChart = ({ lots, allLots, prices, range, isLogScale, isYearlyTicks }) => {
    const svgRef = useRef(null);
    const containerRef = useRef(null);
    const [selectedSymbols, setSelectedSymbols] = useState(null);

    const baseChartData = useMemo(() => {
        let base = lots;
        if (selectedSymbols) {
            base = base.filter(l => selectedSymbols.has(l.symbol));
        }

        if (isYearlyTicks) {
            // Group lots by (symbol, year) so each stock has its own aggregated bubble per year
            const grouped = d3.group(
                base,
                d => d.symbol,
                d => new Date(d.openDate).getFullYear()
            );

            const result = [];
            grouped.forEach((yearsMap, symbol) => {
                yearsMap.forEach((items, year) => {
                    const totalCost = d3.sum(items, d => d.costBasis);
                    const totalValue = d3.sum(items, d => d.marketValue);
                    const totalQty = d3.sum(items, d => d.qty);

                    // Cost-weighted average buy date (fallback to share-weighted or mean date if costBasis is 0)
                    const rawTime = totalCost > 0
                        ? d3.sum(items, d => new Date(d.openDate).getTime() * d.costBasis) / totalCost
                        : totalQty > 0
                            ? d3.sum(items, d => new Date(d.openDate).getTime() * d.qty) / totalQty
                            : d3.mean(items, d => new Date(d.openDate).getTime());

                    const weightedTime = Math.round(rawTime);

                    result.push({
                        symbol,
                        year: Number(year),
                        costBasis: totalCost,
                        marketValue: totalValue,
                        gainLoss: totalValue - totalCost,
                        openDate: new Date(weightedTime),
                        qty: totalQty,
                        isGrouped: true,
                        tradeCount: items.length,
                        id: `${symbol}-${year}`
                    });
                });
            });

            return result;
        }

        return base.map((l, i) => ({
            ...l,
            id: `lot-${i}`,
            openDate: new Date(l.openDate)
        }));
    }, [lots, selectedSymbols, isYearlyTicks]);

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

            let cutoffDate = null;
            if (range && range !== 'max') {
                const daysMap = { '1m': 30, '6m': 180, '1y': 365, '2y': 730, '3y': 1095, '5y': 1825 };
                const days = daysMap[range] || 0;
                cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - days);
            }
            // 1. Calculate X-axis domain strictly based on range filter
            const allLotsData = lots.map(l => ({ ...l, openDate: new Date(l.openDate) }));
            let xDomain;
            const now = new Date();

            if (cutoffDate) {
                xDomain = [cutoffDate, now];
            } else {
                xDomain = d3.extent(allLotsData, d => d.openDate);
                if (!xDomain[0]) xDomain = [new Date(), new Date()];
            }

            const x = d3.scaleTime()
                .domain(xDomain)
                .range([0, innerWidth])
                .nice();

            // Re-sync extent for subsequent logic (base price lookup etc)
            const xExtent = x.domain();

            // 2. Data for Y-axis scale (honors symbol selection)
            const scaleData = cutoffDate
                ? baseChartData.filter(d => d.openDate >= cutoffDate)
                : baseChartData;

            const basePrices = {};
            if (prices) {
                Object.entries(prices).forEach(([symbol, history]) => {
                    const sortedDates = Object.keys(history).sort();
                    const startDateStr = xExtent[0].toISOString().split('T')[0];
                    let baseDate = sortedDates.find(d => d >= startDateStr) || sortedDates[0];
                    basePrices[symbol] = history[baseDate];
                });
            }

            // Calculate Y Extent based on normalized price history and bubbles of SELECTED symbols in the VISIBLE window
            let yDomain = [-10, 10]; // Default
            const historyPoints = [];
            const activeSymbols = selectedSymbols ? Array.from(selectedSymbols) : symbols;

            if (prices) {
                activeSymbols.forEach(symbol => {
                    const history = prices[symbol];
                    const base = basePrices[symbol];
                    if (!history || !base) return;
                    Object.keys(history).forEach(dateStr => {
                        const d = new Date(dateStr);
                        if (d >= x.domain()[0] && d <= x.domain()[1]) {
                            historyPoints.push((history[dateStr] / base - 1) * 100);
                        }
                    });
                });
            }

            scaleData.forEach(d => {
                const base = basePrices[d.symbol];
                if (base && d.qty > 0) {
                    historyPoints.push(((d.costBasis / d.qty) / base - 1) * 100);
                } else if (d.costBasis > 0) {
                    historyPoints.push((d.marketValue / d.costBasis - 1) * 100);
                }
            });

            if (historyPoints.length > 0) {
                const extent = d3.extent(historyPoints);
                // Add a small 5% padding to the range (subtractive/additive for percentages)
                yDomain = [extent[0] - 5, extent[1] + 5];
            }

            const yScaleType = isLogScale ? d3.scaleLog : d3.scaleLinear;
            const y = yScaleType()
                .domain(isLogScale
                    ? [Math.max(1, yDomain[0] + 100), yDomain[1] + 100]
                    : yDomain)
                .range([innerHeight, 0]);

            if (!isLogScale) y.nice();

            const r = d3.scaleSqrt().domain([1, 500000]).range([2, 80]);
            const color = d3.scaleOrdinal(d3.schemeTableau10).domain(symbols);

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

            svg.append('text').attr('x', innerWidth / 2).attr('y', innerHeight + 45).attr('text-anchor', 'middle')
                .style('fill', '#9ca3af').style('font-size', '12px').style('font-weight', '500')
                .text('Trade Date');

            svg.append('text').attr('transform', 'rotate(-90)').attr('x', -innerHeight / 2).attr('y', -55).attr('text-anchor', 'middle')
                .style('fill', '#9ca3af').style('font-size', '12px').style('font-weight', '500')
                .text(`Stock Return %${isLogScale ? ' (Log Offset)' : ''}`);

            if (prices) {
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

            const bubbles = svg.selectAll('.bubble-group')
                .data(baseChartData, d => d.id)
                .enter()
                .append('g')
                .attr('class', 'bubble-group')
                .style('display', d => cutoffDate && d.openDate < cutoffDate ? 'none' : null)
                .attr('transform', d => {
                    const base = basePrices[d.symbol];
                    const tx = x(d.openDate);
                    const perf = (base && d.qty > 0) ? ((d.costBasis / d.qty) / base - 1) * 100 : 0;
                    const ty = y(isLogScale ? perf + 100 : perf);
                    return `translate(${tx},${ty})`;
                })
                .on('mouseover', function (event, d) {
                    d3.select(this).select('circle').attr('fill-opacity', 0.9).attr('stroke-width', 2);
                    tooltip.style('display', null);
                    const ratio = d.costBasis > 0 ? (d.marketValue / d.costBasis) : 1;
                    const headerText = d.isGrouped
                        ? `${d.symbol} (${d.year}) • ${d.tradeCount} trade${d.tradeCount > 1 ? 's' : ''}`
                        : `${d.symbol} (${d.openDate.toLocaleDateString()})`;

                    const avgCost = d.qty > 0 ? (d.costBasis / d.qty) : 0;
                    const dateFormatted = d.openDate.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
                    const lines = [
                        headerText,
                        d.isGrouped ? `Weighted Avg Date: ${dateFormatted}` : `Trade Date: ${dateFormatted}`,
                        `Shares: ${d.qty.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`,
                        `Avg Cost/Sh: $${avgCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                        `Cost Basis: $${d.costBasis.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
                        `Market Value: $${d.marketValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
                        `Total Ret: ${((ratio - 1) * 100).toFixed(1)}% ($${(d.marketValue - d.costBasis).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })})`
                    ];
                    tooltipText.selectAll('tspan').remove();
                    lines.forEach((line, i) => {
                        tooltipText.append('tspan').attr('x', 12).attr('dy', i === 0 ? 0 : '1.4em')
                            .style('font-weight', i === 0 ? 'bold' : 'normal').style('fill', i === 0 ? color(d.symbol) : '#e5e7eb').text(line);
                    });
                    const bbox = tooltipText.node().getBBox();
                    tooltipBg.attr('width', bbox.width + 24).attr('height', bbox.height + 20);
                    const base = basePrices[d.symbol];
                    const tx = x(d.openDate) + 15;
                    const perf = (base && d.qty > 0) ? ((d.costBasis / d.qty) / base - 1) * 100 : 0;
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
    }, [baseChartData, symbols, prices, selectedSymbols, range, isLogScale, lots]);

    if (!lots || lots.length === 0) {
        return null;
    }

    const colorScale = d3.scaleOrdinal(d3.schemeTableau10).domain(symbols);

    return (
        <div className="card chart-card trade-bubble-card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-header">
                <h3>{isYearlyTicks ? 'Yearly Performance' : 'Individual Trade Performance'}</h3>
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
