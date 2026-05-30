import React, { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import api from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import type { User, Shop } from '@/types'
import { ROLE_LABELS } from '@/types'
import { Users, Plus, UserCheck, UserX } from 'lucide-react'

export function UserManagement() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ username: '', password: '', displayName: '', role: 'staff' as string, shopId: '' as string })

  const loadData = async () => {
    try {
      const [uRes, sRes] = await Promise.all([api.get('/users'), api.get('/shops')])
      setUsers(uRes.data)
      setShops(sRes.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const handleAdd = async () => {
    if (!form.username || !form.password || !form.displayName) return
    await api.post('/users', { ...form, shopId: form.shopId ? Number(form.shopId) : null })
    setShowAdd(false)
    setForm({ username: '', password: '', displayName: '', role: 'staff', shopId: '' })
    loadData()
  }

  const toggleActive = async (id: number, isActive: number) => {
    await api.put(`/users/${id}`, { isActive: isActive ? 0 : 1 })
    loadData()
  }

  if (loading) return <div className="text-center py-12 text-muted-foreground">加载中...</div>

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">用户管理</h1>
          <p className="text-muted-foreground text-sm mt-1">管理账号和权限</p>
        </div>
        {(currentUser?.role === 'admin' || currentUser?.role === 'super_admin') && (
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-1" /> 新增用户
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-3 px-4 font-medium">用户名</th>
                  <th className="text-left py-3 px-4 font-medium">姓名</th>
                  <th className="text-left py-3 px-4 font-medium">角色</th>
                  <th className="text-left py-3 px-4 font-medium">所属店铺</th>
                  <th className="text-left py-3 px-4 font-medium">状态</th>
                  <th className="text-right py-3 px-4 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-border/50 last:border-0">
                    <td className="py-3 px-4 font-medium">{u.username}</td>
                    <td className="py-3 px-4">{u.displayName}</td>
                    <td className="py-3 px-4">
                      <Badge variant={u.role === 'super_admin' ? 'default' : u.role === 'admin' ? 'secondary' : 'outline'}>
                        {ROLE_LABELS[u.role] || u.role}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{u.shopName || '-'}</td>
                    <td className="py-3 px-4">
                      <Badge variant={u.isActive ? 'success' : 'destructive'}>
                        {u.isActive ? '正常' : '禁用'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {currentUser?.role === 'super_admin' && u.id !== currentUser.id && (
                        <Button size="sm" variant="outline" onClick={() => toggleActive(u.id, u.isActive!)}>
                          {u.isActive ? <UserX className="h-3 w-3 mr-1" /> : <UserCheck className="h-3 w-3 mr-1" />}
                          {u.isActive ? '禁用' : '启用'}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add User Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增用户</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-sm font-medium mb-1.5">用户名 *</label>
              <Input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="请输入用户名" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">密码 *</label>
              <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="请输入密码" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">姓名 *</label>
              <Input value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} placeholder="请输入姓名" />
            </div>
            {currentUser?.role === 'super_admin' && (
              <div>
                <label className="block text-sm font-medium mb-1.5">角色</label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="staff">店员</option>
                  <option value="finance">财务</option>
                  <option value="admin">管理员</option>
                  <option value="super_admin">超级管理员</option>
                </select>
              </div>
            )}
            {currentUser?.role === 'super_admin' && (
              <div>
                <label className="block text-sm font-medium mb-1.5">所属店铺</label>
                <select
                  value={form.shopId}
                  onChange={e => setForm(f => ({ ...f, shopId: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">无</option>
                  {shops.filter(s => !s.isWarehouse && s.status === 'active').map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>取消</Button>
            <Button onClick={handleAdd} disabled={!form.username || !form.password || !form.displayName}>确认新增</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
