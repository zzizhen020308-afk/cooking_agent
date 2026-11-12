import type {RecipeDefinition as Recipe} from './catalog.ts';

/** Independently worded, measured planning versions; no third-party photos or recipe text are republished. */
export const WEB_RECIPES:Recipe[]=[
 {id:'zucchini-eggs',name:'西葫芦炒蛋',aliases:['西葫芦炒蛋','西葫芦炒鸡蛋','角瓜炒蛋','角瓜炒鸡蛋'],category:'蛋豆',tag:'清爽家常',intro:'西葫芦配鸡蛋，炒一盘简单家常菜。',image:'green',color:'#e1e7d5',ingredients:[{id:'zucchini',amount:350},{id:'egg',amount:3},{id:'garlic',amount:10},{id:'oil',amount:15},{id:'salt',amount:3}],steps:[
  {title:'切配西葫芦，炒熟鸡蛋',detail:'西葫芦清洗后切薄片，蒜切末；鸡蛋打散，加一部分盐。炒锅热一半油，蛋液下锅炒至完全凝固，盛入洁净碗中。',minutes:5,burner:true,equipment:'炒锅'},
  {title:'炒西葫芦，回锅合炒',detail:'锅放剩余油，小火炒香蒜末，再下西葫芦翻炒。偏干可补少量水，炒至全熟后放回鸡蛋，加剩余盐翻匀热透再出锅。',minutes:6,burner:true,equipment:'炒锅'}],tips:['本版按重量整理西葫芦，油盐和时间为掌勺参考值。','不用固定两分钟作为熟度保证，鸡蛋需完全凝固。']},
 {id:'garlic-scape-pork',name:'蒜苔炒肉',aliases:['蒜苔炒肉','蒜薹炒肉','蒜苔肉丝','蒜薹肉丝'],category:'荤菜',tag:'蒜香下饭',intro:'蒜苔切小段，和薄肉片炒出家常香味。',image:'pork',color:'#e7e9d7',ingredients:[{id:'garlic-scape',amount:300},{id:'lean-pork',amount:200},{id:'garlic',amount:10},{id:'ginger',amount:10},{id:'soy',amount:15},{id:'oyster',amount:10},{id:'beanpaste',amount:10},{id:'starch',amount:6},{id:'oil',amount:15}],steps:[
  {title:'切配蒜苔与肉片',detail:'蒜苔洗净去老根，切成约 3 厘米段。猪瘦肉切薄片，拌入淀粉、一半生抽和少量水。姜蒜切末，生肉刀板与即食食材分开。',minutes:5},
  {title:'肉片炒熟盛出',detail:'炒锅放一半油，中火把肉片滑散并充分炒熟，盛入洁净盘中。',minutes:5,burner:true,equipment:'炒锅'},
  {title:'炒蒜苔，肉片回锅',detail:'锅放剩余油，小火炒香姜蒜与豆瓣酱。下蒜苔翻炒至熟，必要时补少量水帮助熟透；肉片回锅，加剩余生抽与蚝油翻匀，充分热透后出锅。',minutes:8,burner:true,equipment:'炒锅'}],tips:['本版省去小米辣和肥肉熬油，酱料有咸味，不另默认加盐。','用量来自掌勺的 2 人整理配方，不把原作者的“适量”冒充精确克数。']}
];

export const WEB_SOURCE_NOTES:Record<string,{title:string;author:string;url:string;note:string}>={
 'zucchini-eggs':{title:'西葫芦炒鸡蛋',author:'随心煮意',url:'https://m.xiachufang.com/recipe/260319/',note:'核对西葫芦、鸡蛋、蒜的搭配，以及先炒蛋再与西葫芦合炒的流程。掌勺独立整理为 2 人基准，西葫芦改用重量、鸡蛋与油盐用量和步骤时间已调整；文字重新编写，未使用原作者图片、功效描述或全文。'},
 'garlic-scape-pork':{title:'蒜苔炒肉',author:'誠明厨坊',url:'https://www.xiachufang.com/recipe/106168470/',note:'核对蒜苔、肉、姜蒜、豆瓣酱与蚝油的搭配及先拌肉再炒的做法。原文多项为“适量”；此版独立设定 2 人基准克数和计时，省去小米辣与肥肉，允许少量补水，文字重新编写，未使用原作者图片或全文。'}
};
