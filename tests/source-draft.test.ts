import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceDraftFromCandidate,type SourceRecipeCandidate} from '../lib/kitchen/source-draft.ts';
import {recipeFromDraft} from '../lib/kitchen/import-recipe.ts';
import {createPlanWithImports,createPlan} from '../lib/kitchen/engine.ts';

const candidate=():SourceRecipeCandidate=>({id:'online-hoc-example',title:'蚂蚁上树',url:'https://github.com/Anduin2017/HowToCook/blob/308cc8b7dab1da84b20e7fafdf836a715437f582/dishes/meat_dish/%E8%9A%82%E8%9A%81%E4%B8%8A%E6%A0%91.md',author:'HowToCook 社区贡献者',platform:'HowToCook',license:'Unlicense',snapshot:'308cc8b7dab1da84b20e7fafdf836a715437f582',retrievedAt:'2026-11-15T01:00:00Z',retrieval:'direct',contentState:'complete',baseServings:2,ingredients:[{name:'红薯粉丝（干重）',quantityText:'80g'},{name:'猪肉末',quantityText:'150g'},{name:'郫县豆瓣酱',quantityText:'15g'},{name:'生抽',quantityText:'10ml'},{name:'老抽',quantityText:'5ml'},{name:'食用油',quantityText:'10ml'},{name:'蒜末',quantityText:'10g'},{name:'姜末',quantityText:'5g'},{name:'清水',quantityText:'300ml'}],steps:['红薯粉丝提前泡软，泡水时间为20分钟','加入肉末炒至熟透'],plannedSteps:[{title:'泡软粉丝',detail:'红薯粉丝提前泡软，泡水时间为20分钟',minutes:20,passive:true,waitKind:'泡发',burner:false,timingBasis:'source'},{title:'炒肉末',detail:'加入肉末炒至熟透',minutes:5,burner:true,equipment:'炒锅',timingBasis:'estimated'}],notes:['可加入少量小葱末。']});
test('complete licensed source becomes a ready draft with facts and explicit estimated timing',()=>{
 const c=candidate();c.warnings=['1 个步骤的时间为掌勺排程估计，原谱未给出明确时长。'];const r=sourceDraftFromCandidate(c);
 assert.deepEqual(r.issues,[]);assert.equal(r.draft.steps[0].detail,c.steps[0]);assert.equal(r.draft.steps[0].timingBasis,'source');assert.equal(r.draft.steps[1].timingBasis,'estimated');assert.equal(r.draft.sourceMode,'source');assert.equal(r.draft.baseServings,'2');assert.equal(r.draft.servingsBasis,'source');assert.equal(r.draft.ingredients.length,9);assert.equal(r.warnings.filter(w=>w.includes('排程估计')).length,1);assert.ok(r.warnings.some(w=>w.includes('可选配料')));
 const recipe=recipeFromDraft({...r.draft,confirmed:true});assert.equal(recipe.source.platform,'HowToCook');assert.equal(recipe.source.license,'Unlicense');assert.equal(recipe.source.snapshot,c.snapshot);assert.match(recipe.source.note,/排程估计/);
 const plan=createPlanWithImports({request:'蚂蚁上树、番茄炒蛋',servings:3,budget:10000,pantry:['salt','oil','soy','darksoy'],burners:2},[recipe]);
 assert.equal(plan.recipes.length,2);assert.equal(plan.requirements.find(i=>recipe.ingredientDefinitions?.[i.id]?.name.includes('红薯粉丝'))?.amount,120);
 const restored=createPlan(plan.input,plan.createdAt,JSON.parse(JSON.stringify(plan.recipes)));assert.deepEqual(restored.tasks,plan.tasks);assert.equal(restored.recipes[0].source.references[0].url,c.url);
});
test('missing portions use an explicit assumption and do not claim an upstream fact',()=>{
 const c=candidate();delete c.baseServings;const r=sourceDraftFromCandidate(c);assert.equal(r.draft.baseServings,'2');assert.equal(r.draft.servingsBasis,'assumed');assert.ok(r.warnings.some(w=>w.includes('原谱人数未注明')));const recipe=recipeFromDraft({...r.draft,confirmed:true});assert.match(recipe.source.note,/人数假设/);
});
test('uncertain quantities and unsupported heating block immediate use instead of inventing facts',()=>{
 const c=candidate();c.ingredients[0].quantityText='适量';const r=sourceDraftFromCandidate(c);assert.equal(r.draft.ingredients[0].amount,'');assert.ok(r.issues.some(i=>i.includes('需要补齐')));
 c.steps[0]='放入烤箱烘烤';assert.ok(sourceDraftFromCandidate(c).issues.some(i=>i.includes('特殊加热设备')));
});
test('unlicensed or incomplete candidates cannot use the open-source automatic path',()=>{
 const c=candidate();c.platform='下厨房';c.url='https://www.xiachufang.com/recipe/123456/';delete c.license;const r=sourceDraftFromCandidate(c);assert.equal(r.draft.sourceMode,'manual');assert.equal(r.draft.steps[0].detail,'');assert.ok(r.issues.length);
 const missing=candidate();missing.plannedSteps=[];assert.ok(sourceDraftFromCandidate(missing).issues.some(i=>i.includes('数量不一致')));
 const changed=candidate();changed.plannedSteps![0].detail='另一份做法';assert.ok(sourceDraftFromCandidate(changed).issues.some(i=>i.includes('内容或数量不一致')));
});
test('explicitly chosen similar recipes keep their actual source name while resolving the requested menu',()=>{
 const c=candidate();c.matchType='similar';c.matchNote='相近做法，原谱另含郫县豆瓣酱，请核对。';
 const prepared=sourceDraftFromCandidate(c,'粉丝烧肉');
 assert.equal(prepared.draft.title,'蚂蚁上树');assert.equal(prepared.draft.sourceTitle,'蚂蚁上树');
 const recipe=recipeFromDraft({...prepared.draft,confirmed:true});
 assert.equal(recipe.name,'蚂蚁上树');assert.ok(recipe.aliases.includes('粉丝烧肉'));assert.match(recipe.source.note,/相近做法/);
 const plan=createPlanWithImports({request:'粉丝烧肉、番茄炒蛋',servings:2,budget:10000,pantry:[],burners:2},[recipe]);
 assert.equal(plan.recipes[0].name,'蚂蚁上树');assert.equal(plan.recipes[0].source.sourceTitle,'蚂蚁上树');
});
