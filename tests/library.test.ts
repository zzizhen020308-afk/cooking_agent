import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {RECIPES,INGREDIENTS,DEFAULT_PANTRY,referencePacks,findRecipes,equipmentFor} from '../lib/kitchen/catalog.ts';
import {LIBRARY_RECIPES,SOURCE_SNAPSHOT} from '../lib/kitchen/library.ts';
import {RECIPE_SOURCES} from '../lib/kitchen/sources.ts';
import {createPlan,parseRequest,availableTasks,remainingSeconds,extendTimer,type TaskProgress} from '../lib/kitchen/engine.ts';
import {answerCookingQuestion} from '../lib/kitchen/advisor.ts';
const fixed=1800000000000;
const input={servings:2,budget:10000,pantry:DEFAULT_PANTRY};

test('all 34 recipes and every alias round-trip without matching another dish',()=>{
 assert.equal(RECIPES.length,34);assert.equal(new Set(RECIPES.map(r=>r.id)).size,34);
 for(const r of RECIPES)for(const alias of r.aliases)assert.deepEqual(parseRequest(alias),[r.id],alias);
 assert.deepEqual(parseRequest('我今天想做宫爆鸡丁、蒸鲈鱼和紫菜鸡蛋汤，3人份，预算100元'),['kung-pao-chicken','steamed-fish','seaweed-egg-soup']);
 assert.deepEqual(parseRequest('不要宫保鸡丁，做可乐鸡翅、番茄蛋汤'),['cola-wings','tomato-egg-soup']);
 assert.throws(()=>parseRequest('宫保鸡丁、惠灵顿牛排'),/暂未收录/);
});
test('recipe search covers aliases, ingredients, categories and empty results',()=>{
 assert.ok(findRecipes('宫爆').some(r=>r.id==='kung-pao-chicken'));
 assert.ok(findRecipes('鸡翅').some(r=>r.id==='cola-wings'));
 assert.ok(findRecipes('干木耳').some(r=>r.id==='fish-fragrant-pork'));
 assert.ok(findRecipes('番茄').some(r=>r.id==='tomato-beef'));
 assert.ok(findRecipes('', '水产').every(r=>r.category==='水产'));
 assert.deepEqual(findRecipes('惠灵顿牛排'),[]);
 assert.deepEqual(findRecipes('牛腩','蔬菜'),[]);assert.ok(findRecipes('蒜薹').some(r=>r.id==='garlic-scape-pork'));assert.deepEqual(parseRequest('角瓜炒鸡蛋、蒜薹炒肉'),['zucchini-eggs','garlic-scape-pork']);
});
test('each recipe has complete quantities, purchase assumptions, safe step metadata and an available illustration',()=>{
 for(const r of RECIPES){
  assert.ok(r.category);assert.ok(r.ingredients.length);assert.ok(r.steps.length);
  assert.equal(new Set(r.ingredients.map(i=>i.id)).size,r.ingredients.length,r.name);
  for(const i of r.ingredients){assert.ok(INGREDIENTS[i.id],i.id);assert.ok(i.amount>0&&Number.isFinite(i.amount));assert.ok(referencePacks.some(p=>p.ingredientId===i.id));}
  for(const s of r.steps){assert.ok(Number.isInteger(s.minutes)&&s.minutes>0);assert.ok(s.title&&s.detail);if(s.burner)assert.ok(s.equipment);if(s.waitKind==='蒸制')assert.equal(s.equipment,'蒸锅');if(s.waitKind==='泡发'||s.waitKind==='腌制')assert.ok(!s.burner&&!s.equipment);}
  assert.ok(existsSync(new URL(`../public/food/${r.image}.svg`,import.meta.url)));
 }
});
test('all added source links point to the verified immutable recipe snapshot',()=>{
 for(const r of LIBRARY_RECIPES){const source=RECIPE_SOURCES[r.id];assert.equal(source.snapshot,SOURCE_SNAPSHOT);assert.match(source.checkedAt,/^2026-11-12$/);assert.ok(source.note.length>20);assert.ok(source.references[0].url?.includes(`/blob/${SOURCE_SNAPSHOT}/dishes/`));}
});
test('new ingredients merge across recipes and scale from one to six people',()=>{
 for(const servings of [1,2,6]){const p=createPlan({...input,servings,request:'番茄牛腩、番茄蛋汤、紫菜蛋花汤'},fixed);assert.equal(p.requirements.find(i=>i.id==='tomato')?.amount,800*servings/2);assert.equal(p.requirements.find(i=>i.id==='egg')?.amount,2*servings);for(const l of p.shopping.lines)assert.ok(l.purchased>=l.required);}
 const p=createPlan({...input,request:'家常豆腐、皮蛋豆腐'},fixed);assert.ok(p.requirements.some(i=>i.id==='tofu'));assert.ok(p.requirements.some(i=>i.id==='ready-tofu'));const eggs=createPlan({...input,servings:3,request:'韭菜炒蛋、西葫芦炒蛋'},fixed);assert.equal(eggs.requirements.find(i=>i.id==='egg')?.amount,10);const answer=answerCookingQuestion('鸡蛋要多少',{plan:eggs,progress:{},now:fixed});assert.match(answer.paragraphs.join(''),/10个/);const soup=createPlan({...input,servings:4,request:'番茄蛋汤'},fixed);assert.match(soup.tasks.find(t=>t.recipeId==='tomato-egg-soup'&&t.detail.includes('ml'))!.detail,/1400–1800ml/);
});
test('steamer occupancy is independent of other pots but never double-booked',()=>{
 const p=createPlan({...input,request:'清蒸鲈鱼、清蒸南瓜、玉米排骨汤'},fixed);
 assert.deepEqual(equipmentFor(p.recipeIds.map(id=>RECIPES.find(r=>r.id===id)!)),['蒸锅','汤锅']);
 for(let m=0;m<p.minutes;m++)assert.ok(p.tasks.filter(t=>t.equipment==='蒸锅'&&t.start<=m&&t.end>m).length<=1);
 const soak=createPlan({...input,request:'凉拌木耳、鱼香肉丝'},fixed);assert.ok(soak.tasks.filter(t=>t.waitKind==='泡发').every(t=>!t.burner));assert.ok(soak.minutes>=60);
 const wait=soak.tasks.find(t=>t.waitKind==='泡发')!;assert.throws(()=>extendTimer(soak.tasks,{[wait.id]:{status:'running',startedAt:fixed}},wait.id,5));
});
test('representative new four-dish meals complete live without deadlocks on one and two burners',()=>{
 const menus=['可乐鸡翅、清蒸鲈鱼、蒜蓉西兰花、紫菜蛋花汤','番茄牛腩、鱼香肉丝、清蒸南瓜、凉拌木耳','宫保鸡丁、麻婆豆腐、手撕包菜、葱油拌面'];
 for(const burners of [1,2] as const)for(const request of menus){const p=createPlan({...input,request,burners},fixed),progress:TaskProgress={};let now=fixed,guard=0;
  while(Object.values(progress).filter(x=>x.status==='done').length<p.tasks.length&&guard++<200){
   const running=p.tasks.filter(t=>progress[t.id]?.status==='running');assert.ok(running.filter(t=>t.burner).length<=burners);for(const eq of equipmentFor(p.recipeIds.map(id=>RECIPES.find(r=>r.id===id)!)))assert.ok(running.filter(t=>t.equipment===eq).length<=1);
   const hands=running.find(t=>t.hands),due=running.find(t=>t.passive&&remainingSeconds(t,progress,now)===0);
   if(hands){now+=hands.minutes*60000;progress[hands.id]={...progress[hands.id],status:'done',finishedAt:now};}
   else if(due)progress[due.id]={...progress[due.id],status:'done',finishedAt:now};
   else {const next=availableTasks(p.tasks,progress,now,burners);if(next.length)progress[next[0].id]={status:'running',startedAt:now};else {assert.ok(running.length,`${request} is stuck`);now+=Math.min(...running.map(t=>remainingSeconds(t,progress,now)))*1000;}}
  }assert.ok(guard<200);assert.equal(Object.values(progress).filter(x=>x.status==='done').length,p.tasks.length);
 }
});
test('local answers ground new recipes in quantities, source and appropriate doneness guidance',()=>{
 const p=createPlan({...input,request:'宫保鸡丁、清蒸鲈鱼、番茄蛋汤'},fixed),context={plan:p,progress:{},now:fixed};
 const amount=answerCookingQuestion('宫保鸡丁需要多少熟花生？',context);assert.equal(amount.recipeId,'kung-pao-chicken');assert.match(amount.paragraphs.join(''),/60g/);
 assert.ok(answerCookingQuestion('宫保鸡丁的来源',context).sources.some(s=>s.url?.includes(SOURCE_SNAPSHOT)));
 assert.match(answerCookingQuestion('宫保鸡丁熟了吗',context).paragraphs.join(''),/74°C/);
 assert.match(answerCookingQuestion('清蒸鲈鱼熟了吗',context).paragraphs.join(''),/63°C/);
 const cola=createPlan({...input,request:'可乐鸡翅'},fixed);assert.match(answerCookingQuestion('可乐鸡翅熟了吗',{...context,plan:cola}).paragraphs.join(''),/74°C/);
 assert.equal(answerCookingQuestion('可乐鸡翅还硬怎么办',{...context,plan:cola,progress:{'cola-wings-2':{status:'running',startedAt:fixed-20*60000}}}).action,undefined);
});

test('Xiachufang entries preserve original author and URL without inheriting an unrelated license',()=>{for(const id of ['zucchini-eggs','garlic-scape-pork']){const s=RECIPE_SOURCES[id];assert.equal(s.platform,'下厨房');assert.ok(s.author);assert.ok(s.sourceTitle);assert.ok(s.references[0].url?.includes('xiachufang.com/recipe/'));assert.equal(s.snapshot,undefined);assert.match(s.note,/独立/);}});
