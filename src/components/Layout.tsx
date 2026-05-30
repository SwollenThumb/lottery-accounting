import React from 'react'
import { NavLink, useNavigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { ROLE_LABELS } from '@/types'
import {
  LayoutDashboard,
  CreditCard,
  Package,
  ShoppingCart,
  CheckSquare,
  Store,
  ScanLine,
  Users,
  CalendarCheck,
  CircleOff,
  ChevronLeft,
  ChevronRight,
  LogOut,
  ClipboardList,
  SearchCheck,
} from 'lucide-react'

interface NavItem {
  path: string
  label: string
  icon: React.ElementType
  roles: string[]
}

const NAV_ITEMS: NavItem[] = [
  { path: '/', label: '工作台', icon: LayoutDashboard, roles: ['super_admin', 'admin', 'finance', 'staff'] },
  { path: '/submissions', label: '交账', icon: ClipboardList, roles: ['super_admin', 'admin', 'finance', 'staff'] },
  { path: '/finance-review', label: '交账核对', icon: SearchCheck, roles: ['super_admin', 'admin', 'finance'] },
  { path: '/bank-cards', label: '银行卡管理', icon: CreditCard, roles: ['super_admin', 'admin', 'finance'] },
  { path: '/sales', label: '进销管理', icon: ShoppingCart, roles: ['super_admin', 'admin', 'finance', 'staff'] },
  { path: '/reconciliation', label: '收款核对', icon: CheckSquare, roles: ['super_admin', 'admin', 'finance'] },
  { path: '/inventory', label: '彩票库存', icon: Package, roles: ['super_admin', 'admin'] },
  { path: '/shops', label: '店铺管理', icon: Store, roles: ['super_admin'] },
  { path: '/equipment', label: '设备管理', icon: ScanLine, roles: ['super_admin'] },
  { path: '/users', label: '用户管理', icon: Users, roles: ['super_admin', 'admin'] },
  { path: '/settlement', label: '每日结算', icon: CalendarCheck, roles: ['super_admin', 'admin'] },
  { path: '/closure', label: '撤店结算', icon: CircleOff, roles: ['super_admin'] },
]

export function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = React.useState(false)

  const userRole = user?.role || 'staff'
  const visibleNavItems = NAV_ITEMS.filter(item => item.roles.includes(userRole))

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className={cn(
        "flex flex-col border-r bg-card transition-all duration-300 ease-in-out relative",
        collapsed ? "w-[68px]" : "w-[220px]"
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-16 border-b">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary text-primary-foreground font-bold text-lg shrink-0">
            彩
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="font-bold text-base leading-tight">彩票记账通</h1>
              <p className="text-[11px] text-muted-foreground leading-tight">智能记账工具</p>
            </div>
          )}
        </div>

        {/* User info */}
        {!collapsed && user && (
          <div className="mx-3 mt-4 mb-2 px-3 py-2 rounded-md bg-accent/50">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
                {user.displayName?.[0] || 'U'}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-medium truncate">{user.displayName}</p>
                <p className="text-[10px] text-muted-foreground">{ROLE_LABELS[userRole]}</p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-2 py-2 space-y-1 overflow-y-auto">
          {visibleNavItems.map(item => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) => cn(
                  "w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  collapsed && "justify-center px-2"
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            )
          })}
        </nav>

        {/* Logout */}
        <div className="px-2 pb-4">
          <button
            onClick={handleLogout}
            className={cn(
              "w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all",
              collapsed && "justify-center px-2"
            )}
            title={collapsed ? '退出登录' : undefined}
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            {!collapsed && <span>退出登录</span>}
          </button>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full border bg-card shadow-sm flex items-center justify-center hover:bg-muted transition-colors z-10"
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1400px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
