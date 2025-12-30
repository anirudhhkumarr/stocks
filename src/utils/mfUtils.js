// src/utils/mfUtils.js

export const FUND_METADATA = [
    { symbol: "0P0000XVJQ.BO", name: "SBI Large Cap Fund" },
    { symbol: "0P0000XW8F.BO", name: "HDFC Mid Cap Fund" },
    { symbol: "0P0000XVAE.BO", name: "HDFC Large and Mid Cap Fund" },
    { symbol: "0P0000XW7T.BO", name: "HDFC Nifty 50 Index Fund" },
    { symbol: "0P0000XW7U.BO", name: "HDFC BSE Sensex Index Fund" },
    { symbol: "0P0000XVWL.BO", name: "Aditya Birla Sun Life Large Cap Fund" },
    { symbol: "0P0000XVYC.BO", name: "Aditya Birla Sun Life ELSS Tax Saver Fund" },
    { symbol: "0P0000XVWD.BO", name: "Aditya Birla Sun Life Flexi Cap Fund" }
];

export function getStartDateForRange(range, lastDate) {
    const cutoff = new Date(lastDate);
    if (range === '1y') cutoff.setFullYear(lastDate.getFullYear() - 1);
    else if (range === '3y') cutoff.setFullYear(lastDate.getFullYear() - 3);
    else if (range === '5y') cutoff.setFullYear(lastDate.getFullYear() - 5);
    else if (range === 'max') return new Date(0); // Epoch
    return cutoff;
}

export function filterDataByRange(data, range) {
    if (range === 'max' || data.length === 0) return data;

    const lastDate = new Date(data[data.length - 1].x);
    let cutoffDate = getStartDateForRange(range, lastDate);

    return data.filter(d => new Date(d.x) >= cutoffDate);
}
