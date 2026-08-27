import https from 'node:https';

const PROXY_URL = 'https://stocks-proxy.anirudhkumar.workers.dev/';
const TARGET = '?https%3A%2F%2Fquery1.finance.yahoo.com%2Fv8%2Ffinance%2Fchart%2FVOO%3Finterval%3D1d%26range%3D1d';

console.log(`[test] Verifying proxy at ${PROXY_URL}`);

const options = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
};

https.get(PROXY_URL + TARGET, options, (res) => {
    console.log(`[test] Proxy responded with status: ${res.statusCode}`);
    if (res.statusCode >= 400) {
        console.error(`[test] ❌ Proxy is not returning a success response! Did you deploy the Cloudflare Worker?`);
        process.exit(1);
    }
    
    // We expect the worker to successfully proxy Yahoo Finance
    console.log(`[test] ✅ Proxy is up and running.`);
    process.exit(0);
}).on('error', (e) => {
    console.error(`[test] ❌ Failed to connect to proxy: ${e.message}`);
    process.exit(1);
});
