import test from 'node:test';
import assert from 'node:assert/strict';
import { createEvaluation } from '../src/evaluation.ts';
test('records only consented active tasks with relative timings', () => {
 let now=100; const e=createEvaluation(()=>now);
 e.log('photo_ready'); assert.equal(e.snapshot().count,0);
 assert.throws(()=>e.start('P01',false)); assert.throws(()=>e.start('Someone Name',true));
 e.start('P01',true); e.log('photo_ready'); assert.equal(e.snapshot().count,1);
 now=150;e.startTask('T1');now=220;e.log('photo_selected','gallery');
 now=370;e.finish('independent');e.end();
 assert.match(e.csv(),/P01,T1,photo_selected,120,gallery/);
 assert.match(e.csv(),/P01,T1,task_end,270,independent/);
});
test('runtime allowlists exclude arbitrary identifying strings and control events',()=>{
 const e=createEvaluation(()=>0);e.start('P02',true);e.startTask('T1');
 e.log('photo_ready','file:///private/photo.jpg');e.log('gps','-41.3,173.2');
 e.log('task_end','independent');assert.equal(e.snapshot().count,2);
 assert.doesNotMatch(e.csv(),/private|41.3|gps|task_end/);
 assert.throws(()=>e.startTask('T2'));assert.throws(()=>e.end());
 e.finish('incomplete');e.end();assert.throws(()=>e.start('P03',true));
 e.clear();e.start('P03',true);
});
test('unsubscribes listeners and reserves room for ending a full log',()=>{
 const e=createEvaluation(()=>1);let updates=0;
 const unsubscribe=e.subscribe(()=>updates++);
 e.start('P01',true);e.startTask('T1');unsubscribe();
 for(let i=0;i<6000;i++)e.log('review_opened');
 e.finish('assisted');e.end();assert.equal(e.snapshot().count,5000);assert.equal(updates,2);
});
