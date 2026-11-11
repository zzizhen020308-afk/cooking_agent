export type Evidence={label:string;url?:string;note?:string};
export const CONTENT_VERSION='2026.11.11';
const github='https://github.com/Anduin2017/HowToCook/blob/master/';
const hoc=(path:string)=>github+encodeURI(path);
export type RecipeSource={kind:'edited'|'original';label:string;checkedAt:string;note:string;references:Evidence[]};
const edited=(path:string,note:string):RecipeSource=>({kind:'edited',label:'掌勺整理版 · 技法参考 HowToCook',checkedAt:'2026-11-10',note,references:[{label:'查看参考做法 · HowToCook',url:hoc(path)}]});
export const RECIPE_SOURCES:Record<string,RecipeSource>={
 'braised-pork':edited('dishes/meat_dish/红烧肉/简易红烧肉.md','参考焯水、上色、补热水慢炖与收汁方法。本餐为 2 人基准整理配方，份量、调味和时间采用掌勺版本，不照搬原文的大份量。'),
 'tomato-eggs':edited('dishes/vegetable_dish/西红柿炒鸡蛋.md','参考先炒蛋盛出、炒番茄出汁再合炒的方法；本餐用量与步骤按掌勺 2 人基准整理，鸡蛋数量向上取整。'),
 'yam-ribs':edited('dishes/soup/排骨山药玉米汤/排骨山药玉米汤.md','参考排骨预处理与小火炖汤方法；本版省去玉米、胡萝卜，山药后放，用量和炖煮时长已独立调整。'),
 'garlic-broccoli':edited('dishes/vegetable_dish/蒜蓉西兰花.md','参考西兰花分朵、焯水和蒜蓉调味方法；本版为盐味翻炒版，省去原参考中的蚝油和生抽。'),
 'potato-strips':edited('dishes/vegetable_dish/酸辣土豆丝.md','参考切丝、冲洗淀粉与醋味快炒；本版不含辣椒，调味和时间采用掌勺整理配方。'),
 'cucumber-salad':edited('dishes/vegetable_dish/凉拌黄瓜.md','参考拍碎黄瓜与蒜醋汁拌匀的方法；本版省去蚝油、香油和长时间腌制，现拌现吃。'),
 'mushroom-chicken':edited('dishes/meat_dish/香菇滑鸡/香菇滑鸡.md','参考鸡腿肉与香菇的搭配；本版使用鲜香菇、增加焖煮步骤，用量、火候和时间均为掌勺整理版。'),
 tofu:{kind:'original',label:'掌勺自编配方',checkedAt:'2026-11-10',note:'2 人基准的家常煮豆腐版本。配方与步骤由掌勺整理，未标称为外部菜谱或厨师实测配方。',references:[]}
};
export const RULE_EVIDENCE:Evidence={label:`掌勺内置答疑规则 · ${CONTENT_VERSION}`,note:'按当前菜谱、份量、步骤和计时计算，支持列明的常见问题；不是自由生成的厨师问答。'};
export const POULTRY_EVIDENCE:Evidence={label:'FoodSafety.gov：安全最低内部温度',url:'https://www.foodsafety.gov/food-safety-charts/safe-minimum-internal-temperatures',note:'禽肉以食物温度计测得至少约 74°C 为依据；计时与肉色不能单独证明熟度。'};
export function evidenceFor(recipeId?:string):Evidence[]{const s=recipeId?RECIPE_SOURCES[recipeId]:undefined;return [RULE_EVIDENCE,...(s?[{label:s.label,note:s.note},...s.references]:[])];}
export const BUYING_TIPS:Record<string,string>={pork:'按所需重量选带皮五花肉；预切块要留意块的大小与是否额外腌制。',ribs:'按所需重量选剁块排骨，核对切块大小与净含量。',yam:'按去皮后的用量估算，整根购买会有去皮损耗；处理时可戴手套。',tomato:'核对净重；个头不同，按重量比按个数更接近菜谱。',egg:'按个数购买，核对包装完整与储存要求。',chicken:'本版使用鸡腿肉；如果买带骨鸡腿，去骨后实际可用重量会减少。',mushroom:'本版用鲜香菇，干香菇不能按相同重量直接替换。',tofu:'选择嫩豆腐；净含量不包含额外包装重量。',salt:'已有足量时不重复购买。调味可少量分次加入。',oil:'已有足量时不重复买整瓶，按本餐需求备好即可。'};

export const FIRE_EVIDENCE:Evidence={label:'国家消防救援局：油锅起火处理',url:'https://www.119.gov.cn/kp/hzyf/jt/2025/52074.shtml',note:'安全时关闭燃气、盖严锅盖并待冷却，油锅火不泼水；危险时优先撤离求助。'};
