import React, { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import api from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { formatCurrency, getToday } from '@/lib/utils'
import type { InventoryItem, LotteryBatch, LotteryType, ScannerRecord, Equipment, Shop } from '@/types'
import { SCANNER_TYPE_LABELS } from '@/types'
import { ScanLine, Package, Plus, Archive, Truck } from 'lucide-react'

export function LotteryInventory() {
  const { user } = useAuth()
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [batches, setBatches] = useState<LotteryBatch[]>([])
  const [lotteryTypes, setLotteryTypes] = useState<LotteryType[]>([])
  const [scannerRecords, setScannerRecords] = useState<ScannerRecord[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)

  // Dialogs
  const [showAddType, setShowAddType] = useState(false)
  const [showStockIn, setShowStockIn] = useState(false)
  const [showScannerRecord, setShowScannerRecord] = useState(false)
  const [showActivate, setShowActivate] = useState<InventoryItem | null>(null)

  // Forms
  const [typeForm, setTypeForm] = useState({ name: '', defaultUnitPrice: 0, description: '' })
  const [batchForm, setBatchForm] = useState({ batchNumber: '', lotteryTypeId: '', unitPrice: 0, totalQuantity: 0, dateReceived: getToday(), notes: '' })
  const [scanForm, setScanForm] = useState({ equipmentId: '', type: 'payment' as 'payment' | 'redemption' | 'activation', amount: 0, date: getToday(), description: '' })
  const [activateQty, setActivateQty] = useState(0)

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'

  const loadData = async () => {
    try {
      const [invRes, batchRes, typeRes, scanRes, eqRes, shopRes] = await Promise.all([
        api.get('/inventory'),
        api.get('/inventory/batches'),
        api.get('/inventory/lottery-types'),
        api.get('/scanner-records'),
        api.get('/equipment'),
        api.get('/shops'),
      ])
      setInventory(invRes.data)
      setBatches(batchRes.data)
      setLotteryTypes(typeRes.data)
      setScannerRecords(scanRes.data)
      setEquipment(eqRes.data)
      setShops(shopRes.data)
    } catch (e) {
      console.error('Failed to load inventory', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const handleAddType = async () => {
    if (!typeForm.name || !typeForm.defaultUnitPrice) return
    await api.post('/inventory/lottery-types', typeForm)
    setShowAddType(false)
    setTypeForm({ name: '', defaultUnitPrice: 0, description: '' })
    loadData()
  }

  const handleStockIn = async () => {
    if (!batchForm.batchNumber || !batchForm.lotteryTypeId || !batchForm.unitPrice || !batchForm.totalQuantity) return
    await api.post('/inventory/batches', batchForm)
    setShowStockIn(false)
    setBatchForm({ batchNumber: '', lotteryTypeId: '', unitPrice: 0, totalQuantity: 0, dateReceived: getToday(), notes: '' })
    loadData()
  }

  const handleScannerRecord = async () => {
    if (!scanForm.equipmentId || !scanForm.amount) return
    await api.post('/scanner-records', { ...scanForm, shopId: null })
    setShowScannerRecord(false)
    setScanForm({ equipmentId: '', type: 'payment', amount: 0, date: getToday(), description: '' })
    loadData()
  }

  const handleActivate = async () => {
    if (!showActivate) return
    await api.post(`/inventory/${showActivate.id}/activate`, { quantity: activateQty })
    setShowActivate(null)
    setActivateQty(0)
    loadData()
  }

  // Group inventory by shop
  const shopGroups = shops.map(s => ({
    shop: s,
    items: inventory.filter(i => i.shopId === s.id),
  })).filter(g => g.items.length > 0)

  // Scanners with balance
  const scanners = equipment.filter(e => e.type === 'scanner')

  if (loading) return <div className="text-center py-12 text-muted-foreground">加载中...</div>

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">彩票库存</h1>
          <p className="text-muted-foreground text-sm mt-1">入库、激活、库存管理</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <>
              <Button variant="outline" size="sm" onClick={() => setShowAddType(true)}>
                <Plus className="h-4 w-4 mr-1" />彩票品种
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowStockIn(true)}>
                <Archive className="h-4 w-4 mr-1" />入库
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowScannerRecord(true)}>
            <ScanLine className="h-4 w-4 mr-1" />扫描枪记录
          </Button>
        </div>
      </div>

      {/* Inventory by shop */}
      {shopGroups.map(({ shop, items }) => (
        <Card key={shop.id}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              {shop.isWarehouse ? <Package className="h-4 w-4" /> : <Truck className="h-4 w-4" />}
              {shop.name}
              <Badge variant="secondary" className="ml-2">{items.length} 种</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 font-medium">彩票名称</th>
                    <th className="text-left py-2 font-medium">批次号</th>
                    <th className="text-right py-2 font-medium">单价</th>
                    <th className="text-right py-2 font-medium">总数量</th>
                    <th className="text-right py-2 font-medium">已激活</th>
                    <th className="text-right py-2 font-medium">已售</th>
                    <th className="text-right py-2 font-medium">未售金额</th>
                    <th className="text-right py-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2 font-medium">{item.lotteryName}</td>
                      <td className="py-2 text-muted-foreground">{item.batchNumber}</td>
                      <td className="py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                      <td className="py-2 text-right">{item.quantity}</td>
                      <td className="py-2 text-right">{item.activatedQuantity}</td>
                      <td className="py-2 text-right">{item.soldQuantity}</td>
                      <td className="py-2 text-right font-medium">{formatCurrency(item.unsoldValue)}</td>
                      <td className="py-2 text-right">
                        {item.activatedQuantity < item.quantity && isAdmin && (
                          <Button size="sm" variant="outline" onClick={() => { setShowActivate(item); setActivateQty(item.quantity - item.activatedQuantity) }}>
                            激活
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
      ))}

      {shopGroups.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>暂无库存数据</p>
            {isAdmin && <Button variant="outline" className="mt-3" onClick={() => setShowStockIn(true)}>入库</Button>}
          </CardContent>
        </Card>
      )}

      {/* Scanner Records */}
      {scannerRecords.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ScanLine className="h-4 w-4" /> 扫描枪记录
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 font-medium">扫描枪</th>
                    <th className="text-left py-2 font-medium">类型</th>
                    <th className="text-right py-2 font-medium">金额</th>
                    <th className="text-left py-2 font-medium">日期</th>
                    <th className="text-left py-2 font-medium">备注</th>
                  </tr>
                </thead>
                <tbody>
                  {scannerRecords.slice(0, 20).map(r => (
                    <tr key={r.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2">{r.equipmentName || r.equipmentId}</td>
                      <td className="py-2"><Badge variant="secondary">{SCANNER_TYPE_LABELS[r.type]}</Badge></td>
                      <td className="py-2 text-right">{formatCurrency(r.amount)}</td>
                      <td className="py-2 text-muted-foreground">{r.date}</td>
                      <td className="py-2 text-muted-foreground">{r.description || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Type Dialog */}
      <Dialog open={showAddType} onOpenChange={setShowAddType}>
        <DialogContent>
          <DialogHeader><DialogTitle>新增彩票品种</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">名称 *</label>
              <Input value={typeForm.name} onChange={e => setTypeForm(p => ({ ...p, name: e.target.value }))} placeholder="如：刮刮乐-好运十倍" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">默认单价 *</label>
              <Input type="number" step="0.01" value={typeForm.defaultUnitPrice || ''} onChange={e => setTypeForm(p => ({ ...p, defaultUnitPrice: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">描述</label>
              <Input value={typeForm.description} onChange={e => setTypeForm(p => ({ ...p, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddType(false)}>取消</Button>
            <Button onClick={handleAddType}>确认</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock In Dialog */}
      <Dialog open={showStockIn} onOpenChange={setShowStockIn}>
        <DialogContent>
          <DialogHeader><DialogTitle>彩票入库</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">彩票品种 *</label>
              <select value={batchForm.lotteryTypeId} onChange={e => {
                const lt = lotteryTypes.find(t => t.id === Number(e.target.value))
                setBatchForm(p => ({ ...p, lotteryTypeId: e.target.value, unitPrice: lt?.defaultUnitPrice || p.unitPrice }))
              }} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">请选择品种</option>
                {lotteryTypes.map(t => <option key={t.id} value={t.id}>{t.name} (单价 {t.defaultUnitPrice})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">批次号 *</label>
              <Input value={batchForm.batchNumber} onChange={e => setBatchForm(p => ({ ...p, batchNumber: e.target.value }))} placeholder="如：GG202501001" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">单价 *</label>
              <Input type="number" step="0.01" value={batchForm.unitPrice || ''} onChange={e => setBatchForm(p => ({ ...p, unitPrice: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">总数量 *</label>
              <Input type="number" value={batchForm.totalQuantity || ''} onChange={e => setBatchForm(p => ({ ...p, totalQuantity: parseInt(e.target.value) || 0 }))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">入库日期</label>
              <Input type="date" value={batchForm.dateReceived} onChange={e => setBatchForm(p => ({ ...p, dateReceived: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">备注</label>
              <Input value={batchForm.notes} onChange={e => setBatchForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStockIn(false)}>取消</Button>
            <Button onClick={handleStockIn}>确认入库</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Scanner Record Dialog */}
      <Dialog open={showScannerRecord} onOpenChange={setShowScannerRecord}>
        <DialogContent>
          <DialogHeader><DialogTitle>扫描枪记录</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">扫描枪 *</label>
              <select value={scanForm.equipmentId} onChange={e => setScanForm(p => ({ ...p, equipmentId: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">请选择扫描枪</option>
                {scanners.map(s => <option key={s.id} value={s.id}>{s.name} ({s.currentShopName || '未分配'})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">类型 *</label>
              <select value={scanForm.type} onChange={e => setScanForm(p => ({ ...p, type: e.target.value as any }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="payment">缴款</option>
                <option value="redemption">兑奖</option>
                <option value="activation">激活</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">金额 *</label>
              <Input type="number" step="0.01" value={scanForm.amount || ''} onChange={e => setScanForm(p => ({ ...p, amount: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">日期</label>
              <Input type="date" value={scanForm.date} onChange={e => setScanForm(p => ({ ...p, date: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">备注</label>
              <Input value={scanForm.description} onChange={e => setScanForm(p => ({ ...p, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScannerRecord(false)}>取消</Button>
            <Button onClick={handleScannerRecord}>确认</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Activate Dialog */}
      <Dialog open={!!showActivate} onOpenChange={() => setShowActivate(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>激活彩票</DialogTitle></DialogHeader>
          {showActivate && (
            <div className="space-y-4">
              <p className="text-sm">{showActivate.lotteryName} - 批次 {showActivate.batchNumber}</p>
              <p className="text-xs text-muted-foreground">可激活: {showActivate.quantity - showActivate.activatedQuantity} 张</p>
              <div>
                <label className="block text-sm font-medium mb-1.5">激活数量</label>
                <Input type="number" value={activateQty} onChange={e => setActivateQty(parseInt(e.target.value) || 0)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowActivate(null)}>取消</Button>
            <Button onClick={handleActivate}>确认激活</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
