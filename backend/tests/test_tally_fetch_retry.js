/** Offline-only regression tests: no real Tally, Sheets, or MailApp calls. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const src = fs.readFileSync(path.join(__dirname, '../SyncOpps_Beta_Buyer_Intake_v1.1.gs'),'utf8');
let pass=0;
function run(name,actions,expected){
 let requests=0,waits=[],warnings=[],props=0;
 const ctx={
   UrlFetchApp:{fetch:(url,options)=>{
     assert.equal(options.timeoutSeconds,20);
     assert.equal(options.method,'get');
     assert.equal(options.headers.Authorization,'Bearer FAKE_TEST_KEY');
     const outcome=actions[Math.min(requests,actions.length-1)];
     requests++;
     if(outcome instanceof Error)throw outcome;
     const response=outcome||{code:200};
     return {getResponseCode:()=>response.code,getContentText:()=>JSON.stringify(response.body||{submissions:[{id:'test123',isCompleted:true}],questions:[{id:'q1'}],hasMore:false})};
   }},
   Utilities:{sleep:ms=>waits.push(ms)},
   console:{warn:msg=>warnings.push(msg),log:()=>{}},
   PropertiesService:{getScriptProperties:()=>({getProperty:()=>{props++;return 'FAKE_TEST_KEY';}})}
 };
 vm.runInNewContext(src+'\nthis.fetchForm=soBBFetchForm_;this.fetchBoth=soBBForms_;',ctx);
 let error='',result=null;
 try{result=expected.both?ctx.fetchBoth():ctx.fetchForm('YjGvPd','FAKE_TEST_KEY');}catch(e){error=String(e.message||e)}
 assert.equal(Boolean(error),expected.failure||false,name+' error expectation');
 assert.equal(requests,expected.calls,name+' request count');
 assert.deepEqual(waits,expected.waits||[],name+' retry schedule');
 assert.equal(warnings.length,waits.length,name+' warnings match retry attempts');
 assert.ok(warnings.every(x=>!x.includes('FAKE_TEST_KEY')),'no secret in logs');
 if(!expected.failure)assert.ok(result,name+' expected full response');
 console.log('PASS',name);pass++;
}
const ok={code:200};
run('success does not retry',[ok],{calls:1});
run('one network failure recovers',[new Error('Exception: Address unavailable'),ok],{calls:2,waits:[1500]});
run('two network failures recover',[new Error('Timeout'),new Error('Address unavailable'),ok],{calls:3,waits:[1500,4500]});
run('HTTP 503 recovers',[{code:503},ok],{calls:2,waits:[1500]});
run('HTTP 429 recovers',[{code:429},ok],{calls:2,waits:[1500]});
run('HTTP 401 fails promptly',[{code:401}],{calls:1,failure:true});
run('HTTP 404 fails promptly',[{code:404}],{calls:1,failure:true});
run('persistent connection problem fails visibly',[new Error('Address unavailable')],{calls:3,waits:[1500,4500],failure:true});
run('persistent 503 fails visibly',[{code:503}],{calls:3,waits:[1500,4500],failure:true});
run('malformed HTTP 200 response fails',[{code:200,body:{unexpected:true}}],{calls:1,failure:true});
console.log('TOTAL',pass,'PASS');
