import {DISHES,RECIPES,INGREDIENTS,referencePacks,equipmentFor,stepDetailFor,recipeLabel} from './catalog.ts';
import {snapshotRecipe,readRecipeSnapshots,type PlannedRecipe} from './snapshots.ts';
import type {Recipe,RecipeStep,Requirement,ReferencePack} from './catalog.ts';
export const money=(fen:number)=>(fen/100).toFixed(2);
export type MealInput={request:string;servings:number;budget:number;pantry:string[];burners?:1|2;availableMinutes?:number;recipeChoices?:Record<string,string>};
export type ShoppingLine={ingredientId:string;required:number;purchased:number;referenceCost:number;low:number;high:number;packs:{pack:ReferencePack;count:number}[]};
export type ShoppingAdvice={lines:ShoppingLine[];low:number;high:number;basis:'internal-reference';includesFees:false};
export type Plan={input:MealInput;dishIds:string[];recipeIds:string[];recipes:PlannedRecipe[];requirements:Requirement[];shopping:ShoppingAdvice;tasks:Task[];minutes:number;createdAt:number};
export type Task=RecipeStep&{id:string;recipeId:string;dishName:string;dependsOn:string[];start:number;end:number;hands:boolean};
export type TaskProgress=Record<string,{status:'running'|'done';startedAt:number;finishedAt?:number;extraMinutes?:number;deadlineAt?:number}>;
export class PlanError extends Error{}
const aliases=DISHES.flatMap(r=>r.aliases.map(alias=>({alias,id:r.id}))).sort((a,b)=>b.alias.length-a.alias.length);
export function parseRequest(raw:string):string[]{
 if(typeof raw!=='string'||raw.length>300)throw new PlanError('请用 300 字以内说出想做的菜。');
 let rest=raw.normalize('NFKC').trim();const ids=new Map<string,number>();
 for(const {alias,id}of aliases){let pos=rest.indexOf(alias);while(pos>=0){const prefix=rest.slice(Math.max(0,pos-6),pos);if(!/(不要|不做|不吃|不想吃|不想做|去掉|排除)\s*$/.test(prefix))ids.set(id,Math.min(ids.get(id)??Infinity,pos));rest=rest.slice(0,pos)+' '.repeat(alias.length)+rest.slice(pos+alias.length);pos=rest.indexOf(alias);}}
 rest=rest.replace(/(?:预算|不超过|控制在)\s*[¥￥]?\s*\d+(?:\.\d+)?\s*(?:元|块钱|块)?/g,'').replace(/(不要|不做|不吃|不想吃|不想做|去掉|排除)/g,'').replace(/\d+(?:\.\d+)?\s*(?:元|块钱|块|人份|人)/g,'').replace(/(?:人民币|预算|今天|今日|今晚|明天|中午|晚上|早上|晚餐|午餐|早餐|我想要|我想|想要|想吃|想做|我要|我们|帮我|给我|请|我|做一份|做一下|做|吃|还有|以及|然后|和|与|加上|加一道|加个|再来|来一份|来个|一道|一份|两道|三道|菜|谢谢|可以吗|一下|一点|就|要|的)/g,'').replace(/[\s¥￥、,，。.!！?？;；:：+&／/“”"'（）()「」]/g,'');
 if(rest)throw new PlanError(`暂未收录“${rest.slice(0,30)}”。当前有 ${DISHES.length} 道菜，可打开菜谱库搜索或选菜。`);
 if(!ids.size)throw new PlanError('先告诉我想做哪道菜，例如：红烧肉、番茄炒蛋。');
 if(ids.size>4)throw new PlanError('每餐最多安排 4 道菜，先选最想吃的几道吧。');
 return [...ids.entries()].sort((a,b)=>a[1]-b[1]).map(([id])=>id);
}
export function requirementsFor(ids:string[],servings:number,recipes:Recipe[]=RECIPES):Requirement[]{const sums=new Map<string,number>();for(const id of ids){const r=recipes.find(x=>x.id===id);if(!r)throw new PlanError('这道做法暂未收录。');for(const x of r.ingredients)sums.set(x.id,(sums.get(x.id)||0)+Math.ceil(x.amount*servings/2));}return [...sums].map(([id,n])=>({id,amount:Math.ceil(n)}));}
export function choosePacks(required:number,packs:ReferencePack[]):ShoppingLine|null{
 if(!Number.isFinite(required)||required<=0||!packs.length)return null;
 if(packs.some(p=>!Number.isFinite(p.amount)||p.amount<=0||p.referencePrice<0))throw new PlanError('参考包装数据有误。');
 let best:ShoppingLine|null=null;
 function visit(i:number,amount:number,cost:number,selected:{pack:ReferencePack;count:number}[]){if(amount>=required){if(!best||cost<best.referenceCost||(cost===best.referenceCost&&amount<best.purchased))best={ingredientId:packs[0].ingredientId,required,purchased:amount,referenceCost:cost,low:Math.round(cost*.8),high:Math.round(cost*1.2),packs:[...selected]};return;}if(i>=packs.length||(best&&cost>best.referenceCost))return;const pack=packs[i],cap=Math.ceil((required-amount)/pack.amount);for(let n=0;n<=cap;n++)visit(i+1,amount+n*pack.amount,cost+n*pack.referencePrice,n?[...selected,{pack,count:n}]:selected);}
 visit(0,0,0,[]);return best;
}
export function shoppingAdvice(requirements:Requirement[],pantry:string[]):ShoppingAdvice{const lines:ShoppingLine[]=[];for(const req of requirements){if(pantry.includes(req.id))continue;const line=choosePacks(req.amount,referencePacks.filter(p=>p.ingredientId===req.id));if(!line)throw new PlanError('缺少参考购买规格，请核对食材。');lines.push(line);}return {lines,low:lines.reduce((s,l)=>s+l.low,0),high:lines.reduce((s,l)=>s+l.high,0),basis:'internal-reference',includesFees:false};}
export function schedule(ids:string[],burners:1|2=2,servings=2,collection:Recipe[]=RECIPES):Task[]{
 const tasks:Task[]=[],recipes=ids.map(id=>collection.find(r=>r.id===id)!).filter(Boolean),equipment=equipmentFor(recipes),occupancy:Record<string,number[]>=Object.fromEntries(['hands','burner',...equipment].map(k=>[k,[]])),prepMinutes=5+Math.ceil(recipes.length*1.5);
 const prep:Task={id:'prep',recipeId:'shared',dishName:'共同准备',title:'一次备好，后面更从容',detail:`核对本餐用量，洗净蔬菜、切好葱姜。生肉与即食食材分开处理；肉类分锅焯水。${equipment.length?`本餐准备：${equipment.join('、')}。`:'准备洁净刀板、碗盘。'}单灶模式仍需准备各菜所需锅具；泡发、腌制与蒸煮另按后续步骤计时。`,minutes:prepMinutes,dependsOn:[],start:0,end:prepMinutes,hands:true};tasks.push(prep);for(let m=0;m<prepMinutes;m++)occupancy.hands[m]=1;
 function place(t:Task,earliest:number){const resources:string[]=[...(t.hands?['hands']:[]),...(t.burner?['burner']:[]),...(t.equipment?[t.equipment]:[])];let at=earliest;while(!resources.every(res=>Array.from({length:t.minutes},(_,i)=>at+i).every(m=>(occupancy[res][m]||0)<(res==='burner'?burners:1))))at++;t.start=at;t.end=at+t.minutes;for(const res of resources)for(let m=at;m<t.end;m++)occupancy[res][m]=(occupancy[res][m]||0)+1;tasks.push(t);}
 const duration=(id:string)=>recipes.find(r=>r.id===id)!.steps.reduce((s,t)=>s+t.minutes,0),long=recipes.filter(r=>r.steps.some(s=>s.passive)).sort((a,b)=>duration(b.id)-duration(a.id)),quick=recipes.filter(r=>!r.steps.some(s=>s.passive));
 for(const r of [...long,...quick]){let prev='prep',ready=prepMinutes;if(!r.steps.some(s=>s.passive))ready=Math.max(ready,Math.max(...tasks.map(t=>t.end))-duration(r.id));r.steps.forEach((s,i)=>{const t:Task={...s,detail:stepDetailFor(s.detail,servings),id:`${r.id}-${i}`,recipeId:r.id,dishName:r.name,dependsOn:[prev],start:0,end:0,hands:!s.passive};place(t,ready);prev=t.id;ready=t.end;});}return tasks.sort((a,b)=>a.start-b.start||a.id.localeCompare(b.id));
}
export function createPlan(input:MealInput,now=Date.now(),savedRecipes?:unknown):Plan{
 if(!input||!Number.isInteger(input.servings)||input.servings<1||input.servings>6)throw new PlanError('用餐人数支持 1–6 人。');
 if(!Number.isInteger(input.budget)||input.budget<1000||input.budget>100000)throw new PlanError('预算支持 10–1,000 元。');
 if(!Array.isArray(input.pantry)||input.pantry.some(id=>!INGREDIENTS[id]))throw new PlanError('已有食材中有未识别的项目，请重新选择。');
 const burners=input.burners??2,availableMinutes=input.availableMinutes??120;
 if(![1,2].includes(burners))throw new PlanError('请选择一口灶或两口灶。');
 if(!Number.isInteger(availableMinutes)||availableMinutes<15||availableMinutes>360)throw new PlanError('可用时间支持 15–360 分钟。');
 if(input.recipeChoices!==undefined&&(!input.recipeChoices||typeof input.recipeChoices!=='object'||Array.isArray(input.recipeChoices)))throw new PlanError('保存的做法选择有误，请重新选择。');
 const dishIds=parseRequest(input.request),choices=input.recipeChoices||{};
 const recipes=savedRecipes!==undefined?readRecipeSnapshots(savedRecipes,dishIds):dishIds.map(dishId=>{const dish=DISHES.find(d=>d.id===dishId)!,id=choices[dishId]??dish.defaultRecipeId;const recipe=RECIPES.find(r=>r.id===id&&r.dishId===dishId);if(!recipe)throw new PlanError(`${dish.name}与所选做法不对应，请重新选择。`);return snapshotRecipe(recipe);});
 for(const recipe of recipes)if(choices[recipe.dishId]!==undefined&&choices[recipe.dishId]!==recipe.id)throw new PlanError('保存的做法与本餐版本不一致，请重新安排。');
 const recipeIds=recipes.map(r=>r.id),recipeChoices=Object.fromEntries(recipes.map(r=>[r.dishId,r.id])),normalized={...input,recipeChoices,pantry:[...new Set(input.pantry)],burners,availableMinutes},requirements=requirementsFor(recipeIds,input.servings,recipes),tasks=schedule(recipeIds,burners,input.servings,recipes);
 return {input:normalized,dishIds,recipeIds,recipes,requirements,shopping:shoppingAdvice(requirements,normalized.pantry),tasks,minutes:Math.max(...tasks.map(t=>t.end)),createdAt:now};
}
export function switchRecipe(plan:Plan,dishId:string,recipeId:string,progress:TaskProgress={},now=Date.now()):Plan{
 if(Object.keys(progress).length&&plan.tasks.some(t=>progress[t.id]?.status!=='done'))throw new PlanError('这餐正在做，完成或结束本次烹饪后再换做法。');
 if(!plan.dishIds.includes(dishId))throw new PlanError('请先把这道菜选进本餐。');
 const target=RECIPES.find(r=>r.id===recipeId&&r.dishId===dishId);if(!target)throw new PlanError('这份做法与菜名不对应。');
 const current=plan.recipes.find(r=>r.dishId===dishId)!;if(current.id===target.id&&current.revision===target.revision)return plan;
 return createPlan({...plan.input,recipeChoices:{...plan.input.recipeChoices,[dishId]:recipeId}},Math.max(now,plan.createdAt+1),plan.recipes.map(r=>r.dishId===dishId?snapshotRecipe(target):r));
}
export function canStart(task:Task,tasks:Task[],progress:TaskProgress,burners:1|2=2){if(progress[task.id]||task.dependsOn.some(id=>progress[id]?.status!=='done'))return false;const running=tasks.filter(t=>progress[t.id]?.status==='running');return !(task.hands&&running.some(t=>t.hands))&&!(task.burner&&running.filter(t=>t.burner).length>=burners)&&!(task.equipment&&running.some(t=>t.equipment===task.equipment));}
export function remainingSeconds(task:Task,progress:TaskProgress,now:number){const p=progress[task.id];return p?.status==='running'?Math.max(0,Math.ceil(((p.deadlineAt??(p.startedAt+(task.minutes+(p.extraMinutes||0))*60000))-now)/1000)):0;}
export function availableTasks(tasks:Task[],progress:TaskProgress,now:number,burners:1|2=2){
 const longIds=new Set(tasks.filter(t=>t.passive).map(t=>t.recipeId)),byDish=new Map<string,number>();for(const t of tasks){if(!longIds.has(t.recipeId)||progress[t.id]?.status==='done')continue;const p=progress[t.id],left=p?.status==='running'?remainingSeconds(t,progress,now)/60:t.minutes;byDish.set(t.recipeId,(byDish.get(t.recipeId)||0)+left);}const longest=Math.max(0,...byDish.values());
 return tasks.filter(t=>canStart(t,tasks,progress,burners)).filter(t=>t.recipeId==='shared'||longIds.has(t.recipeId)||!t.dependsOn.includes('prep')||longest<=tasks.filter(x=>x.recipeId===t.recipeId).reduce((s,x)=>s+x.minutes,0)+3);
}
export function extendTimer(tasks:Task[],progress:TaskProgress,taskId:string,minutes:number,options:{expectedStartedAt?:number;expectedExtraMinutes?:number;now?:number}={}):TaskProgress{const t=tasks.find(t=>t.id===taskId),p=progress[taskId];if(!t?.passive||!t.burner||p?.status!=='running'||(options.expectedStartedAt!==undefined&&p.startedAt!==options.expectedStartedAt)||(options.expectedExtraMinutes!==undefined&&(p.extraMinutes||0)!==options.expectedExtraMinutes))throw new PlanError('这条计时已经改变，请重新询问当前步骤。');if(!Number.isInteger(minutes)||minutes<1||minutes>30||(p.extraMinutes||0)+minutes>180)throw new PlanError('单次可延长 1–30 分钟，累计不超过 180 分钟。');const oldDeadline=p.deadlineAt??p.startedAt+(t.minutes+(p.extraMinutes||0))*60000;const now=options.now??Date.now();return {...progress,[taskId]:{...p,extraMinutes:(p.extraMinutes||0)+minutes,deadlineAt:Math.max(oldDeadline,now)+minutes*60000}};}

export function changeBurners(plan:Plan,progress:TaskProgress,burners:1|2){if(plan.tasks.filter(t=>t.burner&&progress[t.id]?.status==='running').length>burners)throw new PlanError('当前有两锅正在加热。请先自行处理好其中一锅，再调整灶台数量；本次不会停止任何计时。');return createPlan({...plan.input,burners},plan.createdAt,plan.recipes);}
export function shoppingText(plan:Plan){return [`掌勺 · ${plan.input.servings} 人餐`,...plan.recipes.map(r=>`${recipeLabel(r)} · 配方版本 ${r.revision}`),...plan.shopping.lines.map(l=>`${INGREDIENTS[l.ingredientId].name}：需 ${l.required}${INGREDIENTS[l.ingredientId].unit}；参考购买 ${l.purchased}${INGREDIENTS[l.ingredientId].unit}`),`内部参考食材预算区间：¥${Math.floor(plan.shopping.low/100)}–¥${Math.ceil(plan.shopping.high/100)}`,`用户预算：¥${money(plan.input.budget)}`,`已备足量：${plan.input.pantry.map(id=>INGREDIENTS[id].name).join('、')||'无'}`,'购买规格与预算来自内部参考值，非商家商品或实时报价；未含配送、包装等费用。','请自行选购并以实际称重、规格、价格和结算总额为准。','本餐所选做法与来源：',...plan.recipes.map(r=>{const s=r.source;return `${recipeLabel(r)}：${s.label}${s.author?' · 作者 '+s.author:''}；核对 ${s.checkedAt}${s.references.map(e=>'\n'+e.url).join('')}`;})].join('\n');}
