import { cleanNum } from './calculations';

export function parseCSVLine(text) {
    const re_value = /(?!\s*$)\s*(?:'([^'\\]*(?:\\[\S\s][^'\\]*)*)'|"([^"\\]*(?:\\[\S\s][^"\\]*)*)"|([^,'"\s\\]*(?:\s+[^,'"\s\\]+)*))\s*(?:,|$)/g;
    const a = [];
    text.replace(re_value, function (m0, m1, m2, m3) {
        if (m1 !== undefined) a.push(m1.replace(/\\'/g, "'"));
        else if (m2 !== undefined) a.push(m2.replace(/\\"/g, '"'));
        else if (m3 !== undefined) a.push(m3);
        return '';
    });
    if (/,\s*$/.test(text)) a.push('');
    return a;
}

export function processPortfolioData(filesData) {
    let allLots = [];
    let portfolioSummary = {
        totalCost: 0,
        stocks: {}
    };

    filesData.forEach(file => {
        if (!file.content || typeof file.content !== 'string') return;

        const symbol = file.filename.replace('.csv', '');
        const lines = file.content.split(/\r\n|\n|\r/);

        let headerIndex = -1;
        for (let i = 0; i < lines.length; i++) {
            const cleanLine = lines[i].replace(/"/g, '');
            if (cleanLine.includes('Open Date')) {
                headerIndex = i;
                break;
            }
        }

        if (headerIndex === -1) return;

        const headerCols = parseCSVLine(lines[headerIndex]).map(c => c.replace(/"/g, '').trim());
        const colMap = {
            qty: headerCols.indexOf('Quantity'),
            costBasis: headerCols.indexOf('Cost Basis')
        };

        if (colMap.qty === -1 || colMap.costBasis === -1) return;

        const maxColIndex = Math.max(colMap.qty, colMap.costBasis);

        for (let i = headerIndex + 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line || line.toLowerCase().startsWith('total')) continue;

            const cols = parseCSVLine(line);
            if (cols.length <= maxColIndex) continue;

            let openDateRaw = cols[0];
            let openDate = '';
            if (openDateRaw) {
                const d = new Date(openDateRaw);
                if (!isNaN(d.getTime())) {
                    openDate = d.toISOString().split('T')[0];
                }
            }

            if (!openDate) continue;

            const qty = parseFloat(cleanNum(cols[colMap.qty]));
            const costBasis = parseFloat(cleanNum(cols[colMap.costBasis]));

            if (isNaN(qty) || isNaN(costBasis)) continue;

            const lot = {
                symbol,
                openDate,
                qty,
                costBasis,
                marketValue: 0,
                gainLoss: 0,
                holdingPeriod: 'Unknown'
            };

            allLots.push(lot);
            portfolioSummary.totalCost += costBasis;

            if (!portfolioSummary.stocks[symbol]) {
                portfolioSummary.stocks[symbol] = { costBasis: 0, qty: 0 };
            }
            portfolioSummary.stocks[symbol].costBasis += costBasis;
            portfolioSummary.stocks[symbol].qty += qty;
        }
    });

    return { lots: allLots, summary: portfolioSummary };
}
