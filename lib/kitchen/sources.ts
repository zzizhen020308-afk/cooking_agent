import {VARIANT_SOURCES} from './variants.ts';
import {WEB_SOURCE_NOTES} from './web-recipes.ts';
import {LIBRARY_SOURCE_NOTES,SOURCE_SNAPSHOT} from './library.ts';
export type Evidence={label:string;url?:string;note?:string};
export const CONTENT_VERSION='2026.11.12';
const github='https://github.com/Anduin2017/HowToCook/blob/master/';
const hoc=(path:string)=>github+encodeURI(path);
export type RecipePlatform='HowToCook'|'下厨房'|'维基教科书';
export type RecipeLicense='Unlicense'|'CC BY-SA 4.0';
export type RecipeSource={kind:'edited'|'original';label:string;checkedAt:string;note:string;references:Evidence[];snapshot?:string;platform?:RecipePlatform;author?:string;sourceTitle?:string;license?:RecipeLicense;retrievedAt?:string;sourceRevision?:string;sourceLanguage?:'zh'|'en';translation?:string};
export const WIKIBOOKS_RECIPE_LICENSE_URL='https://creativecommons.org/licenses/by-sa/4.0/';
const sourceFingerprint=(value:string)=>{let a=2166136261,b=2246822519;for(const ch of value){const code=ch.codePointAt(0)!;a=Math.imul(a^code,16777619);b=Math.imul(b^code,3266489917);}return (a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0');};
function normalizedWikibooksTitle(value:unknown,language:'zh'|'en'='zh'):string|null{
 if(typeof value!=='string'||value.length>200||/[\x00-\x1f%\\#<>\[\]{}|?]/.test(value))return null;
 const title=value.normalize('NFC');
 if((language==='zh'?!/^(食谱|食譜)\/.+/.test(title):!/^Cookbook:.+/.test(title)||/^Cookbook:(?:Category|Template|File|User|Wikibooks|Help|Module|Special):/i.test(title))||title.trim()!==title||title.split('/').some(part=>!part||part==='.'||part==='..'))return null;
 return title;
}
/** Recipe evidence is pinned to an explicit revision, never a mutable article URL. */
export function normalizeWikibooksRecipeUrl(raw:unknown):string|null{
 if(typeof raw!=='string'||raw.length>1800||/[\x00-\x1f\\]/.test(raw))return null;
 try{
  const u=new URL(raw);
  if(u.protocol!=='https:'||!['zh.wikibooks.org','en.wikibooks.org'].includes(u.hostname)||u.username||u.password||u.port||u.hash||u.pathname!=='/w/index.php')return null;
  if([...u.searchParams].length!==2||u.searchParams.getAll('title').length!==1||u.searchParams.getAll('oldid').length!==1)return null;
  const language=u.hostname==='zh.wikibooks.org'?'zh':'en',title=normalizedWikibooksTitle(u.searchParams.get('title'),language),revision=u.searchParams.get('oldid');
  if(!title||!revision||!/^[1-9]\d{0,19}$/.test(revision))return null;
  return `https://${language}.wikibooks.org/w/index.php?title=${encodeURIComponent(title)}&oldid=${revision}`;
 }catch{return null;}
}
export function wikibooksSourceIdentity(raw:unknown):{title:string;revision:string;id:string;language:'zh'|'en'}|null{
 const url=normalizeWikibooksRecipeUrl(raw);if(!url)return null;
 const u=new URL(url),params=u.searchParams,title=params.get('title')!,revision=params.get('oldid')!,language=u.hostname==='zh.wikibooks.org'?'zh':'en';
 return {title,revision,id:'online-wb-'+language+'-'+sourceFingerprint(title),language};
}
export function wikibooksHistoryUrl(raw:string,language:'zh'|'en'='zh'):string|null{
 if(!['zh','en'].includes(language))return null;
 const title=normalizedWikibooksTitle(raw,language);return title?`https://${language}.wikibooks.org/w/index.php?title=${encodeURIComponent(title)}&action=history`:null;
}
/** Only immutable Markdown recipes in the upstream HowToCook dishes directory. */
export function normalizeHowToCookRecipeUrl(raw:unknown):string|null{
 if(typeof raw!=='string'||raw.length>1200||raw.includes('\\'))return null;
 try{
  const u=new URL(raw);
  if(u.protocol!=='https:'||u.hostname!=='github.com'||u.username||u.password||u.port||u.search||u.hash)return null;
  if(/%2f|%5c/i.test(u.pathname))return null;
  const decoded=decodeURIComponent(u.pathname);
  if(/[\x00-\x1f%\\]/.test(decoded))return null;
  const match=decoded.match(/^\/Anduin2017\/HowToCook\/blob\/([a-f0-9]{40})\/(dishes\/.+\.md)$/);
  if(!match||match[2].split('/').some(p=>!p||p==='.'||p==='..'))return null;
  return `https://github.com/Anduin2017/HowToCook/blob/${match[1]}/${match[2].split('/').map(encodeURIComponent).join('/')}`;
 }catch{return null;}
}
export function howToCookSourceIdentity(raw:unknown):{snapshot:string;path:string;id:string}|null{
 const url=normalizeHowToCookRecipeUrl(raw);if(!url)return null;
 const parts=new URL(url).pathname.split('/'),path=decodeURIComponent(parts.slice(5).join('/'));
 return {snapshot:parts[4],path,id:'online-hoc-'+sourceFingerprint(path)};
}
const edited=(path:string,note:string):RecipeSource=>({kind:'edited',label:'掌勺整理版 · 技法参考 HowToCook',checkedAt:'2026-11-10',note,references:[{label:'查看参考做法 · HowToCook',url:hoc(path)}]});
export const RECIPE_SOURCES:Record<string,RecipeSource>={
 'braised-pork':edited('dishes/meat_dish/红烧肉/简易红烧肉.md','参考焯水、上色、补热水慢炖与收汁方法。本餐为 2 人基准整理配方，份量、调味和时间采用掌勺版本，不照搬原文的大份量。'),
 'tomato-eggs':edited('dishes/vegetable_dish/西红柿炒鸡蛋.md','参考先炒蛋盛出、炒番茄出汁再合炒的方法；本餐用量与步骤按掌勺 2 人基准整理，鸡蛋数量向上取整。'),
 'yam-ribs':edited('dishes/soup/排骨山药玉米汤/排骨山药玉米汤.md','参考排骨预处理与小火炖汤方法；本版省去玉米、胡萝卜，山药后放，用量和炖煮时长已独立调整。'),
 'garlic-broccoli':edited('dishes/vegetable_dish/蒜蓉西兰花.md','参考西兰花分朵、焯水和蒜蓉调味方法；本版为盐味翻炒版，省去原参考中的蚝油和生抽。'),
 'potato-strips':edited('dishes/vegetable_dish/酸辣土豆丝.md','参考切丝、冲洗淀粉与醋味快炒；本版不含辣椒，调味和时间采用掌勺整理配方。'),
 'cucumber-salad':edited('dishes/vegetable_dish/凉拌黄瓜.md','参考拍碎黄瓜与蒜醋汁拌匀的方法；本版省去蚝油、香油和长时间腌制，现拌现吃。'),
 'mushroom-chicken':edited('dishes/meat_dish/香菇滑鸡/香菇滑鸡.md','参考鸡腿肉与香菇的搭配；本版使用鲜香菇、增加焖煮步骤，用量、火候和时间均为掌勺整理版。'),
 ...Object.fromEntries(Object.entries(LIBRARY_SOURCE_NOTES).map(([id,s])=>[id,{kind:'edited' as const,label:'掌勺整理版 · 参考 HowToCook',checkedAt:'2026-11-12',note:s.note,snapshot:SOURCE_SNAPSHOT,references:[{label:'查看本次核对原文 · HowToCook',url:'https://github.com/Anduin2017/HowToCook/blob/'+SOURCE_SNAPSHOT+'/'+encodeURI(s.path)}]}])),
 ...Object.fromEntries(Object.entries(WEB_SOURCE_NOTES).map(([id,s])=>[id,{kind:'edited' as const,label:'掌勺整理版 · 参考下厨房',platform:'下厨房' as const,author:s.author,sourceTitle:s.title,checkedAt:'2026-11-12',note:s.note,references:[{label:`${s.title} · ${s.author} · 下厨房`,url:s.url}]}])),
 ...VARIANT_SOURCES,
 tofu:{kind:'original',label:'掌勺自编配方',checkedAt:'2026-11-10',note:'2 人基准的家常煮豆腐版本。配方与步骤由掌勺整理，未标称为外部菜谱或厨师实测配方。',references:[]}
};
export const RULE_EVIDENCE:Evidence={label:`掌勺内置答疑规则 · ${CONTENT_VERSION}`,note:'按当前菜谱、份量、步骤和计时计算，支持列明的常见问题；不是自由生成的厨师问答。'};
export const POULTRY_EVIDENCE:Evidence={label:'FoodSafety.gov：安全最低内部温度',url:'https://www.foodsafety.gov/food-safety-charts/safe-minimum-internal-temperatures',note:'禽肉以食物温度计测得至少约 74°C 为依据；计时与肉色不能单独证明熟度。'};
export function evidenceFor(recipeId?:string,frozenSource?:RecipeSource):Evidence[]{const s=frozenSource||(recipeId?RECIPE_SOURCES[recipeId]:undefined);return [RULE_EVIDENCE,...(recipeId&&['fish-fragrant-pork','wood-ear-salad'].includes(recipeId)?[SOAKING_EVIDENCE]:[]),...(recipeId==='egg-fried-rice'?[RICE_EVIDENCE]:[]),...(s?[{label:s.label,note:s.note},...s.references]:[])];}
export const BUYING_TIPS:Record<string,string>={pork:'按所需重量选带皮五花肉；预切块要留意块的大小与是否额外腌制。',ribs:'按所需重量选剁块排骨，核对切块大小与净含量。',yam:'按去皮后的用量估算，整根购买会有去皮损耗；处理时可戴手套。',tomato:'核对净重；个头不同，按重量比按个数更接近菜谱。',egg:'按个数购买，核对包装完整与储存要求。',chicken:'本版使用鸡腿肉；如果买带骨鸡腿，去骨后实际可用重量会减少。',mushroom:'本版用鲜香菇，干香菇不能按相同重量直接替换。',tofu:'选择嫩豆腐；净含量不包含额外包装重量。',salt:'已有足量时不重复购买。调味可少量分次加入。',oil:'已有足量时不重复买整瓶，按本餐需求备好即可。'};

export const FIRE_EVIDENCE:Evidence={label:'国家消防救援局：油锅起火处理',url:'https://www.119.gov.cn/kp/hzyf/jt/2025/52074.shtml',note:'安全时关闭燃气、盖严锅盖并待冷却，油锅火不泼水；危险时优先撤离求助。'};

export const SOAKING_EVIDENCE:Evidence={label:'中山市市场监督管理局：泡发木耳提示',url:'https://www.zs.gov.cn/zszjj/gkmlpt/content/2/2538/post_2538512.html',note:'洁净冷水泡发、控制时长，泡好及时烹饪；久泡的毒素风险不能靠煮熟补救。'};
export const RICE_EVIDENCE:Evidence={label:'FoodSafety.gov：剩食复热',url:'https://www.foodsafety.gov/food-safety-charts/safe-minimum-internal-temperatures',note:'冷藏剩饭需充分复热，中心温度至少约 74°C；储存不当的米饭不能靠复热补救。'};
export const SEAFOOD_EVIDENCE:Evidence={label:'FoodSafety.gov：鱼虾熟度',url:'https://www.foodsafety.gov/food-safety-charts/safe-minimum-internal-temperatures',note:'鱼最厚处约 63°C；虾肉需珠白且不透明，不能只按外壳颜色或计时判断。'};
Object.assign(BUYING_TIPS,{'wood-ear':'按干重购买，不与泡发重混用；只泡本餐用量，按步骤计时后及时煮熟。','ready-tofu':'必须选标签明确可直接食用的即食豆腐，并按标签冷藏；普通嫩豆腐不直接替代此无加热做法。','cooked-rice':'本版需已煮熟的米饭，清单不是生米重量；若自行煮饭，需另留煮饭时间。',bass:'按整条鱼净重选购，可请商家去鳞、鳃与内脏；实际整鱼规格会影响所需蒸制时间。',shrimp:'清单按带壳整虾重量，冷冻虾须先在冷藏中充分解冻并另留时间。',wings:'本版按鸡翅中重量计算，不以固定只数代替称重；冷冻鸡翅需提前安全解冻。',peanut:'选已经炒熟、无额外调味的花生；不是生花生。',oyster:'核对配料和过敏原提示，蚝油一般含牡蛎成分。',noodles:'按干面条重量购买，煮制时间以包装说明和实际熟度为准。'});
