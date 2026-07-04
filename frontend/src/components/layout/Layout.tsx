import { Navigate, Outlet, NavLink } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../ui/button'
import { LogOut, LayoutDashboard, Layers, Activity, Server, Box } from 'lucide-react'

export default function Layout() {
  const { user, signOut } = useAuth()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Jobs', path: '/jobs', icon: Activity },
    { name: 'Queues', path: '/queues', icon: Layers },
    { name: 'Workers', path: '/workers', icon: Server },
    { name: 'Batches', path: '/batches', icon: Box },
  ]

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r-4 border-black bg-white flex flex-col z-10">
        <div className="p-6 border-b-4 border-black bg-accent3">
          <h1 className="text-3xl font-black uppercase text-white shadow-brutal-sm inline-block px-2 bg-black -rotate-2">Codity</h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 font-bold uppercase transition-all border-2 border-transparent ${
                  isActive 
                    ? 'bg-primary text-white border-black shadow-brutal-sm translate-x-1' 
                    : 'hover:bg-black/5 text-black hover:border-black'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 flex-shrink-0 border-b-4 border-black bg-white flex items-center justify-between px-8 z-10">
          <div className="font-bold uppercase tracking-widest text-sm text-gray-500">
            Internal Job Scheduler
          </div>
          <div className="flex items-center gap-6">
            <span className="font-medium text-sm hidden sm:inline-block border-2 border-black px-3 py-1 bg-accent2 text-white shadow-brutal-sm">
              {user.email}
            </span>
            <Button variant="destructive" size="sm" onClick={signOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-8 bg-background relative">
          {/* Subtle grid pattern background for brutalism feel */}
          <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.03]" 
               style={{ backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
          <div className="relative z-10 max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
