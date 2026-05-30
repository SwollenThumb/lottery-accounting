import React, { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import api from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Shop } from '@/types'
import { Store, Plus, MapPin, Phone } from 'lucide-react'

export function ShopManagement() {
  const { user } = useAuth()
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [showDetail, setShowDetail] = useState<Shop | null>(null)
  const [form, setForm] = useState({ name: '', address: '', contactPhone: '' })

  const loadShops = async () => {
    try {
      const { data } = await api.get('/shops')
      setShops(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadShops() }, [])

  const handleAdd = async () => {
    if (!form.name) return
    await api.post('/shops', form)
    setShowAdd(false)
    setForm({ name: '', address: '', contactPhone: '' })
    loadShops()
  }

  const handleViewDetail = async (id: number) => {
    const { data } = await api.get(`/shops/${id}`)
    setShowDetail(data)
  }

  const isSuperAdmin = user?.role === 'super_admin'

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">店铺管理</h1>
          <p className="text-muted-foreground text-sm mt-1">管理门店信息和设备分配</p>
        </div>
        {isSuperAdmin && (
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-1" /> 新增店铺
          </Button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">加载中...</div>
      ) : shops.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">暂无店铺</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {shops.map(shop => (
            <Card
              key={shop.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handleViewDetail(shop.id)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Store className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{shop.name}</h3>
                      {shop.isWarehouse ? (
                        <Badge variant="secondary" className="mt-1">总仓库</Badge>
                      ) : (
                        <Badge variant={shop.status === 'active' ? 'success' : 'destructive'} className="mt-1">
                          {shop.status === 'active' ? '营业中' : '已关闭'}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                {shop.address && (
                  <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" /> {shop.address}
                  </div>
                )}
                {shop.contactPhone && (
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" /> {shop.contactPhone}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Shop Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增店铺</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-sm font-medium mb-1.5">店铺名称 *</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="请输入店铺名称" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">地址</label>
              <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="请输入地址" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">联系电话</label>
              <Input value={form.contactPhone} onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))} placeholder="请输入联系电话" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>取消</Button>
            <Button onClick={handleAdd} disabled={!form.name}>确认新增</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!showDetail} onOpenChange={() => setShowDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{showDetail?.name} - 店铺详情</DialogTitle>
          </DialogHeader>
          {showDetail && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">地址：</span>{showDetail.address || '-'}</div>
                <div><span className="text-muted-foreground">电话：</span>{showDetail.contactPhone || '-'}</div>
                <div><span className="text-muted-foreground">状态：</span>
                  <Badge variant={showDetail.status === 'active' ? 'success' : 'destructive'}>
                    {showDetail.status === 'active' ? '营业中' : '已关闭'}
                  </Badge>
                </div>
                <div><span className="text-muted-foreground">创建时间：</span>{formatDate(showDetail.createdAt)}</div>
              </div>
              {showDetail.equipment && showDetail.equipment.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2">已分配设备</h4>
                  <div className="space-y-2">
                    {showDetail.equipment.map(eq => (
                      <div key={eq.id} className="flex items-center justify-between p-2 rounded-md bg-muted text-sm">
                        <span>{eq.name}</span>
                        <Badge variant="secondary">{eq.type === 'scanner' ? '扫描枪' : '投注机'}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!showDetail.equipment?.length && (
                <p className="text-sm text-muted-foreground">暂无分配设备</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
