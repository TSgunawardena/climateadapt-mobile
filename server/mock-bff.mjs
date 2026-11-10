import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const MAX = 5 * 1024 * 1024;
export function containsExif(bytes) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return false;
  let i = 2;
  while (i + 4 <= bytes.length && bytes[i] === 0xff) {
    const marker = bytes[i + 1];
    if (marker === 0xda || marker === 0xd9) return false;
    const length = bytes.readUInt16BE(i + 2);
    if (length < 2 || i + 2 + length > bytes.length) return false;
    if (marker === 0xe1 && bytes.subarray(i + 4, i + 10).toString('binary') === 'Exif\0\0') return true;
    i += length + 2;
  }
  return false;
}
export function createMockServer({ delays = { normal: 1200, slow: 6000, timeout: 65000 } } = {}) {
  return http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store');
    const send = (status, data) => { if (!res.destroyed) { res.writeHead(status, {'Content-Type':'application/json'}); res.end(JSON.stringify(data)); } };
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/api/health' && req.method === 'GET') { send(200, {ok:true, mode:'mock', service:'ClimateAdapt prototype BFF'}); return; }
    if (url.pathname !== '/api/analyse' || req.method !== 'POST') { send(404, {error:'not_found'}); return; }
    const abort = new AbortController();
    req.on('aborted', () => abort.abort()); res.on('close', () => abort.abort());
    let chunks = [], size = 0;
    try {
      for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX + 65536) { send(413, {error:'too_large',retryable:false}); req.resume(); return; }
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks); chunks = [];
      const request = new Request('http://localhost/api/analyse', { method:'POST', headers:{'Content-Type':req.headers['content-type'] || ''}, body });
      const form = await request.formData();
      const photo = form.get('image');
      if (!photo || typeof photo === 'string' || photo.size === 0) { send(400,{error:'missing_image',retryable:false}); return; }
      if (photo.size > MAX) { send(413,{error:'too_large',retryable:false}); return; }
      const bytes = Buffer.from(await photo.arrayBuffer());
      if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || containsExif(bytes)) { send(415,{error:'bad_image',retryable:false}); return; }
      const mode = url.searchParams.get('fail') || 'normal';
      const supported = ['normal','low','slow','timeout','error','rate','malformed'];
      if (!supported.includes(mode)) { send(400,{error:'unknown_mode',retryable:false}); return; }
      const delay = mode === 'slow' ? delays.slow : mode === 'timeout' ? delays.timeout : delays.normal;
      await new Promise((resolve) => {
        const timer = setTimeout(done, delay);
        function done() { clearTimeout(timer); abort.signal.removeEventListener('abort',done); resolve(); }
        if (abort.signal.aborted) done(); else abort.signal.addEventListener('abort',done,{once:true});
      });
      if (abort.signal.aborted || res.destroyed) return;
      if (mode === 'error') { send(503,{error:'upstream_unavailable',retryable:true}); return; }
      if (mode === 'rate') { res.setHeader('Retry-After','3'); send(429,{error:'rate_limited',retryable:true}); return; }
      if (mode === 'malformed') { res.writeHead(200,{'Content-Type':'application/json'}); res.end('not a JSON result'); return; }
      const low = mode === 'low';
      send(200, { requestId:randomUUID(), mode:'mock', status:low?'needs_review':'done',
        label:low?'Unclear visible-water evidence':'Possible surface water', confidence:low?0.42:0.82,
        alternatives:low?[{label:'Shadow or wet ground',confidence:0.35}]:[],
        receivedBytes:photo.size, exifDetected:false,
      });
      // No disk writes, photo retention, image logs, external model or API key.
    } catch {
      if (!res.headersSent) send(400,{error:'invalid_upload',retryable:false});
    }
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createMockServer();
  server.listen(Number(process.env.PORT || 8080),'0.0.0.0',()=>console.log('Mock BFF: http://0.0.0.0:8080/api/health (demo responses only)'));
}
