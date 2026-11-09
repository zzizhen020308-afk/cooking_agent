import { RECIPES, INGREDIENTS, PROVIDERS, catalogue } from './catalog.ts';
import type { Product, ProviderId, RecipeStep, Requirement } from './catalog.ts';
export const money = (fen:number) => (fen / 100).toFixed(2);
export const QUOTE_TTL = 15 * 60 * 1000;
export type MealInput = { request:string; servings:number; budget:number; pantry:string[] };
export type BasketLine = { ingredientId:string; required:number; purchased:number; cost:number; packs:{product:Product;count:number}[] };
export type Quote = { id:string; provider:ProviderId; lines:BasketLine[]; subtotal:number; delivery:number; packaging:number; total:number; expiresAt:number; missing:string[]; };
export type Plan = { input:MealInput; recipeIds:string[]; requirements:Requirement[]; quotes:Quote[]; tasks:Task[]; minutes:number; createdAt:number };
export type Task = RecipeStep & {id:string;recipeId:string;dishName:string;dependsOn:string[];start:number;end:number;hands:boolean};
export class PlanError extends Error {}
const aliasList=RECIPES.flatMap(r=>r.aliases.map(alias=>({alias,id:r.id}))).sort((a,b)=>b.alias.length-a.alias.length);
export function parseRequest(raw:string):string[]{
 if(typeof raw!=='string'||raw.length>300) throw new PlanError('请用 300 字以内说出想做的菜。');
 let rest=raw.normalize('NFKC').trim(); const ids=new Map<string,number>();
 for(const {alias,id} of aliasList){
   let pos=rest.indexOf(alias);
   while(pos>=0){
     const prefix=rest.slice(Math.max(0,pos-6),pos);
     if(!/(不要|不做|不吃|不想吃|不想做|去掉|排除)\s*$/.test(prefix)) ids.set(id,Math.min(ids.get(id)??Infinity,pos));
     rest=rest.slice(0,pos)+' '.repeat(alias.length)+rest.slice(pos+alias.length);pos=rest.indexOf(alias);
   }
 }
 rest=rest.replace(/(?:预算|不超过|控制在)\s*[¥￥]?\s*\d+(?:\.\d+)?\s*(?:元|块钱|块)?/g,'').replace(/(不要|不做|不吃|不想吃|不想做|去掉|排除)/g,'').replace(/(?:预算|不超过|控制在|一共|总共)?\s*[¥￥]?\s*\d+(?:\.\d+)?\s*(?:元|块钱|块|人份|人)/g,'').replace(/(?:人民币|预算|今天|今日|今晚|明天|中午|晚上|早上|晚餐|午餐|早餐|我想要|我想|想要|想吃|想做|我要|我们|帮我|给我|请|我|做一份|做一下|做|吃|还有|以及|然后|和|与|加上|再来|来一份|来个|一道|一份|两道|三道|菜|谢谢|可以吗|一下|一点|就|要|的)/g,'').replace(/[\s¥￥、,，。.!！?？;；:：+&／/“”"'（）()「」]/g,'');
 if(rest) throw new PlanError(`暂时还不认识“${rest.slice(0,30)}”。请从 8 道示例菜里选择，也可以改用完整菜名。`);
 if(!ids.size) throw new PlanError('先告诉我想做哪道菜，例如：红烧肉、番茄炒蛋。');
 if(ids.size>4) throw new PlanError('这一版每餐最多安排 4 道菜，先选最想吃的几道吧。');
 return [...ids.entries()].sort((a,b)=>a[1]-b[1]).map(([id])=>id);
}
export function requirementsFor(recipeIds:string[],servings:number):Requirement[]{
 const sums=new Map<string,number>();
 for(const id of recipeIds){const r=RECIPES.find(x=>x.id===id);if(!r) throw new PlanError('这道菜暂未收录。');for(const ing of r.ingredients)sums.set(ing.id,(sums.get(ing.id)||0)+ing.amount*servings/2);}
 return [...sums].map(([id,amount])=>({id,amount:Math.ceil(amount)}));
}
/** Exact bounded search over available package combinations: price first, waste second. */
export function choosePacks(required:number,products:Product[]):BasketLine|null{
 if(!products.length||required<=0) return null;
 let best:BasketLine|null=null;
 function visit(index:number,amount:number,cost:number,packs:{product:Product;count:number}[]){
  if(amount>=required){if(!best || cost<best.cost || (cost===best.cost && amount<best.purchased)) best={ingredientId:products[0].ingredientId,required,purchased:amount,cost,packs:[...packs]};return;}
  if(index>=products.length|| (best && cost>best.cost))return;
  const p=products[index]; const cap=Math.min(p.stock,Math.ceil((required-amount)/p.amount));
  for(let n=0;n<=cap;n++)visit(index+1,amount+n*p.amount,cost+n*p.price,n?[...packs,{product:p,count:n}]:packs);
 }
 visit(0,0,0,[]);return best;
}
function fingerprint(value:unknown){const s=JSON.stringify(value);let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return (h>>>0).toString(36);}
export function quoteFor(requirements:Requirement[],pantry:string[],provider:ProviderId,now=Date.now()):Quote{
 const meta=PROVIDERS.find(p=>p.id===provider)!; const products=catalogue(provider),lines:BasketLine[]=[],missing:string[]=[];
 for(const req of requirements){if(pantry.includes(req.id))continue;const line=choosePacks(req.amount,products.filter(p=>p.ingredientId===req.id));if(line)lines.push(line);else missing.push(req.id);}
 const subtotal=lines.reduce((s,l)=>s+l.cost,0),delivery=subtotal===0||subtotal>=meta.freeAt?0:meta.delivery,packaging=subtotal?meta.packaging:0;
 return {id:`quote-${fingerprint({provider,requirements,pantry:[...pantry].sort()})}`,provider,lines,missing,subtotal,delivery,packaging,total:subtotal+delivery+packaging,expiresAt:now+QUOTE_TTL};
}
/** Resource schedule: one pair of hands, two burners, one of each kind of pot. */
export function schedule(recipeIds:string[]):Task[]{
 const tasks:Task[]=[],occupancy:Record<string,number[]>={hands:[],burner:[],汤锅:[],炖锅:[],炒锅:[]};
 const recipes=recipeIds.map(id=>RECIPES.find(r=>r.id===id)!).filter(Boolean);
 const prepMinutes=5+Math.ceil(recipes.length*1.5);
 const prep:Task={id:'prep',recipeId:'shared',dishName:'共同准备',title:'一次备好，后面更从容',detail:'按菜谱核对用量，洗净蔬菜、切好葱姜。生肉与即食食材分开处理；肉类分锅焯水。准备汤锅、炖锅和炒锅（按本餐实际需要）。',minutes:prepMinutes,dependsOn:[],start:0,end:prepMinutes,hands:true};tasks.push(prep);
 for(let m=0;m<prepMinutes;m++)occupancy.hands[m]=1;
 function place(task:Task,earliest:number){
  const resources:string[]=[...(task.hands?['hands']:[]),...(task.burner?['burner']:[]),...(task.equipment?[task.equipment]:[])];
  let at=earliest;
  while(!resources.every(res=>Array.from({length:task.minutes},(_,i)=>at+i).every(m=>(occupancy[res][m]||0)<(res==='burner'?2:1))))at++;
  task.start=at;task.end=at+task.minutes;
  for(const res of resources)for(let m=at;m<task.end;m++)occupancy[res][m]=(occupancy[res][m]||0)+1;
  tasks.push(task);
 }
 const duration=(id:string)=>RECIPES.find(r=>r.id===id)!.steps.reduce((s,t)=>s+t.minutes,0);
 const long=recipes.filter(r=>r.steps.some(s=>s.passive)).sort((a,b)=>duration(b.id)-duration(a.id));
 const quick=recipes.filter(r=>!r.steps.some(s=>s.passive));
 for(const recipe of [...long,...quick]){
   let prev='prep',ready=prepMinutes;
   // Keep fast dishes near the end of the long cooks, while respecting resources.
   if(!recipe.steps.some(s=>s.passive))ready=Math.max(ready,Math.max(...tasks.map(t=>t.end))-duration(recipe.id));
   recipe.steps.forEach((s,i)=>{const task:Task={...s,id:`${recipe.id}-${i}`,recipeId:recipe.id,dishName:recipe.name,dependsOn:[prev],start:0,end:0,hands:!s.passive};place(task,ready);prev=task.id;ready=task.end;});
 }
 return tasks.sort((a,b)=>a.start-b.start||a.id.localeCompare(b.id));
}
export function createPlan(input:MealInput,now=Date.now()):Plan{
 if(!Number.isInteger(input.servings)||input.servings<1||input.servings>6) throw new PlanError('用餐人数支持 1–6 人。');
 if(!Number.isInteger(input.budget)||input.budget<1000||input.budget>100000)throw new PlanError('请输入 10–1,000 元之间的预算，最多两位小数。');
 if(input.pantry.some(id=>!INGREDIENTS[id]))throw new PlanError('储物柜里有未识别的食材，请重新选择。');
 const recipeIds=parseRequest(input.request),requirements=requirementsFor(recipeIds,input.servings),tasks=schedule(recipeIds);
 return {input:{...input,pantry:[...new Set(input.pantry)]},recipeIds,requirements,quotes:PROVIDERS.map(p=>quoteFor(requirements,input.pantry,p.id,now)).sort((a,b)=>a.total-b.total),tasks,minutes:Math.max(...tasks.map(t=>t.end)),createdAt:now};
}
export type TaskProgress = Record<string,{status:'running'|'done';startedAt:number;finishedAt?:number}>;
export function canStart(task:Task,tasks:Task[],progress:TaskProgress):boolean{
 if(progress[task.id] || task.dependsOn.some(id=>progress[id]?.status!=='done'))return false;
 const running=tasks.filter(t=>progress[t.id]?.status==='running');
 if(task.hands && running.some(t=>t.hands))return false;
 if(task.burner && running.filter(t=>t.burner).length>=2)return false;
 if(task.equipment && running.some(t=>t.equipment===task.equipment))return false;
 return true;
}
/** Keep fast hot dishes near the actual finish of the long cooks. */
export function availableTasks(tasks:Task[],progress:TaskProgress,now:number):Task[]{
 const longIds=new Set(tasks.filter(t=>t.passive).map(t=>t.recipeId));
 const remainingByDish=new Map<string,number>();
 for(const t of tasks){if(!longIds.has(t.recipeId)||progress[t.id]?.status==='done')continue;const p=progress[t.id];const left=p?.status==='running'?Math.max(0,t.minutes-(now-p.startedAt)/60000):t.minutes;remainingByDish.set(t.recipeId,(remainingByDish.get(t.recipeId)||0)+left);}
 const longest=Math.max(0,...remainingByDish.values());
 return tasks.filter(t=>canStart(t,tasks,progress)).filter(t=>{
  if(t.recipeId==='shared'||longIds.has(t.recipeId)||!t.dependsOn.includes('prep'))return true;
  const quickTime=tasks.filter(x=>x.recipeId===t.recipeId).reduce((s,x)=>s+x.minutes,0);
  return longest<=quickTime+3;
 });
}
export type DemoOrder={id:string;quoteId:string;total:number;provider:ProviderId;createdAt:number;mode:'demo';fingerprint:string};
export function createDemoOrder(plan:Plan,quote:Quote,existing:DemoOrder|null=null,now=Date.now()):DemoOrder{
 const current=plan.quotes.find(q=>q.provider===quote.provider);
 if(!current || current.id!==quote.id||current.total!==quote.total)throw new PlanError('清单已经变化，请重新核对报价。');
 if(quote.missing.length)throw new PlanError('有食材暂不可购买。');
 if(quote.total>plan.input.budget)throw new PlanError('这份采购清单超过预算，请先调整。');
 if(quote.expiresAt<=now)throw new PlanError('示例报价已过期，请刷新报价后再试。');
 if(!quote.lines.length)throw new PlanError('食材已经备齐，可以直接开始做饭。');
 const key=fingerprint({input:plan.input,quote:quote.id,total:quote.total});
 if(existing?.fingerprint===key)return existing;
 return {id:`DEMO-${fingerprint({key,now})}`.toUpperCase(),quoteId:quote.id,total:quote.total,provider:quote.provider,createdAt:now,mode:'demo',fingerprint:key};
}
export function shoppingText(plan:Plan,quote:Quote){return [`掌勺 · ${plan.input.servings} 人晚餐`,plan.recipeIds.map(id=>RECIPES.find(r=>r.id===id)!.name).join('、'),'上海 · '+PROVIDERS.find(p=>p.id===quote.provider)!.name+'（示例清单，非实时报价）',...quote.lines.map(l=>`${INGREDIENTS[l.ingredientId].name}：需 ${l.required}${INGREDIENTS[l.ingredientId].unit}，购买 ${l.purchased}${INGREDIENTS[l.ingredientId].unit}，¥${money(l.cost)}`),`商品 ¥${money(quote.subtotal)} + 配送 ¥${money(quote.delivery)} + 包装 ¥${money(quote.packaging)} = ¥${money(quote.total)}`,`预算 ¥${money(plan.input.budget)}`,`已备足量：${plan.input.pantry.map(id=>INGREDIENTS[id].name).join('、')||'无'}`,'示例价格和库存由原型预设；请在买菜 App 内核对实际商品、配送范围和费用。'].join('\n');}
