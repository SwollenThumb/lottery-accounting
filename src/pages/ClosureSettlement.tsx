import React, { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import api from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import type { ClosureSettlement, Shop } from '@/types'
import { SETTLEMENT_STATUS_LABELS } from '@/types'
import { Input } from '@/components/ui/input'
import { CircleOff, Calculator, CheckCircle, AlertTriangle } from 'lucide-react'

export function ClosureSettlement() {
  const { user } = useAuth()
  const [closures, setClosures] = useState<ClosureSettlement[]>([])
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [calcShopId, setCalcShopId] = useState('')
  const [calcResult, setCalcResult] = useState<any>(null)
  const [notes, setNotes] = useState('')

  const loadData = async () => {
    try {
      const [cRes, shRes] = await Promise.all([api.get('/closures'), api.get('/shops')])
      setClosures(cRes.data)
      setShops(shRes.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const handleCalculate = async () => {
    if (!calcShopId) return
    const { data } = await api.post('/closures/calculate', { shopId: Number(calcShopId) })
    setCalcResult(data)
  }

  const handleSave = async () => {
    if (!calcShopId) return
    await api.post('/closures', { shopId: Number(calcShopId), notes })
    setCalcResult(null)
    setNotes('')
    loadData()
  }

  const handleConfirm = async (id: number) => {
    if (!confirm('确认撤店结算？此操作将关闭店铺、归还库存、解绑设备，不可撤销！')) return
    await api.put(`/closures/${id}/confirm`)
    loadData()
  }

  const availableShops = shops.filter(s => !s.isWarehouse && s.status === 'active')

  if (loading) return <div className="text-center py-12 text-muted-foreground">加载中...</div>

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">撤店结算</h1>
        <p className="text-muted-foreground text-sm mt-1">关闭店铺并进行最终结算</p>
      </div>

      {/* Warning */}
      <div className="flex items-start gap-3 p-4 rounded-md bg-destructive/10 border border-destructive/20">
        <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-destructive">注意：撤店操作不可撤销</p>
          <p className="text-muted-foreground mt-1">确认撤店后，店铺将被关闭，所有库存归还总仓库，设备自动解绑。</p>
        </div>
      </div>

      {/* Calculator */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="h-4 w-4" /> 撤店结算计算
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">选择店铺</label>
              <select
                value={calcShopId}
                onChange={e => { setCalcShopId(e.target.value); setCalcResult(null) }}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm min-w-[160px]"
              >
                <option value="">请选择店铺</option>
                {availableShops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <Button onClick={handleCalculate} disabled={!calcShopId}>
              <Calculator className="h-4 w-4 mr-1" /> 计算
            </Button>
          </div>

          {calcResult && (
            <div className="mt-4 p-4 rounded-md border bg-muted/30 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div><span className="text-muted-foreground">剩余库存价值：</span><span className="font-medium">{formatCurrency(calcResult.remainingInventoryValue)}</span></div>
                <div><span className="text-muted-foreground">累计总销售：</span><span className="font-medium">{formatCurrency(calcResult.totalSales)}</span></div>
                <div><span className="text-muted-foreground">累计总支出：</span><span className="font-medium">{formatCurrency(calcResult.totalExpenses)}</span></div>
                <div><span className="text-muted-foreground">净利润：</span><span className="font-bold">{formatCurrency(calcResult.netFinancial)}</span></div>
                <div><span className="text-muted-foreground">银行卡余额：</span><span className="font-medium">{formatCurrency(calcResult.finalBalance)}</span></div>
                <div><span className="text-muted-foreground">扫描枪归还：</span><span className="font-medium">{calcResult.scannerReturned ? '是' : '否'}</span></div>
                <div><span className="text-muted-foreground">投注机归还：</span><span className="font-medium">{calcResult.machineReturned ? '是' : '否'}</span></div>
              </div>
              <div>
                <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="备注（可选）" className="mt-2" />
              </div>
              <Button variant="destructive" onClick={handleSave}>保存撤店结算</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CircleOff className="h-4 w-4" /> 撤店记录
          </CardTitle>
        </CardHeader>
        <CardContent>
          {closures.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">暂无撤店记录</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 font-medium">店铺</th>
                    <th className="text-left py-2 font-medium">撤店日期</th>
                    <th className="text-right py-2 font-medium">库存价值</th>
                    <th className="text-right py-2 font-medium">净利润</th>
                    <th className="text-right py-2 font-medium">银行余额</th>
                    <th className="text-left py-2 font-medium">状态</th>
                    <th className="text-right py-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {closures.map(c => (
                    <tr key={c.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2">{c.shopName}</td>
                      <td className="py-2">{c.closureDate}</td>
                      <td className="py-2 text-right">{formatCurrency(c.remainingInventoryValue)}</td>
                      <td className="py-2 text-right font-medium">{formatCurrency(c.netFinancial)}</td>
                      <td className="py-2 text-right">{formatCurrency(c.finalBalance)}</td>
                      <td className="py-2">
                        <Badge variant={c.status === 'confirmed' ? 'success' : 'warning'}>
                          {SETTLEMENT_STATUS_LABELS[c.status]}
                        </Badge>
                      </td>
                      <td className="py-2 text-right">
                        {c.status === 'pending' && user?.role === 'super_admin' && (
                          <Button size="sm" variant="destructive" onClick={() => handleConfirm(c.id)}>
                            <CheckCircle className="h-3 w-3 mr-1" /> 确认撤店
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
    </div>
  )
}
