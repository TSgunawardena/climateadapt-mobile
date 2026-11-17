import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { createMockServer, containsExif } from '../server/mock-bff.mjs';
import { parseResult, RequestGate, validateBaseUrl } from '../src/domain.ts';

const jpeg = await readFile(new URL('../assets/design/coast.jpg',import.meta.url));
async function withServer(fn) {
 for (let attempt = 0; attempt < 10; attempt++) {
  const server = createMockServer({ delays: { normal: 5, slow: 35, timeout: 150 } });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
   const base = `http://127.0.0.1:${server.address().port}`;
   // The OS can assign a port that Fetch blocks. Retry setup only, never the test.
   try {
    const response = await fetch(`${base}/api/health`);
    await response.arrayBuffer();
   } catch (error) {
    if (error.cause?.message === 'bad port') continue;
    throw error;
   }
   await fn(base);
   return;
  } finally {
   server.closeAllConnections();
   await new Promise(resolve => server.close(resolve));
  }
 }
 throw new Error('Could not allocate a Fetch-compatible test port after 10 attempts.');
}

function body(bytes=jpeg,type='image/jpeg'){const f=new FormData();f.append('image',new Blob([bytes],{type}),'photo.jpg');return f;}

test('health reports mock mode, normal and low results are distinguishable',()=>withServer(async base=>{
 assert.equal((await(await fetch(`${base}/api/health`)).json()).mode,'mock');
 for(const mode of ['normal','low','slow']){const res=await fetch(`${base}/api/analyse?fail=${mode}`,{method:'POST',body:body()});assert.equal(res.status,200);const value=await res.json();assert.equal(value.receivedBytes,jpeg.length);const result=parseResult(value);assert.equal(result.demo,true);assert.equal(result.status,mode==='low'?'needs_review':'done');}
}));
test('unavailable, rate-limit and malformed responses cannot look like a valid result',()=>withServer(async base=>{
 for(const [mode,status] of [['error',503],['rate',429]]){const res=await fetch(`${base}/api/analyse?fail=${mode}`,{method:'POST',body:body()});assert.equal(res.status,status);assert.equal((await res.json()).retryable,true);}
 const res=await fetch(`${base}/api/analyse?fail=malformed`,{method:'POST',body:body()});assert.equal(res.status,200);await assert.rejects(()=>res.json());
}));
test('bad, missing, EXIF-bearing and oversized uploads are rejected',()=>withServer(async base=>{
 assert.equal((await fetch(`${base}/api/analyse`,{method:'POST',body:new FormData()})).status,400);
 assert.equal((await fetch(`${base}/api/analyse`,{method:'POST',body:body(Buffer.from('not an image'))})).status,415);
 const exif=Buffer.from([0xff,0xd8,0xff,0xe1,0,8,69,120,105,102,0,0,0xff,0xd9]);assert.equal(containsExif(exif),true);
 assert.equal((await fetch(`${base}/api/analyse`,{method:'POST',body:body(exif)})).status,415);
 const large=Buffer.alloc(5*1024*1024+1);large[0]=255;large[1]=216;
 assert.equal((await fetch(`${base}/api/analyse`,{method:'POST',body:body(large)})).status,413);
}));
test('timeout/cancel can abort an outstanding request',()=>withServer(async base=>{
 await assert.rejects(fetch(`${base}/api/analyse?fail=timeout`,{method:'POST',body:body(),signal:AbortSignal.timeout(25)}),{name:'TimeoutError'});
}));
test('stale completions cannot update the newest request',()=>{const gate=new RequestGate(),old=gate.next(),fresh=gate.next();assert.equal(gate.accepts(old),false);assert.equal(gate.accepts(fresh),true);gate.invalidate();assert.equal(gate.accepts(fresh),false);});
test('invalid confidence and incomplete replies are rejected; low confidence forces review',()=>{
 const valid={status:'done',label:'Example',confidence:.42,requestId:'a',mode:'mock'};assert.equal(parseResult(valid).status,'needs_review');for(const confidence of [NaN,-1,1.1,'0.8'])assert.throws(()=>parseResult({...valid,confidence}));assert.throws(()=>parseResult({status:'done'}));
});
test('backend address validation rejects credentials, paths and non-http schemes',()=>{
 assert.equal(validateBaseUrl(' http://192.168.1.2:8080/ '),'http://192.168.1.2:8080');for(const url of ['file:///a','http://user:pass@host','http://host/api','http://host/?key=secret'])assert.throws(()=>validateBaseUrl(url));
});
