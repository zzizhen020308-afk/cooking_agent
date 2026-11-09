import test from 'node:test';
import assert from 'node:assert/strict';
import { RECIPES, DEFAULT_PANTRY, INGREDIENTS } from '../lib/kitchen/catalog.ts';
import { createPlan, parseRequest, choosePacks, createDemoOrder, quoteFor, canStart, availableTasks, shoppingText, requirementsFor, QUOTE_TTL } from '../lib/kitchen/engine.ts';
import type { TaskProgress } from '../lib/kitchen/engine.ts';
const input={request:'我今天想做红烧肉、番茄炒蛋、山药排骨汤',servings:2,budget:10000,pantry:DEFAULT_PANTRY};
const fixed=1800000000000;
test('recognizes all named dishes, aliases and explicit negation',()=>{
 assert.deepEqual(parseRequest(input.request),['braised-pork','tomato-eggs','yam-ribs']);
 assert.deepEqual(parseRequest('不要红烧肉，做西红柿炒鸡蛋'),['tomato-eggs']);
 assert.equal(parseRequest('山药排骨汤、番茄炒鸡蛋、红烧五花肉').length,3);
});
test('unknown dish never silently disappears, even if other dishes match',()=>{assert.throws(()=>parseRequest('红烧肉、宫保鸡丁'),/宫保鸡丁/);assert.throws(()=>parseRequest(''),/先告诉我/);assert.throws(()=>parseRequest(RECIPES.map(r=>r.name).join('、')),/最多/);});
test('validates numbers, including NaN and fractions',()=>{for(const servings of [0,7,1.5,NaN])assert.throws(()=>createPlan({...input,servings}));for(const budget of [0,1000000,NaN,1000.1])assert.throws(()=>createPlan({...input,budget}));});
test('merges shared ingredients and rounds eggs up for one person',()=>{const p=createPlan(input,fixed);assert.equal(p.requirements.find(r=>r.id==='ginger')?.amount,20);assert.equal(p.requirements.find(r=>r.id==='scallion')?.amount,15);assert.equal(p.requirements.find(r=>r.id==='wine')?.amount,25);assert.equal(requirementsFor(['tomato-eggs'],1).find(r=>r.id==='egg')?.amount,2);});
test('bounded package selection can mix sizes; unavailable stock blocks coverage',()=>{
 const make=(sku:string,amount:number,price:number,stock=5)=>({sku,ingredientId:'pork',title:sku,amount,price,stock});
 const l=choosePacks(1000,[make('small',400,1000),make('large',700,1400)]);assert.equal(l?.cost,2400);assert.equal(l?.purchased,1100);assert.equal(l?.packs.length,2);
 assert.equal(choosePacks(1000,[make('small',400,1000,2)]),null);
});
test('prices full packages and delivery, and removes sufficient pantry stock',()=>{const p=createPlan(input,fixed);for(const q of p.quotes){assert.equal(q.total,q.lines.reduce((s,l)=>s+l.cost,0)+q.delivery+q.packaging);for(const l of q.lines){assert.ok(l.purchased>=l.required);assert.ok(!input.pantry.includes(l.ingredientId));}assert.equal(q.lines.filter(l=>l.ingredientId==='ginger').length,1);}const q=quoteFor(p.requirements,p.requirements.map(r=>r.id),'dingdong',fixed);assert.equal(q.total,0);assert.equal(q.delivery,0);assert.equal(q.packaging,0);});
test('all schedules respect dependencies, one cook, two burners and unique pans',()=>{for(let a=0;a<RECIPES.length;a++)for(let b=a+1;b<RECIPES.length;b++)for(let c=b+1;c<RECIPES.length;c++){const ids=[RECIPES[a].id,RECIPES[b].id,RECIPES[c].id],p=createPlan({...input,request:ids.map(id=>RECIPES.find(r=>r.id===id)!.name).join('、')},fixed);for(const t of p.tasks)for(const dep of t.dependsOn)assert.ok(p.tasks.find(x=>x.id===dep)!.end<=t.start);for(let minute=0;minute<p.minutes;minute++){const active=p.tasks.filter(t=>t.start<=minute&&t.end>minute);assert.ok(active.filter(t=>t.hands).length<=1);assert.ok(active.filter(t=>t.burner).length<=2);for(const eq of ['汤锅','炒锅','炖锅'])assert.ok(active.filter(t=>t.equipment===eq).length<=1);}}});
test('live cooking enforces dependencies and cook availability',()=>{const p=createPlan(input,fixed),prep=p.tasks[0];assert.equal(canStart(prep,p.tasks,{}),true);const first=p.tasks.find(t=>t.id==='yam-ribs-0')!;assert.equal(canStart(first,p.tasks,{}),false);const progress:TaskProgress={prep:{status:'done',startedAt:fixed}};assert.equal(canStart(first,p.tasks,progress),true);progress[first.id]={status:'running',startedAt:fixed};const pork=p.tasks.find(t=>t.id==='braised-pork-0')!;assert.equal(canStart(pork,p.tasks,progress),false);});
test('orders are visibly simulated and idempotent; stale and over-budget orders fail',()=>{const p=createPlan(input,fixed),q=p.quotes[0],order=createDemoOrder(p,q,null,fixed+1000);assert.equal(order.mode,'demo');assert.ok(order.id.startsWith('DEMO-'));assert.equal(createDemoOrder(p,q,order,fixed+2000).id,order.id);assert.throws(()=>createDemoOrder(p,q,null,fixed+QUOTE_TTL+1),/过期/);assert.throws(()=>createDemoOrder({...p,input:{...input,budget:1000}},q,null,fixed+1000),/超过预算/);assert.throws(()=>createDemoOrder(p,{...q,total:q.total-100},null,fixed+1000),/变化/);});
test('pantry and serving changes invalidate basket quote and old checkout',()=>{const p=createPlan(input,fixed);const altered=createPlan({...input,pantry:[...DEFAULT_PANTRY,'pork']},fixed);assert.notEqual(p.quotes[0].id,altered.quotes.find(q=>q.provider===p.quotes[0].provider)!.id);assert.throws(()=>createDemoOrder(altered,p.quotes[0],null,fixed+1000),/变化/);});
test('export gives transparent totals, purchase amounts, and synthetic data notice',()=>{const p=createPlan(input,fixed),text=shoppingText(p,p.quotes[0]);assert.ok(text.includes('示例清单'));assert.ok(text.includes('配送'));assert.ok(text.includes('购买'));assert.ok(text.includes('已备足量'));});
test('every recipe references real ingredient IDs',()=>{for(const r of RECIPES)for(const i of r.ingredients)assert.ok(INGREDIENTS[i.id]);});

test('fast dishes wait for actual long-cook progress, rather than starting too early',()=>{
 const p=createPlan(input,fixed),progress:TaskProgress={};
 for(const t of p.tasks)if(t.recipeId!=='tomato-eggs')progress[t.id]={status:'done',startedAt:fixed};
 const simmer=p.tasks.find(t=>t.id==='braised-pork-2')!;
 progress[simmer.id]={status:'running',startedAt:fixed};delete progress['braised-pork-3'];
 assert.ok(!availableTasks(p.tasks,progress,fixed).some(t=>t.recipeId==='tomato-eggs'));
 assert.ok(availableTasks(p.tasks,progress,fixed+39*60000).some(t=>t.recipeId==='tomato-eggs'));
});
test('inline budget and portion phrases remain valid meal instructions',()=>{assert.equal(parseRequest('红烧肉、番茄炒蛋，预算¥80，2人份').length,2);});
