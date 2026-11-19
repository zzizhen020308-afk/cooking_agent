import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata:Metadata={title:'掌勺 · 把想吃的，变成这一餐',description:'按人数、预算和灶台安排菜谱与备菜清单，结合当前步骤和计时陪你处理厨房里的常见问题。',manifest:'/manifest.webmanifest',icons:{icon:'/favicon.svg',shortcut:'/favicon.svg',apple:'/icons/apple-touch-icon.png'},appleWebApp:{capable:true,title:'掌勺',statusBarStyle:'default'}};
export const viewport:Viewport={themeColor:'#f7f6f0',width:'device-width',initialScale:1};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body>{children}</body></html>;}
