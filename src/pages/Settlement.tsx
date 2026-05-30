import React, { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import api from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import type { DailySettlement, Shop } from '@/types'
import { SETTLEMENT_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '@/types'
import { CalendarCheck, Calculator, CheckCircle } from 'lucide-react'

export function Settlement() {
  const { user } = useAuth()
  const [settlements, setSettlements] = useState<DailySettlement[]>([])
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [calcShopId, setCalcShopId] = useState('')
  const [calcDate, setCalcDate] = useState(new Date().toISOString().split('T')[0])
  const [calcResult, setCalcResult] = useState<any>(null)
  const [notes, setNotes] = useState('')

  const loadData = async () => {
    try {
      const [sRes, shRes] = await Promise.all([api.get('/settlements'), api.get('/shops')])
      setSettlements(sRes.data)
      setShops(shRes.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const handleCalculate = async () => {
    if (!calcShopId || !calcDate) return
    const { data } = await api.post('/settlements/calculate', { shopId: Number(calcShopId), date: calcDate })
    setCalcResult(data)
  }

  const handleSave = async () => {
    if (!calcShopId || !calcDate) return
    await api.post('/settlements', { shopId: Number(calcShopId), date: calcDate, notes })
    setCalcResult(null)
    setNotes('')
    loadData()
  }

  const handleConfirm = async (id: number) => {
    await api.put(`/settlements/${id}/confirm`)
    loadData()
  }

  const availableShops = shops.filter(s => !s.isWarehouse && s.status === 'active')

  if (loading) return <div className="text-center py-12 text-muted-foreground">加载中...</div>

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">每日结算</h1>
        <p className="text-muted-foreground text-sm mt-1">店铺每日经营结算与核对</p>
      </div>

      {/* Calculator */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="h-4 w-4" /> 结算计算
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">店铺</label>
              <select
                value={calcShopId}
                onChange={e => { setCalcShopId(e.target.value); setCalcResult(null) }}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm min-w-[160px]"
              >
                <option value="">请选择店铺</option>
                {availableShops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">日期</label>
              <Input type="date" value={calcDate} onChange={e => { setCalcDate(e.target.value); setCalcResult(null) }} className="w-[160px]" />
            </div>
            <Button onClick={handleCalculate} disabled={!calcShopId || !calcDate}>
              <Calculator className="h-4 w-4 mr-1" /> 计算
            </Button>
          </div>

          {calcResult && (
            <div className="mt-4 p-4 rounded-md border bg-muted/30 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div><span className="text-muted-foreground">现金销售：</span><span className="font-medium">{formatCurrency(calcResult.cashSales)}</span></div>
                <div><span className="text-muted-foreground">微信销售：</span><span className="font-medium">{formatCurrency(calcResult.wechatSales)}</span></div>
                <div><span className="text-muted-foreground">支付宝销售：</span><span className="font-medium">{formatCurrency(calcResult.alipaySales)}</span></div>
                <div><span className="text-muted-foreground">兑奖销售：</span><span className="font-medium">{formatCurrency(calcResult.redemptionSales)}</span></div>
                <div><span className="text-muted-foreground">总销售：</span><span className="font-bold">{formatCurrency(calcResult.totalSales)}</span></div>
                <div><span className="text-muted-foreground">总支出：</span><span className="font-medium">{formatCurrency(calcResult.totalExpenses)}</span></div>
                <div><span className="text-muted-foreground">净利润：</span><span className="font-bold text-primary">{formatCurrency(calcResult.netAmount)}</span></div>
                <div><span className="text-muted-foreground">库存价值：</span><span className="font-medium">{formatCurrency(calcResult.inventoryValue)}</span></div>
                <div><span className="text-muted-foreground">扫描枪余额：</span><span className="font-medium">{formatCurrency(calcResult.scannerBalance)}</span></div>
                <div><span className="text-muted-foreground">投注机余额：</span><span className="font-medium">{formatCurrency(calcResult.machineBalance)}</span></div>
              </div>
              <div>
                <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="备注（可选）" className="mt-2" />
              </div>
              <Button onClick={handleSave}>保存结算</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarCheck className="h-4 w-4" /> 结算记录
          </CardTitle>
        </CardHeader>
        <CardContent>
          {settlements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">暂无结算记录</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 font-medium">日期</th>
                    <th className="text-left py-2 font-medium">店铺</th>
                    <th className="text-right py-2 font-medium">总销售</th>
                    <th className="text-right py-2 font-medium">净利润</th>
                    <th className="text-right py-2 font-medium">库存价值</th>
                    <th className="text-left py-2 font-medium">状态</th>
                    <th className="text-right py-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {settlements.map(s => (
                    <tr key={s.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2">{s.settlementDate}</td>
                      <td className="py-2">{s.shopName}</td>
                      <td className="py-2 text-right">{formatCurrency(s.totalSales)}</td>
                      <td className="py-2 text-right font-medium">{formatCurrency(s.netAmount)}</td>
                      <td className="py-2 text-right">{formatCurrency(s.inventoryValue)}</td>
                      <td className="py-2">
                        <Badge variant={s.status === 'confirmed' ? 'success' : 'warning'}>
                          {SETTLEMENT_STATUS_LABELS[s.status]}
                        </Badge>
                      </td>
                      <td className="py-2 text-right">
                        {s.status === 'pending' && (user?.role === 'admin' || user?.role === 'super_admin') && (
                          <Button size="sm" variant="outline" onClick={() => handleConfirm(s.id)}>
                            <CheckCircle className="h-3 w-3 mr-1" /> 确认
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
