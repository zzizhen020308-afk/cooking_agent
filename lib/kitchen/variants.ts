import type {Recipe} from './catalog.ts';
import type {RecipeSource} from './sources.ts';

export const DEFAULT_VARIANT_NAMES:Record<string,string>={
 'braised-pork':'炒糖色炖锅版','tomato-eggs':'家常快炒版','garlic-broccoli':'清炒蒜香版',
 'potato-strips':'不辣醋香版','mushroom-chicken':'炒锅焖煮版','torn-cabbage':'蒜香蔬菜版','zucchini-eggs':'蒜香合炒版'
};
export const VARIANT_RECIPES:Recipe[]=[
 {id:'braised-pork-soy',dishId:'braised-pork',variantName:'酱香免炒糖色版',revision:'1',name:'红烧肉',aliases:['红烧肉','红烧五花肉'],category:'荤菜',tag:'酱香慢炖',intro:'用酱油上色，省去单独炒糖色的一步。',image:'pork',color:'#eee2d3',ingredients:[{id:'pork',amount:400},{id:'ginger',amount:15},{id:'scallion',amount:10},{id:'garlic',amount:10},{id:'soy',amount:25},{id:'darksoy',amount:6},{id:'sugar',amount:10},{id:'wine',amount:15}],steps:[
  {title:'五花肉焯水并沥干',detail:'五花肉切约 3 厘米方块，冷水入炖锅，加一半姜和料酒，煮沸撇沫后捞出沥干，清洗锅具。',minutes:7,burner:true,equipment:'炖锅'},
  {title:'煸香五花肉，加入酱汁',detail:'炖锅放沥干的五花肉，中小火翻动至出少量油脂，加入剩余姜、葱、蒜、生抽、老抽和糖翻匀。加热水刚没过肉块，煮开；本版不单独炒糖色。',minutes:7,burner:true,equipment:'炖锅'},
  {title:'酱香小火慢炖',detail:'盖盖小火微沸，参考 50 分钟，期间检查水量，必要时少量补热水。肉块大小和部位会影响时间。',minutes:50,passive:true,burner:true,equipment:'炖锅',waitKind:'炖煮'},
  {title:'检查软烂，开盖收汁',detail:'确认肉充分熟透且软烂再开盖收浓，持续翻动，留一点酱汁后关火盛出；肉还硬就先补水续炖。',minutes:7,burner:true,equipment:'炖锅'}],tips:['本版酱油上色，不包含炒糖色步骤。','未额外列食用油，先小火煸出五花肉自身油脂。']},
 {id:'tomato-eggs-juicy',dishId:'tomato-eggs',variantName:'多番茄浓汁版',revision:'1',name:'番茄炒蛋',aliases:['番茄炒蛋','西红柿炒鸡蛋','西红柿炒蛋','番茄炒鸡蛋'],category:'蛋豆',tag:'番茄浓汁',intro:'增加番茄比例，留一点浓汁拌饭。',image:'tomato',color:'#f3e7d2',ingredients:[{id:'tomato',amount:600},{id:'egg',amount:2},{id:'scallion',amount:5},{id:'oil',amount:12},{id:'salt',amount:3},{id:'sugar',amount:4}],steps:[
  {title:'炒熟鸡蛋备用',detail:'鸡蛋打散，加少许盐。炒锅放一半油，把蛋液炒至完全凝固，盛到洁净碗中。',minutes:3,burner:true,equipment:'炒锅'},
  {title:'把番茄炒成浓汁',detail:'番茄切小块，炒锅放剩余油，中小火炒至明显出汁。用铲轻压部分番茄，锅内偏干时少量补热水，留一部分块状口感。',minutes:8,burner:true,equipment:'炒锅'},
  {title:'鸡蛋回锅，留汁出锅',detail:'放回鸡蛋，加剩余盐、糖和葱花，翻匀并充分加热后关火；保留一些汤汁，不需要收干。',minutes:2,burner:true,equipment:'炒锅'}],tips:['本版 2 人基准用 600g 番茄、2 个鸡蛋，和快炒版用量不同。','为独立整理的浓汁版，不使用番茄酱。']},
 {id:'garlic-broccoli-oyster',dishId:'garlic-broccoli',variantName:'蚝油蒜汁版',revision:'1',name:'蒜蓉西兰花',aliases:['蒜蓉西兰花','清炒西兰花','西兰花'],category:'蔬菜',tag:'蒜汁鲜味',intro:'西兰花煮熟摆盘，淋上蒜香蚝油汁。',image:'green',color:'#e1e7d5',ingredients:[{id:'broccoli',amount:400},{id:'garlic',amount:20},{id:'soy',amount:10},{id:'oyster',amount:10},{id:'sugar',amount:3},{id:'oil',amount:10}],steps:[
  {title:'煮熟西兰花摆盘',detail:'西兰花洗净分小朵，炒锅水煮开后分批下锅，煮至熟透且达到喜欢的口感，捞出沥水摆盘。',minutes:5,burner:true,equipment:'炒锅'},
  {title:'煮蒜香蚝油汁',detail:'炒锅倒净水，热油后小火炒香蒜末，加入生抽、蚝油、白糖和少量水煮开，再均匀淋在西兰花上。',minutes:4,burner:true,equipment:'炒锅'}],tips:['蚝油版含牡蛎来源调味料，和清炒蒜香版的用料不同。','酱料有咸味，不另外默认加盐。']},
 {id:'potato-strips-spicy',dishId:'potato-strips',variantName:'青椒酸辣版',revision:'1',name:'酸溜土豆丝',aliases:['酸溜土豆丝','酸辣土豆丝','醋溜土豆丝','土豆丝'],category:'蔬菜',tag:'酸辣爽口',intro:'加青椒和干辣椒，炒一盘酸辣土豆丝。',image:'potato',color:'#f1ead5',ingredients:[{id:'potato',amount:400},{id:'pepper',amount:100},{id:'garlic',amount:15},{id:'dry-chili',amount:3},{id:'scallion',amount:5},{id:'soy',amount:5},{id:'vinegar',amount:20},{id:'oil',amount:15},{id:'salt',amount:2}],steps:[
  {title:'洗土豆丝，焯水沥干',detail:'土豆去皮切细丝，清水冲去表面淀粉。炒锅水煮开，土豆丝短时焯水后捞起沥干；青椒切丝，蒜和干辣椒切好。',minutes:5,burner:true,equipment:'炒锅'},
  {title:'炒香椒蒜，加入土豆丝',detail:'炒锅热油，小火炒香蒜末、干辣椒和一半葱花，加入青椒丝和土豆丝翻炒至全熟，必要时少量补水。',minutes:5,burner:true,equipment:'炒锅'},
  {title:'调酸辣味出锅',detail:'加生抽、米醋、盐和剩余葱花，翻匀充分加热后出锅。干辣椒只作风味，不保证每种辣椒辣度相同。',minutes:2,burner:true,equipment:'炒锅'}],tips:['本版用米醋代替原参考陈醋，只用青椒，省去红椒。','和不辣醋香版分开备料，避免漏买辣椒。']},
 {id:'torn-cabbage-pork',dishId:'torn-cabbage',variantName:'五花肉合炒版',revision:'1',name:'手撕包菜',aliases:['手撕包菜','手撕圆白菜','清炒包菜'],category:'蔬菜',tag:'肉香合炒',intro:'包菜配薄五花肉片，肉香更浓的一版。',image:'green',color:'#e1e7d5',ingredients:[{id:'cabbage',amount:400},{id:'pork',amount:150},{id:'ginger',amount:10},{id:'garlic',amount:15},{id:'dry-chili',amount:2},{id:'wine',amount:10},{id:'soy',amount:10},{id:'vinegar',amount:10},{id:'oil',amount:10},{id:'salt',amount:2}],steps:[
  {title:'撕包菜，切薄肉片',detail:'包菜去硬芯，撕片洗净沥干。五花肉切薄片，姜蒜切好；生肉与即食食材分开处理。',minutes:5},
  {title:'先炒包菜盛出',detail:'炒锅放一半油，中大火把包菜炒至断生，盛到洁净盘中备用。',minutes:4,burner:true,equipment:'炒锅'},
  {title:'炒熟肉片，包菜回锅',detail:'锅放剩余油，中火煸炒五花肉片至充分熟透，加入姜、蒜、干辣椒和料酒炒香。包菜回锅，加生抽、米醋和盐翻炒，确认菜肉全熟后出锅。',minutes:9,burner:true,equipment:'炒锅'}],tips:['这一做法包含五花肉；菜名分类不代表食材为纯素。','本版较原参考减少油量，省去蒜苗与鸡精。']},
 {id:'zucchini-eggs-tomato',dishId:'zucchini-eggs',variantName:'番茄合炒版',revision:'1',name:'西葫芦炒蛋',aliases:['西葫芦炒蛋','西葫芦炒鸡蛋','角瓜炒蛋','角瓜炒鸡蛋'],category:'蛋豆',tag:'番茄合炒',intro:'加一份番茄汁，让西葫芦和鸡蛋更入味。',image:'green',color:'#e1e7d5',ingredients:[{id:'zucchini',amount:350},{id:'tomato',amount:200},{id:'egg',amount:3},{id:'oil',amount:18},{id:'salt',amount:3},{id:'starch',amount:4}],steps:[
  {title:'切配番茄与西葫芦，炒熟蛋',detail:'番茄切小块，西葫芦切薄片，蛋打散。炒锅用一半油把蛋液炒至完全凝固，盛到洁净碗中。',minutes:5,burner:true,equipment:'炒锅'},
  {title:'炒番茄出汁，再放西葫芦',detail:'锅放剩余油，中小火炒番茄至软烂出汁，下西葫芦翻炒，视水分加少量水，煮炒至全熟。',minutes:7,burner:true,equipment:'炒锅'},
  {title:'鸡蛋回锅，薄芡收拢',detail:'鸡蛋回锅，加盐调味。淀粉用少量冷水化开，分次淋入煮沸至薄薄挂汁，充分热透后出锅。',minutes:3,burner:true,equipment:'炒锅'}],tips:['这份做法增加番茄与淀粉，不包含蒜。','原参考的油盐与芡汁没有统一克数，本版用量独立整理。']},
 {id:'mushroom-chicken-steamed',dishId:'mushroom-chicken',variantName:'鲜香菇清蒸版',revision:'1',name:'香菇滑鸡',aliases:['香菇滑鸡','香菇炖鸡','香菇鸡'],category:'荤菜',tag:'鲜香清蒸',intro:'鸡腿肉冷藏腌好，与鲜香菇一起上锅蒸。',image:'chicken',color:'#e8e0cd',ingredients:[{id:'chicken',amount:400},{id:'mushroom',amount:150},{id:'ginger',amount:15},{id:'scallion',amount:10},{id:'soy',amount:20},{id:'wine',amount:10},{id:'starch',amount:10},{id:'sesameoil',amount:5},{id:'sugar',amount:3},{id:'salt',amount:2}],steps:[
  {title:'切鸡腿肉并拌入腌料',detail:'去骨鸡腿肉切约 2 厘米块，加姜丝、生抽、料酒、淀粉、香油、糖和盐拌匀，加盖放冰箱。鲜香菇另行洗净切片。',minutes:6},
  {title:'冷藏腌鸡肉',detail:'冷藏腌制参考 20 分钟，生肉与即食食材隔开。此时可准备其他菜，不要把生鸡肉放室温等待。',minutes:20,passive:true,waitKind:'腌制'},
  {title:'鸡肉香菇铺盘，上蒸锅',detail:'把鸡肉和鲜香菇拌匀，铺在宽浅耐热盘中，不要堆得过厚。蒸锅加足底水烧开，再放入盘子，防烫盖盖。',minutes:6,burner:true,equipment:'蒸锅'},
  {title:'蒸熟鸡肉与香菇',detail:'保持充足蒸汽，参考蒸 30 分钟，留意底水，不让蒸锅烧干。份量增大或铺得过厚需分批，时间仅供参考。',minutes:30,passive:true,burner:true,equipment:'蒸锅',waitKind:'蒸制'},
  {title:'测温检查，防烫出锅',detail:'用食物温度计检查最厚处鸡肉至少约 74°C；未达到继续蒸后复测。确认后关火，戴隔热手套取盘，撒葱花。',minutes:3,burner:true,equipment:'蒸锅'}],tips:['本版使用鲜香菇、去骨鸡腿肉，不含干香菇泡发时间。','清蒸版占蒸锅；腌制时间也已计入安排。']}
];

const snapshot='308cc8b7dab1da84b20e7fafdf836a715437f582';
const hoc=(path:string,note:string):RecipeSource=>({kind:'edited',platform:'HowToCook',label:'掌勺整理版 · 参考 HowToCook',checkedAt:'2026-11-12',snapshot,note,references:[{label:'查看本次核对原文 · HowToCook',url:'https://github.com/Anduin2017/HowToCook/blob/'+snapshot+'/'+encodeURI(path)}]});
export const VARIANT_SOURCES:Record<string,RecipeSource>={
 'braised-pork-soy':hoc('dishes/meat_dish/红烧肉/南派红烧肉.md','参考焯水、葱姜蒜慢炖和收汁。此版独立改为酱油上色，省去原文炒糖色、冰糖与香料，减少用量，不是原文南派配方复现。'),
 'tomato-eggs-juicy':hoc('dishes/vegetable_dish/西红柿炒鸡蛋.md','参考先炒蛋、炒番茄出汁再合炒，以及增加汤汁的思路。独立增加番茄比例、减少鸡蛋数量，不加番茄酱，用量与时间为掌勺浓汁版。'),
 'garlic-broccoli-oyster':hoc('dishes/vegetable_dish/蒜蓉西兰花.md','参考先煮熟西兰花摆盘，再把蒜、生抽、蚝油和糖煮成汁浇淋。按 2 人基准重新整理用量和计时，和清炒版分开保存。'),
 'potato-strips-spicy':hoc('dishes/vegetable_dish/酸辣土豆丝.md','参考土豆丝去淀粉、焯水、椒蒜爆香和酸辣调味。此版只用青椒，省红椒，用米醋，比例与时间已整理，不沿用固定秒数熟度判断。'),
 'torn-cabbage-pork':hoc('dishes/vegetable_dish/手撕包菜/手撕包菜.md','参考包菜先炒、五花肉另炒再合炒。保留五花肉搭配，独立调整 2 人用量并减少油，省去蒜苗与鸡精，和不含肉的默认版分开保存。'),
 'zucchini-eggs-tomato':{kind:'edited',platform:'下厨房',label:'掌勺整理版 · 参考下厨房',author:'火龙果很好吃',sourceTitle:'西葫芦炒鸡蛋',checkedAt:'2026-11-12',note:'参考番茄出汁后与西葫芦、鸡蛋合炒并勾薄芡的组合。独立整理为 2 人基准重量、油盐和淀粉用量及计时，文字重新编写，未使用原作者图片或全文。',references:[{label:'西葫芦炒鸡蛋 · 火龙果很好吃 · 下厨房',url:'https://m.xiachufang.com/recipe/106140793/'}]},
 'mushroom-chicken-steamed':{kind:'edited',platform:'下厨房',label:'掌勺整理版 · 参考下厨房',author:'小厨实验',sourceTitle:'香菇蒸鸡腿',checkedAt:'2026-11-12',note:'参考鸡腿肉用姜、酱油和淀粉腌制后与香菇蒸制的做法。改用鲜香菇、去骨肉，独立整理 2 人用量，冷藏腌制与蒸制计时纳入安排，并增加鸡肉测温检查；文字重新编写，未转载图片或全文。',references:[{label:'香菇蒸鸡腿 · 小厨实验 · 下厨房',url:'https://m.xiachufang.com/recipe/103667939/'}]}
};
