/** Run against a serving Site; this exercises the same converter and planner used by the page. */
import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
import {DISHES,DEFAULT_PANTRY,ingredientsFor} from '../lib/kitchen/catalog.ts';
import {sourceDraftFromCandidate} from '../lib/kitchen/source-draft.ts';
import {recipeFromDraft} from '../lib/kitchen/import-recipe.ts';
import {createPlanWithImports,createPlan,availableTasks,remainingSeconds,shoppingText,type TaskProgress} from '../lib/kitchen/engine.ts';
import type {OpenRecipeCandidate} from '../lib/kitchen/open-recipes.ts';

const origin=process.argv[2]||'http://127.0.0.1:5173';
const query='蚂蚁上树';
assert.ok(!DISHES.some(d=>d.aliases.includes(query)),'The test dish must be absent from the built-in library.');
const response=await fetch(new URL('/api/recipes/search',origin),{method:'POST',headers:{'Content-Type':'application/json',Origin:new URL(origin).origin},body:JSON.stringify({query,source:'HowToCook'})});
assert.equal(response.status,200);
const result=await response.json() as {status:string;candidates:OpenRecipeCandidate[];message:string};
assert.equal(result.status,'ok',result.message);
const candidate=result.candidates.find(c=>c.title===query&&c.contentState==='complete');
assert.ok(candidate,'Live search must return the complete source, not a fixture or a link-only result.');
const {draft,issues}=sourceDraftFromCandidate(candidate,query);
assert.deepEqual(issues,[],'The real recipe must be ready for the same one-click conversion as the page.');
const recipe=recipeFromDraft({...draft,confirmed:true});
assert.equal(recipe.steps.length,candidate.steps.length);
assert.equal(recipe.source.platform,'HowToCook');
assert.equal(recipe.source.snapshot,candidate.snapshot);
const menus=[];
for(const burners of [1,2] as const){
 const plan=createPlanWithImports({request:query+'、番茄炒蛋、拍黄瓜',servings:3,budget:10000,pantry:DEFAULT_PANTRY,burners,availableMinutes:120},[recipe]);
 const definitions=ingredientsFor(plan.recipes),progress:TaskProgress={};let now=plan.createdAt,guard=0;
 while(Object.values(progress).filter(x=>x.status==='done').length<plan.tasks.length&&guard++<200){
  const running=plan.tasks.filter(t=>progress[t.id]?.status==='running');
  assert.ok(running.filter(t=>t.burner).length<=burners);assert.ok(running.filter(t=>t.hands).length<=1);
  const pots=running.flatMap(t=>t.equipment?[t.equipment]:[]);assert.equal(new Set(pots).size,pots.length);
  const hands=running.find(t=>t.hands),due=running.find(t=>t.passive&&remainingSeconds(t,progress,now)===0);
  if(hands){now+=hands.minutes*60000;progress[hands.id]={...progress[hands.id],status:'done',finishedAt:now};}
  else if(due)progress[due.id]={...progress[due.id],status:'done',finishedAt:now};
  else{const next=availableTasks(plan.tasks,progress,now,burners);if(next.length)progress[next[0].id]={status:'running',startedAt:now};else{assert.ok(running.length,'Live recipe scheduling must not deadlock.');now+=Math.min(...running.map(t=>remainingSeconds(t,progress,now)))*1000;}}
 }
 assert.ok(guard<200);assert.equal(Object.values(progress).filter(p=>p.status==='done').length,plan.tasks.length);
 const saved=JSON.parse(JSON.stringify(plan));const restored=createPlan(saved.input,saved.createdAt,saved.recipes);
 assert.deepEqual(restored.requirements,plan.requirements);assert.deepEqual(restored.tasks,plan.tasks);assert.deepEqual(restored.recipes,plan.recipes);
 assert.ok(shoppingText(plan).includes(candidate.snapshot));
 menus.push({burners,servings:plan.input.servings,minutes:plan.minutes,completedTasks:plan.tasks.length,source:recipe.source,ingredients:plan.requirements.map(r=>({...r,name:definitions[r.id].name,unit:definitions[r.id].unit})),unpriced:plan.shopping.unpricedIngredientIds.map(id=>definitions[id].name),tasks:plan.tasks.map(t=>({dish:t.dishName,title:t.title,start:t.start,end:t.end,equipment:t.equipment,timingBasis:t.timingBasis}))});
}
mkdirSync('outputs',{recursive:true});
const report={checkedAt:new Date().toISOString(),origin,query,liveSearch:true,candidate:{title:candidate.title,url:candidate.url,sourceSnapshot:candidate.snapshot,ingredients:candidate.ingredients.length,steps:candidate.steps.length,baseServings:candidate.baseServings,notes:candidate.notes},menus};
writeFileSync('outputs/complete-live-recipe-check.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({passed:true,query,source:candidate.url,ingredients:candidate.ingredients.length,steps:candidate.steps.length,menus:menus.map(m=>({burners:m.burners,minutes:m.minutes,completedTasks:m.completedTasks})),report:'outputs/complete-live-recipe-check.json'},null,2));
