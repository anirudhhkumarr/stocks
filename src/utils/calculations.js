import {
    FED_BRACKETS,
    FED_LTCG_BRACKETS,
    NIIT_THRESHOLD,
    NIIT_RATE,
    CA_BRACKETS,
    CA_MENTAL_HEALTH_THRESHOLD,
    CA_MENTAL_HEALTH_RATE
} from './constants';

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

    return { fedRate, ltcgRate, caRate, niitRate };
}

export function calculateLotTax(gain, isLongTerm, rates) {
    const { fedRate, ltcgRate, caRate, niitRate } = rates;
    let totalRate = caRate + niitRate;

    if (isLongTerm) {
        totalRate += ltcgRate;
    } else {
        totalRate += fedRate;
    }

    return Math.max(0, gain) * totalRate;
}

export function calculateTotalTax(ordinaryIncome, ltcgIncome) {
    let fedOrdTax = calculateTaxFromBrackets(ordinaryIncome, FED_BRACKETS);
    let fedLtcgTax = 0;
    const totalIncome = ordinaryIncome + ltcgIncome;

    let remainingLtcg = ltcgIncome;
    let currentStack = ordinaryIncome;

    const limit0 = FED_LTCG_BRACKETS[0].limit;
    if (currentStack < limit0) {
        const space = limit0 - currentStack;
        const taxedAt0 = Math.min(space, remainingLtcg);
        remainingLtcg -= taxedAt0;
        currentStack += taxedAt0;
    }

    const limit15 = FED_LTCG_BRACKETS[1].limit;
    if (remainingLtcg > 0 && currentStack < limit15) {
        const space = limit15 - currentStack;
        const taxedAt15 = Math.min(space, remainingLtcg);
        fedLtcgTax += taxedAt15 * 0.15;
        remainingLtcg -= taxedAt15;
        currentStack += taxedAt15;
    }

    if (remainingLtcg > 0) {
        fedLtcgTax += remainingLtcg * 0.20;
    }

    let niitTax = 0;
    if (totalIncome > NIIT_THRESHOLD) {
        const subjectToNiit = Math.min(ltcgIncome, totalIncome - NIIT_THRESHOLD);
        if (subjectToNiit > 0) niitTax = subjectToNiit * NIIT_RATE;
    }

    const caTaxable = totalIncome;
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
