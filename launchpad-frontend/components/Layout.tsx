import Navbar from './Navbar'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout ({ children }: LayoutProps) {
  return (
    <div className='min-h-screen flex flex-col bg-gradient-to-b from-blue-50 to-white'>
      <Navbar />
      <main className='flex-grow pt-16'>{children}</main>
    </div>
  )
}
