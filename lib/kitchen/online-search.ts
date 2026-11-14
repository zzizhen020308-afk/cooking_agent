import {parseXiachufangHtml,parsePastedRecipe,recipeContentState,cleanXiachufangTitle,type RawRecipeFields,type RecipeContentState} from './online-parser.ts';
export type RawOnlineRecipe=RawRecipeFields&{id:string;url:string;retrievedAt:string;retrieval:'direct'|'search-index'|'pasted';contentState:RecipeContentState};
export type OnlineSearchResult={status:'ok'|'not_configured'|'restricted'|'unavailable';candidates:RawOnlineRecipe[];searchUrl:string;message:string};
export type OnlineSearchOptions={apiKey?:string;fetcher?:typeof fetch;now?:number};
const MAX_BYTES=750000,TIMEOUT_MS=10000;
export function normalizeXiachufangRecipeUrl(value:string):string|null{
 try{const u=new URL(value);if(u.protocol!=='https:'||!['www.xiachufang.com','m.xiachufang.com'].includes(u.hostname)||u.port||u.username||u.password||!/^\/recipe\/\d{5,12}\/?$/.test(u.pathname))return null;return `https://${u.hostname}/recipe/${u.pathname.split('/')[2]}/`;}catch{return null;}
}
export function xiachufangSearchUrl(query:string):string{return 'https://www.xiachufang.com/search/?keyword='+encodeURIComponent(query)+'&cat=1001';}
function blocked(text:string,url=''):boolean{return /humancheck_captcha|验证你是真人|人机验证|请完成验证|访问过于频繁|安全验证|验证码/.test(text+' '+url);}
class RestrictedError extends Error{}
async function limitedFetch(url:string,init:RequestInit,fetcher:typeof fetch):Promise<string>{
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
 try{
  const response=await fetcher(url,{...init,signal:controller.signal,redirect:'manual'});
  const location=response.headers.get('location');
  if(response.status>=300&&response.status<400){if(location&&blocked('',location))throw new RestrictedError();throw new Error('Unexpected redirect');}
  if(response.status===403||response.status===429)throw new RestrictedError();
  if(!response.ok)throw new Error('Upstream unavailable');
  const size=Number(response.headers.get('content-length')||0);if(size>MAX_BYTES)throw new Error('Response too large');
  if(!response.body)return '';
  const reader=response.body.getReader(),decoder=new TextDecoder();let bytes=0,text='';
  try{while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>MAX_BYTES){await reader.cancel();throw new Error('Response too large');}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}finally{reader.releaseLock();}
  return text;
 }finally{clearTimeout(timer);}
}
function queryValue(query:string):string|null{return typeof query==='string'&&query.trim().length>=2&&query.trim().length<=40&&!/[<>\r\n\u0000-\u001f]|https?:\/\//i.test(query)?query.trim():null;}
function timestamp(now?:number):string{return new Date(now??Date.now()).toISOString();}
function makeCandidate(fields:RawRecipeFields,url:string,now:number|undefined,retrieval:RawOnlineRecipe['retrieval']):RawOnlineRecipe{return {...fields,contentState:recipeContentState(fields),id:'xiachufang-'+new URL(url).pathname.split('/')[2],url,retrievedAt:timestamp(now),retrieval};}
/** Server-only Tavily adapter. The API key never belongs in NEXT_PUBLIC_* or a browser bundle.
 * Official contract: https://docs.tavily.com/documentation/api-reference/endpoint/search */
export async function searchXiachufang(query:string,options:OnlineSearchOptions={}):Promise<OnlineSearchResult>{
 const q=queryValue(query),searchUrl=xiachufangSearchUrl(q||'');
 const result=(status:OnlineSearchResult['status'],message:string,candidates:RawOnlineRecipe[]=[]):OnlineSearchResult=>({status,message,candidates,searchUrl});
 if(!q)return result('unavailable','请输入 2–40 字的菜名。');
 const key=options.apiKey;
 if(!key)return result('not_configured','线上搜索服务尚未配置。你可以打开下厨房搜索，并把选中的菜谱用料和步骤粘贴回来核对。');
 try{
  const body=await limitedFetch('https://api.tavily.com/search',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify({query:q+' 菜谱 用料 做法',topic:'general',search_depth:'basic',max_results:3,include_domains:['xiachufang.com'],include_answer:false,include_raw_content:'markdown',include_images:false,auto_parameters:false})},options.fetcher??fetch);
  const data:unknown=JSON.parse(body),rows=data&&typeof data==='object'&&Array.isArray((data as {results?:unknown}).results)?(data as {results:unknown[]}).results:[];
  const candidates:RawOnlineRecipe[]=[],seen=new Set<string>();
  for(const row of rows.slice(0,20)){
   if(!row||typeof row!=='object')continue;const r=row as Record<string,unknown>,url=typeof r.url==='string'?normalizeXiachufangRecipeUrl(r.url):null;if(!url)continue;
   const id=new URL(url).pathname.split('/')[2];if(seen.has(id))continue;seen.add(id);
   const raw=typeof r.raw_content==='string'?r.raw_content.slice(0,60000):'';
   if(blocked(raw))continue;
   // Search snippets are not full recipes. Without raw_content, retain the link only.
   const parsed=raw?(raw.includes('<html')?parseXiachufangHtml(raw):parsePastedRecipe(raw)):null;
   const title=cleanXiachufangTitle(typeof r.title==='string'?r.title:parsed?.title||'')||'待核对菜谱';
   candidates.push(makeCandidate(parsed?{...parsed,title}:{title,ingredients:[],steps:[]},url,options.now,'search-index'));if(candidates.length===3)break;
  }
  if(!candidates.length)return result('unavailable','暂未取得可用的下厨房菜谱结果。可以打开原站搜索，选好后粘贴用料和步骤。');
  const message=candidates.every(c=>c.contentState==='link-only')?'已找到下厨房原页链接，但搜索服务未返回菜谱正文，暂不能据此生成食材清单和烹饪安排。请打开原文核对，再粘贴用料与步骤。':'搜索结果来自下厨房公开网页的搜索索引。各份做法会标明正文读取情况；请核对原作者、用量、步骤和时长后加入本餐，内容缺失时需粘贴原文补齐。';
  return result('ok',message,candidates);
 }catch(error){return error instanceof RestrictedError?result('restricted','搜索服务暂时限制访问，请稍后重试，或打开下厨房后粘贴菜谱。'):result('unavailable','线上搜索暂时不可用，请稍后重试，或打开下厨房后粘贴菜谱。');}
}
/** Only whitelisted public recipe URLs are fetched. Redirects/captchas are never bypassed. */
export async function fetchXiachufangRecipe(value:string,options:OnlineSearchOptions={}):Promise<OnlineSearchResult>{
 const url=normalizeXiachufangRecipeUrl(value),result=(status:OnlineSearchResult['status'],message:string,candidates:RawOnlineRecipe[]=[]):OnlineSearchResult=>({status,message,candidates,searchUrl:url||xiachufangSearchUrl('')});
 if(!url)return result('unavailable','请输入 https://www.xiachufang.com/recipe/ 或 https://m.xiachufang.com/recipe/ 开头的菜谱链接。');
 try{const html=await limitedFetch(url,{headers:{Accept:'text/html'}},options.fetcher??fetch);if(blocked(html))throw new RestrictedError();const fields=parseXiachufangHtml(html);if(!fields)return result('unavailable','此页面未提供可读取的菜谱用料和步骤，请从原站复制后粘贴。');const candidate=makeCandidate(fields,url,options.now,'direct');return result('ok',candidate.contentState==='complete'?'已读取公开菜谱的用料与步骤，加入本餐前请核对原文、用量和时长。':'只读取到部分菜谱内容，不能直接生成完整计划。请打开原文核对，补齐用料和步骤。',[candidate]);}
 catch(error){return error instanceof RestrictedError?result('restricted','下厨房要求人工验证，无法自动读取。请在原站打开菜谱，将用料和步骤粘贴回来；掌勺不会绕过验证。'):result('unavailable','暂时无法读取这份菜谱。请打开原站，将用料和步骤粘贴回来。');}
}
