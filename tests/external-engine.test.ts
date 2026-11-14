import test from 'node:test';
import assert from 'node:assert/strict';
import {INGREDIENTS,ingredientsFor,ingredientFor,DEFAULT_PANTRY} from '../lib/kitchen/catalog.ts';
import {createPlan,createPlanWithImports,parseMealRequest,parseRequest,shoppingText,changeBurners,availableTasks,remainingSeconds,type TaskProgress} from '../lib/kitchen/engine.ts';
import {validateRecipeSnapshots,type PlannedRecipe} from '../lib/kitchen/snapshots.ts';
import {answerCookingQuestion} from '../lib/kitchen/advisor.ts';
const fixed=1800000000000;
const imported=():PlannedRecipe=>({id:'online-100000001',dishId:'online-100000001',name:'莴笋炒虾仁',aliases:['莴笋炒虾仁'],variantName:'原页核对版',revision:'user-v1',category:'水产',tag:'导入做法',intro:'已核对原页的本餐配方。',color:'#e1e7d5',image:'green',tips:['按原页和实际状态核对熟度。'],ingredients:[{id:'external-celtuce',amount:300},{id:'shrimp',amount:200},{id:'oil',amount:10},{id:'salt',amount:2}],ingredientDefinitions:{'external-celtuce':{id:'external-celtuce',name:'莴笋',unit:'g',category:'生鲜',icon:'🥬'}},steps:[{title:'备料',detail:'按原页处理莴笋与虾仁。',minutes:6},{title:'炒制至熟',detail:'按核对后的顺序入炒锅，充分炒熟。',minutes:8,burner:true,equipment:'炒锅'}],source:{kind:'edited',platform:'下厨房',label:'下厨房 · 用户核对导入',checkedAt:'2026-11-14',note:'用量与步骤经过本次用户核对。',author:'测试作者',sourceTitle:'莴笋炒虾仁',references:[{label:'查看下厨房原页',url:'https://www.xiachufang.com/recipe/100000001/'}]}});
const input={request:'莴笋炒虾仁、番茄炒蛋',servings:3,budget:10000,pantry:DEFAULT_PANTRY};
const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value));
test('unknown dish segments retain complete names instead of matching a contained local alias',()=>{
 assert.deepEqual(parseMealRequest('我今天想做西兰花炒虾仁、番茄炒蛋，预算80元，2人份'),{dishIds:['tomato-eggs'],unknown:['西兰花炒虾仁']});
 assert.deepEqual(parseMealRequest('不要红烧肉，做莴笋炒虾仁、番茄炒蛋'),{dishIds:['tomato-eggs'],unknown:['莴笋炒虾仁']});
 assert.deepEqual(parseRequest('我想做莴笋炒虾仁、番茄炒蛋',[imported()]),['online-100000001','tomato-eggs']);
 assert.deepEqual(parseMealRequest('我不要惠灵顿牛排和水煮牛肉，想做莲藕炖鸭、番茄炒蛋'),{dishIds:['tomato-eggs'],unknown:['莲藕炖鸭']});
 assert.deepEqual(parseMealRequest('不要西兰花炒虾仁，做莴笋炒虾仁'),{dishIds:[],unknown:['莴笋炒虾仁']});
});
test('imported recipes combine with local defaults and keep extra shelf entries out of the meal',()=>{
 const extra=imported();extra.id=extra.dishId='online-100000002';extra.name='另一道导入菜';extra.aliases=[extra.name];
 const p=createPlanWithImports(input,[imported(),extra],fixed);
 assert.deepEqual(p.dishIds,['online-100000001','tomato-eggs']);assert.equal(p.recipes.length,2);
 assert.equal(p.requirements.find(r=>r.id==='external-celtuce')?.amount,450);
 assert.equal(p.requirements.find(r=>r.id==='shrimp')?.amount,300);
 assert.equal(p.requirements.find(r=>r.id==='egg')?.amount,5);
 assert.equal(INGREDIENTS['external-celtuce'],undefined);assert.equal(ingredientFor('external-celtuce',p.recipes)?.name,'莴笋');
 assert.equal(ingredientsFor(p.recipes)['external-celtuce'].unit,'g');
});
test('unpriced imported ingredients remain in the grocery list and cannot masquerade as a complete budget',()=>{
 const p=createPlanWithImports(input,[imported()],fixed),line=p.shopping.lines.find(l=>l.ingredientId==='external-celtuce');
 assert.equal(line?.unpriced,true);assert.equal(line?.required,450);assert.deepEqual(line?.packs,[]);assert.deepEqual(p.shopping.unpricedIngredientIds,['external-celtuce']);
 const text=shoppingText(p);assert.match(text,/莴笋：需 450g/);assert.match(text,/尚未估价：莴笋/);assert.match(text,/无法据此判断预算充足/);assert.match(text,/100000001/);assert.match(text,/测试作者/);
 const answer=answerCookingQuestion('预算够吗',{plan:p,progress:{},now:fixed});assert.match(answer.paragraphs.join(''),/不是整餐总价/);
});
test('frozen external recipes restore without global registration and survive pantry and burner replanning',()=>{
 const p=createPlanWithImports(input,[imported()],fixed),saved=clone(p.recipes),restored=createPlan(p.input,p.createdAt,saved);
 assert.deepEqual(restored.recipes,p.recipes);assert.deepEqual(restored.requirements,p.requirements);assert.deepEqual(changeBurners(restored,{},1).recipes,p.recipes);
 const stocked=createPlan({...p.input,pantry:[...p.input.pantry,'external-celtuce']},fixed,p.recipes);
 assert.deepEqual(stocked.shopping.unpricedIngredientIds,[]);assert.ok(!stocked.shopping.lines.some(l=>l.ingredientId==='external-celtuce'));
 const changedMenu=createPlanWithImports({...input,request:'番茄炒蛋',pantry:[...input.pantry,'external-celtuce']},p.recipes,fixed);assert.ok(!changedMenu.input.pantry.includes('external-celtuce'));
 saved[0].ingredientDefinitions!['external-celtuce'].name='changed';assert.equal(restored.recipes[0].ingredientDefinitions!['external-celtuce'].name,'莴笋');
});
test('external amount and step answers use the selected source while special recipe rules do not leak',()=>{
 const p=createPlanWithImports({...input,request:'莴笋炒虾仁'},[imported()],fixed),ctx={plan:p,progress:{},now:fixed};
 const amount=answerCookingQuestion('莴笋炒虾仁需要多少莴笋',ctx);assert.match(amount.paragraphs.join(''),/450g/);assert.ok(amount.sources.some(s=>s.url?.includes('100000001')));
 const steps=answerCookingQuestion('莴笋炒虾仁怎么做',ctx);assert.match(steps.paragraphs.join(''),/按原页处理莴笋与虾仁/);assert.notEqual(steps.kind,'unsupported');
 const heat=answerCookingQuestion('莴笋炒虾仁火开多大',ctx);assert.match(heat.paragraphs.join(''),/尚无专门验证/);assert.doesNotMatch(heat.paragraphs.join(''),/糖色|汤面/);
 const hard=answerCookingQuestion('莴笋炒虾仁还硬怎么办',ctx);assert.equal(hard.action,undefined);assert.doesNotMatch(hard.paragraphs.join(''),/延长 10 分钟|补热水/);
});
test('external snapshot inputs reject invalid source URLs, missing definitions, conflicting units and malformed fields',()=>{
 for(const url of ['http://www.xiachufang.com/recipe/1/','https://evil.test/recipe/1/','https://www.xiachufang.com.evil.test/recipe/1/','https://user@www.xiachufang.com/recipe/1/','https://www.xiachufang.com:8443/recipe/1/','https://www.xiachufang.com/recipe/1/?x=1']){const r=imported();r.source.references[0].url=url;assert.throws(()=>validateRecipeSnapshots([r]));}
 const missing=imported();delete missing.ingredientDefinitions;assert.throws(()=>validateRecipeSnapshots([missing]));
 const override=imported();override.ingredientDefinitions!.salt={id:'salt',name:'盐',unit:'ml',category:'调味',icon:'◦'};assert.throws(()=>validateRecipeSnapshots([override]));
 const badId=imported();badId.ingredients[0].id='constructor';assert.throws(()=>validateRecipeSnapshots([badId]));
 const conflict=imported();conflict.id=conflict.dishId='online-100000002';conflict.name='另一个';conflict.aliases=['另一个'];conflict.ingredientDefinitions!['external-celtuce'].unit='个';assert.throws(()=>validateRecipeSnapshots([imported(),conflict]));
 const amount=imported();amount.ingredients[0].amount=NaN;assert.throws(()=>validateRecipeSnapshots([amount]));
 const step=imported();step.steps[0].minutes=0;assert.throws(()=>validateRecipeSnapshots([step]));
 assert.throws(()=>createPlanWithImports({...input,pantry:['constructor']},[imported()]));
});
test('an import shelf can contain 24 distinct dishes and harmless display metadata differences',()=>{
 const shelf=Array.from({length:24},(_,i)=>{const r=imported();r.id=r.dishId=`online-${100000001+i}`;r.name=`导入菜${i}`;r.aliases=[r.name];r.ingredientDefinitions!['external-celtuce'].category=i%2?'调味':'生鲜';r.ingredientDefinitions!['external-celtuce'].icon=i%2?'🥬':'🌿';return r;});
 const p=createPlanWithImports({...input,request:'导入菜23、番茄炒蛋'},shelf,fixed);assert.equal(p.recipes[0].name,'导入菜23');assert.equal(p.recipes.length,2);assert.ok(ingredientsFor(shelf)['external-celtuce']);
});
test('mixed external and local meals complete without burner or hands conflicts',()=>{
 for(const burners of [1,2] as const){const p=createPlanWithImports({...input,burners},[imported()],fixed),progress:TaskProgress={};let now=fixed,guard=0;
  while(Object.values(progress).filter(x=>x.status==='done').length<p.tasks.length&&guard++<100){const running=p.tasks.filter(t=>progress[t.id]?.status==='running');assert.ok(running.filter(t=>t.burner).length<=burners);assert.ok(running.filter(t=>t.hands).length<=1);const hands=running.find(t=>t.hands),due=running.find(t=>t.passive&&remainingSeconds(t,progress,now)===0);if(hands){now+=hands.minutes*60000;progress[hands.id]={...progress[hands.id],status:'done',finishedAt:now};}else if(due)progress[due.id]={...progress[due.id],status:'done',finishedAt:now};else{const next=availableTasks(p.tasks,progress,now,burners);if(next.length)progress[next[0].id]={status:'running',startedAt:now};else{assert.ok(running.length);now+=Math.min(...running.map(t=>remainingSeconds(t,progress,now)))*1000;}}}
  assert.ok(guard<100);assert.equal(Object.values(progress).filter(x=>x.status==='done').length,p.tasks.length);
 }
});
