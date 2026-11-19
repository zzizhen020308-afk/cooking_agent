import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_PANTRY} from '../lib/kitchen/catalog.ts';
import {createPlan,extendTimer,type TaskProgress} from '../lib/kitchen/engine.ts';
import {dueTimers} from '../lib/kitchen/alerts.ts';

const fixed=1800000000000,minute=60000;
const plan=createPlan({request:'红烧肉、番茄炒蛋',servings:2,budget:10000,pantry:DEFAULT_PANTRY},fixed);
const simmer=plan.tasks.find(t=>t.passive&&t.burner)!;
const active=plan.tasks.find(t=>!t.passive)!;

test('only running waiting steps past their reference time are due',()=>{
 const progress:TaskProgress={[simmer.id]:{status:'running',startedAt:fixed},[active.id]:{status:'running',startedAt:fixed}};
 assert.deepEqual(dueTimers(plan.tasks,progress,fixed+(simmer.minutes*minute)-1000),[]);
 const due=dueTimers(plan.tasks,progress,fixed+simmer.minutes*minute);
 assert.deepEqual(due.map(d=>d.task.id),[simmer.id]);
 assert.match(due[0].title,new RegExp(simmer.dishName));
 assert.deepEqual(dueTimers(plan.tasks,{[simmer.id]:{status:'done',startedAt:fixed,finishedAt:fixed}},fixed+simmer.minutes*minute*2),[]);
});

test('extending a due timer clears it and gives the next alarm a new key',()=>{
 const start:TaskProgress={[simmer.id]:{status:'running',startedAt:fixed}};
 const end=fixed+simmer.minutes*minute,[first]=dueTimers(plan.tasks,start,end);
 const extended=extendTimer(plan.tasks,start,simmer.id,10,{now:end});
 assert.deepEqual(dueTimers(plan.tasks,extended,end+5*minute),[]);
 const [second]=dueTimers(plan.tasks,extended,end+10*minute);
 assert.equal(second.task.id,simmer.id);
 assert.notEqual(second.key,first.key);
});
