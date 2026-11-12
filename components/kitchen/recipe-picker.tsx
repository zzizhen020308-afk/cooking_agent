'use client';
import {useState} from 'react';
import {ArrowUpRight,BookOpen,Check,Clock,Search,X} from 'lucide-react';
import {RECIPES,RECIPE_CATEGORIES,findRecipes,type Recipe,type RecipeCategory} from '@/lib/kitchen/catalog';
import {RECIPE_SOURCES} from '@/lib/kitchen/sources';

export function RecipePicker({selection,onSelection,onDetail}:{selection:string[];onSelection:(ids:string[])=>void;onDetail:(recipe:Recipe)=>void}){
 const [query,setQuery]=useState(''),[category,setCategory]=useState<RecipeCategory|'全部'>('全部');
 const matches=findRecipes(query,category);
 const toggle=(id:string)=>onSelection(selection.includes(id)?selection.filter(x=>x!==id):selection.length<4?[...selection,id]:selection);
 return <div className="recipe-library">
  <div className="library-search"><Search size={17}/><label className="sr-only" htmlFor="recipe-search">搜索菜名、别名或食材</label><input id="recipe-search" placeholder="搜菜名、别名或食材，比如：鸡翅、番茄" value={query} onChange={e=>setQuery(e.target.value)} maxLength={60}/>{query&&<button aria-label="清空搜索" onClick={()=>setQuery('')}><X size={15}/></button>}</div>
  <div className="library-categories" aria-label="菜谱分类">{(['全部',...RECIPE_CATEGORIES] as const).map(c=><button key={c} aria-pressed={category===c} className={category===c?'active':''} onClick={()=>setCategory(c)}>{c}<small>{c==='全部'?RECIPES.length:RECIPES.filter(r=>r.category===c).length}</small></button>)}</div>
  <div className="library-selection" aria-live="polite"><span>已选 {selection.length}/4</span>{selection.map(id=><button key={id} aria-label={`移除${RECIPES.find(r=>r.id===id)!.name}`} onClick={()=>toggle(id)}>{RECIPES.find(r=>r.id===id)!.name}<X size={11}/></button>)}{selection.length===4&&<small>已选满，可先移除一道再选</small>}</div>
  <div className="library-count">找到 {matches.length} 道菜 · 食材用量按人数调整，等待时间计入安排</div>
  <div className="library-results">{matches.length?matches.map(r=>{const chosen=selection.includes(r.id),source=RECIPE_SOURCES[r.id];return <article className={`library-recipe ${chosen?'selected':''}`} key={r.id}>
   <button className="library-choose" aria-label={`${chosen?'取消选择':'选择'}${r.name}`} aria-pressed={chosen} disabled={!chosen&&selection.length>=4} onClick={()=>toggle(r.id)}><img src={`/food/${r.image}.svg`} alt=""/><span><b>{r.name}</b><small>{r.category} · {r.tag}</small></span><span className="checkbox-mark">{chosen&&<Check size={13}/>}</span></button>
   <div className="library-recipe-foot"><span><Clock size={11}/>{r.steps.reduce((n,s)=>n+s.minutes,0)} 分钟</span><button onClick={()=>onDetail(r)} aria-label={`查看${r.name}的做法与来源`}><BookOpen size={11}/>做法与来源<ArrowUpRight size={11}/></button></div>
   <p className="library-attribution">{source.kind==='edited'?`参考 ${source.platform||'HowToCook'}${source.author?` · ${source.author}`:' · 掌勺整理'}`:'掌勺自编配方'}</p>
  </article>;}):<div className="library-empty"><Search size={26}/><b>还没找到这道菜</b><p>试试别名或主要食材，或切回“全部”。当前收录 {RECIPES.length} 道，不会自动为未收录的菜编造用量。</p><button onClick={()=>{setQuery('');setCategory('全部');}}>查看全部菜谱</button></div>}</div>
 </div>;
}
