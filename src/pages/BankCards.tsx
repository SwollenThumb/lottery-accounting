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
import type { BankCard, Transaction, TransactionCategory, Shop } from '@/types'
import { PERSONAL_CATEGORIES, CORPORATE_CATEGORIES, CATEGORY_LABELS } from '@/types'
import {
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  Building2,
  Eye,
  Trash2,
} from 'lucide-react'

type CardFilter = 'all' | 'personal' | 'corporate'

export function BankCards() {
  const { user } = useAuth()
  const [cards, setCards] = useState<BankCard[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [shops, setShops] = useState<Shop[]>([])
  const [filter, setFilter] = useState<CardFilter>('all')
  const [showAddCard, setShowAddCard] = useState(false)
  const [showAddTx, setShowAddTx] = useState(false)
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null)
  const [showTxDetail, setShowTxDetail] = useState(false)

  const [cardForm, setCardForm] = useState({
    name: '', type: 'personal' as 'personal' | 'corporate',
    bankName: '', cardNumber: '', balance: 0, shopId: '' as string,
  })
  const [txForm, setTxForm] = useState({
    cardId: '' as string, type: 'income' as 'income' | 'expense',
    category: '' as TransactionCategory, amount: 0, date: getToday(), description: '',
  })

  const loadData = async () => {
    try {
      const [cRes, tRes, sRes] = await Promise.all([
        api.get('/bank-cards'),
        api.get('/transactions'),
        api.get('/shops'),
      ])
      setCards(cRes.data)
      setTransactions(tRes.data)
      setShops(sRes.data)
    } catch (e) {
      console.error('Failed to load bank cards', e)
    }
  }

  useEffect(() => { loadData() }, [])

  const filteredCards = filter === 'all' ? cards : cards.filter(c => c.type === filter)
  const selectedCard = cards.find(c => c.id === selectedCardId)
  const cardTransactions = selectedCardId
    ? transactions.filter(t => t.cardId === selectedCardId)
    : []

  const categories = txForm.cardId
    ? (cards.find(c => c.id === Number(txForm.cardId))?.type === 'personal' ? PERSONAL_CATEGORIES : CORPORATE_CATEGORIES)
    : []

  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cardForm.name) return
    await api.post('/bank-cards', {
      ...cardForm,
      shopId: cardForm.shopId ? Number(cardForm.shopId) : null,
    })
    setCardForm({ name: '', type: 'personal', bankName: '', cardNumber: '', balance: 0, shopId: '' })
    setShowAddCard(false)
    loadData()
  }

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!txForm.cardId || !txForm.category || !txForm.amount) return
    await api.post('/transactions', {
      ...txForm,
      cardId: Number(txForm.cardId),
      amount: Number(txForm.amount),
    })
    setTxForm({ cardId: '', type: 'income', category: '' as TransactionCategory, amount: 0, date: getToday(), description: '' })
    setShowAddTx(false)
    loadData()
  }

  const handleDeleteCard = async (id: number) => {
    await api.delete(`/bank-cards/${id}`)
    if (selectedCardId === id) setSelectedCardId(null)
    loadData()
  }

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">银行卡管理</h1>
          <p className="text-muted-foreground text-sm mt-1">管理个人卡与对公卡及其流水账目</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowAddTx(true)} variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-1" />记流水
          </Button>
          {isAdmin && (
            <Button onClick={() => setShowAddCard(true)} size="sm">
              <Plus className="h-4 w-4 mr-1" />添加银行卡
            </Button>
          )}
        </div>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as CardFilter)}>
        <TabsList>
          <TabsTrigger value="all">全部 ({cards.length})</TabsTrigger>
          <TabsTrigger value="personal">个人卡 ({cards.filter(c => c.type === 'personal').length})</TabsTrigger>
          <TabsTrigger value="corporate">对公卡 ({cards.filter(c => c.type === 'corporate').length})</TabsTrigger>
        </TabsList>

        <TabsContent value={filter}>
          {filteredCards.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>暂无{filter === 'personal' ? '个人' : filter === 'corporate' ? '对公' : ''}银行卡</p>
                {isAdmin && <Button variant="outline" className="mt-3" onClick={() => setShowAddCard(true)}>添加银行卡</Button>}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCards.map(card => {
                const cardTxs = transactions.filter(t => t.cardId === card.id)
                const income = cardTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
                const expense = cardTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
                return (
                  <Card key={card.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {card.type === 'personal' ? (
                            <CreditCard className="h-4 w-4 text-primary" />
                          ) : (
                            <Building2 className="h-4 w-4 text-primary" />
                          )}
                          <CardTitle className="text-base">{card.name}</CardTitle>
                        </div>
                        <Badge variant={card.type === 'personal' ? 'default' : 'secondary'}>
                          {card.type === 'personal' ? '个人' : '对公'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{card.bankName} · {card.cardNumber.replace(/(\d{4})\d+(\d{4})/, '$1****$2')}</p>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold mb-3">{formatCurrency(card.balance)}</p>
                      <div className="flex justify-between text-xs text-muted-foreground mb-4">
                        <span className="text-success">收入 {formatCurrency(income)}</span>
                        <span className="text-destructive">支出 {formatCurrency(expense)}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => { setSelectedCardId(card.id); setShowTxDetail(true) }}>
                          <Eye className="h-3 w-3 mr-1" />流水
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => { setTxForm(p => ({ ...p, cardId: String(card.id) })); setShowAddTx(true) }}>
                          <Plus className="h-3 w-3 mr-1" />记账
                        </Button>
                        {user?.role === 'super_admin' && (
                          <Button size="sm" variant="ghost" onClick={() => handleDeleteCard(card.id)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Card Dialog */}
      <Dialog open={showAddCard} onOpenChange={setShowAddCard}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加银行卡</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddCard} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">卡名称 *</label>
              <Input value={cardForm.name} onChange={e => setCardForm(p => ({ ...p, name: e.target.value }))} placeholder="如：工行个人卡" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">卡类型</label>
              <select value={cardForm.type} onChange={e => setCardForm(p => ({ ...p, type: e.target.value as any }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="personal">个人卡</option>
                <option value="corporate">对公卡</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">银行名称</label>
              <Input value={cardForm.bankName} onChange={e => setCardForm(p => ({ ...p, bankName: e.target.value }))} placeholder="如：工商银行" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">卡号</label>
              <Input value={cardForm.cardNumber} onChange={e => setCardForm(p => ({ ...p, cardNumber: e.target.value }))} placeholder="输入银行卡号" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">初始余额</label>
              <Input type="number" step="0.01" value={cardForm.balance || ''} onChange={e => setCardForm(p => ({ ...p, balance: parseFloat(e.target.value) || 0 }))} />
            </div>
            {user?.role === 'super_admin' && (
              <div>
                <label className="block text-sm font-medium mb-1.5">所属店铺</label>
                <select value={cardForm.shopId} onChange={e => setCardForm(p => ({ ...p, shopId: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">公共</option>
                  {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddCard(false)}>取消</Button>
            <Button onClick={handleAddCard}>添加</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Transaction Dialog */}
      <Dialog open={showAddTx} onOpenChange={setShowAddTx}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>记录流水</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddTransaction} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">银行卡</label>
              <select value={txForm.cardId} onChange={e => setTxForm(p => ({ ...p, cardId: e.target.value, category: '' as TransactionCategory }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">请选择银行卡</option>
                {cards.map(c => <option key={c.id} value={c.id}>{c.name} ({c.type === 'personal' ? '个人' : '对公'})</option>)}
              </select>
            </div>
            {txForm.cardId && (
              <p className="text-xs text-muted-foreground">
                当前余额: {formatCurrency(cards.find(c => c.id === Number(txForm.cardId))?.balance || 0)}
              </p>
            )}
            <div>
              <label className="block text-sm font-medium mb-1.5">收支类型</label>
              <select value={txForm.type} onChange={e => setTxForm(p => ({ ...p, type: e.target.value as 'income' | 'expense', category: '' as TransactionCategory }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="income">收入</option>
                <option value="expense">支出</option>
              </select>
            </div>
            {txForm.cardId && (
              <div>
                <label className="block text-sm font-medium mb-1.5">分类</label>
                <select value={txForm.category} onChange={e => setTxForm(p => ({ ...p, category: e.target.value as TransactionCategory }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">请选择分类</option>
                  {categories.filter(c => c.type === txForm.type).map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1.5">金额</label>
              <Input type="number" step="0.01" min="0.01" value={txForm.amount || ''} onChange={e => setTxForm(p => ({ ...p, amount: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">日期</label>
              <Input type="date" value={txForm.date} onChange={e => setTxForm(p => ({ ...p, date: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">备注</label>
              <Input value={txForm.description} onChange={e => setTxForm(p => ({ ...p, description: e.target.value }))} placeholder="输入备注信息" />
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTx(false)}>取消</Button>
            <Button onClick={handleAddTransaction} disabled={!txForm.cardId || !txForm.category || !txForm.amount}>确认</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transaction Detail Dialog */}
      <Dialog open={showTxDetail} onOpenChange={(v) => { setShowTxDetail(v); if (!v) setSelectedCardId(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedCard ? `${selectedCard.name} - 流水明细` : '流水明细'}</DialogTitle>
          </DialogHeader>
          {selectedCard && (
            <div>
              <div className="flex items-center justify-between mb-4 p-3 rounded-md bg-muted">
                <span className="text-sm">当前余额</span>
                <span className="text-lg font-bold">{formatCurrency(selectedCard.balance)}</span>
              </div>
              {cardTransactions.length === 0 ? (
                <p className="text-center py-6 text-muted-foreground text-sm">暂无流水记录</p>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {cardTransactions.map(t => (
                    <div key={t.id} className="flex items-center justify-between py-2.5 px-3 rounded-md hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${t.type === 'income' ? 'bg-success/10' : 'bg-destructive/10'}`}>
                          {t.type === 'income' ? <ArrowUpRight className="h-4 w-4 text-success" /> : <ArrowDownRight className="h-4 w-4 text-destructive" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{CATEGORY_LABELS[t.category]}</p>
                          <p className="text-xs text-muted-foreground">{t.description} · {t.date}</p>
                        </div>
                      </div>
                      <span className={`text-sm font-semibold ${t.type === 'income' ? 'text-success' : 'text-destructive'}`}>
                        {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
