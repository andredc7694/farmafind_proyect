const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function waitForHttp(url, child, timeout = 5000) {
  const deadline = Date.now() + timeout;
  do {
    if (child && child.exitCode !== null) throw new Error('Proceso terminó antes de HTTP');
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(Math.min(500, timeout)) });
      if (response.ok) return response;
    } catch { /* The port is not listening yet. */ }
    await sleep(50);
  } while (Date.now() < deadline);
  throw new Error(`HTTP no respondió en ${timeout} ms`);
}

export async function healthCheck(url, service) {
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (response.status !== 200 || !response.headers.get('content-type')?.includes('application/json') || response.headers.get('cache-control') !== 'no-store') throw new Error('Contrato HTTP inválido');
  const body = await response.json();
  if (JSON.stringify(body) !== JSON.stringify({ service, status: 'ok', mode: 'bootstrap' })) throw new Error('identidad o contenido del servicio inválido');
  return body;
}
