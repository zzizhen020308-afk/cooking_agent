import {INGREDIENTS,RECIPE_CATEGORIES,type Ingredient,type RecipeCategory,type RecipeStep} from './catalog.ts';
import type {PlannedRecipe} from './snapshots.ts';
import {normalizeHowToCookRecipeUrl,howToCookSourceIdentity} from './sources.ts';

export type DraftIngredient={name:string;amount:string;unit:Ingredient['unit'];category:Ingredient['category'];originalQuantity?:string};
export type DraftStep={title:string;detail:string;minutes:string;equipment:NonNullable<RecipeStep['equipment']>|'none';mode:'active'|'炖煮'|'蒸制'|'泡发'|'腌制';timingBasis?:'source'|'estimated'};
export type DraftRecipe={title:string;url:string;author:string;baseServings:string;category:RecipeCategory;ingredients:DraftIngredient[];steps:DraftStep[];sourceTitle?:string;retrievedAt?:string;retrieval?:'direct'|'search-index'|'pasted';confirmed:boolean;sourceMode?:'source'|'manual';servingsBasis?:'source'|'assumed'|'user'};

export function xiachufangRecipeUrl(raw:string):string|null{
 try{const u=new URL(raw.trim());if(u.protocol!=='https:'||!['www.xiachufang.com','m.xiachufang.com'].includes(u.hostname)||u.port||u.username||u.password||!/^\/recipe\/\d{1,15}\/?$/.test(u.pathname))return null;return `https://www.xiachufang.com/recipe/${u.pathname.split('/')[2]}/`;}catch{return null;}
}
export function recipeSourceUrl(raw:string):string|null{return normalizeHowToCookRecipeUrl(raw)||xiachufangRecipeUrl(raw);}
const normalized=(value:string)=>value.normalize('NFKC').trim();
/** Stable IDs are scoped by exact normalized ingredient name AND unit. Never guess aliases. */
function fingerprint(value:string){let a=2166136261,b=2246822519;for(const ch of value){const code=ch.codePointAt(0)!;a=Math.imul(a^code,16777619);b=Math.imul(b^code,3266489917);}return (a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0');}
export function parseIngredientQuantity(name:string,quantity:string):DraftIngredient{
 const text=normalized(quantity),n='(?:\\d+(?:\\.\\d+)?|\\d+\\/\\d+)';
 const match=text.match(new RegExp(`^(${n})\\s*(千克|公斤|kg|克|g|毫升|ml|升|L|斤|个)$`,'i'));
 let amount='',unit:Ingredient['unit']='g';
 if(match){const value=match[1].includes('/')?Number(match[1].split('/')[0])/Number(match[1].split('/')[1]):Number(match[1]);const u=match[2].toLowerCase();unit=['ml','毫升','升','l'].includes(u)?'ml':u==='个'?'个':'g';const scale=['千克','公斤','kg','升','l'].includes(u)?1000:u==='斤'?500:1;if(Number.isFinite(value)&&value>0)amount=String(Number((value*scale).toFixed(4)));}
 const cleanName=normalized(name);const known=Object.values(INGREDIENTS).find(i=>i.name===cleanName);
 return {name:cleanName,amount,unit,category:known?.category||'生鲜',originalQuantity:text};
}
export function parseIngredientLines(raw:string):DraftIngredient[]{
 return raw.split(/\r?\n/).map(normalized).filter(Boolean).slice(0,41).map(line=>{
  const separated=line.match(/^(.+?)(?:\s*[:：]\s*|\s+)([^:：]+)$/);if(separated)return parseIngredientQuantity(separated[1],separated[2]);
  const joined=line.match(/^(.+?)(\d+(?:\.\d+)?\s*(?:千克|公斤|kg|克|g|毫升|ml|升|L|斤|个))$/i);return joined?parseIngredientQuantity(joined[1],joined[2]):parseIngredientQuantity(line,'');
 });
}
function required(value:string,label:string,max:number){const s=normalized(value);if(!s||s.length>max)throw new Error(`请填写${label}（不超过 ${max} 字）。`);return s;}
export function recipeFromDraft(draft:DraftRecipe,now=new Date()):PlannedRecipe{
 if(!draft.confirmed)throw new Error('请先核对原菜谱、用量、步骤与时间，再确认导入。');
 const hoc=howToCookSourceIdentity(draft.url),url=recipeSourceUrl(draft.url);if(!url)throw new Error('请填写已支持来源的原菜谱 HTTPS 链接：下厨房原页，或 HowToCook 固定版本的 Markdown 菜谱。');
 if(draft.sourceMode!==undefined&&!['source','manual'].includes(draft.sourceMode))throw new Error('菜谱整理方式有误。');
 if(draft.servingsBasis!==undefined&&!['source','assumed','user'].includes(draft.servingsBasis))throw new Error('菜谱人数依据有误。');
 if(draft.sourceMode==='source'&&!hoc)throw new Error('当前只有许可明确的 HowToCook 原文可自动保留完整步骤。');
 const title=required(draft.title,'菜名',60),author=normalized(draft.author)||(hoc?'HowToCook contributors':'');if(author.length>200)throw new Error('作者名称过长。');
 const servings=Number(draft.baseServings);if(!Number.isInteger(servings)||servings<1||servings>12)throw new Error('请核对原菜谱适用人数，支持 1–12 人。');
 if(!RECIPE_CATEGORIES.includes(draft.category))throw new Error('请选择菜品分类。');
 if(!draft.ingredients.length||draft.ingredients.length>40)throw new Error('请填写 1–40 项食材。');
 const definitions:Record<string,Ingredient>={},sums=new Map<string,number>();
 for(const line of draft.ingredients){const name=required(line.name,'食材名称',40),amount=Number(line.amount);if(!line.amount.trim()||!Number.isFinite(amount)||amount<=0||amount>10000)throw new Error(`请核对“${name}”的数量，不能以“适量”代替。`);if(!['g','ml','个'].includes(line.unit)||!['生鲜','调味'].includes(line.category))throw new Error(`请核对“${name}”的单位和分类。`);
  const known=Object.values(INGREDIENTS).find(i=>i.name===name&&i.unit===line.unit),id=known?.id||`external-${fingerprint(name+'\0'+line.unit)}`;
  if(!known){const old=definitions[id];if(old&&(old.name!==name||old.unit!==line.unit))throw new Error('食材标识冲突，请更换名称后重试。');definitions[id]={id,name,unit:line.unit,category:line.category,icon:line.category==='调味'?'◦':'🥬'};}
  sums.set(id,(sums.get(id)||0)+amount*2/servings);
 }
 const ingredients=[...sums].map(([id,amount])=>({id,amount:Number(amount.toFixed(4))}));if(ingredients.some(i=>i.amount<=0||i.amount>10000))throw new Error('换算为 2 人份后的食材数量超出范围，请核对。');
 if(!draft.steps.length||draft.steps.length>20)throw new Error('请填写 1–20 个烹饪步骤。');
 const steps:RecipeStep[]=draft.steps.map((step,index)=>{
  const title=required(step.title,`第 ${index+1} 步名称`,100),detail=required(step.detail,`第 ${index+1} 步操作简写`,1200),minutes=Number(step.minutes);
  if(!step.minutes.trim()||!Number.isInteger(minutes)||minutes<1||minutes>180)throw new Error(`请核对第 ${index+1} 步的分钟数，支持 1–180 分钟。`);
  if(step.timingBasis!==undefined&&!['source','estimated'].includes(step.timingBasis))throw new Error('步骤时间依据有误。');
  if(draft.sourceMode==='source'&&step.timingBasis===undefined)throw new Error('原谱导入的每一步需要注明时间来自原文还是排程估计。');
  const equipment=step.equipment==='none'?undefined:step.equipment;if(equipment&&!['汤锅','炖锅','炒锅','蒸锅'].includes(equipment))throw new Error('请选择支持的锅具。');
  if(!['active','炖煮','蒸制','泡发','腌制'].includes(step.mode))throw new Error('请核对等待方式。');
  const cold=step.mode==='泡发'||step.mode==='腌制';if(cold&&equipment)throw new Error(`第 ${index+1} 步的冷藏等待应选择“不加热”。`);if(['炖煮','蒸制'].includes(step.mode)&&!equipment)throw new Error(`第 ${index+1} 步需要选择实际加热锅具。`);
  return {title,detail,minutes,...(step.timingBasis?{timingBasis:step.timingBasis}:{}),...(equipment?{equipment,burner:true}:{}),...(step.mode!=='active'?{passive:true,waitKind:step.mode}:{}),...(cold?{burner:false}: {})};
 });
 const sourceTitle=required(draft.sourceTitle||title,'原菜谱标题',200);
 const id=hoc?.id||'online-'+url.split('/')[4],revision='user-'+fingerprint(JSON.stringify({title,servings,ingredients,definitions,steps,category:draft.category,sourceTitle,author,url,sourceMode:draft.sourceMode,servingsBasis:draft.servingsBasis}));
 const retrieved=draft.retrievedAt&&Number.isFinite(Date.parse(draft.retrievedAt))?draft.retrievedAt:null;
 const platform=hoc?'HowToCook':'下厨房',sourceMode=draft.sourceMode==='source',estimated=steps.filter(s=>s.timingBasis==='estimated').length;
 const servingsNote=draft.servingsBasis==='assumed'?`原谱未明确适用人数；本次将所列用量暂按 ${servings} 人份作为换算基准（人数假设，不是原谱事实）`:draft.servingsBasis==='user'?`用户将所列用量的换算基准调整为 ${servings} 人份，并非原谱声明`:`原谱按 ${servings} 人份录入`;
 const timingNote=sourceMode?`保留许可允许使用的原文操作；${estimated?`${estimated} 步的分钟数为掌勺排程估计，原谱未明确其耗时`:'步骤时间采用已读取的原文时间依据'}，实际火候和熟度仍需现场检查`:'用户已核对用量并自行简写步骤、填写参考时长';
 return {id,dishId:id,name:title,aliases:[title],variantName:sourceMode?'原谱导入版':'本机核对版',revision,category:draft.category,tag:platform+'参考',intro:sourceMode?'读取完整来源用料与操作后生成，参考时间用于安排顺序。':`根据所选${platform}菜谱，由你核对食材、步骤和参考时间后整理。`,image:'soup',color:'#eee4d0',ingredients,ingredientDefinitions:definitions,steps,tips:[`食材按${draft.servingsBasis==='assumed'?'暂定的':draft.servingsBasis==='user'?'用户指定的':'原谱'}人数换算；步骤文字中的具体用量不会自动改写，请以本餐食材清单为准。`,sourceMode?'排程估计不代表原谱声明的时间，必须结合实际火候、食材状态和原菜谱检查。':'计时为你核对的参考值，必须结合实际火候、食材状态和原菜谱检查。'],source:{kind:'edited',platform,label:sourceMode?'原谱读取 · HowToCook':`本机整理 · 参考${platform}`,checkedAt:now.toISOString().slice(0,10),...(author?{author}:{}),sourceTitle,...(hoc?{snapshot:hoc.snapshot,license:'Unlicense' as const,retrievedAt:retrieved||now.toISOString()}:retrieved?{retrievedAt:retrieved}:{}),note:`${draft.retrieval==='direct'?'公开页面读取':draft.retrieval==='search-index'?'搜索索引读取':'用户粘贴或手动录入'}${retrieved?'，读取时间 '+retrieved:''}；${servingsNote}，${timingNote}。来源内容与实际熟度未由掌勺独立核验；原文作者${author?'为 '+author:'未填写'}。仅在本机保存，不作为共享菜谱库条目。`,references:[{label:sourceTitle+` · ${platform}原菜谱`,url},...(hoc?[{label:'本次来源许可 · Unlicense',url:`https://github.com/Anduin2017/HowToCook/blob/${hoc.snapshot}/LICENSE`}]:[])]}};
}
