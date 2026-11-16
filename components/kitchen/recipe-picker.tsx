'use client';
import {useState} from 'react';
import {ArrowUpRight,BookOpen,Check,Clock,Search,X} from 'lucide-react';
import {DISHES,RECIPES,RECIPE_CATEGORIES,findDishes,recipesForDish,ingredientsFor,type Recipe,type RecipeCategory} from '@/lib/kitchen/catalog';
import type {PlannedRecipe} from '@/lib/kitchen/snapshots';
import {RECIPE_SOURCES} from '@/lib/kitchen/sources';

export function RecipePicker({selection,choices,imported=[],onSearch,onSelection,onDetail,onVariants}:{selection:string[];choices:Record<string,string>;imported?:PlannedRecipe[];onSearch?:(query:string)=>void;onSelection:(ids:string[])=>void;onDetail:(recipe:Recipe)=>void;onVariants:(dishId:string)=>void}){
 const [query,setQuery]=useState(''),[category,setCategory]=useState<RecipeCategory|'全部'>('全部');
 const extra=imported.map(r=>({id:r.dishId,name:r.name,aliases:r.aliases,category:r.category,defaultRecipeId:r.id}));
 const dishes=[...DISHES,...extra],collection=[...RECIPES,...imported],ingredients=ingredientsFor(imported);
 const words=query.normalize('NFKC').trim().toLowerCase().split(/\s+/).filter(Boolean);
 const matches=[...findDishes(query,category),...extra.filter(d=>(category==='全部'||d.category===category)&&words.every(w=>[d.name,...d.aliases,...imported.find(r=>r.dishId===d.id)!.ingredients.map(i=>ingredients[i.id].name)].join(' ').toLowerCase().includes(w)))];
 const toggle=(id:string)=>onSelection(selection.includes(id)?selection.filter(x=>x!==id):selection.length<4?[...selection,id]:selection);
 return <div className="recipe-library">
  <div className="library-search"><Search size={17}/><label className="sr-only" htmlFor="recipe-search">搜索菜名、别名或食材</label><input id="recipe-search" placeholder="搜菜名、别名或食材，比如：鸡翅、番茄" value={query} onChange={e=>setQuery(e.target.value)} maxLength={60}/>{query&&<button aria-label="清空搜索" onClick={()=>setQuery('')}><X size={15}/></button>}</div>
  <div className="library-categories" aria-label="菜谱分类">{(['全部',...RECIPE_CATEGORIES] as const).map(c=><button key={c} aria-pressed={category===c} className={category===c?'active':''} onClick={()=>setCategory(c)}>{c}<small>{c==='全部'?dishes.length:dishes.filter(r=>r.category===c).length}</small></button>)}</div>
  <div className="library-selection" aria-live="polite"><span>已选 {selection.length}/4</span>{selection.map(id=><button key={id} aria-label={`移除${dishes.find(r=>r.id===id)?.name||''}`} onClick={()=>toggle(id)}>{dishes.find(r=>r.id===id)?.name}<X size={11}/></button>)}{selection.length===4&&<small>已选满，可先移除一道再选</small>}</div>
  <div className="library-count">找到 {matches.length} 道菜 · 食材用量按人数调整，等待时间计入安排</div>
  {onSearch&&<button className="text-button online-entry" onClick={()=>onSearch(query)}>本地没找到？搜索完整菜谱 / 导入<ArrowUpRight size={12}/></button>}
  <div className="library-results">{matches.length?matches.map(d=>{const r=collection.find(r=>r.id===(choices[d.id]||d.defaultRecipeId))||collection.find(r=>r.dishId===d.id)!,chosen=selection.includes(d.id),source=(r as PlannedRecipe).source||RECIPE_SOURCES[r.id],count=recipesForDish(d.id).length;return <article className={`library-recipe ${chosen?'selected':''}`} key={d.id}>
   <button className="library-choose" aria-label={`${chosen?'取消选择':'选择'}${r.name}`} aria-pressed={chosen} disabled={!chosen&&selection.length>=4} onClick={()=>toggle(d.id)}><img src={`/food/${r.image}.svg`} alt=""/><span><b>{r.name}</b><small>{r.category} · {r.variantName}</small></span><span className="checkbox-mark">{chosen&&<Check size={13}/>}</span></button>
   <div className="library-recipe-foot"><span><Clock size={11}/>{r.steps.reduce((n,s)=>n+s.minutes,0)} 分钟</span><button onClick={()=>onDetail(r)} aria-label={`查看${r.name}的做法与来源`}><BookOpen size={11}/>做法与来源<ArrowUpRight size={11}/></button></div>
   {count>1&&<button className="library-variant-link" aria-label={`给${r.name}换一种做法`} onClick={()=>onVariants(d.id)}>换一种做法 · {count} 份可选</button>}<p className="library-attribution">{source.kind==='edited'?`参考 ${source.platform||'HowToCook'}${source.author?` · ${source.author}`:' · 掌勺整理'}`:'掌勺自编配方'}</p>
  </article>;}):<div className="library-empty"><Search size={26}/><b>还没找到这道菜</b><p>试试别名或主要食材，或切回“全部”。当前收录 {DISHES.length} 道，不会自动为未收录的菜编造用量。</p><button onClick={()=>{setQuery('');setCategory('全部');}}>查看全部菜谱</button></div>}</div>
 </div>;
}
