// ===== Auth =====
export interface User {
  id: number
  username: string
  displayName: string
  role: 'super_admin' | 'admin' | 'finance' | 'staff'
  shopId: number | null
  shopName?: string
  isActive?: number
  createdAt?: string
}

// ===== Shops =====
export interface Shop {
  id: number
  name: string
  address: string
  contactPhone: string
  isWarehouse: number
  status: 'active' | 'closed'
  createdAt: string
  equipment?: Equipment[]
}

// ===== Bank Cards =====
export interface BankCard {
  id: number
  name: string
  type: 'personal' | 'corporate'
  bankName: string
  cardNumber: string
  balance: number
  shopId: number | null
}

// ===== Transactions =====
export type TransactionCategory =
  | 'investment'
  | 'corporate_transaction'
  | 'salary'
  | 'reimbursement'
  | 'lottery_sales'
  | 'lottery_payment'
  | 'terminal_recharge'
  | 'rent_utilities'
  | 'commission'
  | 'other_income'
  | 'other_expense'

export interface Transaction {
  id: number
  cardId: number
  cardName?: string
  type: 'income' | 'expense'
  category: TransactionCategory
  amount: number
  date: string
  description: string
  shopId?: number | null
  shopName?: string
}

// ===== Equipment =====
export interface Equipment {
  id: number
  type: 'scanner' | 'betting_machine'
  name: string
  serialNumber: string
  status: 'available' | 'assigned' | 'in_maintenance' | 'retired'
  initialBalance: number
  currentBalance: number
  notes: string
  currentShopId?: number | null
  currentShopName?: string | null
  assignedAt?: string | null
}

// ===== Scanner Records =====
export interface ScannerRecord {
  id: number
  equipmentId: number
  equipmentName?: string
  shopId: number | null
  shopName?: string
  type: 'payment' | 'redemption' | 'activation'
  amount: number
  date: string
  description: string
}

// ===== Betting Machine Records =====
export interface BettingMachineRecord {
  id: number
  equipmentId: number
  equipmentName?: string
  shopId: number | null
  shopName?: string
  type: 'recharge' | 'computer_sale' | 'adjustment'
  amount: number
  date: string
  description: string
}

// ===== Lottery Types =====
export interface LotteryType {
  id: number
  name: string
  defaultUnitPrice: number
  description: string
}

// ===== Lottery Batches =====
export interface LotteryBatch {
  id: number
  batchNumber: string
  lotteryTypeId: number
  lotteryName: string
  unitPrice: number
  totalQuantity: number
  dateReceived: string
  notes: string
}

// ===== Inventory =====
export interface InventoryItem {
  id: number
  batchId: number
  batchNumber: string
  lotteryName: string
  unitPrice: number
  shopId: number
  shopName: string
  quantity: number
  activatedQuantity: number
  soldQuantity: number
  redeemedQuantity: number
  unsoldQuantity: number
  unsoldValue: number
}

// ===== Sales =====
export interface SaleItem {
  id: number
  inventoryId?: number | null
  lotteryName: string
  quantity: number
  unitPrice: number
  amount: number
}

export interface Sale {
  id: number
  date: string
  shopId: number
  shopName: string
  paymentMethod: 'cash' | 'wechat' | 'alipay' | 'redemption'
  totalAmount: number
  status: 'pending' | 'verified' | 'discrepancy'
  description: string
  items: SaleItem[]
}

// ===== Transfers =====
export interface Transfer {
  id: number
  date: string
  fromShopId: number
  fromShopName: string
  toShopId: number
  toShopName: string
  batchId: number
  lotteryName: string
  quantity: number
  unitPrice: number
  reason: string
  status: 'pending' | 'completed' | 'cancelled'
}

// ===== Bank Receipts =====
export interface BankReceipt {
  id: number
  date: string
  cardId: number
  cardName?: string
  expectedAmount: number
  actualAmount: number
  source: string
  status: 'pending' | 'matched' | 'discrepancy'
  description: string
  difference: number
}

// ===== Daily Settlements =====
export interface DailySettlement {
  id: number
  shopId: number
  shopName: string
  settlementDate: string
  cashSales: number
  wechatSales: number
  alipaySales: number
  redemptionSales: number
  totalSales: number
  totalExpenses: number
  netAmount: number
  inventoryValue: number
  scannerBalance: number
  machineBalance: number
  status: 'pending' | 'confirmed'
  notes: string
}

// ===== Closure Settlements =====
export interface ClosureSettlement {
  id: number
  shopId: number
  shopName: string
  closureDate: string
  remainingInventoryValue: number
  scannerReturned: number
  scannerId: number | null
  machineReturned: number
  machineId: number | null
  totalSales: number
  totalExpenses: number
  netFinancial: number
  finalBalance: number
  status: 'pending' | 'confirmed'
  notes: string
}

// ===== Dashboard =====
export interface DashboardSummary {
  totalBalance: number
  personalBalance: number
  corporateBalance: number
  todayIncome: number
  todayExpense: number
  todaySales: number
  inventoryValue: number
  pendingReceipts: number
  discrepancyReceipts: number
}

export interface ScannerBalance {
  id: number
  name: string
  shopName: string
  initialBalance: number
  totalPayment: number
  totalRedemption: number
  totalActivation: number
  balance: number
}

export interface InventoryOverview {
  id: number
  lotteryName: string
  batchNumber: string
  shopName: string
  unitPrice: number
  activatedQuantity: number
  soldQuantity: number
  unsoldQuantity: number
  unsoldValue: number
}

// ===== Constants =====
export const PERSONAL_CATEGORIES: { value: TransactionCategory; label: string; type: 'income' | 'expense' }[] = [
  { value: 'lottery_sales', label: '彩票售卖收入', type: 'income' },
  { value: 'salary', label: '工资', type: 'income' },
  { value: 'reimbursement', label: '报销', type: 'income' },
  { value: 'investment', label: '投资', type: 'expense' },
  { value: 'corporate_transaction', label: '对公往来', type: 'income' },
  { value: 'other_income', label: '其他收入', type: 'income' },
  { value: 'other_expense', label: '其他支出', type: 'expense' },
]

export const CORPORATE_CATEGORIES: { value: TransactionCategory; label: string; type: 'income' | 'expense' }[] = [
  { value: 'commission', label: '彩票中心佣金', type: 'income' },
  { value: 'lottery_payment', label: '彩票货款(刮刮乐缴款激活)', type: 'expense' },
  { value: 'terminal_recharge', label: '电脑机余额充值', type: 'expense' },
  { value: 'rent_utilities', label: '租金水电费', type: 'expense' },
  { value: 'other_income', label: '其他收入', type: 'income' },
  { value: 'other_expense', label: '其他支出', type: 'expense' },
]

export const CATEGORY_LABELS: Record<TransactionCategory, string> = {
  investment: '投资',
  corporate_transaction: '对公往来',
  salary: '工资',
  reimbursement: '报销',
  lottery_sales: '彩票售卖收入',
  lottery_payment: '彩票货款(刮刮乐缴款激活)',
  terminal_recharge: '电脑机余额充值',
  rent_utilities: '租金水电费',
  commission: '彩票中心佣金',
  other_income: '其他收入',
  other_expense: '其他支出',
}

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: '现金',
  wechat: '微信',
  alipay: '支付宝',
  redemption: '兑奖',
}

export const SCANNER_TYPE_LABELS: Record<string, string> = {
  payment: '缴款',
  redemption: '兑奖',
  activation: '激活',
}

export const EQUIPMENT_TYPE_LABELS: Record<string, string> = {
  scanner: '扫描枪',
  betting_machine: '电脑投注机',
}

export const BETTING_MACHINE_TYPE_LABELS: Record<string, string> = {
  recharge: '充值',
  computer_sale: '电脑票销售',
  adjustment: '调整',
}

export interface StaffSubmission {
  id: number
  shopId: number
  shopName: string
  staffId: number
  staffName: string
  submissionDate: string
  cashAmount: number
  wechatAmount: number
  alipayAmount: number
  redemptionAmount: number
  personalCardId?: number | null
  personalCardName?: string
  notes: string
  status: 'pending' | 'verified' | 'discrepancy'
  verifiedBy?: number | null
  verifierName?: string
  verifiedAt?: string
  verificationNotes?: string
  totalAmount: number
  attachments?: SubmissionAttachment[]
}

export interface SubmissionAttachment {
  id: number
  filePath: string
  fileName: string
}

export const ROLE_LABELS: Record<string, string> = {
  super_admin: '超级管理员',
  admin: '管理员',
  finance: '财务',
  staff: '店员',
}

export const SETTLEMENT_STATUS_LABELS: Record<string, string> = {
  pending: '待确认',
  confirmed: '已确认',
}
