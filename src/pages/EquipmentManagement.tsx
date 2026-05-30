import React, { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import api from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import type { Equipment, Shop } from '@/types'
import { EQUIPMENT_TYPE_LABELS } from '@/types'
import { ScanLine, Monitor, Plus, Unplug, Plug } from 'lucide-react'

export function EquipmentManagement() {
  const { user } = useAuth()
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [showAssign, setShowAssign] = useState<Equipment | null>(null)
  const [assignShopId, setAssignShopId] = useState('')
  const [form, setForm] = useState({ type: 'scanner' as 'scanner' | 'betting_machine', name: '', serialNumber: '', initialBalance: 0 })

  const loadData = async () => {
    try {
      const [eqRes, shopsRes] = await Promise.all([
        api.get('/equipment'),
        api.get('/shops'),
      ])
      setEquipment(eqRes.data)
      setShops(shopsRes.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const isSuperAdmin = user?.role === 'super_admin'

  const handleAdd = async () => {
    if (!form.name) return
    await api.post('/equipment', form)
    setShowAdd(false)
    setForm({ type: 'scanner', name: '', serialNumber: '', initialBalance: 0 })
    loadData()
  }

  const handleAssign = async () => {
    if (!showAssign || !assignShopId) return
    await api.post(`/equipment/${showAssign.id}/assign`, { shopId: Number(assignShopId) })
    setShowAssign(null)
    setAssignShopId('')
    loadData()
  }

  const handleUnassign = async (id: number) => {
    await api.post(`/equipment/${id}/unassign`, { reason: '解绑' })
    loadData()
  }

  const getScannerBalance = async (id: number) => {
    const { data } = await api.get(`/equipment/${id}/balance`)
    return data
  }

  if (loading) return <div className="text-center py-12 text-muted-foreground">加载中...</div>

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">设备管理</h1>
          <p className="text-muted-foreground text-sm mt-1">扫描枪和电脑投注机管理</p>
        </div>
        {isSuperAdmin && (
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-1" /> 新增设备
          </Button>
        )}
      </div>

      {/* Scanners */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ScanLine className="h-4 w-4" /> 扫描枪
          </CardTitle>
        </CardHeader>
        <CardContent>
          {equipment.filter(e => e.type === 'scanner').length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">暂无扫描枪</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 font-medium">名称</th>
                    <th className="text-left py-2 font-medium">序列号</th>
                    <th className="text-left py-2 font-medium">状态</th>
                    <th className="text-left py-2 font-medium">分配店铺</th>
                    <th className="text-right py-2 font-medium">初始余额</th>
                    <th className="text-right py-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {equipment.filter(e => e.type === 'scanner').map(eq => (
                    <tr key={eq.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2 font-medium">{eq.name}</td>
                      <td className="py-2 text-muted-foreground">{eq.serialNumber || '-'}</td>
                      <td className="py-2">
                        <Badge variant={eq.status === 'assigned' ? 'success' : eq.status === 'available' ? 'secondary' : 'destructive'}>
                          {eq.status === 'assigned' ? '已分配' : eq.status === 'available' ? '可用' : eq.status}
                        </Badge>
                      </td>
                      <td className="py-2">{eq.currentShopName || '-'}</td>
                      <td className="py-2 text-right">{formatCurrency(eq.initialBalance)}</td>
                      <td className="py-2 text-right">
                        {eq.status === 'available' && isSuperAdmin && (
                          <Button size="sm" variant="outline" onClick={() => { setShowAssign(eq); setAssignShopId('') }}>
                            <Plug className="h-3 w-3 mr-1" /> 分配
                          </Button>
                        )}
                        {eq.status === 'assigned' && isSuperAdmin && (
                          <Button size="sm" variant="outline" onClick={() => handleUnassign(eq.id)}>
                            <Unplug className="h-3 w-3 mr-1" /> 解绑
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Betting Machines */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Monitor className="h-4 w-4" /> 电脑投注机
          </CardTitle>
        </CardHeader>
        <CardContent>
          {equipment.filter(e => e.type === 'betting_machine').length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">暂无投注机</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 font-medium">名称</th>
                    <th className="text-left py-2 font-medium">序列号</th>
                    <th className="text-left py-2 font-medium">状态</th>
                    <th className="text-left py-2 font-medium">分配店铺</th>
                    <th className="text-right py-2 font-medium">当前余额</th>
                    <th className="text-right py-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {equipment.filter(e => e.type === 'betting_machine').map(eq => (
                    <tr key={eq.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2 font-medium">{eq.name}</td>
                      <td className="py-2 text-muted-foreground">{eq.serialNumber || '-'}</td>
                      <td className="py-2">
                        <Badge variant={eq.status === 'assigned' ? 'success' : eq.status === 'available' ? 'secondary' : 'destructive'}>
                          {eq.status === 'assigned' ? '已分配' : eq.status === 'available' ? '可用' : eq.status}
                        </Badge>
                      </td>
                      <td className="py-2">{eq.currentShopName || '-'}</td>
                      <td className="py-2 text-right">{formatCurrency(eq.currentBalance)}</td>
                      <td className="py-2 text-right">
                        {eq.status === 'available' && isSuperAdmin && (
                          <Button size="sm" variant="outline" onClick={() => { setShowAssign(eq); setAssignShopId('') }}>
                            <Plug className="h-3 w-3 mr-1" /> 分配
                          </Button>
                        )}
                        {eq.status === 'assigned' && isSuperAdmin && (
                          <Button size="sm" variant="outline" onClick={() => handleUnassign(eq.id)}>
                            <Unplug className="h-3 w-3 mr-1" /> 解绑
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Equipment Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增设备</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-sm font-medium mb-1.5">设备类型</label>
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="scanner">扫描枪</option>
                <option value="betting_machine">电脑投注机</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">设备名称 *</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="请输入设备名称" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">序列号</label>
              <Input value={form.serialNumber} onChange={e => setForm(f => ({ ...f, serialNumber: e.target.value }))} placeholder="请输入序列号" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">初始余额</label>
              <Input type="number" value={form.initialBalance} onChange={e => setForm(f => ({ ...f, initialBalance: Number(e.target.value) }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>取消</Button>
            <Button onClick={handleAdd} disabled={!form.name}>确认新增</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Dialog */}
      <Dialog open={!!showAssign} onOpenChange={() => setShowAssign(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>分配 {showAssign?.name} 到店铺</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-sm font-medium mb-1.5">选择店铺</label>
              <select
                value={assignShopId}
                onChange={e => setAssignShopId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">请选择店铺</option>
                {shops.filter(s => !s.isWarehouse && s.status === 'active').map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssign(null)}>取消</Button>
            <Button onClick={handleAssign} disabled={!assignShopId}>确认分配</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
