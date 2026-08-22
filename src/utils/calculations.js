import {
    FED_BRACKETS,
    FED_LTCG_BRACKETS,
    NIIT_THRESHOLD,
    NIIT_RATE,
    CA_BRACKETS,
    CA_MENTAL_HEALTH_THRESHOLD,
    CA_MENTAL_HEALTH_RATE
} from './constants.js';

export function formatCurrency(num) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Math.round(num));
}

export function formatINRShort(num) {
    const val = Math.abs(num);
    if (val >= 10000000) return (num / 10000000).toFixed(2) + ' Cr';
    if (val >= 100000) return (num / 100000).toFixed(2) + ' L';
    if (val >= 1000) return (num / 1000).toFixed(1) + 'k';
    return Math.round(num).toString();
}

export function formatPercent(num) {
    return num.toFixed(2) + '%';
}

export function cleanNum(str) {
    if (!str || typeof str !== 'string') return typeof str === 'number' ? str : 0;
    return parseFloat(str.replace(/[$,%]/g, '')) || 0;
}

export function calculateTaxFromBrackets(income, brackets) {
    let tax = 0;
    let previousLimit = 0;

    for (let bracket of brackets) {
        if (income > previousLimit) {
            const taxableInBracket = Math.min(income, bracket.limit) - previousLimit;
            tax += taxableInBracket * bracket.rate;
            previousLimit = bracket.limit;
        } else {
            break;
        }
    }
    return tax;
}

export function getTaxRates(w2Income) {
    let fedRate = 0;
    for (let b of FED_BRACKETS) {
        if (w2Income < b.limit) {
            fedRate = b.rate;
            break;
        }
    }

    let ltcgRate = 0.15;
    if (w2Income > 583750) ltcgRate = 0.20;
    if (w2Income < 94050) ltcgRate = 0.00;

    let caRate = 0.093;
    for (let b of CA_BRACKETS) {
        if (w2Income < b.limit) {
            caRate = b.rate;
            break;
        }
    }

    const niitRate = w2Income > NIIT_THRESHOLD ? NIIT_RATE : 0;
    const mhRate = w2Income > CA_MENTAL_HEALTH_THRESHOLD ? CA_MENTAL_HEALTH_RATE : 0;

    return { fedRate, ltcgRate, caRate, niitRate, mhRate };
}

export function calculateLotTax(gain, isLongTerm, rates) {
    const { fedRate, ltcgRate, caRate, niitRate, mhRate } = rates;
    let totalRate = caRate + niitRate + mhRate;

    if (isLongTerm) {
        totalRate += ltcgRate;
    } else {
        totalRate += fedRate;
    }

    return Math.max(0, gain) * totalRate;
}

export function calculateTotalTax(w2Income, stcg, ltcg) {
    // 1. Federal Netting Logic
    let taxableOrdinary = w2Income;
    let effectiveLtcg = 0;

    // Netting rules: 
    // - If ST and LT are same sign, keep characters.
    // - If opposite signs, net them. The character follows the larger one.
    if ((stcg >= 0 && ltcg >= 0) || (stcg <= 0 && ltcg <= 0)) {
        taxableOrdinary += Math.max(0, stcg);
        effectiveLtcg = Math.max(0, ltcg);
    } else {
        const net = stcg + ltcg;
        if (net > 0) {
            // If net is positive, character is ST if stcg was larger (in abs), else LT.
            // Simplified: if stcg > 0, it means stcg was large enough to cover the lt loss.
            if (stcg > 0) {
                taxableOrdinary += net;
                effectiveLtcg = 0;
            } else {
                taxableOrdinary += 0;
                effectiveLtcg = net;
            }
        }
    }

    // Federal Capital Loss Rule: Net loss offsets up to $3k of W2
    const totalNetGain = stcg + ltcg;
    if (totalNetGain < 0) {
        taxableOrdinary += Math.max(totalNetGain, -3000);
    }

    let fedOrdTax = calculateTaxFromBrackets(taxableOrdinary, FED_BRACKETS);

    // 2. Federal LTCG Tax (Progressive stacking on top of ordinary)
    let fedLtcgTax = 0;
    if (effectiveLtcg > 0) {
        let remainingLtcg = effectiveLtcg;
        let currentStack = taxableOrdinary;

        // 0% Bracket
        const limit0 = FED_LTCG_BRACKETS[0].limit;
        if (currentStack < limit0) {
            const space = limit0 - currentStack;
            const taxedAt0 = Math.min(space, remainingLtcg);
            remainingLtcg -= taxedAt0;
            currentStack += taxedAt0;
        }

        // 15% Bracket
        const limit15 = FED_LTCG_BRACKETS[1].limit;
        if (remainingLtcg > 0 && currentStack < limit15) {
            const space = limit15 - currentStack;
            const taxedAt15 = Math.min(space, remainingLtcg);
            fedLtcgTax += taxedAt15 * 0.15;
            remainingLtcg -= taxedAt15;
            currentStack += taxedAt15;
        }

        // 20% Bracket
        if (remainingLtcg > 0) {
            fedLtcgTax += remainingLtcg * 0.20;
        }
    }

    // 3. NIIT (3.8% on lesser of Net Investment Income or excess AGI)
    let niitTax = 0;
    const agi = w2Income + stcg + ltcg;
    if (agi > NIIT_THRESHOLD) {
        const netInvestmentIncome = Math.max(0, stcg + ltcg);
        const excessAgi = agi - NIIT_THRESHOLD;
        niitTax = Math.min(netInvestmentIncome, excessAgi) * NIIT_RATE;
    }

    // 4. CA State Tax (Progressive on total income)
    // CA treats capital gains as ordinary income
    const caTaxable = Math.max(0, w2Income + stcg + ltcg);
    let caTax = calculateTaxFromBrackets(caTaxable, CA_BRACKETS);

    if (caTaxable > CA_MENTAL_HEALTH_THRESHOLD) {
        caTax += (caTaxable - CA_MENTAL_HEALTH_THRESHOLD) * CA_MENTAL_HEALTH_RATE;
    }

    return fedOrdTax + fedLtcgTax + niitTax + caTax;
}

export function calculateXIRR(lots, currentValue) {
    if (!lots || lots.length === 0 || currentValue <= 0) return null;

    const cashFlows = [];
    const today = new Date();

    lots.forEach(lot => {
        if (lot.costBasis > 0 && lot.openDate) {
            cashFlows.push({
                date: new Date(lot.openDate),
                amount: -lot.costBasis
            });
        }
    });

    cashFlows.push({
        date: today,
        amount: currentValue
    });

    if (cashFlows.length < 2) return null;

    cashFlows.sort((a, b) => a.date - b.date);
    const refDate = cashFlows[0].date;

    const yearFractions = cashFlows.map(cf => {
        const diffMs = cf.date - refDate;
        return diffMs / (365.25 * 24 * 60 * 60 * 1000);
    });

    function npv(rate) {
        let sum = 0;
        for (let i = 0; i < cashFlows.length; i++) {
            sum += cashFlows[i].amount / Math.pow(1 + rate, yearFractions[i]);
        }
        return sum;
    }

    function npvDerivative(rate) {
        let sum = 0;
        for (let i = 0; i < cashFlows.length; i++) {
            sum -= yearFractions[i] * cashFlows[i].amount / Math.pow(1 + rate, yearFractions[i] + 1);
        }
        return sum;
    }

    let rate = 0.1;
    const maxIterations = 100;
    const tolerance = 1e-7;

    for (let i = 0; i < maxIterations; i++) {
        const npvValue = npv(rate);
        const npvDeriv = npvDerivative(rate);
        if (Math.abs(npvDeriv) < 1e-10) break;
        const newRate = rate - npvValue / npvDeriv;
        if (Math.abs(newRate - rate) < tolerance) return newRate;
        rate = newRate;
        if (rate < -0.99) rate = -0.99;
        if (rate > 10) rate = 10;
    }

    return (rate > -0.99 && rate < 10) ? rate : null;
}

export function calculateRebalancePlan(activeLots, targetAllocations, prices, w2Income) {
    if (!activeLots || activeLots.length === 0) {
        return {
            stockAllocations: [],
            lotsToSell: [],
            stocksToBuy: [],
            totalSellProceeds: 0,
            netCashToDeploy: 0,
            totalBuyAmount: 0,
            totalEstTax: 0,
            totalRealizedGain: 0,
            totalPortfolioValue: 0,
            effectivePortfolioValue: 0,
            isBalanced: true
        };
    }

    const rates = getTaxRates(w2Income);

    // 1. Group active lots by symbol and compute current value
    const symbolTotals = {};
    activeLots.forEach(lot => {
        if (!symbolTotals[lot.symbol]) {
            symbolTotals[lot.symbol] = {
                currentValue: 0,
                costBasis: 0,
                qty: 0,
                lots: []
            };
        }
        symbolTotals[lot.symbol].currentValue += (lot.marketValue || 0);
        symbolTotals[lot.symbol].costBasis += (lot.costBasis || 0);
        symbolTotals[lot.symbol].qty += (lot.qty || 0);
        symbolTotals[lot.symbol].lots.push(lot);
    });

    const totalPortfolioValue = Object.values(symbolTotals).reduce((sum, s) => sum + s.currentValue, 0);
    const symbols = Object.keys(symbolTotals).sort();

    // 2. Iteratively solve for tax liability and target allocations accounting for tax paid from proceeds
    let estTax = 0;
    let iterations = 0;
    let finalResult = null;

    while (iterations < 10) {
        iterations++;
        const effectivePortfolioValue = Math.max(0, totalPortfolioValue - estTax);

        const stockAllocations = symbols.map(symbol => {
            const currentVal = symbolTotals[symbol].currentValue;
            const currentPct = totalPortfolioValue > 0 ? (currentVal / totalPortfolioValue) * 100 : 0;
            const targetPct = targetAllocations && targetAllocations[symbol] !== undefined
                ? targetAllocations[symbol]
                : currentPct;
            const targetVal = (targetPct / 100) * effectivePortfolioValue;
            const diffVal = targetVal - currentVal; // negative = sell (overweight), positive = buy (underweight)

            const history = prices[symbol];
            let latestPrice = 0;
            if (history) {
                const dates = Object.keys(history).sort();
                latestPrice = history[dates[dates.length - 1]] || 0;
            }

            return {
                symbol,
                currentValue: currentVal,
                currentPct,
                targetPct,
                targetValue: targetVal,
                diffValue: diffVal,
                currentQty: symbolTotals[symbol].qty,
                costBasis: symbolTotals[symbol].costBasis,
                latestPrice
            };
        });

        // Tax-efficient lot selection for overweight symbols
        const lotsToSell = [];
        let totalSellProceeds = 0;
        let iterationTax = 0;
        let totalRealizedGain = 0;

        symbols.forEach(symbol => {
            const alloc = stockAllocations.find(a => a.symbol === symbol);
            if (!alloc || alloc.diffValue >= -0.01) return;

            let neededLiquidation = Math.abs(alloc.diffValue);

            // Sort lots of this symbol by tax efficiency (lowest tax / marketValue)
            const symbolLots = symbolTotals[symbol].lots.map(lot => {
                const isLongTerm = lot.holdingPeriod === 'Long Term';
                const tax = calculateLotTax(lot.gainLoss, isLongTerm, rates);
                const efficiency = lot.marketValue > 0 ? (tax / lot.marketValue) : 0;
                return {
                    ...lot,
                    estTax: tax,
                    efficiency,
                    isLongTerm
                };
            }).sort((a, b) => a.efficiency - b.efficiency);

            for (const lot of symbolLots) {
                if (neededLiquidation <= 0.001) break;

                const isLongTerm = lot.isLongTerm;
                if (lot.marketValue <= neededLiquidation + 0.01) {
                    // Sell full lot
                    lotsToSell.push({
                        symbol: lot.symbol,
                        openDate: lot.openDate,
                        totalQty: lot.qty,
                        sellQty: lot.qty,
                        isPartial: false,
                        marketValue: lot.marketValue,
                        costBasis: lot.costBasis,
                        gainLoss: lot.gainLoss,
                        holdingPeriod: lot.holdingPeriod,
                        efficiency: lot.efficiency,
                        estTax: lot.estTax
                    });
                    totalSellProceeds += lot.marketValue;
                    iterationTax += lot.estTax;
                    totalRealizedGain += lot.gainLoss;
                    neededLiquidation -= lot.marketValue;
                } else {
                    // Sell partial lot
                    const fraction = neededLiquidation / lot.marketValue;
                    const sellQty = lot.qty * fraction;
                    const sellProceeds = neededLiquidation;
                    const sellCost = lot.costBasis * fraction;
                    const sellGain = sellProceeds - sellCost;
                    const sellTax = calculateLotTax(sellGain, isLongTerm, rates);
                    const sellEfficiency = sellProceeds > 0 ? (sellTax / sellProceeds) : 0;

                    lotsToSell.push({
                        symbol: lot.symbol,
                        openDate: lot.openDate,
                        totalQty: lot.qty,
                        sellQty: sellQty,
                        isPartial: true,
                        marketValue: sellProceeds,
                        costBasis: sellCost,
                        gainLoss: sellGain,
                        holdingPeriod: lot.holdingPeriod,
                        efficiency: sellEfficiency,
                        estTax: sellTax
                    });

                    totalSellProceeds += sellProceeds;
                    iterationTax += sellTax;
                    totalRealizedGain += sellGain;
                    neededLiquidation = 0;
                }
            }
        });

        // Net cash deployed into buys equals gross sells minus estimated taxes
        const netCashToDeploy = Math.max(0, totalSellProceeds - iterationTax);

        const stocksToBuy = [];
        let totalBuyAmount = 0;

        stockAllocations.forEach(alloc => {
            if (alloc.diffValue > 0.01) {
                const buyAmount = alloc.diffValue;
                const buyShares = alloc.latestPrice > 0 ? (buyAmount / alloc.latestPrice) : 0;
                stocksToBuy.push({
                    symbol: alloc.symbol,
                    buyAmount,
                    latestPrice: alloc.latestPrice,
                    buyShares
                });
                totalBuyAmount += buyAmount;
            }
        });

        // Projected post-rebalance allocations
        const postRebalanceAllocations = stockAllocations.map(alloc => {
            let postValue = alloc.currentValue;
            if (alloc.diffValue < -0.01) {
                const soldForSymbol = lotsToSell
                    .filter(l => l.symbol === alloc.symbol)
                    .reduce((sum, l) => sum + l.marketValue, 0);
                postValue = Math.max(0, alloc.currentValue - soldForSymbol);
            } else if (alloc.diffValue > 0.01) {
                const boughtForSymbol = stocksToBuy
                    .filter(b => b.symbol === alloc.symbol)
                    .reduce((sum, b) => sum + b.buyAmount, 0);
                postValue = alloc.currentValue + boughtForSymbol;
            }

            const postPct = effectivePortfolioValue > 0 ? (postValue / effectivePortfolioValue) * 100 : 0;

            return {
                ...alloc,
                postValue,
                postPct
            };
        });

        const isBalanced = lotsToSell.length === 0 && stocksToBuy.length === 0;

        finalResult = {
            stockAllocations: postRebalanceAllocations,
            lotsToSell,
            stocksToBuy,
            totalSellProceeds,
            netCashToDeploy,
            totalBuyAmount,
            totalEstTax: iterationTax,
            totalRealizedGain,
            totalPortfolioValue,
            effectivePortfolioValue,
            isBalanced
        };

        if (Math.abs(iterationTax - estTax) < 0.01) break;
        estTax = iterationTax;
    }

    return finalResult;
}

