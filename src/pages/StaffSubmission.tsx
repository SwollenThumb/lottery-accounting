import React, { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import api from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { formatCurrency } from '@/lib/utils'
import type { StaffSubmission, Shop, BankCard } from '@/types'
import { ClipboardList, Plus, Paperclip, X } from 'lucide-react'

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

export function StaffSubmissionPage() {
  const { user } = useAuth()
  const [submissions, setSubmissions] = useState<StaffSubmission[]>([])
  const [shops, setShops] = useState<Shop[]>([])
  const [cards, setCards] = useState<BankCard[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [detail, setDetail] = useState<StaffSubmission | null>(null)

  const [form, setForm] = useState({
    submissionDate: new Date().toISOString().split('T')[0],
    cashAmount: '',
    wechatAmount: '',
    alipayAmount: '',
    redemptionAmount: '',
    personalCardId: '',
    notes: '',
  })
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)

  const isStaff = user?.role === 'staff'
  const canCreate = user?.role === 'staff' || user?.role === 'admin' || user?.role === 'super_admin'

  const loadData = async () => {
    try {
      const [subRes, shopRes, cardRes] = await Promise.all([
        api.get('/submissions'),
        api.get('/shops'),
        api.get('/bank-cards'),
      ])
      setSubmissions(subRes.data)
      setShops(shopRes.data)
      setCards(cardRes.data.filter((c: BankCard) => c.type === 'personal'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const handleAdd = async () => {
    if (!form.submissionDate) return
    setSubmitting(true)
    try {
      const payload = {
        submissionDate: form.submissionDate,
        cashAmount: Number(form.cashAmount) || 0,
        wechatAmount: Number(form.wechatAmount) || 0,
        alipayAmount: Number(form.alipayAmount) || 0,
        redemptionAmount: Number(form.redemptionAmount) || 0,
        personalCardId: form.personalCardId ? Number(form.personalCardId) : null,
        notes: form.notes,
      }
      const { data } = await api.post('/submissions', payload)
      if (files.length > 0 && data.id) {
        const fd = new FormData()
        files.forEach(f => fd.append('files', f))
        await api.post(`/submissions/${data.id}/attachments`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      }
      setShowAdd(false)
      setForm({ submissionDate: new Date().toISOString().split('T')[0], cashAmount: '', wechatAmount: '', alipayAmount: '', redemptionAmount: '', personalCardId: '', notes: '' })
      setFiles([])
      loadData()
    } finally {
      setSubmitting(false)
    }
  }

  const openDetail = async (sub: StaffSubmission) => {
    const { data } = await api.get(`/submissions/${sub.id}`)
    setDetail(data)
  }

  const totalOf = (s: StaffSubmission) => (s.cashAmount || 0) + (s.wechatAmount || 0) + (s.alipayAmount || 0) + (s.redemptionAmount || 0)

  if (loading) return <div className="text-center py-12 text-muted-foreground">加载中...</div>

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">交账</h1>
          <p className="text-muted-foreground text-sm mt-1">提交每日现金、微信、支付宝、兑奖数据及凭证</p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1" />新建交账</Button>
        )}
      </div>

      <div className="space-y-3">
        {submissions.length === 0 && (
          <Card><CardContent className="py-12 text-center text-muted-foreground">暂无交账记录</CardContent></Card>
        )}
        {submissions.map(sub => (
          <Card key={sub.id} className="cursor-pointer hover:shadow-sm transition-shadow" onClick={() => openDetail(sub)}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ClipboardList className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">{sub.shopName} · {sub.submissionDate}</p>
                    <p className="text-xs text-muted-foreground">提交人：{sub.staffName}</p>
                  </div>
                </div>
                <Badge className={STATUS_COLORS[sub.status] || ''} variant="outline">{STATUS_LABELS[sub.status]}</Badge>
              </div>
              <div className="grid grid-cols-4 gap-4 mt-3">
                <div><p className="text-[11px] text-muted-foreground">现金</p><p className="text-sm font-semibold">{formatCurrency(sub.cashAmount)}</p></div>
                <div><p className="text-[11px] text-muted-foreground">微信</p><p className="text-sm font-semibold">{formatCurrency(sub.wechatAmount)}</p></div>
                <div><p className="text-[11px] text-muted-foreground">支付宝</p><p className="text-sm font-semibold">{formatCurrency(sub.alipayAmount)}</p></div>
                <div><p className="text-[11px] text-muted-foreground">合计</p><p className="text-sm font-semibold">{formatCurrency(totalOf(sub))}</p></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>新建交账</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">交账日期</label>
              <Input type="date" value={form.submissionDate} onChange={e => setForm({ ...form, submissionDate: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">现金</label>
                <Input type="number" placeholder="0.00" value={form.cashAmount} onChange={e => setForm({ ...form, cashAmount: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">微信</label>
                <Input type="number" placeholder="0.00" value={form.wechatAmount} onChange={e => setForm({ ...form, wechatAmount: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">支付宝</label>
                <Input type="number" placeholder="0.00" value={form.alipayAmount} onChange={e => setForm({ ...form, alipayAmount: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">兑奖</label>
                <Input type="number" placeholder="0.00" value={form.redemptionAmount} onChange={e => setForm({ ...form, redemptionAmount: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">转入个人卡</label>
              <select
                value={form.personalCardId}
                onChange={e => setForm({ ...form, personalCardId: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">请选择（可选）</option>
                {cards.map(c => <option key={c.id} value={c.id}>{c.name} {c.bankName} {c.cardNumber}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">备注</label>
              <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="可选" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">凭证上传（可多选）</label>
              <Input type="file" multiple accept="image/*" onChange={e => setFiles(Array.from(e.target.files || []))} />
              {files.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {files.map((f, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded">
                      <Paperclip className="h-3 w-3" />{f.name}
                      <button onClick={() => setFiles(files.filter((_, idx) => idx !== i))}><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>取消</Button>
            <Button onClick={handleAdd} disabled={submitting}>提交交账</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>交账详情</DialogTitle></DialogHeader>
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
                <div className="text-sm"><p className="text-muted-foreground text-xs">备注</p><p>{detail.notes}</p></div>
              )}
              {detail.verificationNotes && (
                <div className="text-sm"><p className="text-muted-foreground text-xs">核对备注</p><p>{detail.verificationNotes}</p></div>
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
