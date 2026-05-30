import React, { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import api from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { formatCurrency } from '@/lib/utils'
import type { StaffSubmission, Shop } from '@/types'
import { SearchCheck, CheckCircle, AlertTriangle } from 'lucide-react'

const STATUS_LABELS: Record<string, string> = {
  pending: '待核对',
  verified: '已核对',
  discrepancy: '有差异',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  verified: 'bg-green-100 text-green-700 border-green-200',
  discrepancy: 'bg-red-100 text-red-700 border-red-200',
}

export function FinanceReviewPage() {
  const { user } = useAuth()
  const [submissions, setSubmissions] = useState<StaffSubmission[]>([])
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterShop, setFilterShop] = useState('all')
  const [detail, setDetail] = useState<StaffSubmission | null>(null)
  const [verifyForm, setVerifyForm] = useState({ status: 'verified' as 'verified' | 'discrepancy', notes: '' })
  const [verifying, setVerifying] = useState(false)

  const loadData = async () => {
    try {
      const [subRes, shopRes] = await Promise.all([api.get('/submissions'), api.get('/shops')])
      setSubmissions(subRes.data)
      setShops(shopRes.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const openDetail = async (sub: StaffSubmission) => {
    const { data } = await api.get(`/submissions/${sub.id}`)
    setDetail(data)
    setVerifyForm({ status: data.status === 'pending' ? 'verified' : data.status, notes: data.verificationNotes || '' })
  }

  const handleVerify = async () => {
    if (!detail) return
    setVerifying(true)
    try {
      await api.put(`/submissions/${detail.id}/verify`, { status: verifyForm.status, verificationNotes: verifyForm.notes })
      setDetail(null)
      loadData()
    } finally {
      setVerifying(false)
    }
  }

  const filtered = submissions.filter(s => {
    if (filterStatus !== 'all' && s.status !== filterStatus) return false
    if (filterShop !== 'all' && String(s.shopId) !== filterShop) return false
    return true
  })

  const totalOf = (s: StaffSubmission) => (s.cashAmount || 0) + (s.wechatAmount || 0) + (s.alipayAmount || 0) + (s.redemptionAmount || 0)

  if (loading) return <div className="text-center py-12 text-muted-foreground">加载中...</div>

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">交账核对</h1>
        <p className="text-muted-foreground text-sm mt-1">核对店员交账数据与实际销售情况</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
          <option value="all">全部状态</option>
          <option value="pending">待核对</option>
          <option value="verified">已核对</option>
          <option value="discrepancy">有差异</option>
        </select>
        <select value={filterShop} onChange={e => setFilterShop(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
          <option value="all">全部店铺</option>
          {shops.filter(s => !s.isWarehouse).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">待核对</p><p className="text-lg font-bold">{submissions.filter(s => s.status === 'pending').length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">已核对</p><p className="text-lg font-bold">{submissions.filter(s => s.status === 'verified').length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">有差异</p><p className="text-lg font-bold">{submissions.filter(s => s.status === 'discrepancy').length}</p></CardContent></Card>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <Card><CardContent className="py-12 text-center text-muted-foreground">暂无记录</CardContent></Card>
        )}
        {filtered.map(sub => (
          <Card key={sub.id} className="cursor-pointer hover:shadow-sm transition-shadow" onClick={() => openDetail(sub)}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {sub.status === 'pending' ? <SearchCheck className="h-5 w-5 text-yellow-600" /> : sub.status === 'verified' ? <CheckCircle className="h-5 w-5 text-green-600" /> : <AlertTriangle className="h-5 w-5 text-red-600" />}
                  <div>
                    <p className="font-medium text-sm">{sub.shopName} · {sub.submissionDate}</p>
                    <p className="text-xs text-muted-foreground">提交人：{sub.staffName} · 合计 {formatCurrency(totalOf(sub))}</p>
                  </div>
                </div>
                <Badge className={STATUS_COLORS[sub.status] || ''} variant="outline">{STATUS_LABELS[sub.status]}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Verify Dialog */}
      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>核对交账</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{detail.shopName} · {detail.submissionDate}</p>
                  <p className="text-xs text-muted-foreground">提交人：{detail.staffName}</p>
                </div>
                <Badge className={STATUS_COLORS[detail.status] || ''} variant="outline">{STATUS_LABELS[detail.status]}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-muted rounded-md p-3"><p className="text-xs text-muted-foreground">现金</p><p className="font-semibold">{formatCurrency(detail.cashAmount)}</p></div>
                <div className="bg-muted rounded-md p-3"><p className="text-xs text-muted-foreground">微信</p><p className="font-semibold">{formatCurrency(detail.wechatAmount)}</p></div>
                <div className="bg-muted rounded-md p-3"><p className="text-xs text-muted-foreground">支付宝</p><p className="font-semibold">{formatCurrency(detail.alipayAmount)}</p></div>
                <div className="bg-muted rounded-md p-3"><p className="text-xs text-muted-foreground">兑奖</p><p className="font-semibold">{formatCurrency(detail.redemptionAmount)}</p></div>
              </div>
              <div className="text-sm">
                <p className="text-muted-foreground text-xs">合计</p>
                <p className="text-lg font-bold">{formatCurrency(totalOf(detail))}</p>
              </div>
              {detail.personalCardName && (
                <div className="text-sm"><p className="text-muted-foreground text-xs">转入个人卡</p><p>{detail.personalCardName}</p></div>
              )}
              {detail.notes && (
                <div className="text-sm"><p className="text-muted-foreground text-xs">店员备注</p><p>{detail.notes}</p></div>
              )}
              {detail.attachments && detail.attachments.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">凭证</p>
                  <div className="grid grid-cols-3 gap-2">
                    {detail.attachments.map(att => (
                      <a key={att.id} href={`http://localhost:3001${att.filePath}`} target="_blank" rel="noreferrer" className="block aspect-square bg-muted rounded overflow-hidden">
                        <img src={`http://localhost:3001${att.filePath}`} alt={att.fileName} className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t pt-4 space-y-3">
                <p className="text-sm font-medium">核对结果</p>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="vstatus" checked={verifyForm.status === 'verified'} onChange={() => setVerifyForm({ ...verifyForm, status: 'verified' })} />
                    <span className="text-sm">已核对（无误）</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="vstatus" checked={verifyForm.status === 'discrepancy'} onChange={() => setVerifyForm({ ...verifyForm, status: 'discrepancy' })} />
                    <span className="text-sm">有差异</span>
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">核对备注</label>
                  <Input value={verifyForm.notes} onChange={e => setVerifyForm({ ...verifyForm, notes: e.target.value })} placeholder="可选" />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetail(null)}>取消</Button>
            <Button onClick={handleVerify} disabled={verifying || detail?.status !== 'pending'}>确认核对</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
