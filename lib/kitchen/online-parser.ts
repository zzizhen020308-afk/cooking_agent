/** Read facts from public recipe markup or text supplied by the visitor.
 * These are unreviewed source fields, never an executable cooking plan. */
export type RawRecipeFields={title:string;author?:string;ingredients:{name:string;quantityText:string}[];steps:string[];servingsText?:string};
/** Field availability only; “complete” does not mean quantities or timing were reviewed. */
export type RecipeContentState='link-only'|'complete'|'partial';
export function recipeContentState(recipe:Pick<RawRecipeFields,'ingredients'|'steps'>):RecipeContentState{
 const ingredients=recipe.ingredients.length>0,steps=recipe.steps.length>0;
 return ingredients&&steps?'complete':ingredients||steps?'partial':'link-only';
}
const MAX_TEXT=60000;
const entities:Record<string,string>={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
export function decodeRecipeText(value:string):string{return value.replace(/&#(x[0-9a-f]+|\d+);|&([a-z]+);/gi,(whole,code,name)=>{if(name)return entities[name.toLowerCase()]??whole;const n=code[0].toLowerCase()==='x'?parseInt(code.slice(1),16):Number(code);return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';});}
function clean(value:string):string{return decodeRecipeText(value.replace(/<[^>]*>/g,' ').replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1')).replace(/[\t \u00a0]+/g,' ').trim();}
/** Search-result titles contain SEO decorations that are not part of the recipe name. */
export function cleanXiachufangTitle(value:string):string{
 return clean(value).replace(/【步骤图】|〖步骤图〗/g,'').replace(/的做法(?:步骤)?[\s\S]*$/,'').replace(/\s*[_-]\s*(?:菜谱\s*[_-]\s*)?下厨房\s*$/,'').trim().slice(0,120);
}
function splitIngredient(value:string):{name:string;quantityText:string}|null{
 const text=clean(value).replace(/^[-*•]\s*/, '').trim();if(!text||/^#/.test(text)||text.length>160)return null;
 if(text.startsWith('|')){const cells=text.split('|').map(s=>s.trim()).filter(Boolean);if(cells.length!==2||cells.every(s=>/^:?-{2,}:?$/.test(s))||/^(?:用料|食材|材料|配料|名称)$/.test(cells[0]))return null;return {name:cells[0],quantityText:cells[1]};}
 const separated=text.match(/^(.{1,60}?)\s+(.{1,80})$/);
 if(separated)return {name:separated[1].trim(),quantityText:separated[2].trim()};
 const compact=text.match(/^([^\d一二三四五六七八九十半]+?)([\d一二三四五六七八九十半]+(?:[.．/／~～—–-][\d一二三四五六七八九十半]+)?\s*(?:克|千克|公斤|毫升|升|斤|两|g|kg|ml|l|个|只|根|颗|片|瓣|勺|匙|杯|碗|块|条|把|适量|少许).*)$/i);
 if(compact)return {name:compact[1].trim(),quantityText:compact[2].trim()};
 return {name:text,quantityText:''};
}
function uniqueIngredients(lines:string[]){const seen=new Set<string>();return lines.map(splitIngredient).filter((x):x is NonNullable<typeof x>=>!!x).filter(x=>{const key=x.name+'|'+x.quantityText;if(seen.has(key))return false;seen.add(key);return true;}).slice(0,50);}
function instructionTexts(value:unknown):string[]{
 if(typeof value==='string')return value.split(/\n+/).map(clean).filter(Boolean);
 if(Array.isArray(value))return value.flatMap(instructionTexts);
 if(value&&typeof value==='object'){const v=value as Record<string,unknown>;return typeof v.text==='string'?[clean(v.text)]:instructionTexts(v.itemListElement);}
 return [];
}
function findRecipe(value:unknown,depth=0):Record<string,unknown>|null{
 if(depth>8)return null;
 if(Array.isArray(value)){for(const v of value){const found=findRecipe(v,depth+1);if(found)return found;}}
 else if(value&&typeof value==='object'){const v=value as Record<string,unknown>,types=Array.isArray(v['@type'])?v['@type']:[v['@type']];if(types.some(t=>t==='Recipe'||t==='https://schema.org/Recipe'))return v;for(const key of ['@graph','mainEntity','itemListElement']){const found=findRecipe(v[key],depth+1);if(found)return found;}}
 return null;
}
export function parseXiachufangHtml(html:string):RawRecipeFields|null{
 if(typeof html!=='string'||html.length>1000000)return null;
 for(const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
  try{const recipe=findRecipe(JSON.parse(match[1]));if(!recipe)continue;const title=typeof recipe.name==='string'?clean(recipe.name):'';if(!title)continue;
   const authorValue=Array.isArray(recipe.author)?recipe.author[0]:recipe.author;const author=typeof authorValue==='string'?clean(authorValue):authorValue&&typeof authorValue==='object'&&typeof (authorValue as {name?:unknown}).name==='string'?clean((authorValue as {name:string}).name):undefined;
   return {title:title.slice(0,120),...(author?{author:author.slice(0,80)}:{}),ingredients:uniqueIngredients(Array.isArray(recipe.recipeIngredient)?recipe.recipeIngredient.filter((s):s is string=>typeof s==='string'):[]),steps:instructionTexts(recipe.recipeInstructions).filter(Boolean).slice(0,40).map(s=>s.slice(0,3000)),...(typeof recipe.recipeYield==='string'?{servingsText:clean(recipe.recipeYield).slice(0,80)}:{})};
  }catch{/* Not all ld+json blocks on a page describe recipes. */}
 }
 const stripped=html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi,'');
 const title=clean(stripped.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]??'');
 const author=clean(stripped.match(/(?:作者[：:]\s*|class=["'][^"']*\bauthor\b[^"']*["'][^>]*>)([\s\S]{0,500}?)(?:<\/a>|<\/p>|<\/span>|<\/div>)/i)?.[1]??'');
 const ingredients:{name:string;quantityText:string}[]=[];
 for(const row of stripped.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){const cells=[...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(c=>clean(c[1]));if(cells.length===2&&cells[0])ingredients.push({name:cells[0].slice(0,60),quantityText:cells[1].slice(0,80)});}
 const steps=[...stripped.matchAll(/<p\b[^>]*class\s*=\s*["'][^"']*\btext\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/gi)].map(m=>clean(m[1])).filter(Boolean);
 if(title&&(ingredients.length||steps.length))return {title:title.slice(0,120),...(author?{author:author.slice(0,80)}:{}),ingredients:ingredients.slice(0,50),steps:steps.slice(0,40).map(s=>s.slice(0,3000))};
 const text=stripped.replace(/<\/(?:h[1-6]|p|li|tr|div|table|section)>|<br\s*\/?>/gi,'\n').replace(/<[^>]*>/g,' ');
 return parsePastedRecipe(text);
}
/** A visitor may paste a recipe for personal review when the source blocks bots.
 * Missing quantities or durations stay missing; the review UI must ask for them. */
export function parsePastedRecipe(text:string):RawRecipeFields|null{
 if(typeof text!=='string'||!text.trim()||text.length>MAX_TEXT)return null;
 const sourceLines=text.replace(/\r\n?/g,'\n').split('\n').map(l=>({text:clean(l).replace(/^#{1,6}\s*/, ''),heading:/^\s*#{1,6}\s/.test(l)})).filter(l=>!!l.text);
 const lines=sourceLines.map(l=>l.text);
 const ingredientsAt=lines.findIndex(l=>/^(?:用料|食材|材料|配料)(?:[：:]|$)/.test(l)||/^\|\s*(?:用料|食材|材料|配料|名称)\s*\|/.test(l));
 const stepsAt=lines.findIndex((l,i)=>i>ingredientsAt&&/^(?:(?:.*的)?做法步骤|做法|制作步骤|烹饪步骤|步骤[：:]?$|步骤\s*[一二三四五六七八九十\d]+|[1１][.、．)）]\s*)/.test(l));
 if(ingredientsAt<0&&stepsAt<0)return null;
 const title=lines.slice(0,ingredientsAt<0?stepsAt:ingredientsAt).find(l=>!/^作者[：:]/.test(l)&&!/(?:人浏览|人收藏|APP中|^https?:)/.test(l))?.slice(0,120)||'待核对菜谱';
 const author=lines.find(l=>/^作者[：:]/.test(l))?.replace(/^作者[：:]\s*/, '').slice(0,80);
 const rawIngredients=ingredientsAt>=0?lines.slice(ingredientsAt+1,stepsAt>=0?stepsAt:undefined):[];
 const ingredients=uniqueIngredients(rawIngredients.filter(l=>!/^#/.test(l)&&!/(?:小贴士|创建时间|人浏览|人收藏)/.test(l)));
 const steps:string[]=[];let current='';
 const stepMarker=/^(?:步骤\s*[一二三四五六七八九十\d]+|\d+[.、．)）])\s*[：:]?\s*(.*)$/;
 const stepLines=stepsAt>=0?sourceLines.slice(stepsAt):[];
 const hasNumberedSteps=stepLines.some(line=>stepMarker.test(line.text));
 for(const row of stepLines){
  const line=row.text;
  if(/(?:小贴士|菜谱创建时间|上传你做的|作者的其他菜谱|参照这个菜谱)/.test(line))break;
  if(/^(?:(?:.*的)?做法步骤|做法|制作步骤|烹饪步骤|步骤)[：:]?$/.test(line))continue;
  const marker=line.match(stepMarker);
  if(marker){if(current)steps.push(current);current=marker[1]||'';}
  else if(!row.heading&&!/^(?:Image:|图片(?:[：:]|$)|图\s*\d+(?:[：:]|$))/i.test(line)){
   const detail=line.replace(/^[-*•]\s*/,'');
   if(hasNumberedSteps)current+=(current?'\n':'')+detail;
   else steps.push(detail);
  }
 }
 if(current)steps.push(current);
 return {title,...(author?{author}:{}),ingredients,steps:steps.slice(0,40).map(s=>s.slice(0,3000))};
}
