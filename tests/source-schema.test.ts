import test from 'node:test';
import assert from 'node:assert/strict';
import {howToCookSourceIdentity,normalizeHowToCookRecipeUrl} from '../lib/kitchen/sources.ts';
import {recipeFromDraft,recipeSourceUrl,type DraftRecipe} from '../lib/kitchen/import-recipe.ts';
import {validateRecipeSnapshots} from '../lib/kitchen/snapshots.ts';
import {createPlan,createPlanWithImports} from '../lib/kitchen/engine.ts';

const sha='308cc8b7dab1da84b20e7fafdf836a715437f582';
const raw=`https://github.com/Anduin2017/HowToCook/blob/${sha}/dishes/meat_dish/蚂蚁上树.md`;
const fixture=():DraftRecipe=>({title:'蚂蚁上树',sourceTitle:'蚂蚁上树',url:raw,author:'HowToCook contributors',sourceMode:'source',servingsBasis:'source',retrieval:'direct',retrievedAt:'2026-11-15T00:00:00.000Z',baseServings:'2',category:'荤菜',confirmed:true,ingredients:[{name:'猪肉末',amount:'100',unit:'g',category:'生鲜'},{name:'粉丝',amount:'100',unit:'g',category:'生鲜'}],steps:[{title:'准备食材',detail:'按原文处理本餐用料。',minutes:'5',equipment:'none',mode:'active',timingBasis:'estimated'},{title:'依原谱烹饪',detail:'按原文顺序完成烹饪并检查实际状态。',minutes:'4',equipment:'炒锅',mode:'active',timingBasis:'source'}]});

test('HowToCook recipe URLs pin an immutable upstream Markdown path',()=>{
 const normalized=normalizeHowToCookRecipeUrl(raw)!;assert.match(normalized,/%E8/);assert.equal(recipeSourceUrl(raw),normalized);
 assert.deepEqual(howToCookSourceIdentity(raw),{snapshot:sha,path:'dishes/meat_dish/蚂蚁上树.md',id:howToCookSourceIdentity(normalized)!.id});
 assert.equal(howToCookSourceIdentity(raw.replace(sha,'a'.repeat(40)))!.id,howToCookSourceIdentity(raw)!.id);
 for(const value of [raw.replace('/'+sha+'/', '/master/'),raw.replace('github.com','raw.githubusercontent.com'),raw.replace('github.com','github.com.evil.test'),raw+'?raw=1',raw+'#section',raw.replace('dishes/meat_dish','dishes/../secret'),raw.replace('dishes/meat_dish','dishes/%252e%252e/secret'),raw.replace('dishes/meat_dish','dishes%2fmeat_dish'),raw.replace('https:','http:'),raw.replace('/蚂蚁上树.md','/../../LICENSE'),raw.replace('https://','https://name@'),raw.replace('/'+sha+'/', '/'+sha.toUpperCase()+'/')])assert.equal(normalizeHowToCookRecipeUrl(value),null,value);
 assert.equal(normalizeHowToCookRecipeUrl(`https://github.com/Anduin2017/HowToCook/blob/${sha}/LICENSE`),null);
});
test('source-based drafts retain license, revision, timing provenance and original instructions',()=>{
 const d=fixture(),r=recipeFromDraft(d,new Date('2026-11-15T01:00:00.000Z'));
 assert.ok(r.id.startsWith('online-hoc-'));assert.equal(r.source.platform,'HowToCook');assert.equal(r.source.snapshot,sha);assert.equal(r.source.license,'Unlicense');assert.equal(r.source.retrievedAt,d.retrievedAt);assert.equal(r.source.references.length,2);assert.match(r.source.references[1].url!,/\/LICENSE$/);
 assert.equal(r.steps[0].detail,d.steps[0].detail);assert.equal(r.steps[0].timingBasis,'estimated');assert.match(r.source.note,/排程估计/);assert.doesNotMatch(r.source.note,/用户已核对用量并自行简写/);
 assert.equal(validateRecipeSnapshots([r])[0].source.license,'Unlicense');
 const changed=fixture();changed.steps[0].timingBasis='source';assert.notEqual(recipeFromDraft(changed).revision,r.revision);
});
test('assumed servings stay visible and source-mode steps cannot hide missing timing evidence',()=>{
 const d=fixture();d.servingsBasis='assumed';const r=recipeFromDraft(d);assert.match(r.source.note,/人数假设，不是原谱事实/);assert.match(r.tips[0],/暂定/);
 d.servingsBasis='user';d.baseServings='4';const adjusted=recipeFromDraft(d);assert.match(adjusted.source.note,/用户将所列用量的换算基准调整为 4 人份，并非原谱声明/);assert.doesNotMatch(adjusted.source.note,/原谱未明确适用人数/);assert.match(adjusted.tips[0],/用户指定/);assert.notEqual(adjusted.revision,r.revision);
 delete d.steps[0].timingBasis;assert.throws(()=>recipeFromDraft(d),/注明时间/);
});
test('external HowToCook snapshots reject missing or mismatched provenance',()=>{
 const r=recipeFromDraft(fixture());
 for(const alter of [(x:typeof r)=>delete x.source.license,(x:typeof r)=>delete x.source.retrievedAt,(x:typeof r)=>x.source.retrievedAt='not a date',(x:typeof r)=>x.source.snapshot='b'.repeat(40),(x:typeof r)=>x.source.references[0].url='https://github.com/other/repo/blob/'+sha+'/dishes/x.md',(x:typeof r)=>x.source.references[1].url='https://github.com/Anduin2017/HowToCook/blob/'+'b'.repeat(40)+'/LICENSE',(x:typeof r)=>(x.steps[0] as {timingBasis:string}).timingBasis='unknown']){const copy=JSON.parse(JSON.stringify(r));alter(copy);assert.throws(()=>validateRecipeSnapshots([copy]));}
});
test('HowToCook source recipes join local meals and restore provenance without global registration',()=>{
 const r=recipeFromDraft(fixture()),plan=createPlanWithImports({request:'蚂蚁上树、番茄炒蛋',servings:3,budget:10000,pantry:['salt','oil'],burners:2,availableMinutes:120},[r]);
 const restored=createPlan(plan.input,plan.createdAt,JSON.parse(JSON.stringify(plan.recipes)));
 assert.deepEqual(restored.requirements,plan.requirements);assert.deepEqual(restored.tasks,plan.tasks);assert.equal(restored.recipes[0].source.license,'Unlicense');assert.equal(restored.recipes[0].steps[0].timingBasis,'estimated');
});
