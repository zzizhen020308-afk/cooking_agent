import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'掌勺 · 把想吃的，变成这一餐',description:'从一句想吃的菜开始，安排菜谱、预算采购与多道菜的烹饪顺序。上海买菜助手交互原型。',icons:{icon:'/favicon.svg',shortcut:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body>{children}</body></html>;}
