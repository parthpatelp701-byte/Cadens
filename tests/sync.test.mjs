import test from 'node:test';
import assert from 'node:assert/strict';
import {delta,validateBackup,pacificDay,canonical} from '../src/sync.mjs';
test('saving changes preserves untouched records and sends explicit deletions',()=>{
 const before={tasks:[{id:'a',text:'A'},{id:'b',text:'B'}]},after={tasks:[{text:'A',id:'a'},{id:'c',text:'C'}]};
 assert.deepEqual(delta(before,after),[{collection:'tasks',id:'c',payload:{id:'c',text:'C'}},{collection:'tasks',id:'b',deleted:true}]);
});
test('backup imports cannot grant sharing or impersonate authors',()=>{
 const d=validateBackup({posts:[{id:'p',privacy:'group',groupId:'g',_ownerId:'foreign',comments:[{text:'fake'}]}],profile:{group:{id:'g'}}});
 assert.equal(d.posts[0].privacy,'private');assert.equal(d.posts[0]._ownerId,undefined);assert.equal(d.profile.group,undefined);assert.deepEqual(d.posts[0].comments,[]);
});
test('reject markup IDs, executable URLs and prototype keys before rendering',()=>{
 for(const input of [{tasks:[{id:'x" onclick="evil'}]},{links:[{id:'x',url:'javascript:alert(1)'}]},JSON.parse('{"__proto__":{"admin":true}}'),{places:[{id:'p',photo:'data:image/svg+xml,evil'}]}])assert.throws(()=>validateBackup(input));
});
test('duplicate identifiers never silently overwrite imported records',()=>assert.throws(()=>validateBackup({tasks:[{id:'a'},{id:'a'}]})));
test('Pacific date remains correct across midnight and daylight-saving changes',()=>{
 assert.equal(pacificDay(new Date('2026-09-06T06:59:00Z')),'2026-09-05');
 assert.equal(pacificDay(new Date('2026-09-06T07:01:00Z')),'2026-09-06');
 assert.equal(pacificDay(new Date('2026-11-01T09:01:00Z')),'2026-11-01');
});
test('canonical objects do not cause extra writes due to property order',()=>assert.equal(canonical({a:1,b:2}),canonical({b:2,a:1})));
