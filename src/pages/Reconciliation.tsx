import React, { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import api from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { formatCurrency, getToday } from '@/lib/utils'
import type { BankReceipt, BankCard } from '@/types'
import { CheckSquare, Plus, CheckCircle } from 'lucide-react'

export function Reconciliation() {
  const { user } = useAuth()
  const [receipts, setReceipts] = useState<BankReceipt[]>([])
  const [cards, setCards] = useState<BankCard[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({
    date: getToday(), cardId: '', expectedAmount: 0, actualAmount: 0, source: '', description: '',
  })

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'

  const loadData = async () => {
    try {
      const [rRes, cRes] = await Promise.all([api.get('/bank-receipts'), api.get('/bank-cards')])
      setReceipts(rRes.data)
      setCards(cRes.data)
    } catch (e) {
      console.error('Failed to load receipts', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const handleAdd = async () => {
    if (!form.cardId || form.expectedAmount === undefined || form.actualAmount === undefined) return
    await api.post('/bank-receipts', { ...form, cardId: Number(form.cardId) })
    setShowAdd(false)
    setForm({ date: getToday(), cardId: '', expectedAmount: 0, actualAmount: 0, source: '', description: '' })
    loadData()
  }

  const handleMatch = async (id: number) => {
    await api.put(`/bank-receipts/${id}/match`)
    loadData()
  }

  const pendingCount = receipts.filter(r => r.status === 'pending').length
  const matchedCount = receipts.filter(r => r.status === 'matched').length
  const discrepancyCount = receipts.filter(r => r.status === 'discrepancy').length

  if (loading) return <div className="text-center py-12 text-muted-foreground">加载中...</div>

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">收款核对</h1>
          <p className="text-muted-foreground text-sm mt-1">银行收款核对与差异追踪</p>
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" />新增核对
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">待核对</p><p className="text-2xl font-bold text-warning">{pendingCount}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">已匹配</p><p className="text-2xl font-bold text-success">{matchedCount}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">有差异</p><p className="text-2xl font-bold text-destructive">{discrepancyCount}</p></CardContent></Card>
      </div>

      {/* Receipts Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckSquare className="h-4 w-4" /> 核对记录
          </CardTitle>
        </CardHeader>
        <CardContent>
          {receipts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">暂无核对记录</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 font-medium">日期</th>
                    <th className="text-left py-2 font-medium">银行卡</th>
                    <th className="text-right py-2 font-medium">预期金额</th>
                    <th className="text-right py-2 font-medium">实际金额</th>
                    <th className="text-right py-2 font-medium">差异</th>
                    <th className="text-left py-2 font-medium">来源</th>
                    <th className="text-left py-2 font-medium">状态</th>
                    <th className="text-right py-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.map(r => (
                    <tr key={r.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2">{r.date}</td>
                      <td className="py-2">{r.cardName}</td>
                      <td className="py-2 text-right">{formatCurrency(r.expectedAmount)}</td>
                      <td className="py-2 text-right">{formatCurrency(r.actualAmount)}</td>
                      <td className={`py-2 text-right font-medium ${r.difference !== 0 ? 'text-destructive' : ''}`}>
                        {r.difference !== 0 ? formatCurrency(r.difference) : '-'}
                      </td>
                      <td className="py-2 text-muted-foreground">{r.source || '-'}</td>
                      <td className="py-2">
                        <Badge variant={r.status === 'matched' ? 'success' : r.status === 'discrepancy' ? 'destructive' : 'warning'}>
                          {r.status === 'matched' ? '已匹配' : r.status === 'discrepancy' ? '差异' : '待核对'}
                        </Badge>
                      </td>
                      <td className="py-2 text-right">
                        {r.status !== 'matched' && isAdmin && (
                          <Button size="sm" variant="outline" onClick={() => handleMatch(r.id)}>
                            <CheckCircle className="h-3 w-3 mr-1" />标记匹配
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

      {/* Add Receipt Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>新增收款核对</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">银行卡 *</label>
              <select value={form.cardId} onChange={e => setForm(p => ({ ...p, cardId: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">请选择</option>
                {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">日期</label>
              <Input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">预期金额</label>
              <Input type="number" step="0.01" value={form.expectedAmount || ''} onChange={e => setForm(p => ({ ...p, expectedAmount: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">实际金额</label>
              <Input type="number" step="0.01" value={form.actualAmount || ''} onChange={e => setForm(p => ({ ...p, actualAmount: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">来源</label>
              <Input value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))} placeholder="如：微信、支付宝、现金" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">备注</label>
              <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>取消</Button>
            <Button onClick={handleAdd}>确认</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
