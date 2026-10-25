import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseExpression, rollExpression, die, keyFor, onRequest } from '../functions/api/dice.js';
class Bucket {
  data = new Map();
  async put(key, value, options) { if (options.onlyIf && this.data.has(key)) return null; this.data.set(key,value); return {key}; }
  async get(key) { return this.data.has(key) ? {json: async()=>JSON.parse(this.data.get(key))} : null; }
  async list({prefix,limit,cursor}) { const keys=[...this.data.keys()].filter(k=>k.startsWith(prefix)).sort(); const start=cursor ? keys.indexOf(cursor)+1 : 0; const page=keys.slice(start,start+limit); return { objects:page.map(key=>({key})), truncated:start+limit<keys.length, cursor:page.at(-1)}; }
}
const request = (method='GET', body, query='') => new Request('https://pikulin.net/api/dice'+query,{method, ...(body!==undefined?{headers:{'content-type':'application/json','origin':'https://pikulin.net'},body:JSON.stringify(body)}:{})});
test('compound damage, subtraction, uppercase and whitespace',()=>{
 const values=[5,3,6,2,4]; assert.equal(rollExpression('1d6+4+4d6','normal',()=>values.shift()).total,24);
 assert.equal(rollExpression(' 2D6 - 2 ','normal',()=>3).total,4);
 assert.equal(rollExpression('-1d4+2','normal',()=>4).total,-2);
 assert.equal(parseExpression('d20').terms[0].count,1);
});
test('reject malformed, excessive and no-dice expressions',()=>{
 for(const input of ['2d6junk','2d6++4','0d6','101d6','1d1','1d1001','50d6+51d6','4','1d6+1000001','1d6*2','alert(1)','',null]) assert.throws(()=>parseExpression(input));
});
test('advantage and disadvantage retain correct die and modifier',()=>{
 for(const [mode,total] of [['advantage',22],['disadvantage',6]]) { const vals=[2,18];const roll=rollExpression('1d20+4',mode,()=>vals.shift());assert.equal(roll.total,total);assert.deepEqual(roll.terms[0].rolls,[2,18]); }
 assert.throws(()=>rollExpression('2d20','advantage'));assert.throws(()=>rollExpression('1d6','advantage'));assert.throws(()=>rollExpression('1d20','cheat'));
});
test('random dice stay within inclusive bounds',()=>{for(const sides of [2,4,6,20,1000]) for(let i=0;i<1000;i++){const n=die(sides);assert.ok(n>=1&&n<=sides);}});
test('save, verify unchanged, history pagination and recipe isolation',async()=>{
 const bucket=new Bucket(),env={RECIPE_DRAFTS:bucket}; bucket.data.set('drafts/private.json','{"private":true}');
 const rolls=[];
 for(let i=0;i<27;i++){const response=await onRequest({request:request('POST',{player:'Pickle',expression:'2d6+4',total:999999}),env});assert.equal(response.status,201);const {roll}=await response.json();assert.ok(roll.total>=6&&roll.total<=16);rolls.push(roll);}
 const roll=rolls[0];const result=await onRequest({request:request('GET',undefined,'?code='+roll.code.toLowerCase()),env});assert.deepEqual((await result.json()).roll,roll);
 const first=await (await onRequest({request:request(),env})).json();assert.equal(first.rolls.length,25);assert.ok(first.cursor);
 const second=await (await onRequest({request:request('GET',undefined,'?cursor='+encodeURIComponent(first.cursor)),env})).json();assert.equal(second.rolls.length,2);assert.equal(second.cursor,null);
 assert.equal(new Set([...first.rolls,...second.rolls].map(r=>r.code)).size,27);assert.equal(bucket.data.size,28);
 assert.throws(()=>keyFor('../../drafts/private.json'));
});
test('missing storage, invalid requests, nonexistent code, failed persistence',async()=>{
 assert.equal((await onRequest({request:request(),env:{}})).status,503);
 const env={DICE_ROLLS:new Bucket()};
 assert.equal((await onRequest({request:request('POST',{player:'x',expression:'bad'}),env})).status,400);
 assert.equal((await onRequest({request:request('POST',{expression:'1d6'}),env})).status,400);
 assert.equal((await onRequest({request:request('GET',undefined,'?code=000000001-ABCDEF123456'),env})).status,404);
 assert.equal((await onRequest({request:request('DELETE'),env})).status,405);
 const cross=new Request('https://pikulin.net/api/dice',{method:'POST',headers:{origin:'https://evil.example','content-type':'application/json'},body:'{}'});assert.equal((await onRequest({request:cross,env})).status,403);
 const failed={DICE_ROLLS:{put:async()=>null}};const response=await onRequest({request:request('POST',{player:'x',expression:'1d6'}),env:failed});assert.equal(response.status,503);assert.equal((await response.json()).roll,undefined);
});
