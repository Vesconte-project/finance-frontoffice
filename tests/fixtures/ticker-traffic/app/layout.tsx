import { ScrollRuntimeProvider } from '@/components/motion/ScrollRuntime'
import '@/app/globals.css'
import Search from '../components/Search'
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><ScrollRuntimeProvider defaultProfile="operational"><Search />{children}</ScrollRuntimeProvider></body></html>
}
