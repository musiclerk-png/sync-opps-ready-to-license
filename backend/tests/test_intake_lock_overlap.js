'use strict';
// Fully synthetic isolation tests. No live spreadsheet, email or Tally network.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../SyncOpps_Beta_Buyer_Intake_v1.1.gs'),'utf8');
let completed=0;
function test(label,config,check){
  let requests=0,opens=0,sends=0,lockCalls=0,waitMs=null,releases=0;
  const logs=[],warnings=[];
  const env={
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>k==='TALLY_API_KEY'?'FAKE_TEST_TOKEN_123456789':'SHEET_ID_SYNTHETIC_TEST_ONLY_123456789'})},
    UrlFetchApp:{fetch:(_url,_options)=>{
      requests++;
      if(config.fetchError)throw Error(config.fetchError);
      return {getResponseCode:()=>config.httpCode||200,
        getContentText:()=>JSON.stringify({submissions:[],questions:[],hasMore:false})};
    }},
    LockService:{getScriptLock:()=>({tryLock:ms=>{lockCalls++;waitMs=ms;return !!config.acquired;},releaseLock:()=>{releases++;}})},
    SpreadsheetApp:{openById:()=>{opens++;throw Error('SYNTHETIC_STOP_AFTER_LOCK');}},
    MailApp:{sendEmail:()=>{sends++;throw Error('UNEXPECTED_REAL_SEND');}},
    Utilities:{sleep:()=>{}},
    console:{log:x=>logs.push(x),warn:x=>warnings.push(x)}
  };
  const process=new Function(...Object.keys(env),source+'\nreturn syncOppsProcessBetaBuyer;')(...Object.values(env));
  let result=null,error='';
  try{result=config.manual?process():process({triggerUid:'SYNTHETIC_TRIGGER'})}catch(e){error=String(e.message||e)}
  check({result,error,requests,opens,sends,lockCalls,waitMs,releases,logs,warnings});
  assert.equal(sends,0,label+' never sends an actual email');
  completed++;
  console.log('PASS',label);
}
test('trigger-only rule before fetching',{manual:true},v=>{
  assert.match(v.error,/Trigger-only/);assert.equal(v.requests,0);assert.equal(v.opens,0);
});
test('busy intake skips with no duplicate writes',{acquired:false},v=>{
  assert.equal(v.error,'');assert.equal(v.result.status,'SKIPPED_BUSY');
  assert.equal(v.result.writes,0);assert.equal(v.result.emails,0);
  assert.equal(v.requests,2);assert.equal(v.opens,0);
  assert.equal(v.waitMs,5000);assert.equal(v.releases,0);
  assert.equal(v.warnings.length,1);
});
test('nonretryable Tally errors halt before lock',{httpCode:401},v=>{
  assert.match(v.error,/HTTP 401/);assert.equal(v.requests,1);
  assert.equal(v.opens,0);assert.equal(v.lockCalls,0);
});
test('upstream server error is not silently masked',{fetchError:"We're sorry, a server error occurred. Please wait a bit and try again."},v=>{
  assert.match(v.error,/server error/);assert.equal(v.requests,1);
  assert.equal(v.opens,0);assert.equal(v.lockCalls,0);
});
test('valid full Tally read completes before write lock',{acquired:true},v=>{
  assert.equal(v.requests,2);assert.equal(v.lockCalls,1);assert.equal(v.opens,1);
  assert.equal(v.waitMs,5000);assert.equal(v.releases,1);
  assert.match(v.error,/SYNTHETIC_STOP_AFTER_LOCK/);
  assert.deepEqual(v.logs.map(x=>{try{return JSON.parse(x).phase}catch(e){return null}}),
    ['TALLY_READ_START','TALLY_READ_COMPLETE','WRITE_LOCK_ACQUIRED']);
});
console.log('TOTAL',completed,'intake lock overlap tests PASS');
