import test from 'node:test';
import assert from 'node:assert/strict';
import {parseIngredientQuantity,parseIngredientLines,recipeFromDraft,xiachufangRecipeUrl,type DraftRecipe} from '../lib/kitchen/import-recipe.ts';
import {INGREDIENTS} from '../lib/kitchen/catalog.ts';
import {parsePastedRecipe} from '../lib/kitchen/online-parser.ts';
import {createPlan,createPlanWithImports} from '../lib/kitchen/engine.ts';

const fixture=():DraftRecipe=>({title:'莴笋炒肉',url:'https://m.xiachufang.com/recipe/1234567/?from=share',author:'示例作者',baseServings:'4',category:'荤菜',confirmed:true,ingredients:[{name:'莴笋',amount:'600',unit:'g',category:'生鲜'},{name:'猪瘦肉',amount:'400',unit:'g',category:'生鲜'},{name:'盐',amount:'4',unit:'g',category:'调味'}],steps:[{title:'准备食材',detail:'蔬菜洗净切片，肉切片，生熟刀板分开。',minutes:'6',equipment:'none',mode:'active'},{title:'炒熟后出锅',detail:'按原谱次序翻炒至食材熟透后关火盛出。',minutes:'8',equipment:'炒锅',mode:'active'}]});

test('only canonical Xiachufang recipe HTTPS URLs are accepted',()=>{
 assert.equal(xiachufangRecipeUrl('https://m.xiachufang.com/recipe/1234567/?from=share'),'https://www.xiachufang.com/recipe/1234567/');
 for(const url of ['http://www.xiachufang.com/recipe/1/','https://xiachufang.com.evil.test/recipe/1/','https://www.xiachufang.com@evil.test/recipe/1/','https://evil.test/recipe/1/','https://www.xiachufang.com:444/recipe/1/','https://www.xiachufang.com/search/?keyword=肉','javascript:alert(1)'])assert.equal(xiachufangRecipeUrl(url),null);
});
test('unambiguous quantities convert units without guessing spoons, roots or vague words',()=>{
 assert.equal(parseIngredientQuantity('莴笋','0.6公斤').amount,'600');assert.equal(parseIngredientQuantity('盐','1/2克').amount,'0.5');assert.equal(parseIngredientQuantity('牛奶','1升').amount,'1000');assert.equal(parseIngredientQuantity('牛奶','50ml').unit,'ml');assert.equal(parseIngredientQuantity('鸡蛋','2个').unit,'个');
 for(const text of ['适量','2根','1大勺','1/0克','少许','100–200g','0克'])assert.equal(parseIngredientQuantity('食材',text).amount,'');
 assert.equal(parseIngredientLines('莴笋 300克\n盐：适量').length,2);
});
test('reviewed recipe scales original portions and reuses exact known ingredient definitions',()=>{
 const before=JSON.stringify(INGREDIENTS),r=recipeFromDraft(fixture(),new Date('2026-11-14T00:00:00Z'));assert.equal(r.id,'online-1234567');assert.equal(r.ingredients.find(i=>i.id==='lean-pork')?.amount,200);assert.equal(r.ingredients.find(i=>i.id==='salt')?.amount,2);const unknown=r.ingredients.find(i=>i.id.startsWith('external-'))!;assert.equal(unknown.amount,300);assert.equal(r.ingredientDefinitions?.[unknown.id].name,'莴笋');assert.equal(r.source.author,'示例作者');assert.equal(r.source.references[0].url,'https://www.xiachufang.com/recipe/1234567/');assert.match(r.source.note,/原谱按 4 人份/);assert.equal(JSON.stringify(INGREDIENTS),before);
});
test('same name with differing units has separate identity and cannot overwrite catalog units',()=>{
 const d=fixture();d.ingredients=[{name:'盐',amount:'1',unit:'个',category:'调味'},{name:'盐',amount:'4',unit:'g',category:'调味'}];const r=recipeFromDraft(d);assert.equal(r.ingredients.length,2);assert.equal(r.ingredients.filter(i=>i.id==='salt').length,1);assert.equal(Object.values(r.ingredientDefinitions!)[0].unit,'个');
});
test('every amount, source portion, step duration and explicit review is required',()=>{
 for(const mutate of [(d:DraftRecipe)=>d.confirmed=false,(d:DraftRecipe)=>d.baseServings='',(d:DraftRecipe)=>d.baseServings='0',(d:DraftRecipe)=>d.ingredients[0].amount='',(d:DraftRecipe)=>d.ingredients[0].amount='适量',(d:DraftRecipe)=>d.ingredients[0].amount='Infinity',(d:DraftRecipe)=>d.steps[0].minutes='',(d:DraftRecipe)=>d.steps[0].minutes='1.5',(d:DraftRecipe)=>d.steps[0].detail='']){const d=fixture();mutate(d);assert.throws(()=>recipeFromDraft(d));}
});
test('cold waiting has no burner and heated waiting requires a specific pot',()=>{
 const d=fixture();d.steps[0].mode='腌制';const r=recipeFromDraft(d);assert.equal(r.steps[0].passive,true);assert.equal(r.steps[0].burner,false);d.steps[0].equipment='炒锅';assert.throws(()=>recipeFromDraft(d),/冷藏等待/);d.steps[0].mode='蒸制';d.steps[0].equipment='none';assert.throws(()=>recipeFromDraft(d),/实际加热锅具/);
});
test('content revision changes with edited ingredients or steps and author omission stays explicit',()=>{
 const d=fixture(),first=recipeFromDraft(d);d.ingredients[0].amount='700';assert.notEqual(recipeFromDraft(d).revision,first.revision);d.author='';const r=recipeFromDraft(d);assert.equal(r.source.author,undefined);assert.match(r.source.note,/原文作者未填写/);
});
test('pasted recipe facts become a mixed meal and survive JSON snapshot restoration with source and unpriced ingredients',()=>{
 const parsed=parsePastedRecipe('莴笋炒肉\n作者：集成测试作者\n用料\n莴笋 0.6公斤\n猪瘦肉 400克\n盐 4克\n做法\n1. 清洗切配\n2. 按顺序炒熟');
 assert.ok(parsed);assert.equal(parsed.steps.length,2);
 const draft=fixture();draft.author=parsed.author!;draft.sourceTitle=parsed.title;draft.retrieval='pasted';draft.ingredients=parsed.ingredients.map(i=>parseIngredientQuantity(i.name,i.quantityText));
 const recipe=recipeFromDraft(draft,new Date('2026-11-14T00:00:00Z'));
 const plan=createPlanWithImports({request:'莴笋炒肉、番茄炒蛋、拍黄瓜',servings:3,budget:10000,pantry:['salt','oil'],burners:2,availableMinutes:120},[recipe],1234567890);
 assert.equal(plan.recipes.length,3);assert.ok(plan.recipeIds.includes('tomato-eggs'));assert.ok(plan.recipeIds.includes('cucumber-salad'));
 const unknownId=recipe.ingredients.find(i=>i.id.startsWith('external-'))!.id,line=plan.shopping.lines.find(i=>i.ingredientId===unknownId);
 assert.equal(line?.required,450);assert.equal(line?.unpriced,true);assert.deepEqual(line?.packs,[]);assert.deepEqual(plan.shopping.unpricedIngredientIds,[unknownId]);
 const frozen=JSON.parse(JSON.stringify({input:plan.input,recipes:plan.recipes,createdAt:plan.createdAt})),restored=createPlan(frozen.input,frozen.createdAt,frozen.recipes);
 assert.deepEqual(restored.requirements,plan.requirements);assert.deepEqual(restored.tasks,plan.tasks);assert.deepEqual(restored.shopping.unpricedIngredientIds,[unknownId]);
 const imported=restored.recipes.find(r=>r.id===recipe.id)!;assert.equal(imported.source.author,'集成测试作者');assert.equal(imported.source.references[0].url,'https://www.xiachufang.com/recipe/1234567/');assert.equal(imported.source.sourceTitle,'莴笋炒肉');assert.equal(imported.ingredientDefinitions?.[unknownId].name,'莴笋');
});
