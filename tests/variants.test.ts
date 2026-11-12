import test from 'node:test';
import assert from 'node:assert/strict';
import {DISHES,RECIPES,DEFAULT_PANTRY,recipesForDish,equipmentFor} from '../lib/kitchen/catalog.ts';
import {createPlan,switchRecipe,changeBurners,shoppingText,availableTasks,remainingSeconds,type TaskProgress} from '../lib/kitchen/engine.ts';
import {RECIPE_SOURCES} from '../lib/kitchen/sources.ts';
import {answerCookingQuestion,planKey} from '../lib/kitchen/advisor.ts';

const fixed=1800000000000;
const input={request:'红烧肉、番茄炒蛋、山药排骨汤',servings:2,budget:10000,pantry:DEFAULT_PANTRY};
const clone=<T>(x:T):T=>JSON.parse(JSON.stringify(x));

test('dish identities are separate from independently selectable recipe revisions',()=>{
 assert.equal(DISHES.length,34);assert.equal(RECIPES.length,41);assert.equal(DISHES.filter(d=>recipesForDish(d.id).length>1).length,7);
 for(const dish of DISHES){assert.ok(recipesForDish(dish.id).some(r=>r.id===dish.defaultRecipeId));for(const r of recipesForDish(dish.id)){assert.ok(r.variantName);assert.ok(r.revision);assert.equal(r.name,dish.name);assert.ok(RECIPE_SOURCES[r.id]);}}
});
test('old meal inputs preserve the default recipes, quantities and 93-minute plan',()=>{
 const p=createPlan(input,fixed);assert.equal(p.minutes,93);assert.deepEqual(p.dishIds,['braised-pork','tomato-eggs','yam-ribs']);assert.deepEqual(p.recipeIds,p.dishIds);assert.equal(p.input.recipeChoices?.['tomato-eggs'],'tomato-eggs');assert.ok(p.recipes.every(r=>r.source&&r.revision==='1'));
});
test('switching a recipe changes its ingredients, steps, estimate and plan identity together',()=>{
 const old=createPlan(input,fixed),next=switchRecipe(old,'tomato-eggs','tomato-eggs-juicy',{},fixed);
 assert.deepEqual(next.dishIds,old.dishIds);assert.ok(next.createdAt>old.createdAt);assert.notEqual(planKey(next),planKey(old));
 assert.equal(next.requirements.find(i=>i.id==='tomato')?.amount,600);assert.equal(next.requirements.find(i=>i.id==='egg')?.amount,2);
 assert.ok(next.tasks.some(t=>t.id==='tomato-eggs-juicy-2'));assert.ok(!next.tasks.some(t=>t.recipeId==='tomato-eggs'));assert.notEqual(next.minutes,old.minutes);assert.notEqual(next.shopping.high,old.shopping.high);
 assert.equal(old.requirements.find(i=>i.id==='tomato')?.amount,400);assert.deepEqual(next.recipes.filter(r=>r.dishId!=='tomato-eggs'),old.recipes.filter(r=>r.dishId!=='tomato-eggs'));
 assert.equal(switchRecipe(next,'tomato-eggs','tomato-eggs-juicy'),next);
});
test('switching broccoli to oyster sauce adds the actual new condiment and its own source',()=>{
 const p=createPlan({...input,request:'蒜蓉西兰花'},fixed),next=switchRecipe(p,'garlic-broccoli','garlic-broccoli-oyster');
 assert.ok(!p.requirements.some(i=>i.id==='oyster'));assert.equal(next.requirements.find(i=>i.id==='oyster')?.amount,10);assert.ok(!next.requirements.some(i=>i.id==='salt'));assert.ok(next.shopping.lines.some(i=>i.ingredientId==='oyster'));
 assert.ok(next.recipes[0].source.snapshot);assert.notDeepEqual(next.recipes[0].source,p.recipes[0].source);
});
test('switching chicken to steaming replaces the pan, includes marinating and retains other dishes',()=>{
 const p=createPlan({...input,request:'香菇滑鸡、清蒸鲈鱼'},fixed),next=switchRecipe(p,'mushroom-chicken','mushroom-chicken-steamed');
 assert.ok(equipmentFor(p.recipes).includes('炒锅'));assert.deepEqual(equipmentFor(next.recipes),['蒸锅']);assert.ok(next.tasks.some(t=>t.waitKind==='腌制'&&!t.burner));assert.ok(next.tasks.some(t=>t.waitKind==='蒸制'));
 assert.deepEqual(next.recipes[1],p.recipes[1]);for(let m=0;m<next.minutes;m++)assert.ok(next.tasks.filter(t=>t.equipment==='蒸锅'&&t.start<=m&&t.end>m).length<=1);
});
test('recipe choices cannot point at another dish or an unknown recipe',()=>{
 const p=createPlan(input,fixed);assert.throws(()=>switchRecipe(p,'braised-pork','tomato-eggs-juicy'),/对应/);assert.throws(()=>switchRecipe(p,'mushroom-chicken','mushroom-chicken-steamed'),/选进/);
 assert.throws(()=>createPlan({...input,recipeChoices:{'braised-pork':'tomato-eggs'}}),/对应/);assert.throws(()=>createPlan({...input,recipeChoices:{'braised-pork':'unknown'}}));assert.throws(()=>createPlan({...input,recipeChoices:[] as unknown as Record<string,string>}));
});
test('a started or partially completed meal cannot silently switch its recipe',()=>{
 const p=createPlan(input,fixed);for(const progress of [{prep:{status:'running' as const,startedAt:fixed}},{prep:{status:'done' as const,startedAt:fixed,finishedAt:fixed}}])assert.throws(()=>switchRecipe(p,'braised-pork','braised-pork-soy',progress),/正在做/);
 const complete:TaskProgress=Object.fromEntries(p.tasks.map(t=>[t.id,{status:'done',startedAt:fixed,finishedAt:fixed}]));assert.ok(switchRecipe(p,'braised-pork','braised-pork-soy',complete).recipeIds.includes('braised-pork-soy'));
});
test('saved meal snapshots survive later catalog revisions, including ingredients, steps and source',()=>{
 const p=createPlan({...input,recipeChoices:{'tomato-eggs':'tomato-eggs-juicy'}},fixed),saved=clone(p.recipes),recipe=RECIPES.find(r=>r.id==='tomato-eggs-juicy')!,backup=clone(recipe),source=RECIPE_SOURCES[recipe.id],sourceBackup=clone(source);
 try{recipe.revision='2';recipe.ingredients[0].amount=999;recipe.steps[0].detail='后续目录更新';source.label='后续来源更新';
  const restored=createPlan(p.input,p.createdAt,saved);assert.deepEqual(restored.recipes,p.recipes);assert.deepEqual(restored.requirements,p.requirements);assert.deepEqual(restored.tasks,p.tasks);assert.equal(planKey(restored),planKey(p));
  assert.deepEqual(changeBurners(restored,{},1).recipes,p.recipes);assert.deepEqual(createPlan({...restored.input,pantry:[]},restored.createdAt,restored.recipes).recipes,p.recipes);
  const updated=createPlan(p.input,p.createdAt);assert.notEqual(planKey(updated),planKey(restored));assert.equal(updated.recipes.find(r=>r.id===recipe.id)?.revision,'2');
  const answer=answerCookingQuestion('番茄炒蛋要多少番茄',{plan:restored,progress:{},now:fixed});assert.match(answer.paragraphs.join(''),/600g/);assert.ok(!answer.sources.some(s=>s.label==='后续来源更新'));
 }finally{Object.assign(recipe,backup);Object.assign(source,sourceBackup);}
});
test('changing one dish preserves other frozen recipes even when their catalog revision has changed',()=>{
 const p=createPlan(input,fixed),r=RECIPES.find(r=>r.id==='yam-ribs')!,backup=clone(r);try{r.revision='2';r.ingredients[0].amount=999;const next=switchRecipe(p,'braised-pork','braised-pork-soy');assert.deepEqual(next.recipes.find(x=>x.dishId==='yam-ribs'),p.recipes.find(x=>x.dishId==='yam-ribs'));}finally{Object.assign(r,backup);}
});
test('corrupt or mismatched saved recipes are rejected rather than silently loading current defaults',()=>{
 const p=createPlan(input,fixed);
 const bad=clone(p.recipes);bad[0].ingredients[0].amount=-1;assert.throws(()=>createPlan(p.input,fixed,bad));
 const unsafe=clone(p.recipes);unsafe[0].source.references[0].url='javascript:alert(1)';assert.throws(()=>createPlan(p.input,fixed,unsafe));
 const malformed=clone(p.recipes);malformed[0].source.snapshot={} as unknown as string;assert.throws(()=>createPlan(p.input,fixed,malformed));
 assert.throws(()=>createPlan(p.input,fixed,[]));assert.throws(()=>createPlan(p.input,fixed,[p.recipes[0],p.recipes[0],p.recipes[2]]));assert.throws(()=>createPlan({...p.input,recipeChoices:{'braised-pork':'braised-pork-soy'}},fixed,p.recipes));
});
test('answers, missing ingredients and exported lists use the selected variant and source author',()=>{
 const p=createPlan({...input,request:'西葫芦炒蛋',recipeChoices:{'zucchini-eggs':'zucchini-eggs-tomato'}},fixed),context={plan:p,progress:{},now:fixed};
 const q=answerCookingQuestion('西葫芦炒蛋需要多少番茄',context);assert.equal(q.recipeId,'zucchini-eggs-tomato');assert.match(q.context,/番茄合炒版/);assert.match(q.paragraphs.join(''),/200g/);assert.match(answerCookingQuestion('西葫芦炒蛋需要多少盐',context).paragraphs.join(''),/3g/);assert.ok(q.sources.some(s=>s.url?.includes('106140793')));
 const missing=answerCookingQuestion('没有大蒜怎么办',context);assert.match(missing.title,/不需要大蒜/);const exported=shoppingText(p);assert.match(exported,/番茄合炒版/);assert.match(exported,/火龙果很好吃/);assert.match(exported,/配方版本 1/);assert.match(exported,/106140793/);
 const steam=createPlan({...input,request:'香菇滑鸡',recipeChoices:{'mushroom-chicken':'mushroom-chicken-steamed'}},fixed),hard=answerCookingQuestion('香菇滑鸡还硬怎么办',{plan:steam,progress:{},now:fixed});assert.match(hard.title,/清蒸/);assert.equal(hard.action,undefined);assert.match(hard.paragraphs.join(''),/74°C/);
});
test('mixed alternative recipes can finish their live cooking flow on one or two burners',()=>{
 for(const burners of [1,2] as const){const p=createPlan({...input,request:'红烧肉、香菇滑鸡、蒜蓉西兰花、手撕包菜',burners,recipeChoices:{'braised-pork':'braised-pork-soy','mushroom-chicken':'mushroom-chicken-steamed','garlic-broccoli':'garlic-broccoli-oyster','torn-cabbage':'torn-cabbage-pork'}},fixed),progress:TaskProgress={};let now=fixed,guard=0;
  while(Object.values(progress).filter(x=>x.status==='done').length<p.tasks.length&&guard++<250){const running=p.tasks.filter(t=>progress[t.id]?.status==='running');assert.ok(running.filter(t=>t.burner).length<=burners);for(const eq of equipmentFor(p.recipes))assert.ok(running.filter(t=>t.equipment===eq).length<=1);const hands=running.find(t=>t.hands),due=running.find(t=>t.passive&&remainingSeconds(t,progress,now)===0);
   if(hands){now+=hands.minutes*60000;progress[hands.id]={...progress[hands.id],status:'done',finishedAt:now};}else if(due)progress[due.id]={...progress[due.id],status:'done',finishedAt:now};else{const next=availableTasks(p.tasks,progress,now,burners);if(next.length)progress[next[0].id]={status:'running',startedAt:now};else{assert.ok(running.length);now+=Math.min(...running.map(t=>remainingSeconds(t,progress,now)))*1000;}}
  }assert.ok(guard<250);assert.equal(Object.values(progress).filter(x=>x.status==='done').length,p.tasks.length);
 }
});
