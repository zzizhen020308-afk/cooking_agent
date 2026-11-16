import type {RecipeStep,RecipeCategory} from './catalog.ts';
import {parseIngredientQuantity,recipeSourceUrl,type DraftRecipe,type DraftStep} from './import-recipe.ts';
import {normalizeHowToCookRecipeUrl} from './sources.ts';

export type SourceRecipeCandidate={
 id:string;title:string;url:string;author?:string;ingredients:{name:string;quantityText:string}[];steps:string[];
 retrievedAt:string;servingsText?:string;retrieval:'direct'|'search-index'|'pasted';
 contentState?:'link-only'|'partial'|'complete';platform?:'HowToCook'|'下厨房';license?:'Unlicense';snapshot?:string;
 baseServings?:number;plannedSteps?:RecipeStep[];warnings?:string[];blockingIssues?:string[];notes?:string[];
};

function categoryFor(candidate:SourceRecipeCandidate):RecipeCategory{
 const path=decodeURIComponent(candidate.url);
 if(path.includes('/soup/'))return '汤羹';
 if(path.includes('/staple/'))return '主食';
 if(path.includes('/aquatic/'))return '水产';
 if(path.includes('/vegetable_dish/'))return '蔬菜';
 if(path.includes('/salad/'))return '凉菜';
 return /蛋|豆腐/.test(candidate.title)?'蛋豆':'荤菜';
}
function draftStep(step:RecipeStep,index:number):DraftStep{
 return {title:step.title||`第 ${index+1} 步`,detail:step.detail,minutes:String(step.minutes),equipment:step.burner?step.equipment||'none':'none',mode:step.passive?(step.waitKind||'炖煮'):'active',timingBasis:step.timingBasis};
}
/** Keep factual source quantities and text; estimates are explicit planning metadata. */
export function sourceDraftFromCandidate(candidate:SourceRecipeCandidate,requestedTitle?:string):{draft:DraftRecipe;issues:string[];warnings:string[]}{
 const permitted=candidate.platform==='HowToCook'&&candidate.license==='Unlicense'&&Boolean(normalizeHowToCookRecipeUrl(candidate.url));
 const issues=[...(candidate.blockingIssues||[])],warnings=[...(candidate.warnings||[]).filter(w=>!/排程估计|原谱.*人数|未注明.*人数/.test(w))];
 const ingredients=candidate.ingredients.map(i=>parseIngredientQuantity(i.name,i.quantityText));
 if(!ingredients.length)issues.push('没有取得完整用料，不能直接使用。');
 if(ingredients.length>40)issues.push('食材超过当前支持的 40 项。');
 for(const item of ingredients)if(!item.amount)issues.push(`“${item.name}”的原文用量“${item.originalQuantity||'未注明'}”需要补齐，不能自动换算。`);
 const planned=candidate.plannedSteps||[];
 if(!permitted)issues.push('此来源需要手动整理和核对步骤，不能直接保留全文生成计划。');
 if(!candidate.steps.length||candidate.steps.length>20)issues.push('缺少操作步骤，或步骤超过当前支持的 20 个。');
 if(permitted&&(planned.length!==candidate.steps.length||planned.some((step,index)=>step.detail!==candidate.steps[index])))issues.push('原谱步骤与排程步骤内容或数量不一致，需要核对。');
 if(/烤箱|微波炉|空气炸锅|高压锅|电压力锅|压力锅|电饭煲/.test(candidate.steps.join(' ')))issues.push('当前排程暂不支持这份做法使用的特殊加热设备，请另选做法。');
 if(planned.some(s=>!Number.isInteger(s.minutes)||s.minutes<1||s.minutes>180||!['source','estimated'].includes(s.timingBasis||'')||(s.burner&&!s.equipment)))issues.push('有步骤的参考时间或锅具尚未确定。');
 const knownServings=typeof candidate.baseServings==='number'&&Number.isInteger(candidate.baseServings)&&candidate.baseServings>=1&&candidate.baseServings<=12;
 const servings=knownServings?candidate.baseServings!:2;
 if(!knownServings)warnings.push('原谱人数未注明，先按 2 人基准估算，可在“修改用量与步骤”中调整；这不是原谱声明的人数。');
 const estimated=planned.filter(s=>s.timingBasis==='estimated').length;
 if(estimated)warnings.push(`${estimated} 步的耗时为排程估计，原谱没有明确分钟数；计时结束仍需按实际状态检查。`);
 if(candidate.steps.some(s=>/可选|可撒|可加入|可根据/.test(s))||candidate.notes?.some(s=>/可选|可撒|可加入/.test(s)))warnings.push('可选配料未计入定量清单；想添加时请修改用量补齐。');
 const draft:DraftRecipe={title:(requestedTitle?.trim()||candidate.title).slice(0,60),url:recipeSourceUrl(candidate.url)||'',author:candidate.author||'',sourceTitle:candidate.title,retrievedAt:candidate.retrievedAt,retrieval:candidate.retrieval,baseServings:String(servings),servingsBasis:knownServings?'source':'assumed',category:categoryFor(candidate),ingredients,steps:permitted?planned.map(draftStep):candidate.steps.map((_,i)=>({title:`第 ${i+1} 步`,detail:'',minutes:'',equipment:'none',mode:'active'})),sourceMode:permitted?'source':'manual',confirmed:false};
 return {draft,issues:[...new Set(issues)],warnings:[...new Set(warnings)]};
}
