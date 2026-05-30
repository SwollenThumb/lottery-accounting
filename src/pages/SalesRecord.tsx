import React, { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import api from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { formatCurrency, getToday } from '@/lib/utils'
import type { Sale, Transfer, InventoryItem, Shop, LotteryBatch } from '@/types'
import { PAYMENT_METHOD_LABELS } from '@/types'
import { ShoppingCart, Truck, Plus, CheckCircle, Trash2 } from 'lucide-react'

export function SalesRecordPage() {
  const { user } = useAuth()
  const [sales, setSales] = useState<Sale[]>([])
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)

  const [activeTab, setActiveTab] = useState('sales')
  const [showAddSale, setShowAddSale] = useState(false)
  const [showAddTransfer, setShowAddTransfer] = useState(false)

  const [saleForm, setSaleForm] = useState({
    date: getToday(), shopId: '', paymentMethod: 'cash' as string, description: '',
    items: [{ inventoryId: '', lotteryName: '', quantity: 1, unitPrice: 0 }] as { inventoryId: string; lotteryName: string; quantity: number; unitPrice: number }[],
  })

  const [transferForm, setTransferForm] = useState({
    date: getToday(), fromShopId: '', toShopId: '', batchId: '', lotteryName: '', quantity: 1, unitPrice: 0, reason: '',
  })

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'

  const loadData = async () => {
    try {
      const [sRes, tRes, iRes, shRes] = await Promise.all([
        api.get('/sales'),
        api.get('/transfers'),
        api.get('/inventory'),
        api.get('/shops'),
      ])
      setSales(sRes.data)
      setTransfers(tRes.data)
      setInventory(iRes.data)
      setShops(shRes.data)
    } catch (e) {
      console.error('Failed to load sales', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  // Sales summary
  const cashTotal = sales.filter(s => s.paymentMethod === 'cash').reduce((sum, s) => sum + s.totalAmount, 0)
  const wechatTotal = sales.filter(s => s.paymentMethod === 'wechat').reduce((sum, s) => sum + s.totalAmount, 0)
  const alipayTotal = sales.filter(s => s.paymentMethod === 'alipay').reduce((sum, s) => sum + s.totalAmount, 0)
  const redemptionTotal = sales.filter(s => s.paymentMethod === 'redemption').reduce((sum, s) => sum + s.totalAmount, 0)

  const handleAddSale = async () => {
    if (!saleForm.shopId || !saleForm.items.length) return
    await api.post('/sales', {
      ...saleForm,
      shopId: Number(saleForm.shopId),
      items: saleForm.items.filter(i => i.lotteryName && i.quantity > 0),
    })
    setShowAddSale(false)
    setSaleForm({
      date: getToday(), shopId: '', paymentMethod: 'cash', description: '',
      items: [{ inventoryId: '', lotteryName: '', quantity: 1, unitPrice: 0 }],
    })
    loadData()
  }

  const handleAddTransfer = async () => {
    if (!transferForm.fromShopId || !transferForm.toShopId || !transferForm.batchId || !transferForm.quantity) return
    await api.post('/transfers', {
      ...transferForm,
      fromShopId: Number(transferForm.fromShopId),
      toShopId: Number(transferForm.toShopId),
      batchId: Number(transferForm.batchId),
    })
    setShowAddTransfer(false)
    setTransferForm({ date: getToday(), fromShopId: '', toShopId: '', batchId: '', lotteryName: '', quantity: 1, unitPrice: 0, reason: '' })
    loadData()
  }

  const handleVerifySale = async (id: number) => {
    await api.put(`/sales/${id}/verify`)
    loadData()
  }

  const handleDeleteSale = async (id: number) => {
    await api.delete(`/sales/${id}`)
    loadData()
  }

  const activeShops = shops.filter(s => !s.isWarehouse && s.status === 'active')

  if (loading) return <div className="text-center py-12 text-muted-foreground">加载中...</div>

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">进销管理</h1>
          <p className="text-muted-foreground text-sm mt-1">销售记录与库存调拨</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowAddTransfer(true)}>
            <Truck className="h-4 w-4 mr-1" />调拨
          </Button>
          <Button size="sm" onClick={() => setShowAddSale(true)}>
            <Plus className="h-4 w-4 mr-1" />销售
          </Button>
        </div>
      </div>

      {/* Sales summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">现金</p><p className="text-lg font-bold">{formatCurrency(cashTotal)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">微信</p><p className="text-lg font-bold">{formatCurrency(wechatTotal)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">支付宝</p><p className="text-lg font-bold">{formatCurrency(alipayTotal)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">兑奖</p><p className="text-lg font-bold">{formatCurrency(redemptionTotal)}</p></CardContent></Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="sales">销售记录 ({sales.length})</TabsTrigger>
          <TabsTrigger value="transfers">调拨记录 ({transfers.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="sales">
          <Card>
            <CardContent className="p-0">
              {sales.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>暂无销售记录</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-3 px-4 font-medium">日期</th>
                        <th className="text-left py-3 px-4 font-medium">店铺</th>
                        <th className="text-left py-3 px-4 font-medium">支付方式</th>
                        <th className="text-right py-3 px-4 font-medium">金额</th>
                        <th className="text-left py-3 px-4 font-medium">状态</th>
                        <th className="text-right py-3 px-4 font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sales.map(s => (
                        <tr key={s.id} className="border-b border-border/50 last:border-0">
                          <td className="py-3 px-4">{s.date}</td>
                          <td className="py-3 px-4">{s.shopName}</td>
                          <td className="py-3 px-4">
                            <Badge variant="secondary">{PAYMENT_METHOD_LABELS[s.paymentMethod]}</Badge>
                          </td>
                          <td className="py-3 px-4 text-right font-medium">{formatCurrency(s.totalAmount)}</td>
                          <td className="py-3 px-4">
                            <Badge variant={s.status === 'verified' ? 'success' : s.status === 'discrepancy' ? 'destructive' : 'warning'}>
                              {s.status === 'verified' ? '已核实' : s.status === 'discrepancy' ? '差异' : '待核实'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right space-x-1">
                            {s.status === 'pending' && isAdmin && (
                              <Button size="sm" variant="outline" onClick={() => handleVerifySale(s.id)}>
                                <CheckCircle className="h-3 w-3" />
                              </Button>
                            )}
                            {isAdmin && (
                              <Button size="sm" variant="ghost" onClick={() => handleDeleteSale(s.id)}>
                                <Trash2 className="h-3 w-3 text-destructive" />
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
        </TabsContent>

        <TabsContent value="transfers">
          <Card>
            <CardContent className="p-0">
              {transfers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Truck className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>暂无调拨记录</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-3 px-4 font-medium">日期</th>
                        <th className="text-left py-3 px-4 font-medium">从</th>
                        <th className="text-left py-3 px-4 font-medium">到</th>
                        <th className="text-left py-3 px-4 font-medium">彩票</th>
                        <th className="text-right py-3 px-4 font-medium">数量</th>
                        <th className="text-right py-3 px-4 font-medium">单价</th>
                        <th className="text-left py-3 px-4 font-medium">原因</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transfers.map(t => (
                        <tr key={t.id} className="border-b border-border/50 last:border-0">
                          <td className="py-3 px-4">{t.date}</td>
                          <td className="py-3 px-4">{t.fromShopName}</td>
                          <td className="py-3 px-4">{t.toShopName}</td>
                          <td className="py-3 px-4">{t.lotteryName}</td>
                          <td className="py-3 px-4 text-right">{t.quantity}</td>
                          <td className="py-3 px-4 text-right">{formatCurrency(t.unitPrice)}</td>
                          <td className="py-3 px-4 text-muted-foreground">{t.reason || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Sale Dialog */}
      <Dialog open={showAddSale} onOpenChange={setShowAddSale}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>记录销售</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">店铺 *</label>
              <select value={saleForm.shopId} onChange={e => setSaleForm(p => ({ ...p, shopId: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">请选择店铺</option>
                {activeShops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">支付方式</label>
              <select value={saleForm.paymentMethod} onChange={e => setSaleForm(p => ({ ...p, paymentMethod: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="cash">现金</option>
                <option value="wechat">微信</option>
                <option value="alipay">支付宝</option>
                <option value="redemption">兑奖</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">日期</label>
              <Input type="date" value={saleForm.date} onChange={e => setSaleForm(p => ({ ...p, date: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">销售明细</label>
              {saleForm.items.map((item, idx) => (
                <div key={idx} className="flex gap-2 mb-2">
                  <Input className="flex-1" placeholder="彩票名称" value={item.lotteryName} onChange={e => {
                    const items = [...saleForm.items]
                    items[idx] = { ...items[idx], lotteryName: e.target.value }
                    setSaleForm(p => ({ ...p, items }))
                  }} />
                  <Input className="w-20" type="number" placeholder="数量" value={item.quantity || ''} onChange={e => {
                    const items = [...saleForm.items]
                    items[idx] = { ...items[idx], quantity: parseInt(e.target.value) || 0 }
                    setSaleForm(p => ({ ...p, items }))
                  }} />
                  <Input className="w-24" type="number" step="0.01" placeholder="单价" value={item.unitPrice || ''} onChange={e => {
                    const items = [...saleForm.items]
                    items[idx] = { ...items[idx], unitPrice: parseFloat(e.target.value) || 0 }
                    setSaleForm(p => ({ ...p, items }))
                  }} />
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => setSaleForm(p => ({ ...p, items: [...p.items, { inventoryId: '', lotteryName: '', quantity: 1, unitPrice: 0 }] }))}>
                <Plus className="h-3 w-3 mr-1" />添加行
              </Button>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">备注</label>
              <Input value={saleForm.description} onChange={e => setSaleForm(p => ({ ...p, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddSale(false)}>取消</Button>
            <Button onClick={handleAddSale}>确认</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Transfer Dialog */}
      <Dialog open={showAddTransfer} onOpenChange={setShowAddTransfer}>
        <DialogContent>
          <DialogHeader><DialogTitle>库存调拨</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">从店铺 *</label>
              <select value={transferForm.fromShopId} onChange={e => setTransferForm(p => ({ ...p, fromShopId: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">请选择</option>
                {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">到店铺 *</label>
              <select value={transferForm.toShopId} onChange={e => setTransferForm(p => ({ ...p, toShopId: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">请选择</option>
                {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">库存批次 *</label>
              <select value={transferForm.batchId} onChange={e => {
                const inv = inventory.find(i => i.batchId === Number(e.target.value))
                setTransferForm(p => ({ ...p, batchId: e.target.value, lotteryName: inv?.lotteryName || '', unitPrice: inv?.unitPrice || 0 }))
              }} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">请选择批次</option>
                {inventory.filter(i => i.shopId === Number(transferForm.fromShopId)).map(i => (
                  <option key={i.batchId} value={i.batchId}>{i.lotteryName} - {i.batchNumber} (库存 {i.quantity - i.soldQuantity})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">数量 *</label>
              <Input type="number" value={transferForm.quantity || ''} onChange={e => setTransferForm(p => ({ ...p, quantity: parseInt(e.target.value) || 0 }))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">日期</label>
              <Input type="date" value={transferForm.date} onChange={e => setTransferForm(p => ({ ...p, date: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">原因</label>
              <Input value={transferForm.reason} onChange={e => setTransferForm(p => ({ ...p, reason: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTransfer(false)}>取消</Button>
            <Button onClick={handleAddTransfer}>确认调拨</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
