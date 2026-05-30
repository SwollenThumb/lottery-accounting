import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import api from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import type { DashboardSummary, Transaction, ScannerBalance, InventoryOverview } from '@/types'
import { CATEGORY_LABELS } from '@/types'
import {
  CreditCard,
  Package,
  TrendingUp,
  TrendingDown,
  CheckSquare,
  ArrowUpRight,
  ArrowDownRight,
  ShoppingCart,
} from 'lucide-react'

export function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [recentTx, setRecentTx] = useState<Transaction[]>([])
  const [scannerBalances, setScannerBalances] = useState<ScannerBalance[]>([])
  const [inventoryOverview, setInventoryOverview] = useState<InventoryOverview[]>([])

  useEffect(() => {
    async function load() {
      try {
        const [sumRes, txRes, scanRes, invRes] = await Promise.all([
          api.get('/dashboard/summary'),
          api.get('/dashboard/recent-transactions'),
          api.get('/dashboard/scanner-balances'),
          api.get('/dashboard/inventory-overview'),
        ])
        setSummary(sumRes.data)
        setRecentTx(txRes.data)
        setScannerBalances(scanRes.data)
        setInventoryOverview(invRes.data)
      } catch (e) {
        console.error('Failed to load dashboard', e)
      }
    }
    load()
  }, [])

  if (!summary) return <div className="text-center py-12 text-muted-foreground">加载中...</div>

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">工作台</h1>
        <p className="text-muted-foreground text-sm mt-1">彩票店经营数据一览</p>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">银行总余额</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(summary.totalBalance)}</p>
                <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                  <span>个人 {formatCurrency(summary.personalBalance)}</span>
                  <span>对公 {formatCurrency(summary.corporateBalance)}</span>
                </div>
              </div>
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <CreditCard className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">今日收支</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-lg font-bold text-success">+{formatCurrency(summary.todayIncome)}</span>
                  <span className="text-muted-foreground">/</span>
                  <span className="text-lg font-bold text-destructive">-{formatCurrency(summary.todayExpense)}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">净额 {formatCurrency(summary.todayIncome - summary.todayExpense)}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">店铺库存价值</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(summary.inventoryValue)}</p>
                <p className="text-xs text-muted-foreground mt-2">今日销售 {formatCurrency(summary.todaySales)}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-warning/10 flex items-center justify-center">
                <Package className="h-6 w-6 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">收款核对</p>
                <p className="text-2xl font-bold mt-1">{summary.pendingReceipts + summary.discrepancyReceipts}</p>
                <div className="flex gap-2 mt-2">
                  {summary.pendingReceipts > 0 && <Badge variant="warning">待核对 {summary.pendingReceipts}</Badge>}
                  {summary.discrepancyReceipts > 0 && <Badge variant="destructive">差异 {summary.discrepancyReceipts}</Badge>}
                  {summary.pendingReceipts === 0 && summary.discrepancyReceipts === 0 && <Badge variant="success">全部核对</Badge>}
                </div>
              </div>
              <div className="h-12 w-12 rounded-xl bg-accent flex items-center justify-center">
                <CheckSquare className="h-6 w-6 text-accent-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent transactions */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">最近流水</CardTitle>
          </CardHeader>
          <CardContent>
            {recentTx.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">暂无流水记录</div>
            ) : (
              <div className="space-y-3">
                {recentTx.map(t => (
                  <div key={t.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center ${t.type === 'income' ? 'bg-success/10' : 'bg-destructive/10'}`}>
                        {t.type === 'income' ? <ArrowUpRight className="h-4 w-4 text-success" /> : <ArrowDownRight className="h-4 w-4 text-destructive" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{CATEGORY_LABELS[t.category] || t.description}</p>
                        <p className="text-xs text-muted-foreground">{t.cardName || '未知'} · {t.date}{t.shopName ? ` · ${t.shopName}` : ''}</p>
                      </div>
                    </div>
                    <span className={`text-sm font-semibold ${t.type === 'income' ? 'text-success' : 'text-destructive'}`}>
                      {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Scanner gun balances */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              扫描枪余额
            </CardTitle>
          </CardHeader>
          <CardContent>
            {scannerBalances.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">暂无扫描枪</div>
            ) : (
              <div className="space-y-3">
                {scannerBalances.map(s => (
                  <div key={s.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <div>
                      <p className="text-sm font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.shopName}</p>
                    </div>
                    <span className="text-sm font-bold">{formatCurrency(s.balance)}</span>
                  </div>
                ))}
              </div>
            )}
            {scannerBalances.length > 0 && (
              <div className="mt-4 p-3 rounded-md bg-muted text-xs text-muted-foreground">
                余额 = 初始余额 + 缴款 + 兑奖 - 激活
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lottery inventory overview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" />
            库存概览
          </CardTitle>
        </CardHeader>
        <CardContent>
          {inventoryOverview.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">暂无库存数据</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 font-medium">名称</th>
                    <th className="text-left py-2 font-medium">批次号</th>
                    <th className="text-left py-2 font-medium">门店</th>
                    <th className="text-right py-2 font-medium">单价</th>
                    <th className="text-right py-2 font-medium">已激活</th>
                    <th className="text-right py-2 font-medium">已售</th>
                    <th className="text-right py-2 font-medium">未售金额</th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryOverview.map(r => (
                    <tr key={r.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2 font-medium">{r.lotteryName}</td>
                      <td className="py-2 text-muted-foreground">{r.batchNumber}</td>
                      <td className="py-2 text-muted-foreground">{r.shopName}</td>
                      <td className="py-2 text-right">{formatCurrency(r.unitPrice)}</td>
                      <td className="py-2 text-right">{r.activatedQuantity}</td>
                      <td className="py-2 text-right">{r.soldQuantity}</td>
                      <td className="py-2 text-right font-medium">{formatCurrency(r.unsoldValue)}</td>
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
