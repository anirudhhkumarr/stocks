export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(request) });
    }

    const search = url.search.substring(1);
    if (!search) {
      return new Response('Missing target URL in query string', { status: 400, headers: cors(request) });
    }

    let targetUrl;
    try {
      targetUrl = decodeURIComponent(search);
    } catch {
      return new Response('Invalid target URL encoding', { status: 400, headers: cors(request) });
    }

    return await proxyRequest(request, targetUrl);
  },
};

async function proxyRequest(request, targetUrl) {
  let target;
  try {
    target = new URL(targetUrl);
  } catch {
    return new Response('Invalid target URL', { status: 400, headers: cors(request) });
  }

  // Allow only yahoo finance domain for security
  if (!target.hostname.endsWith('yahoo.com')) {
    return new Response('Forbidden host.', { status: 403, headers: cors(request) });
  }

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('origin');
  headers.delete('referer');

  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'follow',
  });

  const response = new Response(upstream.body, upstream);
  cors(request).forEach((value, key) => response.headers.set(key, value));
  return response;
}

function cors(request) {
  const origin = request.headers.get('Origin') || '*';
  return new Headers({
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  });
}
