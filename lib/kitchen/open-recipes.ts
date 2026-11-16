import type {RecipeStep} from './catalog.ts';
import {howToCookSourceIdentity} from './sources.ts';
import {recipeContentState,type RawRecipeFields,type RecipeContentState} from './online-parser.ts';

/** Verified public-domain upstream snapshot. Runtime requests retrieve source files, not embedded recipes. */
export const OPEN_RECIPE_SNAPSHOT='308cc8b7dab1da84b20e7fafdf836a715437f582';
export const OPEN_RECIPE_REPOSITORY='https://github.com/Anduin2017/HowToCook';
export type OpenRecipeCandidate=RawRecipeFields&{
 id:string;url:string;retrievedAt:string;retrieval:'direct';contentState:RecipeContentState;
 platform:'HowToCook';snapshot:string;license:'Unlicense';baseServings?:number;
 plannedSteps:RecipeStep[];warnings:string[];blockingIssues:string[];notes:string[];
 matchType?:'exact'|'partial'|'similar';matchNote?:string;
};
export type OpenRecipeIndexStats={snapshot:string;totalRecipeFiles:number;uniqueTitles:number;byCategory:Record<string,number>;templateFiles:number;nonTemplateRecipeFiles:number};
export type OpenRecipeResult={status:'ok'|'unavailable';candidates:OpenRecipeCandidate[];searchUrl:string;message:string;indexStats?:OpenRecipeIndexStats};
export type OpenRecipeOptions={fetcher?:typeof fetch;now?:number;cache?:boolean};
type ProviderCache={index?:{expires:number;paths:string[]};texts:Map<string,{markdown:string;at:number}>};
const caches=new WeakMap<typeof fetch,ProviderCache>();
const TITLE_LIMIT=120,FILE_LIMIT=150000,INDEX_LIMIT=1500000;
const sourceUrl=(path:string)=>`${OPEN_RECIPE_REPOSITORY}/blob/${OPEN_RECIPE_SNAPSHOT}/${path.split('/').map(encodeURIComponent).join('/')}`;
const rawUrl=(path:string)=>`https://raw.githubusercontent.com/Anduin2017/HowToCook/${OPEN_RECIPE_SNAPSHOT}/${path.split('/').map(encodeURIComponent).join('/')}`;
function clean(text:string){return text.replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/\*\*|__|`/g,'').trim();}
function cacheFor(fetcher:typeof fetch){let cache=caches.get(fetcher);if(!cache){cache={texts:new Map()};caches.set(fetcher,cache);}return cache;}
async function readPublic(url:string,fetcher:typeof fetch,limit:number){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{
  const response=await fetcher(url,{signal:controller.signal,redirect:'manual',headers:{Accept:'application/vnd.github+json, text/plain','User-Agent':'Zhangshao-Recipe-Reader'}});
  if(!response.ok||Number(response.headers.get('content-length')||0)>limit)throw new Error('公开菜谱暂时无法读取。');
  if(!response.body)throw new Error('公开菜谱正文为空。');
  const reader=response.body.getReader(),decoder=new TextDecoder();let bytes=0,value='';
  try{while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>limit){await reader.cancel();throw new Error('公开菜谱正文过长。');}value+=decoder.decode(part.value,{stream:true});}return value+decoder.decode();}finally{reader.releaseLock();}
 }finally{clearTimeout(timer);}
}
function validPath(path:unknown):path is string{
 return typeof path==='string'&&path.length<600&&path.startsWith('dishes/')&&path.endsWith('.md')&&!/[\x00-\x1f\\%?#]/.test(path)&&path.split('/').every(p=>p&&p!=='.'&&p!=='..');
}
export function parseOpenRecipeIndex(value:unknown):string[]{
 if(!value||typeof value!=='object'||(value as {truncated?:unknown}).truncated===true||!Array.isArray((value as {tree?:unknown}).tree))throw new Error('公开菜谱索引不完整。');
 const tree=(value as {tree:unknown[]}).tree;if(tree.length>20000)throw new Error('公开菜谱索引过长。');
 const paths=tree.flatMap(row=>row&&typeof row==='object'&&(row as {type?:unknown}).type==='blob'&&validPath((row as {path?:unknown}).path)?[(row as {path:string}).path]:[]);
 if(!paths.length)throw new Error('公开菜谱索引为空。');return [...new Set(paths)];
}
/** Public Markdown index fallback when anonymous GitHub API requests are rate limited. */
export function parseOpenRecipeReadme(markdown:string):string[]{
 const paths=[...markdown.matchAll(/\[[^\]]*\]\((?:\.\/)?(dishes\/[^\n)]*?\.md)\)/g)].flatMap(match=>{try{const path=decodeURIComponent(match[1]);return validPath(path)?[path]:[];}catch{return [];}});
 if(!paths.length)throw new Error('公开 Markdown 索引为空。');return [...new Set(paths)];
}
const recipeName=(path:string)=>path.split('/').at(-1)!.replace(/\.md$/,'');
/** Counts describe indexed files, not a promise that every source is ready for automatic planning. */
export function openRecipeIndexStats(paths:string[]):OpenRecipeIndexStats{
 const unique=[...new Set(paths)],byCategory:Record<string,number>={};
 for(const path of unique){const category=path.split('/')[1];byCategory[category]=(byCategory[category]||0)+1;}
 const templateFiles=byCategory.template||0;
 return {snapshot:OPEN_RECIPE_SNAPSHOT,totalRecipeFiles:unique.length,uniqueTitles:new Set(unique.map(recipeName)).size,byCategory,templateFiles,nonTemplateRecipeFiles:unique.length-templateFiles};
}
function normalizedDishName(value:string):string{
 return value.normalize('NFKC').toLowerCase().replace(/[\s、，,。.!！?？:：;；()（）\-_/]/g,'').replace(/西红柿/g,'番茄').replace(/马铃薯/g,'土豆').replace(/洋白菜|圆白菜|卷心菜/g,'包菜').replace(/角瓜/g,'西葫芦').replace(/蒜薹/g,'蒜苔');
}
// Conservative ingredient vocabulary. Unknown words are kept as a blocker instead of guessed away.
const ingredientNames=['红薯粉丝','猪肉末','牛肉末','胡萝卜','西兰花','西葫芦','油麦菜','空心菜','郫县豆瓣酱','四季豆','土豆','番茄','牛肉','牛腩','猪肉','排骨','鸡肉','鸡翅','鸡腿','羊肉','鸭肉','鱼肉','虾仁','鸡蛋','豆腐','茄子','黄瓜','包菜','白菜','萝卜','青椒','尖椒','辣椒','洋葱','香菇','蘑菇','木耳','粉丝','面条','米饭','豆角','南瓜','山药','玉米','莲藕','菠菜','生菜','韭菜','蒜苔','芹菜','莴笋','酸菜','雪菜','花生','毛豆','豌豆','腐竹','青豆','大蒜','生姜','小葱','虾','鱼'].sort((a,b)=>b.length-a.length);
function dishFacts(value:string):{ingredients:string[];rest:string;family:string|undefined}{
 let rest=normalizedDishName(value);const ingredients:string[]=[];
 for(const name of ingredientNames)if(rest.includes(name)){ingredients.push(name);rest=rest.split(name).join(' ');}
 const family=/红烧|清炖|焖|炖|烧/.test(rest)?'braise':/爆炒|干煸|清炒|小炒|炒|爆|煸/.test(rest)?'fry':/清蒸|蒸/.test(rest)?'steam':/水煮|煮/.test(rest)?'boil':/凉拌|拌/.test(rest)?'mix':/香煎|煎/.test(rest)?'pan-fry':/烤/.test(rest)?'bake':undefined;
 rest=rest.replace(/红烧|清炖|爆炒|干煸|清炒|小炒|清蒸|水煮|凉拌|香煎|焖|炖|烧|炒|爆|煸|蒸|煮|拌|煎|烤|的|和|与/g,'').replace(/\s+/g,'');
 return {ingredients,rest,family};
}
function sourceIngredientLabel(name:string,sourceName:string){return name==='番茄'&&sourceName.includes('西红柿')?'西红柿':name;}
function similarNote(name:string,extras:string[]){return `相近做法：原谱为「${name}」${extras.length?'，另含'+extras.map(i=>sourceIngredientLabel(i,name)).join('、'):''}，请核对用料与做法。`;}
export type OpenRecipeNameMatch={path:string;name:string;matchType:'exact'|'partial'|'similar';matchNote?:string};
/** Match names and common aliases first. A related dish requires every recognized ingredient, never a protein substitution. */
export function matchOpenRecipeNames(paths:string[],query:string):OpenRecipeNameMatch[]{
 const q=query.normalize('NFKC').trim(),normalized=normalizedDishName(q),words=q.toLowerCase().split(/\s+/),facts=dishFacts(q);
 const relatedAllowed=facts.ingredients.length>=2&&!facts.rest;
 return paths.map(path=>{
  const name=recipeName(path),normalizedName=normalizedDishName(name),sourceFacts=dishFacts(name),extras=sourceFacts.ingredients.filter(i=>!facts.ingredients.includes(i));
  if(name===q)return {path,name,matchType:'exact' as const,rank:0,extras:0};
  if(normalizedName===normalized)return {path,name,matchType:'partial' as const,matchNote:'按常用食材别名匹配，原谱名称和用料保持不变。',rank:1,extras:0};
  if(words.every(word=>name.toLowerCase().includes(word))||normalizedName.includes(normalized)){
   const similar=relatedAllowed&&extras.length>0;
   return {path,name,matchType:similar?'similar' as const:'partial' as const,matchNote:similar?similarNote(name,extras):'按菜名关键词匹配，请查看原谱完整名称与用料。',rank:2,extras:extras.length};
  }
  if(relatedAllowed&&facts.ingredients.every(i=>sourceFacts.ingredients.includes(i))&&(!facts.family||facts.family===sourceFacts.family))return {path,name,matchType:'similar' as const,matchNote:similarNote(name,extras),rank:3,extras:extras.length};
  return null;
 }).filter((row):row is NonNullable<typeof row>=>row!==null).sort((a,b)=>a.rank-b.rank||a.extras-b.extras||a.name.length-b.name.length||a.path.localeCompare(b.path)).slice(0,3).map(({rank,extras,...row})=>row);
}
function section(lines:string[],heading:RegExp){const at=lines.findIndex(l=>heading.test(l));if(at<0)return [];const end=lines.findIndex((l,i)=>i>at&&/^##\s/.test(l));return lines.slice(at+1,end<0?undefined:end);}
function portions(text:string):{baseServings?:number;servingsText?:string}{
 const explicit=text.match(/一份(?:正好)?(?:够|供)\s*(\d+)\s*(?:个)?人/)||text.match(/(?:下面|以下|本配方|本菜谱)(?:是|为)?\s*(\d+)\s*人份/)||text.match(/(?:适合|可供|可供食用人数|食用人数)[：:]?\s*(\d+)\s*人/);
 if(explicit){const n=Number(explicit[1]);if(n>=1&&n<=12)return {baseServings:n,servingsText:explicit[0]};}
 if(/(?:下面|以下)(?:是|为)?一人份/.test(text))return {baseServings:1,servingsText:'原文注明一人份'};
 const range=text.match(/一份(?:正好)?(?:够|供)\s*\d+\s*[-–~到至]\s*\d+\s*(?:个)?人/);return range?{servingsText:range[0]}:{};
}
function ingredientFact(line:string):RawRecipeFields['ingredients'][number]{
 const value=clean(line.replace(/^\s*[-*+]\s*/,''));
 const numeric=value.match(/^(.+?)\s+(\d+(?:\.\d+)?(?:\s*[-–~到至]\s*\d+(?:\.\d+)?)?\s*(?:kg|ml|g|L|千克|公斤|毫升|升|克|斤|两|个|只|根|颗|片|瓣|勺|匙|杯|碗|块|条|把))(.*)$/i);
 if(numeric){const state=/[（(]\s*(干重|湿重|净重)\s*[）)]/.exec(numeric[3]);return {name:numeric[1].trim()+(state?`（${state[1]}）`:''),quantityText:numeric[2].replace(/\s+/g,'')};}
 const spaced=value.match(/^(.+?)\s+(.+)$/);return spaced?{name:spaced[1].trim(),quantityText:spaced[2].trim()}:{name:value,quantityText:''};
}
/** A scheduling estimate is explicitly distinct from a duration stated by the source. */
export function planOpenRecipeStep(detail:string,index:number,defaultEquipment:RecipeStep['equipment']='炒锅'):RecipeStep{
 const text=clean(detail),duration=text.match(/(\d+(?:\.\d+)?)(?:\s*(?:-|–|—|~|～|到|至)\s*(\d+(?:\.\d+)?))?\s*(分钟|小时|分(?:钟)?|秒钟|秒|seconds?|minutes?|mins?|s)/i);
 const number=duration?Number(duration[2]||duration[1]):0,unit=duration?.[3]||'';
 const minutes=duration?Math.max(1,Math.ceil(number*(/小时/.test(unit)?60:/秒|^s(?:econds?)?$/i.test(unit)?1/60:1))):/(?:切|剁|洗|打散|去皮|去蒂|去壳)/.test(text)?4:/(?:收汁|出锅|装盘|盛出|搅拌|翻匀)/.test(text)?2:/(?:煮沸|烧开)/.test(text)?5:/(?:翻炒|煸炒|炒至|炒香)/.test(text)?3:3;
 const title=text.split(/[，。；（(]/)[0].trim().slice(0,75)||`按原谱操作第 ${index+1} 步`;
 const step:RecipeStep={title,detail:text,minutes,timingBasis:duration?'source':'estimated'};
 const coldWait=duration&&/(?:泡软|泡发|浸泡|腌制|腌好)/.test(text)&&!/(?:热锅|锅中|加入.*炒|煮沸|烧开)/.test(text);
 if(coldWait)return {...step,passive:true,waitKind:/腌/.test(text)?'腌制':'泡发',burner:false};
 const heated=/(?:锅|炒|煎|煮|烧开|焖|炖|蒸|熬|炸|火|油热|粉丝|面条.*捞)/.test(text)&&!(/(?:剁碎|切碎|洗净|提前泡|备用)/.test(text)&&!/(?:锅|炒|煮|蒸)/.test(text));
 if(heated){step.burner=true;step.equipment=/蒸锅|上锅蒸|隔水蒸|蒸制/.test(text)?'蒸锅':/炖锅/.test(text)?'炖锅':/汤锅/.test(text)?'汤锅':/炒锅/.test(text)?'炒锅':defaultEquipment;}
 // Most source steps still need a cook nearby; only explicit unattended simmer/steam becomes passive.
 if(duration&&step.burner&&/(?:盖.*盖|加盖|小火.*(?:焖|炖|蒸)|(?:焖|炖|蒸).*(?:分钟|小时))/.test(text)&&!/(?:翻炒|搅拌|不停|拨动)/.test(text)){step.passive=true;step.waitKind=/蒸/.test(text)?'蒸制':'炖煮';}
 return step;
}
export function parseOpenRecipeMarkdown(markdown:string,path:string,now=Date.now()):OpenRecipeCandidate|null{
 if(typeof markdown!=='string'||markdown.length>FILE_LIMIT||!validPath(path))return null;
 const lines=markdown.replace(/\r\n?/g,'\n').split('\n'),title=clean(lines.find(l=>/^#\s+/.test(l))?.replace(/^#\s+/,'')||path.split('/').at(-1)!.replace(/\.md$/,'' )).replace(/的做法$/,'').slice(0,TITLE_LIMIT);
 const calculation=section(lines,/^##\s*计算\s*$/),operations=section(lines,/^##\s*(?:操作|做法|制作步骤)\s*$/);
 const ingredients=calculation.filter(l=>/^\s*[-*+]\s+/.test(l)).map(ingredientFact).filter(i=>i.name);
 const steps:string[]=[];let current='';
 for(const raw of operations){const value=clean(raw);if(!value||/^###\s|^!\[/.test(raw))continue;const marker=value.match(/^(?:\d+[.、)）]|[-*+])\s+(.*)$/);if(marker){if(current)steps.push(current);current=marker[1];}else if(current)current+='\n'+value;else if(value&&!/^#/.test(value))current=value;}
 if(current)steps.push(current);
 const url=sourceUrl(path),identity=howToCookSourceIdentity(url);if(!identity||!title)return null;
 const base=portions(calculation.join('\n')),blockingIssues:string[]=[],warnings:string[]=[];
 if(!ingredients.length||!steps.length)blockingIssues.push('原文未取得完整的计算用料与操作分区，需手动核对。');
 if(ingredients.length>40||steps.length>20)blockingIssues.push('原文超过当前支持的食材或步骤数量，需手动简化核对。');
 if(!base.baseServings)blockingIssues.push('原文未明确唯一适用人数，请先确认基准人数。');
 if(calculation.filter(l=>/^(?:###|.*基础量|每份面条)/.test(l)).length>1)blockingIssues.push('原谱包含多份基础酱汁或分项配方，不能直接按单一人数缩放。');
 if(/烤箱|空气炸锅|微波炉|高压锅|压力锅|电饭煲|电压力锅/.test(operations.join('\n')))blockingIssues.push('原谱使用当前排程不支持的设备，请另选炉灶做法。');
 const notes=section(lines,/^##\s*附加内容\s*$/).filter(l=>/^\s*[-*+]\s+/.test(l)).map(l=>clean(l.replace(/^\s*[-*+]\s*/,'')));
 const optional=steps.filter(s=>/可选|(?:可|可以)(?:撒|加入|加点|加上)/.test(s));
 if(optional.length)notes.push(...optional.map(s=>'原谱可选操作：'+s));
 let equipment:RecipeStep['equipment']=path.startsWith('dishes/soup/')?'汤锅':'炒锅';
 const plannedSteps=steps.map((detail,index)=>{const step=planOpenRecipeStep(detail,index,equipment);if(step.equipment)equipment=step.equipment;return step;});const estimated=plannedSteps.filter(s=>s.timingBasis==='estimated').length;
 if(plannedSteps.some(step=>step.minutes>180))blockingIssues.push('原谱有步骤超过 180 分钟；保留原时长，请另留时间并拆步审核，不能直接套用当前计时。');
 if(estimated)warnings.push(`${estimated} 个步骤的时间为掌勺排程估计，原谱未给出明确时长；以食材实际状态为准。`);
 if(plannedSteps.some(s=>s.timingBasis==='source'&&/秒|\d\s*s\b/i.test(s.detail)))warnings.push('原文秒级步骤在排程中向上计为整分钟，操作仍应按原文观察。');
 if(plannedSteps.some(s=>s.timingBasis==='source'&&/\d\s*(?:-|–|—|~|～|到|至)\s*\d/.test(s.detail)))warnings.push('原文时长范围按上限排程，实际操作仍按原谱状态检查。');
 warnings.push('锅具类型由原谱操作推定，请核对现场可用锅具；排程不能验证实际熟度。');
 return {id:identity.id,title,author:'HowToCook 社区贡献者',ingredients,steps,...base,url,retrievedAt:new Date(now).toISOString(),retrieval:'direct',contentState:recipeContentState({ingredients,steps}),platform:'HowToCook',snapshot:OPEN_RECIPE_SNAPSHOT,license:'Unlicense',plannedSteps,warnings,blockingIssues,notes};
}
async function loadRecipe(path:string,options:OpenRecipeOptions):Promise<OpenRecipeCandidate|null>{
 const fetcher=options.fetcher??fetch,cache=cacheFor(fetcher);let entry=options.cache===false?undefined:cache.texts.get(path);
 if(entry===undefined){entry={markdown:await readPublic(rawUrl(path),fetcher,FILE_LIMIT),at:options.now??Date.now()};if(options.cache!==false){if(cache.texts.size>=100)cache.texts.delete(cache.texts.keys().next().value!);cache.texts.set(path,entry);}}
 return parseOpenRecipeMarkdown(entry.markdown,path,entry.at);
}
export async function fetchOpenRecipe(value:string,options:OpenRecipeOptions={}):Promise<OpenRecipeResult>{
 const identity=howToCookSourceIdentity(value),searchUrl=OPEN_RECIPE_REPOSITORY;
 if(!identity||identity.snapshot!==OPEN_RECIPE_SNAPSHOT)return {status:'unavailable',message:'仅支持已核对的 HowToCook 固定版本菜谱链接。',candidates:[],searchUrl};
 try{const candidate=await loadRecipe(identity.path,options);return candidate?{status:'ok',candidates:[candidate],searchUrl:candidate.url,message:'已读取 HowToCook 完整原文（可能使用固定版本缓存）。来源允许复用；数量、人数和排程估时会分别标明。'}:{status:'unavailable',candidates:[],searchUrl,message:'未识别到完整用料与步骤，请选择其他公开菜谱。'};}
 catch{return {status:'unavailable',candidates:[],searchUrl,message:'开放菜谱来源暂时无法读取，请稍后重试；不会用缺失正文生成配方。'};}
}
export async function searchOpenRecipes(query:string,options:OpenRecipeOptions={}):Promise<OpenRecipeResult>{
 const searchUrl=OPEN_RECIPE_REPOSITORY,q=typeof query==='string'?query.normalize('NFKC').trim():'';
 if(q.length<2||q.length>40||/[<>\x00-\x1f]|https?:\/\//i.test(q))return {status:'unavailable',message:'请输入 2–40 字的菜名。',candidates:[],searchUrl};
 try{
  const fetcher=options.fetcher??fetch,cache=cacheFor(fetcher),now=options.now??Date.now();let paths=options.cache===false?undefined:cache.index?.expires&&cache.index.expires>now?cache.index.paths:undefined;
  if(!paths){
   try{const body=await readPublic(`https://api.github.com/repos/Anduin2017/HowToCook/git/trees/${OPEN_RECIPE_SNAPSHOT}?recursive=1`,fetcher,INDEX_LIMIT);paths=parseOpenRecipeIndex(JSON.parse(body));}
   catch{const readme=await readPublic(`https://raw.githubusercontent.com/Anduin2017/HowToCook/${OPEN_RECIPE_SNAPSHOT}/README.md`,fetcher,INDEX_LIMIT);paths=parseOpenRecipeReadme(readme);}
   if(options.cache!==false)cache.index={paths,expires:now+3600000};
  }
  const indexStats=openRecipeIndexStats(paths),matches=matchOpenRecipeNames(paths,q);
  const settled=await Promise.allSettled(matches.map(async row=>{const candidate=await loadRecipe(row.path,options);return candidate?{...candidate,matchType:row.matchType,...(row.matchNote?{matchNote:row.matchNote}:{})}:null;})),candidates=settled.flatMap(r=>r.status==='fulfilled'&&r.value?[r.value]:[]);
  const onlySimilar=candidates.length>0&&candidates.every(c=>c.matchType==='similar');
  return candidates.length?{status:'ok',candidates,searchUrl,indexStats,message:onlySimilar?'未找到同名菜谱，已找到用料相近的做法。原谱可能有额外食材或技法差异，请核对后再选择。':'已检索 HowToCook 公开索引并读取候选原文（可能使用固定版本缓存）；来源版本、用量和估计时间随配方保留。'}:{status:'unavailable',candidates:[],searchUrl,indexStats,message:matches.length?'找到菜名，但公开原文暂时无法读取，请稍后重试。':'该来源当前索引没有匹配菜谱，并非这道菜不存在。可尝试主要食材或选择其他来源。'};
 }catch{return {status:'unavailable',candidates:[],searchUrl,message:'开放菜谱索引暂时不可用，请稍后重试。'};}
}
