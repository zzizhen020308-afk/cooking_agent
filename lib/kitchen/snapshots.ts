import {DISHES,INGREDIENTS,RECIPE_CATEGORIES,ingredientsFor,type Recipe,type Ingredient} from './catalog.ts';
import {RECIPE_SOURCES,howToCookSourceIdentity,type RecipeSource} from './sources.ts';

export type PlannedRecipe=Recipe&{source:RecipeSource};
const copy=<T>(value:T):T=>JSON.parse(JSON.stringify(value));
export const snapshotRecipe=(recipe:Recipe):PlannedRecipe=>copy({...recipe,source:(recipe as Partial<PlannedRecipe>).source||RECIPE_SOURCES[recipe.id]});
const text=(value:unknown,max=3000)=>typeof value==='string'&&value.length>0&&value.length<=max;
const id=(value:unknown)=>typeof value==='string'&&/^[a-z][a-z0-9-]{0,79}$/.test(value);
const stringList=(value:unknown,max=30)=>Array.isArray(value)&&value.length<=max&&value.every(x=>text(x));
export function isXiachufangRecipeUrl(raw:unknown):boolean{
 if(typeof raw!=='string'||raw.length>300)return false;
 try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&['www.xiachufang.com','m.xiachufang.com'].includes(u.hostname)&&/^\/recipe\/\d{1,20}\/?$/.test(u.pathname)&&!u.search&&!u.hash;}catch{return false;}
}
function checkDefinitions(raw:unknown):Record<string,Ingredient>{
 if(raw===undefined)return {};
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).length>40)throw new Error('导入食材定义有误。');
 for(const [key,value]of Object.entries(raw)){
  const d=value as Ingredient;
  if(!id(key)||!/^(external|import|online)-[a-z0-9-]+$/.test(key)||Object.hasOwn(INGREDIENTS,key)||!d||typeof d!=='object'||d.id!==key||!text(d.name,60)||!['g','ml','个'].includes(d.unit)||!['生鲜','调味'].includes(d.category)||!text(d.icon,16))throw new Error('导入食材名称或单位有误。');
 }
 return raw as Record<string,Ingredient>;
}
/** Validate complete recipe records before either import or browser-local restoration. */
export function validateRecipeSnapshots(raw:unknown,max=24):PlannedRecipe[]{
 if(!Array.isArray(raw)||raw.length>max)throw new Error('保存的菜谱格式有误。');
 for(const item of raw){
  if(!item||typeof item!=='object')throw new Error('保存的菜谱格式有误。');
  const r=item as PlannedRecipe,s=r.source,known=DISHES.some(d=>d.id===r.dishId);
  const definitions=checkDefinitions(r.ingredientDefinitions);
  if(!id(r.id)||!id(r.dishId)||(!known&&!/^(online|import)-[a-z0-9-]+$/.test(r.dishId))||!text(r.revision,40)||!text(r.variantName,80)||!text(r.name,80)||!stringList(r.aliases)||!r.aliases.length||r.aliases.some(a=>a.length>80)||!RECIPE_CATEGORIES.includes(r.category)||!text(r.tag,80)||!text(r.intro)||!text(r.color,40)||!/^#[0-9a-f]{6}$/i.test(r.color)||!text(r.image,40)||!/^[a-z-]+$/.test(r.image)||!stringList(r.tips))throw new Error('保存的菜谱信息有误，请重新选择做法。');
  if(known&&Object.keys(definitions).length)throw new Error('本地菜谱不能覆盖食材定义。');
  if(!Array.isArray(r.ingredients)||!r.ingredients.length||r.ingredients.length>40||new Set(r.ingredients.map(i=>i?.id)).size!==r.ingredients.length||r.ingredients.some(i=>!i||!(Object.hasOwn(INGREDIENTS,i.id)||Object.hasOwn(definitions,i.id))||!Number.isFinite(i.amount)||i.amount<=0||i.amount>10000))throw new Error('保存的食材用量有误，请重新安排菜单。');
  if(!Array.isArray(r.steps)||!r.steps.length||r.steps.length>20||r.steps.some(step=>!step||!text(step.title,160)||!text(step.detail)||!Number.isInteger(step.minutes)||step.minutes<1||step.minutes>180||(step.timingBasis!==undefined&&!['source','estimated'].includes(step.timingBasis))||(step.equipment!==undefined&&!['汤锅','炖锅','炒锅','蒸锅'].includes(step.equipment))||(step.waitKind!==undefined&&!['炖煮','蒸制','泡发','腌制'].includes(step.waitKind))||(step.burner!==undefined&&typeof step.burner!=='boolean')||(step.passive!==undefined&&typeof step.passive!=='boolean')||(step.burner&&!step.equipment)))throw new Error('保存的烹饪步骤有误，请重新安排菜单。');
  if(!s||(s.snapshot!==undefined&&(!text(s.snapshot,40)||!/^[a-f0-9]{40}$/.test(s.snapshot)))||(s.platform!==undefined&&!['HowToCook','下厨房'].includes(s.platform))||(s.author!==undefined&&!text(s.author,200))||(s.sourceTitle!==undefined&&!text(s.sourceTitle,200))||(s.license!==undefined&&(s.license!=='Unlicense'||s.platform!=='HowToCook'))||(s.retrievedAt!==undefined&&(!text(s.retrievedAt,40)||!/^\d{4}-\d{2}-\d{2}T/.test(s.retrievedAt)||!Number.isFinite(Date.parse(s.retrievedAt))))||!['edited','original'].includes(s.kind)||!text(s.label)||!text(s.note)||!text(s.checkedAt,10)||!/^\d{4}-\d{2}-\d{2}$/.test(s.checkedAt)||!Array.isArray(s.references)||s.references.length>10||s.references.some(e=>!e||!text(e.label)||(e.note!==undefined&&!text(e.note))||(e.url!==undefined&&(!text(e.url)||!/^https:\/\//.test(e.url)))))throw new Error('保存的菜谱来源有误，请重新安排菜单。');
  if(!known){
   if(s.platform==='下厨房'){
    if(!s.references.some(e=>isXiachufangRecipeUrl(e.url))||s.references.some(e=>e.url!==undefined&&!isXiachufangRecipeUrl(e.url)))throw new Error('导入菜谱需要有效的下厨房原页来源。');
   }else if(s.platform==='HowToCook'){
    const urls=s.references.flatMap(e=>e.url?[e.url]:[]),references=urls.map(e=>howToCookSourceIdentity(e));
    const licenseUrl=`https://github.com/Anduin2017/HowToCook/blob/${s.snapshot}/LICENSE`;
    if(!references.some(e=>e?.snapshot===s.snapshot)||urls.some((url,i)=>url!==licenseUrl&&references[i]?.snapshot!==s.snapshot)||s.license!=='Unlicense'||!s.retrievedAt)throw new Error('导入 HowToCook 菜谱需要固定版本原页、许可与读取时间。');
   }else throw new Error('导入菜谱需要有效的已支持来源。');
  }
 }
 if(new Set(raw.map(r=>r.dishId)).size!==raw.length||new Set(raw.map(r=>r.id)).size!==raw.length)throw new Error('这餐的做法与菜名不对应。');
 ingredientsFor(raw);
 return copy(raw);
}
/** Validate browser-local data before rebuilding a meal from its chosen recipe revisions. */
export function readRecipeSnapshots(raw:unknown,dishIds:string[]):PlannedRecipe[]{
 if(!Array.isArray(raw)||raw.length!==dishIds.length)throw new Error('这餐保存的做法不完整，请重新安排菜单。');
 const recipes=validateRecipeSnapshots(raw,4);
 if(recipes.some(r=>!dishIds.includes(r.dishId)))throw new Error('这餐的做法与菜名不对应。');
 return dishIds.map(dishId=>recipes.find(r=>r.dishId===dishId)!);
}
