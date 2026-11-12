'use client';
import {ArrowRight,BookOpen,Check,Clock,CookingPot} from 'lucide-react';
import {DISHES,INGREDIENTS,equipmentFor,recipesForDish,type Recipe} from '@/lib/kitchen/catalog';
import {RECIPE_SOURCES,type RecipeSource} from '@/lib/kitchen/sources';
import {SourceNote} from './source-note';

export function RecipeVariants({dishId,current,servings,locked,onChoose,onDetail}:{dishId:string;current?:Recipe&{source?:RecipeSource};servings:number;locked:boolean;onChoose:(recipe:Recipe)=>void;onDetail:(recipe:Recipe)=>void}){
 const dish=DISHES.find(d=>d.id===dishId)!;
 const variants=recipesForDish(dishId).map(r=>current&&r.id===current.id&&r.revision===current.revision?current:r);
 return <div className="dialog-body variant-picker"><p className="variant-intro">{dish.name}有 {variants.length} 种做法。用量按 {servings} 人展示，确认后更新这餐的食材清单、参考预算和烹饪顺序。</p>{locked&&<p className="variant-locked">这餐正在做，当前做法已固定。完成或结束本次烹饪后再切换。</p>}
  {variants.map(r=>{const chosen=r.id===current?.id&&r.revision===current.revision;const changes=current?r.ingredients.filter(i=>current.ingredients.find(c=>c.id===i.id)?.amount!==i.amount).map(i=>INGREDIENTS[i.id].name):[];const source=(r as Recipe&{source?:RecipeSource}).source||RECIPE_SOURCES[r.id];const removed=current?current.ingredients.filter(i=>!r.ingredients.some(c=>c.id===i.id)).map(i=>INGREDIENTS[i.id].name):[];
   return <article key={r.id} className={`variant-option ${chosen?'chosen':''}`}><div className="variant-title"><h3>{r.variantName}</h3>{chosen&&<span><Check size={12}/>当前选择</span>}</div><p className="variant-description">{r.intro}</p><div className="variant-meta"><span><Clock size={13}/>{r.steps.reduce((n,s)=>n+s.minutes,0)} 分钟参考步骤</span><span><CookingPot size={13}/>{equipmentFor([r]).join('、')||'不需加热'}</span></div>
    <p className="variant-ingredients">{r.ingredients.map(i=>`${INGREDIENTS[i.id].name} ${Math.ceil(i.amount*servings/2)}${INGREDIENTS[i.id].unit}`).join(' · ')}</p>
    {!chosen&&current&&<p className="variant-difference">与当前版相比：{changes.length?`用量或用料有变化：${changes.join('、')}`:'食材用量相同，步骤不同'}{removed.length?`；不再需要${removed.join('、')}`:''}。</p>}
    <details className="variant-source"><summary>来源：{source.platform||source.label}{source.author?` · ${source.author}`:''} · 配方版本 {r.revision}</summary><SourceNote recipe={r}/></details><div className="variant-actions"><button className="text-button" onClick={()=>onDetail(r)}><BookOpen size={13}/>查看完整做法</button><button className="primary" disabled={chosen||locked} onClick={()=>onChoose(r)}>{chosen?'本餐使用这份':'使用这个做法'}{chosen?<Check size={14}/>:<ArrowRight size={14}/>}</button></div>
   </article>;
  })}<p className="dialog-fine">各版本的步骤与用量独立整理。参考时间会受火力、切块与分批操作影响。</p>
 </div>;
}
