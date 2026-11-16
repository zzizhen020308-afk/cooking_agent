import {ArrowUpRight,BookOpen} from 'lucide-react';
import type {Recipe} from '@/lib/kitchen/catalog';
import {RECIPE_SOURCES,type RecipeSource} from '@/lib/kitchen/sources';

export function SourceNote({recipe}:{recipe:Recipe&{source?:RecipeSource}}){
 const source=recipe.source||RECIPE_SOURCES[recipe.id];
 return <section className="recipe-source"><div><BookOpen size={15}/><b>{source.label}{source.author?` · 作者 ${source.author}`:''}</b><small>配方版本 {recipe.revision} · 核对 {source.checkedAt}{source.snapshot?` · 原文 ${source.snapshot.slice(0,7)}`:''}{source.license?` · ${source.license}`:''}{source.retrievedAt?` · 获取 ${source.retrievedAt.slice(0,10)}`:''}</small></div><p>{source.note}</p>{source.references.map(r=><a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer">{r.label}<ArrowUpRight size={12}/></a>)}</section>;
}
