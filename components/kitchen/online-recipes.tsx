'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight,BookOpen,Check,Plus,Search,X} from 'lucide-react';
import {RECIPE_CATEGORIES,type RecipeCategory} from '@/lib/kitchen/catalog';
import type {PlannedRecipe} from '@/lib/kitchen/snapshots';
import {parsePastedRecipe} from '@/lib/kitchen/online-parser';
import {parseIngredientQuantity,recipeFromDraft,recipeSourceUrl,type DraftIngredient,type DraftRecipe,type DraftStep} from '@/lib/kitchen/import-recipe';

import {sourceDraftFromCandidate,type SourceRecipeCandidate} from '@/lib/kitchen/source-draft';
type Candidate=SourceRecipeCandidate;
type SearchResponse={status:'ok'|'not_configured'|'restricted'|'unavailable';candidates:Candidate[];searchUrl:string;message:string};
const emptyIngredient=():DraftIngredient=>({name:'',amount:'',unit:'g',category:'生鲜'});
const emptyStep=(index=0):DraftStep=>({title:`第 ${index+1} 步`,detail:'',minutes:'',equipment:'none',mode:'active'});
const baseDraft=(query:string):DraftRecipe=>({title:query.slice(0,60),url:'',author:'',baseServings:'',category:'荤菜',ingredients:[emptyIngredient()],steps:[emptyStep()],confirmed:false});
const searchLink=(query:string)=>`https://www.xiachufang.com/search/?keyword=${encodeURIComponent(query.slice(0,60))}`;
export function OnlineRecipes({initialQuery,onImport,onClose}:{initialQuery:string;onImport:(recipe:PlannedRecipe)=>void;onClose:()=>void}){
 const [provider,setProvider]=useState<'HowToCook'|'xiachufang'>('HowToCook'),[preview,setPreview]=useState<{candidate:Candidate;prepared:ReturnType<typeof sourceDraftFromCandidate>}|null>(null);
 const [query,setQuery]=useState(initialQuery),[busy,setBusy]=useState<'search'|'import'|null>(null),[result,setResult]=useState<SearchResponse|null>(null),[error,setError]=useState('');
 const [draft,setDraft]=useState<DraftRecipe>(()=>baseDraft(initialQuery)),[raw,setRaw]=useState(''),[manual,setManual]=useState(false),[review,setReview]=useState(false),[parseNotice,setParseNotice]=useState('');
 const abort=useRef<AbortController|null>(null),requestId=useRef(0);
 useEffect(()=>()=>{requestId.current++;abort.current?.abort();},[]);
 useEffect(()=>{if(initialQuery.trim())void requestSearch('search',initialQuery);},[]);
 function change<K extends keyof DraftRecipe>(key:K,value:DraftRecipe[K]){setDraft(d=>({...d,[key]:value,confirmed:false}));}
 async function requestSearch(kind:'search'|'import',value:string,source=provider){
  if(kind==='search'&&!value.trim()){setError('先输入想找的菜名。');return;}
  if(kind==='import'&&!recipeSourceUrl(value)){setError('请填写下厨房原页或 HowToCook 固定版本菜谱的 HTTPS 链接。');return;}
  abort.current?.abort();const controller=new AbortController();abort.current=controller;const id=++requestId.current;setBusy(kind);setError('');if(kind==='search')setPreview(null);
  const timeout=setTimeout(()=>controller.abort(),25000);
  try{
   const response=await fetch(`/api/recipes/${kind}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(kind==='search'?{query:value.trim(),source}:{url:value}),signal:controller.signal});
   const data=await response.json() as SearchResponse;if(id!==requestId.current)return;
   if(!response.ok||!data||!['ok','not_configured','restricted','unavailable'].includes(data.status)||!Array.isArray(data.candidates))throw new Error(typeof data?.message==='string'?data.message:'这次读取未完成，请稍后重试。');
   const candidates=data.candidates.slice(0,3).filter(c=>typeof c?.title==='string'&&typeof c?.url==='string'&&Boolean(recipeSourceUrl(c.url))&&Array.isArray(c.ingredients)&&Array.isArray(c.steps));
   setResult({...data,candidates});
   if(kind==='import'&&data.status==='ok'&&candidates.length)chooseCandidate(candidates[0]);
  }catch(e){if(id===requestId.current){setError((e as Error).name==='AbortError'?'这次读取超时了。可以打开原菜谱，在下方粘贴食材或手动整理。':(e as Error).message);}}
  finally{clearTimeout(timeout);if(id===requestId.current)setBusy(null);}
 }
 function chooseCandidate(candidate:Candidate){
  if(candidate.platform==='HowToCook'&&candidate.license==='Unlicense'){setPreview({candidate,prepared:sourceDraftFromCandidate(candidate,initialQuery||candidate.title)});setManual(false);setReview(false);setError('');return;}
  if(candidate.ingredients.length>40||candidate.steps.length>20){setError('这份菜谱超过当前支持的 40 项食材或 20 个步骤，无法完整导入。请另选一份做法；不会自动删减食材或步骤。');return;}
  const ingredients=candidate.ingredients.slice(0,40).map(i=>parseIngredientQuantity(String(i.name).slice(0,40),String(i.quantityText).slice(0,100)));
  setDraft({...baseDraft(initialQuery||candidate.title),url:recipeSourceUrl(candidate.url)||'',author:candidate.author?.slice(0,200)||'',sourceTitle:candidate.title.slice(0,200),retrievedAt:candidate.retrievedAt,retrieval:candidate.retrieval,ingredients:ingredients.length?ingredients:[emptyIngredient()],steps:Array.from({length:Math.min(candidate.steps.length||1,20)},(_,i)=>emptyStep(i))});
  setReview(true);setManual(true);setError('');setParseNotice(`已读取 ${ingredients.length} 项食材、${candidate.steps.length} 个原文步骤。请核对原谱人数，补全未定量食材，并用自己的话写下每一步和参考时间。${candidate.servingsText?'原页人数提示：'+candidate.servingsText.slice(0,60):'原页人数未确认，不会默认为 2 人。'}`);
 }
 function parsePaste(){
  const parsed=parsePastedRecipe(raw);
  if(!parsed){setParseNotice('没有识别到完整的食材或步骤分区。可在下方逐项填写，原文链接仍需保留。');setReview(true);return;}
  if(parsed.ingredients.length>40||parsed.steps.length>20){setError('粘贴的菜谱超过当前支持的 40 项食材或 20 个步骤，无法完整导入。请核对是否包含无关内容，或另选做法。');return;}
  const ingredients=parsed.ingredients.slice(0,40).map(i=>parseIngredientQuantity(i.name,i.quantityText));
  setDraft(d=>({...d,title:d.title||parsed.title?.slice(0,60)||'',sourceTitle:d.sourceTitle||parsed.title?.slice(0,200)||d.title,author:d.author||parsed.author||'',retrieval:'pasted',retrievedAt:new Date().toISOString(),sourceMode:'manual',servingsBasis:undefined,ingredients:ingredients.length?ingredients:d.ingredients,steps:Array.from({length:Math.min(parsed.steps.length||1,20)},(_,i)=>emptyStep(i)),confirmed:false}));
  setReview(true);setParseNotice(`识别到 ${ingredients.length} 项食材、${parsed.steps.length} 个原文步骤。请逐项核对，并自行简写操作和填写参考分钟；“适量”等不会自动猜数。`);
 }
 function importDraft(){setError('');try{onImport(recipeFromDraft(draft));}catch(e){setError((e as Error).message);}}
 return <div className="online-recipes">
  <p className="online-intro">本地没收录的菜，优先联网读取 HowToCook 的完整开放菜谱。来源、用量和时间依据会保留；下厨房仍可选。</p><label className="online-provider">菜谱来源<select aria-label="在线菜谱来源" value={provider} disabled={Boolean(busy)} onChange={e=>{const next=e.target.value as typeof provider;setProvider(next);setResult(null);setPreview(null);if(query.trim())void requestSearch('search',query,next);}}><option value="HowToCook">HowToCook · 完整开放菜谱</option><option value="xiachufang">下厨房 · 搜索与手动导入</option></select></label>
  <div className="online-search-row"><label className="sr-only" htmlFor="online-query">在线搜索菜名</label><input id="online-query" value={query} onChange={e=>setQuery(e.target.value)} maxLength={40} placeholder="例如：蚂蚁上树"/><button className="primary" disabled={Boolean(busy)} onClick={()=>requestSearch('search',query)}><Search size={15}/>{busy==='search'?'正在查找…':'搜索完整菜谱'}</button></div>
  {result&&<div className={`online-status ${result.status==='ok'?'success':''}`} role="status"><BookOpen size={16}/><p>{result.message}</p></div>}
  <a className="text-button online-source-link" href={provider==='HowToCook'?'https://github.com/Anduin2017/HowToCook':searchLink(query)} target="_blank" rel="noopener noreferrer">查看{provider==='HowToCook'?'HowToCook 开放菜谱来源':'下厨房搜索结果'}<ArrowUpRight size={13}/></a>
  {result?.candidates.map(candidate=>{const complete=candidate.ingredients.length>0&&candidate.steps.length>0,hasFields=candidate.ingredients.length>0||candidate.steps.length>0;return <article className="online-candidate" key={candidate.id}><div><h3>{candidate.title}</h3><p>{candidate.platform||'下厨房'} · {candidate.author?`作者 ${candidate.author}`:'作者尚待核对'} · {complete?'已读取用料和步骤，仍需核对':hasFields?'只取得部分内容':'仅找到来源链接'}</p>{!complete&&<p className="online-review-note">{hasFields?'缺少完整用料或步骤':'未取得菜谱正文'}，暂不能据此生成食材清单和烹饪安排。可查看原文后手动导入。</p>}</div><div className="online-candidate-actions"><a href={recipeSourceUrl(candidate.url)!} target="_blank" rel="noopener noreferrer">查看原菜谱<ArrowUpRight size={12}/></a><button className="secondary" onClick={()=>chooseCandidate(candidate)}>{complete&&candidate.platform==='HowToCook'?'查看完整做法':complete?'核对并整理':'手动整理这份来源'}</button></div></article>;})}
  {preview&&<section className="online-preview" aria-label="完整菜谱预览"><h3>{preview.candidate.title}</h3><p className="online-fine">{preview.candidate.platform} · {preview.candidate.author||'社区贡献者'} · {preview.candidate.license} · 读取 {new Date(preview.candidate.retrievedAt).toLocaleDateString('zh-CN')} · 来源版本 {preview.candidate.snapshot?.slice(0,7)}</p><a className="text-button" href={recipeSourceUrl(preview.candidate.url)!} target="_blank" rel="noopener noreferrer">查看本次原谱与贡献者记录<ArrowUpRight size={13}/></a><p className="online-fine">{preview.prepared.draft.servingsBasis==='source'?`原谱基准 ${preview.prepared.draft.baseServings} 人份`:'原谱人数未注明，先按 2 人基准估算，可修改'} · 共 {preview.prepared.draft.steps.reduce((sum,step)=>sum+Number(step.minutes||0),0)} 分钟（仅各步骤，整餐另计共同备菜）</p><h3>原谱用料</h3><div className="online-preview-ingredients">{preview.prepared.draft.ingredients.map((i,index)=><span key={index}>{i.name}<b>{i.amount?i.amount+i.unit:i.originalQuantity||'用量待补齐'}</b></span>)}</div><h3>完整操作与排程时间</h3><ol className="online-preview-steps">{preview.prepared.draft.steps.map((step,index)=><li key={index}><h4>{step.title}</h4><p>{step.detail}</p><small>{step.minutes} 分钟 · {step.timingBasis==='source'?'原文时间':'排程估计（原谱未写）'} · {step.equipment==='none'?'不占炉灶':step.equipment}{step.mode==='active'?' · 动手操作':' · '+step.mode+'等待'}</small></li>)}</ol>{preview.prepared.warnings.map(w=><p className="online-review-note" key={w}>{w}</p>)}{preview.prepared.issues.map(i=><p className="online-error" key={i}>{i}</p>)}{preview.candidate.notes?.length?<details className="online-paste"><summary>原谱附加说明</summary>{preview.candidate.notes.map((note,index)=><p key={index}>{note}</p>)}</details>:null}<div className="online-candidate-actions"><button className="secondary" onClick={()=>{setDraft({...preview.prepared.draft,confirmed:false});setManual(true);setReview(true);setPreview(null);setParseNotice('已预填完整来源内容。更改分钟后会标为排程估计；请核对未明确的用量和人数。');}}>修改用量与步骤</button><button className="primary" disabled={Boolean(preview.prepared.issues.length)||Boolean(busy)} onClick={()=>{try{onImport(recipeFromDraft({...preview.prepared.draft,confirmed:true}));}catch(e){setError((e as Error).message);}}}><Check size={15}/>使用这份做法</button></div><p className="online-fine">点击使用表示接受以上配方、人数基准及排程估计。食材会按本餐人数换算；步骤中的文字数量不自动改写，请以生成的食材清单为准。</p></section>}
  <button className="text-button online-manual-toggle" onClick={()=>{setManual(v=>!v);setError('');}}>{manual?'收起手动导入':'已有原菜谱？粘贴链接或食材导入'}</button>
  {manual&&<div className="online-manual">
   <h3>保留原页，整理这一份做法</h3>
   <div className="online-form-grid"><label>本餐菜名<input value={draft.title} maxLength={60} onChange={e=>change('title',e.target.value)} placeholder="使用你点菜时的名称"/></label><label>作者或贡献者（可稍后补充）<input value={draft.author} maxLength={200} onChange={e=>change('author',e.target.value)} placeholder="未填写时会标注未核对"/></label></div>
   <label className="online-field">原菜谱链接<input value={draft.url} onChange={e=>change('url',e.target.value)} maxLength={1200} placeholder="下厨房原页或 HowToCook 固定版本 .md 链接" inputMode="url"/></label>
   <button className="secondary" disabled={Boolean(busy)} onClick={()=>requestSearch('import',draft.url)}>{busy==='import'?'正在读取…':'尝试读取这个链接'}</button>
   <details className="online-paste"><summary>粘贴原菜谱的食材与步骤</summary><p>可使用“用料”“做法”分区。粘贴内容只在本机用于整理；不会上传为公共菜谱。</p><label className="sr-only" htmlFor="online-paste">粘贴菜谱原文</label><textarea id="online-paste" value={raw} onChange={e=>setRaw(e.target.value)} maxLength={25000} rows={7} placeholder={'用料\n莴笋 300克\n猪瘦肉 200克\n做法\n…'}/><button className="secondary" onClick={parsePaste}>识别食材与步骤数量</button></details>
   {!review&&<button className="text-button" onClick={()=>setReview(true)}>直接逐项填写<Plus size={13}/></button>}
   {parseNotice&&<p className="online-review-note" role="status">{parseNotice}</p>}
   {review&&<>
    <div className="online-form-grid"><label>原菜谱适用人数<input type="number" min={1} max={12} value={draft.baseServings} onChange={e=>setDraft(d=>({...d,baseServings:e.target.value,servingsBasis:'user',confirmed:false}))} placeholder="请核对，不能留空"/></label><label>菜品分类<select value={draft.category} onChange={e=>change('category',e.target.value as RecipeCategory)}>{RECIPE_CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></label></div>
    <h3>核对食材用量</h3><p className="online-fine">填写上面原谱人数对应的用量，系统再按本餐人数换算。“一勺”“一根”“适量”需要你核对成 g、ml 或个；不会自动估算。</p>
    <div className="online-ingredients">{draft.ingredients.map((ingredient,index)=><div className="online-ingredient" key={index}>
     <label>食材<input aria-label={`第 ${index+1} 项食材名称`} value={ingredient.name} maxLength={40} onChange={e=>change('ingredients',draft.ingredients.map((x,i)=>i===index?{...x,name:e.target.value}:x))}/>{ingredient.originalQuantity&&<small>原文：{ingredient.originalQuantity}</small>}</label>
     <label>数量<input aria-label={`第 ${index+1} 项食材数量`} inputMode="decimal" value={ingredient.amount} onChange={e=>change('ingredients',draft.ingredients.map((x,i)=>i===index?{...x,amount:e.target.value}:x))} placeholder="待核对"/></label>
     <label>单位<select aria-label={`第 ${index+1} 项食材单位`} value={ingredient.unit} onChange={e=>change('ingredients',draft.ingredients.map((x,i)=>i===index?{...x,unit:e.target.value as DraftIngredient['unit']}:x))}><option>g</option><option>ml</option><option>个</option></select></label>
     <label>类别<select aria-label={`第 ${index+1} 项食材类别`} value={ingredient.category} onChange={e=>change('ingredients',draft.ingredients.map((x,i)=>i===index?{...x,category:e.target.value as DraftIngredient['category']}:x))}><option>生鲜</option><option>调味</option></select></label>
     <button className="icon-button" aria-label={`删除第 ${index+1} 项食材`} disabled={draft.ingredients.length<=1} onClick={()=>change('ingredients',draft.ingredients.filter((_,i)=>i!==index))}><X size={14}/></button>
    </div>)}</div><button className="text-button" disabled={draft.ingredients.length>=40} onClick={()=>change('ingredients',[...draft.ingredients,emptyIngredient()])}><Plus size={13}/>增加食材</button>
    <h3>{draft.sourceMode==='source'?'核对原谱操作、时间和锅具':'简写操作，核对时间和锅具'}</h3><p className="online-fine">开放来源可保留原文操作；手动来源请填写自己的简写。步骤中的具体份量不会自动改写，请按生成的食材清单操作；标注排程估计的时间可自行调整。当前支持炉灶和四类锅具，烤箱、微波炉或压力锅做法暂不导入。</p>
    {draft.steps.map((step,index)=><section className="online-step" key={index}><div className="online-step-title"><label>第 {index+1} 步名称<input aria-label={`第 ${index+1} 步名称`} value={step.title} maxLength={100} onChange={e=>change('steps',draft.steps.map((x,i)=>i===index?{...x,title:e.target.value}:x))}/></label><button className="icon-button" disabled={draft.steps.length<=1} aria-label={`删除第 ${index+1} 步`} onClick={()=>change('steps',draft.steps.filter((_,i)=>i!==index))}><X size={14}/></button></div><label>操作内容<textarea aria-label={`第 ${index+1} 步操作笔记`} value={step.detail} maxLength={1200} rows={3} onChange={e=>change('steps',draft.steps.map((x,i)=>i===index?{...x,detail:e.target.value,timingBasis:'estimated'}:x))} placeholder="写清食材处理、入锅顺序、火候和完成状态"/></label><div className="online-step-options"><label>参考分钟<input aria-label={`第 ${index+1} 步分钟`} type="number" min={1} max={180} value={step.minutes} onChange={e=>change('steps',draft.steps.map((x,i)=>i===index?{...x,minutes:e.target.value,timingBasis:'estimated'}:x))} placeholder="待核对"/></label><label>加热锅具<select aria-label={`第 ${index+1} 步锅具`} value={step.equipment} onChange={e=>change('steps',draft.steps.map((x,i)=>i===index?{...x,equipment:e.target.value as DraftStep['equipment'],timingBasis:'estimated'}:x))}><option value="none">不加热</option><option>炒锅</option><option>汤锅</option><option>炖锅</option><option>蒸锅</option></select></label><label>操作方式<select aria-label={`第 ${index+1} 步操作方式`} value={step.mode} onChange={e=>change('steps',draft.steps.map((x,i)=>i===index?{...x,mode:e.target.value as DraftStep['mode']}:x))}><option value="active">需要动手操作</option><option value="炖煮">炖煮等待</option><option value="蒸制">蒸制等待</option><option value="泡发">冷藏泡发</option><option value="腌制">冷藏腌制</option></select></label></div></section>)}
    <button className="text-button" disabled={draft.steps.length>=20} onClick={()=>change('steps',[...draft.steps,{...emptyStep(draft.steps.length),timingBasis:'estimated'}])}><Plus size={13}/>增加步骤</button>
    <label className="online-confirm"><input type="checkbox" checked={draft.confirmed} onChange={e=>setDraft(d=>({...d,confirmed:e.target.checked}))}/><span>我已对照原菜谱核对人数、食材数量、操作顺序、锅具和参考时间，确认以上内容适合本次烹饪。</span></label>
    <p className="online-fine">将保留原页、作者和本次整理版本，仅保存在本机。未收录食材会列出需求，但没有价格参考，不会被当作免费或预算充足。</p>
   </>}
  </div>}
  {error&&<p className="online-error" role="alert">{error}</p>}
  <div className="online-actions"><button className="secondary" onClick={onClose}>返回菜单</button>{review&&<button className="primary" disabled={!draft.confirmed||Boolean(busy)} onClick={importDraft}><Check size={15}/>保存并加入这餐</button>}</div>
 </div>;
}
