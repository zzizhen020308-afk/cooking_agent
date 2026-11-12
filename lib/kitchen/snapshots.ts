import {DISHES,INGREDIENTS,RECIPE_CATEGORIES,type Recipe} from './catalog.ts';
import {RECIPE_SOURCES,type RecipeSource} from './sources.ts';

export type PlannedRecipe=Recipe&{source:RecipeSource};
const copy=<T>(value:T):T=>JSON.parse(JSON.stringify(value));
export const snapshotRecipe=(recipe:Recipe):PlannedRecipe=>copy({...recipe,source:RECIPE_SOURCES[recipe.id]});
const text=(value:unknown,max=3000)=>typeof value==='string'&&value.length>0&&value.length<=max;
const id=(value:unknown)=>typeof value==='string'&&/^[a-z][a-z0-9-]{0,79}$/.test(value);
const stringList=(value:unknown,max=30)=>Array.isArray(value)&&value.length<=max&&value.every(x=>text(x));

/** Validate browser-local data before rebuilding a meal from its chosen recipe revisions. */
export function readRecipeSnapshots(raw:unknown,dishIds:string[]):PlannedRecipe[]{
 if(!Array.isArray(raw)||raw.length!==dishIds.length)throw new Error('这餐保存的做法不完整，请重新安排菜单。');
 for(const item of raw){
  if(!item||typeof item!=='object')throw new Error('保存的菜谱格式有误。');
  const r=item as PlannedRecipe,s=r.source;
  if(!id(r.id)||!dishIds.includes(r.dishId)||!DISHES.some(d=>d.id===r.dishId)||!text(r.revision,40)||!text(r.variantName,80)||!text(r.name,80)||!stringList(r.aliases)||!RECIPE_CATEGORIES.includes(r.category)||!text(r.tag,80)||!text(r.intro)||!text(r.color,40)||!/^#[0-9a-f]{6}$/i.test(r.color)||!text(r.image,40)||!/^[a-z-]+$/.test(r.image)||!stringList(r.tips))throw new Error('保存的菜谱信息有误，请重新选择做法。');
  if(!Array.isArray(r.ingredients)||!r.ingredients.length||r.ingredients.length>40||new Set(r.ingredients.map(i=>i.id)).size!==r.ingredients.length||r.ingredients.some(i=>!i||!INGREDIENTS[i.id]||!Number.isFinite(i.amount)||i.amount<=0||i.amount>10000))throw new Error('保存的食材用量有误，请重新安排菜单。');
  if(!Array.isArray(r.steps)||!r.steps.length||r.steps.length>20||r.steps.some(step=>!step||!text(step.title,160)||!text(step.detail)||!Number.isInteger(step.minutes)||step.minutes<1||step.minutes>180||(step.equipment!==undefined&&!['汤锅','炖锅','炒锅','蒸锅'].includes(step.equipment))||(step.waitKind!==undefined&&!['炖煮','蒸制','泡发','腌制'].includes(step.waitKind))||(step.burner!==undefined&&typeof step.burner!=='boolean')||(step.passive!==undefined&&typeof step.passive!=='boolean')||(step.burner&&!step.equipment)))throw new Error('保存的烹饪步骤有误，请重新安排菜单。');
  if(!s||(s.snapshot!==undefined&&(!text(s.snapshot,40)||!/^[a-f0-9]{40}$/.test(s.snapshot)))||(s.platform!==undefined&&!['HowToCook','下厨房'].includes(s.platform))||(s.author!==undefined&&!text(s.author,200))||(s.sourceTitle!==undefined&&!text(s.sourceTitle,200))||!['edited','original'].includes(s.kind)||!text(s.label)||!text(s.note)||!text(s.checkedAt,10)||!/^\d{4}-\d{2}-\d{2}$/.test(s.checkedAt)||!Array.isArray(s.references)||s.references.length>10||s.references.some(e=>!e||!text(e.label)||(e.note!==undefined&&!text(e.note))||(e.url!==undefined&&(!text(e.url)||!/^https:\/\//.test(e.url)))))throw new Error('保存的菜谱来源有误，请重新安排菜单。');
 }
 if(new Set(raw.map(r=>r.dishId)).size!==dishIds.length||new Set(raw.map(r=>r.id)).size!==dishIds.length)throw new Error('这餐的做法与菜名不对应。');
 return copy(dishIds.map(dishId=>raw.find(r=>r.dishId===dishId)!));
}
