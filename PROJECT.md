# 彩票记账通 - 项目文档

## 一、项目概述

**彩票记账通**是一款面向彩票店经营者的智能记账管理工具，支持多店铺、多设备、多银行卡的综合经营管理。系统采用前后端分离架构，后端使用 Express + sql.js (SQLite) 提供数据持久化和 REST API，前端使用 React + TypeScript + Tailwind CSS 构建现代化管理界面。

### 核心价值

- **多店统一管理**：总仓库 + 多店铺独立库存，一键调拨
- **设备绑定追踪**：扫描枪和投注机弱绑定店铺，支持换枪/换机
- **实时财务看板**：银行余额、收支统计、库存价值一目了然
- **每日结算核对**：自动汇总销售、支出、设备余额，确保账实相符
- **四级权限体系**：超管、管理员、财务、店员各司其职，数据隔离
- **店员交账核对**：店员提交每日交账数据（现金/微信/支付宝/兑奖+凭证），财务/管理员核对

---

## 二、技术架构

### 2.1 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端框架 | React 18 + TypeScript | SPA 单页应用 |
| 构建工具 | Vite 6 | 开发热更新、生产构建 |
| UI 样式 | Tailwind CSS 3 + class-variance-authority | 原子化 CSS + 组件变体 |
| 路由 | react-router-dom v6 | 客户端路由 + 路由守卫 |
| HTTP 客户端 | axios | 请求拦截 + JWT 自动刷新 |
| 图标 | lucide-react | 轻量 SVG 图标库 |
| 后端框架 | Express 4 | REST API 服务 |
| 数据库 | sql.js (SQLite WASM) | 纯 JS 实现，无需编译原生模块 |
| 认证 | JWT (jsonwebtoken + bcryptjs) | accessToken + refreshToken 双令牌 |
| 文件上传 | multer | 本地磁盘存储，支持多文件上传 |
| 跨域 | cors + cookie-parser | 开发环境跨域支持 |

### 2.2 为什么选择 sql.js

项目最初使用 better-sqlite3，但 Windows 环境下需要 Visual Studio C++ Build Tools (node-gyp) 才能编译原生模块。sql.js 是 SQLite 的 WebAssembly 版本，纯 JavaScript 实现，零编译依赖，适合跨平台部署。代价是性能略低于原生绑定，但对于彩票店的业务量级（单机、中小数据量）完全足够。

### 2.3 系统架构图

```
┌──────────────────────────────────────────────┐
│                  浏览器                        │
│  React SPA (Vite dev server :5173/5174)      │
│  ┌─────────┐ ┌──────────┐ ┌───────────────┐ │
│  │ AuthCtx  │ │ API Client│ │ React Router  │ │
│  │ (JWT)    │ │ (axios)   │ │ (Protected)   │ │
│  └─────────┘ └─────┬──────┘ └───────────────┘ │
└──────────────────────┼─────────────────────────┘
                       │ HTTP /api/*
                       │ (Vite proxy → :3001)
┌──────────────────────┼─────────────────────────┐
│        Express Server (:3001)                   │
│  ┌──────────┐ ┌───────────┐ ┌──────────────┐  │
│  │ CORS     │ │ JWT Auth  │ │ Role Check    │  │
│  │ Middleware│ │ Middleware │ │ (requireRole) │  │
│  └──────────┘ └───────────┘ └──────────────┘  │
│  ┌──────────────────────────────────────────┐  │
│  │         Route Handlers (15 个模块)        │  │
│  │  shops / users / bank-cards / equipment  │  │
│  │  transactions / scanner-records / sales  │  │
│  │  inventory / transfers / receipts        │  │
│  │  settlements / closures / dashboard      │  │
│  │  submissions (交账+核对+凭证上传)        │  │
│  └────────────────────┬─────────────────────┘  │
│                       │                         │
│  ┌────────────────────▼─────────────────────┐  │
│  │    sql.js (SQLite in-memory + disk)       │  │
│  │    data/lottery.db (自动持久化)            │  │
│  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

---

## 三、项目目录结构

```
lottery-accounting/
├── server/                          # 后端
│   ├── package.json
│   ├── src/
│   │   ├── index.js                 # Express 入口，挂载路由和中间件
│   │   ├── db/
│   │   │   ├── schema.sql           # 19 张表 DDL
│   │   │   └── index.js             # sql.js 初始化、CRUD 辅助函数、持久化、迁移
│   │   ├── middleware/
│   │   │   └── auth.js              # JWT 生成/验证、authMiddleware、requireRole
│   │   └── routes/
│   │       ├── auth.js              # 登录/刷新令牌/当前用户/改密码
│   │       └── index.js             # 所有业务路由（15 个 Router）
│   ├── data/                        # 运行时自动创建
│   │   └── lottery.db               # SQLite 数据库文件
│   └── uploads/                     # 运行时自动创建
│       └── *.png / *.jpg            # 交账凭证附件
│
├── src/                             # 前端
│   ├── main.tsx                     # React 入口
│   ├── App.tsx                      # 路由配置 (react-router-dom)
│   ├── types.ts                     # TypeScript 类型定义 + 常量
│   ├── index.css                    # Tailwind 基础样式
│   ├── lib/
│   │   ├── api.ts                   # axios 实例 + JWT 拦截器
│   │   ├── auth.tsx                 # AuthProvider + useAuth Hook
│   │   ├── utils.ts                 # cn() / formatCurrency() / getToday()
│   │   └── hooks.ts                 # (遗留) useLocalStorage Hook
│   ├── components/
│   │   ├── Layout.tsx               # 主布局：侧栏导航 + Outlet
│   │   ├── ProtectedRoute.tsx       # 路由守卫：认证 + 角色检查
│   │   └── ui/                      # 基础 UI 组件
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── input.tsx            # Input + Select
│   │       ├── dialog.tsx           # Dialog + Content/Header/Title/Footer
│   │       ├── badge.tsx
│   │       └── tabs.tsx
│   └── pages/
│       ├── Login.tsx                # 登录页
│       ├── Dashboard.tsx            # 工作台（数据汇总）
│       ├── BankCards.tsx            # 银行卡管理 + 流水记录
│       ├── LotteryInventory.tsx     # 彩票库存 + 激活 + 扫描枪记录
│       ├── SalesRecord.tsx          # 销售 + 调拨
│       ├── Reconciliation.tsx       # 收款核对
│       ├── ShopManagement.tsx       # 店铺管理
│       ├── EquipmentManagement.tsx  # 设备管理（扫描枪/投注机）
│       ├── UserManagement.tsx       # 用户管理
│       ├── Settlement.tsx           # 每日结算
│       ├── ClosureSettlement.tsx    # 撤店结算
│       ├── StaffSubmission.tsx      # 交账（现金/微信/支付宝/兑奖+凭证上传）
│       └── FinanceReview.tsx        # 交账核对（财务/管理员）
│
├── vite.config.ts                   # Vite 配置 + API 代理
├── tailwind.config.ts               # Tailwind 主题配置
├── tsconfig.json                    # TypeScript 配置
└── package.json                     # 前端依赖
```

---

## 四、数据库设计

### 4.1 ER 关系概览

```
shops (1) ──── (N) users
  │                   │
  │                   └── shop_id (FK)
  │
  ├── (1) ──── (N) equipment_assignments ──── (N) ── (1) equipment
  │
  ├── (1) ──── (N) inventory ──── (N) ── (1) lottery_batches ── (1) lottery_types
  │
  ├── (1) ──── (N) bank_cards ──── (1) ── (N) transactions
  │                              └── (1) ── (N) bank_receipts
  │                              └── (1) ── (N) staff_submissions ── (1) ── (N) submission_attachments
  │
  ├── (1) ──── (N) sales ──── (1) ── (N) sale_items
  │
  ├── (1) ──── (N) scanner_records
  ├── (1) ──── (N) betting_machine_records
  ├── (1) ──── (N) transfers
  ├── (1) ──── (N) daily_settlements
  └── (1) ──── (1) closure_settlements
```

### 4.2 数据表详细说明

#### shops — 门店/仓库

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| name | TEXT UNIQUE | 店铺名称（唯一） |
| address | TEXT | 地址 |
| contact_phone | TEXT | 联系电话 |
| is_warehouse | INTEGER | 是否为总仓库 (0/1) |
| status | TEXT | 状态：active / closed |
| created_at / updated_at | TEXT | 时间戳 |

**关键设计**：系统启动时自动创建 `总仓库` (is_warehouse=1)，所有入库首先进入总仓库，再通过调拨分发到各店铺。

#### users — 用户

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| username | TEXT UNIQUE | 登录用户名 |
| password_hash | TEXT | bcrypt 哈希密码 |
| display_name | TEXT | 显示名称 |
| role | TEXT | 角色：super_admin / admin / finance / staff |
| shop_id | INTEGER FK | 所属店铺（super_admin/finance 可为空） |
| is_active | INTEGER | 是否启用 (0/1) |

**数据库迁移说明**：旧数据库中 users 表的 role CHECK 约束为 `('super_admin','admin','staff')`。项目启动时会自动检测并迁移表结构以支持 `finance` 角色，无需手动操作。

#### staff_submissions — 店员交账记录

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| shop_id | INTEGER FK | 店铺 |
| staff_id | INTEGER FK | 提交人 |
| submission_date | TEXT | 交账日期 |
| cash_amount | REAL | 现金金额 |
| wechat_amount | REAL | 微信金额 |
| alipay_amount | REAL | 支付宝金额 |
| redemption_amount | REAL | 兑奖金额 |
| personal_card_id | INTEGER FK | 转入个人卡（可选） |
| notes | TEXT | 备注 |
| status | TEXT | 状态：pending / verified / discrepancy |
| verified_by | INTEGER FK | 核对人 |
| verified_at | TEXT | 核对时间 |
| verification_notes | TEXT | 核对备注 |

#### submission_attachments — 交账凭证附件

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| submission_id | INTEGER FK | 交账记录 |
| file_path | TEXT | 文件相对路径（如 `/uploads/xxx.jpg`） |
| file_name | TEXT | 原始文件名 |

**文件存储**：凭证图片通过 multer 上传到 `server/uploads/` 目录，数据库仅保存相对路径，前端通过 `http://localhost:3001/uploads/xxx.jpg` 访问。

#### equipment — 设备

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| type | TEXT | 设备类型：scanner / betting_machine |
| name | TEXT | 设备名称 |
| serial_number | TEXT | 序列号 |
| status | TEXT | 状态：available / assigned / in_maintenance / retired |
| initial_balance | REAL | 初始余额（扫描枪用） |
| current_balance | REAL | 当前余额（投注机用） |

**扫描枪余额公式**：`余额 = initial_balance + SUM(缴款) + SUM(兑奖) - SUM(激活)`，动态计算，不存 current_balance。

**投注机余额**：直接维护 current_balance，充值增加、销售/调整减少。

#### equipment_assignments — 设备分配历史

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| equipment_id | INTEGER FK | 设备 ID |
| shop_id | INTEGER FK | 店铺 ID |
| assigned_at | TEXT | 分配时间 |
| unassigned_at | TEXT | 解绑时间（NULL 表示当前在用） |
| assigned_by / unassigned_by | INTEGER FK | 操作人 |
| reason | TEXT | 原因 |

**弱绑定设计**：同一店铺只能有一把扫描枪和一台投注机（分配时检查唯一性），但可以随时解绑/重新分配。

#### lottery_types — 彩票品种目录

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| name | TEXT UNIQUE | 品种名称 |
| default_unit_price | REAL | 默认单价 |
| is_active | INTEGER | 是否启用 |

#### lottery_batches — 入库批次

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| batch_number | TEXT | 批次号 |
| lottery_type_id | INTEGER FK | 彩票品种 |
| unit_price | REAL | 本批单价 |
| total_quantity | INTEGER | 本批总数量 |
| date_received | TEXT | 入库日期 |

#### inventory — 库存（按店铺+批次）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| batch_id | INTEGER FK | 批次 ID |
| shop_id | INTEGER FK | 店铺 ID |
| quantity | INTEGER | 当前总数量 |
| activated_quantity | INTEGER | 已激活数量 |
| sold_quantity | INTEGER | 已销售数量 |
| redeemed_quantity | INTEGER | 已兑奖数量 |

**唯一约束**：`UNIQUE(batch_id, shop_id)`，同一批次在同一店铺只有一条记录。

#### bank_cards — 银行卡

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| name | TEXT | 卡名称 |
| type | TEXT | 卡类型：personal / corporate |
| bank_name | TEXT | 银行名称 |
| card_number | TEXT | 卡号 |
| balance | REAL | 当前余额 |
| shop_id | INTEGER FK | 所属店铺（NULL 为公共卡） |
| is_active | INTEGER | 是否启用 |

#### transactions — 银行流水

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| card_id | INTEGER FK | 银行卡 ID |
| type | TEXT | 收支类型：income / expense |
| category | TEXT | 分类（见下方分类表） |
| amount | REAL | 金额 |
| date | TEXT | 日期 |
| description | TEXT | 备注 |
| shop_id | INTEGER FK | 关联店铺 |

**个人卡分类**：投资(investment)、对公往来(corporate_transaction)、工资(salary)、报销(reimbursement)、彩票售卖收入(lottery_sales)、其他收支

**对公卡分类**：彩票中心佣金(commission)、彩票货款/刮刮乐缴款激活(lottery_payment)、电脑机余额充值(terminal_recharge)、租金水电费(rent_utilities)、其他收支

#### scanner_records — 扫描枪记录

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| equipment_id | INTEGER FK | 扫描枪 ID |
| shop_id | INTEGER FK | 店铺 ID |
| type | TEXT | 类型：payment(缴款) / redemption(兑奖) / activation(激活) |
| amount | REAL | 金额 |
| date | TEXT | 日期 |

#### betting_machine_records — 投注机记录

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| equipment_id | INTEGER FK | 投注机 ID |
| shop_id | INTEGER FK | 店铺 ID |
| type | TEXT | 类型：recharge(充值) / computer_sale(电脑票销售) / adjustment(调整) |
| amount | REAL | 金额 |
| date | TEXT | 日期 |

#### sales — 销售记录

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| date | TEXT | 日期 |
| shop_id | INTEGER FK | 店铺 |
| payment_method | TEXT | 支付方式：cash / wechat / alipay / redemption |
| total_amount | REAL | 总金额 |
| status | TEXT | 状态：pending / verified / discrepancy |
| description | TEXT | 备注 |

#### sale_items — 销售明细

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| sale_id | INTEGER FK | 销售记录 ID (CASCADE DELETE) |
| inventory_id | INTEGER FK | 关联库存（可选） |
| lottery_name | TEXT | 彩票名称 |
| quantity | INTEGER | 数量 |
| unit_price | REAL | 单价 |
| amount | REAL | 金额 |

#### transfers — 调拨记录

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| date | TEXT | 日期 |
| from_shop_id / to_shop_id | INTEGER FK | 源/目标店铺 |
| batch_id | INTEGER FK | 批次 |
| lottery_name | TEXT | 彩票名称 |
| quantity | INTEGER | 数量 |
| unit_price | REAL | 单价 |
| reason | TEXT | 原因 |
| status | TEXT | 状态：pending / completed / cancelled |

#### bank_receipts — 收款核对

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| date | TEXT | 日期 |
| card_id | INTEGER FK | 银行卡 |
| expected_amount | REAL | 预期金额 |
| actual_amount | REAL | 实际金额 |
| source | TEXT | 来源 |
| status | TEXT | 状态：pending / matched / discrepancy |
| description | TEXT | 备注 |

**自动匹配逻辑**：新增时若 actual_amount > 0 且等于 expected_amount，自动标记为 matched；若不等则标记为 discrepancy。

#### daily_settlements — 每日结算

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| shop_id | INTEGER FK | 店铺 |
| settlement_date | TEXT | 结算日期 |
| cash/wechat/alipay/redemption_sales | REAL | 各支付方式销售额 |
| total_sales / total_expenses / net_amount | REAL | 销售汇总 |
| inventory_value | REAL | 库存价值 |
| scanner_balance / machine_balance | REAL | 设备余额 |
| status | TEXT | pending / confirmed |
| UNIQUE | | (shop_id, settlement_date) |

#### closure_settlements — 撤店结算

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| shop_id | INTEGER FK UNIQUE | 店铺（每店只能撤一次） |
| closure_date | TEXT | 撤店日期 |
| remaining_inventory_value | REAL | 剩余库存价值 |
| scanner_returned / scanner_id | | 扫描枪归还信息 |
| machine_returned / machine_id | | 投注机归还信息 |
| total_sales / total_expenses / net_financial | REAL | 财务汇总 |
| final_balance | REAL | 最终银行余额 |
| status | TEXT | pending / confirmed |

---

## 五、API 接口文档

### 5.1 认证接口（无需 Token）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/login | 登录，返回 accessToken + refreshToken + user |
| POST | /api/auth/refresh | 用 refreshToken 换新 accessToken |

### 5.2 认证接口（需 Token）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/auth/me | 获取当前用户信息 |
| PUT | /api/auth/password | 修改密码 (oldPassword, newPassword) |

### 5.3 业务接口（均需 Token）

所有接口请求头：`Authorization: Bearer <accessToken>`

#### 店铺管理

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | /api/shops | 全部 | 列表（非超管/财务只看本店） |
| GET | /api/shops/:id | 全部 | 详情（含已分配设备） |
| POST | /api/shops | super_admin | 新增店铺 |
| PUT | /api/shops/:id | super_admin | 更新店铺信息 |
| GET | /api/shops/:id/inventory | 全部 | 店铺库存列表 |

#### 用户管理

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | /api/users | admin+ | 列表 |
| POST | /api/users | admin+ | 新增用户（admin 只能创建 staff） |
| PUT | /api/users/:id | admin+ | 编辑用户 |
| DELETE | /api/users/:id | super_admin | 禁用用户（软删除） |

#### 银行卡

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | /api/bank-cards | 全部 | 列表 |
| POST | /api/bank-cards | admin+ | 新增银行卡 |
| DELETE | /api/bank-cards/:id | super_admin | 停用（软删除） |

#### 流水

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | /api/transactions | 全部 | 列表（支持 cardId/shopId/dateFrom/dateTo 筛选） |
| POST | /api/transactions | finance / admin / super_admin | 新增流水（自动更新卡余额） |
| DELETE | /api/transactions/:id | admin+ | 删除流水（回滚卡余额） |

#### 交账（新增）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | /api/submissions | 全部 | 列表（staff 只看自己的，支持 status/shopId/dateFrom/dateTo 筛选） |
| GET | /api/submissions/:id | 全部 | 详情（含附件列表） |
| POST | /api/submissions | staff / admin / super_admin | 创建交账记录 |
| PUT | /api/submissions/:id/verify | finance / admin / super_admin | 核对交账（verified/discrepancy + 备注） |
| DELETE | /api/submissions/:id | super_admin | 删除交账记录 |
| POST | /api/submissions/:id/attachments | staff / admin / super_admin | 上传凭证（multipart/form-data，最多 10 张，单张 5MB） |
| GET | /api/submissions/:id/attachments | 全部 | 获取凭证列表 |

#### 设备

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | /api/equipment | 全部 | 列表（含当前分配信息） |
| POST | /api/equipment | super_admin | 新增设备 |
| POST | /api/equipment/:id/assign | super_admin | 分配到店铺 |
| POST | /api/equipment/:id/unassign | super_admin | 从店铺解绑 |
| GET | /api/equipment/:id/balance | 全部 | 获取余额（扫描枪动态计算） |

#### 扫描枪记录

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | /api/scanner-records | 全部 | 列表（支持 equipmentId/shopId 筛选） |
| POST | /api/scanner-records | 全部 | 新增记录 |
| DELETE | /api/scanner-records/:id | admin+ | 删除记录 |

#### 投注机记录

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | /api/betting-machine-records | 全部 | 列表 |
| POST | /api/betting-machine-records | 全部 | 新增记录（自动更新投注机余额） |

#### 库存

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | /api/inventory/lottery-types | 全部 | 彩票品种列表 |
| POST | /api/inventory/lottery-types | admin+ | 新增品种 |
| GET | /api/inventory/batches | 全部 | 批次列表 |
| POST | /api/inventory/batches | admin+ | 入库（自动创建总仓库库存） |
| GET | /api/inventory | 全部 | 库存列表（支持 shopId 筛选） |
| POST | /api/inventory/:id/activate | 全部 | 激活彩票 |

#### 销售

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | /api/sales | 全部 | 列表（含明细，支持 shopId/dateFrom/dateTo 筛选） |
| POST | /api/sales | 全部 | 新增销售（自动扣减库存 sold_quantity） |
| PUT | /api/sales/:id/verify | admin+ | 核实销售 |
| DELETE | /api/sales/:id | admin+ | 删除销售（回滚库存） |

#### 调拨

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | /api/transfers | 全部 | 列表 |
| POST | /api/transfers | admin+ | 新增调拨（原子更新双方库存） |

#### 收款核对

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | /api/bank-receipts | 全部 | 列表 |
| POST | /api/bank-receipts | 全部 | 新增（自动判定 matched/discrepancy） |
| PUT | /api/bank-receipts/:id/match | admin+ | 手动标记匹配 |

#### 每日结算

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | /api/settlements | 全部 | 列表 |
| POST | /api/settlements/calculate | admin+ | 预计算（不保存） |
| POST | /api/settlements | admin+ | 保存结算记录 |
| PUT | /api/settlements/:id/confirm | admin+ | 确认结算 |

#### 撤店结算

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | /api/closures | 全部 | 列表 |
| POST | /api/closures/calculate | super_admin | 预计算 |
| POST | /api/closures | super_admin | 保存撤店记录 |
| PUT | /api/closures/:id/confirm | super_admin | 确认撤店（关闭店铺、归还库存、解绑设备） |

#### 仪表盘

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | /api/dashboard/summary | 全部 | 汇总数据 |
| GET | /api/dashboard/recent-transactions | 全部 | 最近流水 |
| GET | /api/dashboard/scanner-balances | 全部 | 扫描枪余额 |
| GET | /api/dashboard/inventory-overview | 全部 | 库存概览 |

---

## 六、权限体系

### 6.1 角色定义

| 角色 | 标识 | 数据范围 | 典型用户 |
|------|------|----------|----------|
| 超级管理员 | super_admin | 全部数据 | 老板/总负责人 |
| 管理员 | admin | 本店铺数据 | 店长 |
| 财务 | finance | 全部数据 | 财务人员 |
| 店员 | staff | 本店铺数据（只读+交账） | 店员 |

### 6.2 功能权限矩阵

| 功能 | super_admin | admin | finance | staff |
|------|:-----------:|:-----:|:-------:|:-----:|
| 查看工作台 | ✅ | ✅ | ✅ | ✅ |
| 交账（提交） | ✅ | ✅ | ❌ | ✅ |
| 交账核对 | ✅ | ✅ | ✅ | ❌ |
| 银行卡管理 | ✅ | ✅ | ✅ | ❌ |
| 银行流水登记 | ✅ | ✅ | ✅ | ❌ |
| 进销管理 | ✅ | ✅ | ✅ | ✅ |
| 收款核对 | ✅ | ✅ | ✅ | ❌ |
| 彩票库存 | ✅ | ✅ | ❌ | ❌ |
| 记录流水/销售 | ✅ | ✅ | ✅ | ❌ |
| 删除流水 | ✅ | ✅ | ❌ | ❌ |
| 核实销售 | ✅ | ✅ | ❌ | ❌ |
| 新增银行卡 | ✅ | ✅ | ❌ | ❌ |
| 新增彩票品种/入库 | ✅ | ✅ | ❌ | ❌ |
| 删除银行卡 | ✅ | ❌ | ❌ | ❌ |
| 店铺管理 | ✅ | ❌ | ❌ | ❌ |
| 设备管理 | ✅ | ❌ | ❌ | ❌ |
| 用户管理 | ✅ | ✅(限店员) | ❌ | ❌ |
| 每日结算 | ✅ | ✅ | ❌ | ❌ |
| 撤店结算 | ✅ | ❌ | ❌ | ❌ |

### 6.3 数据隔离

- **super_admin / finance**：可查看所有店铺数据
- **admin / staff**：只能查看自己所属店铺的数据
- 后端 API 自动注入 shopId 过滤条件，前端无需关心

---

## 七、核心业务流程

### 7.1 店员交账与核对流程（新增）

```
1. 店员每日营业结束后进入【交账】页面
2. 填写交账数据：
   - 现金金额、微信金额、支付宝金额、兑奖金额
   - 选择转入的个人银行卡（可选）
   - 填写备注
   - 上传凭证图片（可多张，最多 10 张，单张 5MB）
3. 提交后交账记录状态为 pending（待核对）
4. 财务/管理员进入【交账核对】页面查看所有待核对记录
5. 打开交账详情，查看金额和凭证图片
6. 核对无误 → 标记 "verified（已核对）"
   发现差异 → 标记 "discrepancy（有差异）" 并填写核对备注
7. 店员可在【交账】页面查看自己提交的记录及核对状态
```

**管理员特殊权限**：管理员可以直接交账并自行核对（提交交账 + 调用核对接口）。

### 7.2 入库流程

```
1. 超管/管理员新增彩票品种（如"刮刮乐-好运十倍"）
2. 入库：选择品种 → 填写批次号/数量/单价 → 自动创建总仓库库存记录
3. 调拨：从总仓库调拨到店铺 → 原子更新双方库存
4. 激活：店铺库存 → 填写激活数量 → 更新 activated_quantity
```

### 7.3 销售流程

```
1. 记录销售：选择店铺 → 选择支付方式 → 填写彩票名称/数量/单价
2. 后端自动计算 total_amount 并更新 inventory.sold_quantity
3. 管理员可核实销售 (verified) 或标记差异 (discrepancy)
```

### 7.4 扫描枪余额计算

```
余额 = initial_balance + SUM(payment) + SUM(redemption) - SUM(activation)

其中：
- payment（缴款）：增加余额
- redemption（兑奖）：增加余额
- activation（激活）：减少余额
```

**注意**：扫描枪余额不存储在 equipment.current_balance，而是每次从 scanner_records 动态计算。

### 7.5 投注机余额

投注机余额直接维护 current_balance，充值增加、销售/调整减少。

### 7.6 每日结算流程

```
1. 选择店铺和日期 → 点击"计算"
2. 系统自动汇总：
   - 各支付方式销售额（从 sales 表）
   - 当日支出总额（从 transactions 表）
   - 当前库存价值（从未售库存 × 单价）
   - 扫描枪余额（动态计算）
   - 投注机余额（从 equipment.current_balance）
3. 保存结算记录 → 管理员确认
```

### 7.7 撤店结算流程

```
1. 超管选择要撤的店铺 → 计算：
   - 剩余库存价值
   - 累计销售额/支出额/净利润
   - 银行卡余额
   - 扫描枪/投注机归还状态
2. 保存撤店记录 → 超管确认
3. 确认后系统自动执行：
   - 标记店铺状态为 closed
   - 所有库存归还总仓库
   - 解绑所有设备
   - ⚠️ 不可撤销！
```

---

## 八、启动与部署

### 8.1 开发环境启动

```bash
# 1. 安装前端依赖
cd lottery-accounting
npm install

# 2. 安装后端依赖
cd server
npm install

# 3. 启动后端（端口 3001）
cd server
npm run dev      # node --watch 自动重载

# 4. 启动前端（端口 5173）
npm run dev      # vite 开发服务器，自动代理 /api → :3001
```

### 8.2 生产环境部署

```bash
# 1. 构建前端
cd lottery-accounting
npm run build    # 输出到 dist/

# 2. 将 dist/ 复制到 server/dist/
cp -r dist/ server/dist/

# 3. 启动后端（自动托管前端静态文件 + 上传文件）
cd server
npm start        # node src/index.js
# 访问 http://localhost:3001
```

### 8.3 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| PORT | 3001 | 后端服务端口 |
| JWT_SECRET | lottery-accounting-jwt-secret-2025 | JWT 签名密钥 |

**生产环境务必修改 JWT_SECRET！**

### 8.4 默认账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | admin123 | super_admin |

**首次登录后请立即修改密码！**

---

## 九、注意事项与常见问题

### 9.1 数据安全

1. **数据库文件位置**：`server/data/lottery.db`，该文件包含所有业务数据，务必定期备份
2. **凭证附件位置**：`server/uploads/`，交账上传的图片存储于此，也需要备份
3. **JWT 密钥**：默认密钥仅用于开发，生产环境必须通过 `JWT_SECRET` 环境变量设置高强度密钥
4. **数据库持久化机制**：sql.js 在内存中运行，数据修改后通过 300ms 防抖写入磁盘。如果进程异常退出（如断电），最多丢失 300ms 内的数据变更
5. **撤店操作不可逆**：确认撤店后，店铺状态变更、库存归还、设备解绑均无法回退。操作前务必仔细核对数据
6. **删除流水会回滚余额**：删除一条交易记录时，系统会自动反向调整对应银行卡余额。确保不在对账期间删除流水

### 9.2 Windows 环境特别说明

1. **不使用 better-sqlite3**：better-sqlite3 需要 node-gyp 编译，要求安装 Visual Studio C++ Build Tools。本项目使用 sql.js (WASM) 替代，无需任何编译工具
2. **路径中的中文字符**：项目路径 `d:/Desktop/考试/` 包含中文，sql.js 在初始化时通过 `fileURLToPath` 正确处理了路径编码。如果移动项目到其他路径，确保路径不含特殊字符
3. **Vite 端口冲突**：如果 5173 端口被占用，Vite 会自动切换到 5174。后端 CORS 已配置为同时允许这两个端口

### 9.3 业务注意事项

1. **交账与结算的区别**：
   - **交账（staff_submissions）**：店员手动提交的每日现金/微信/支付宝/兑奖金额，供财务核对
   - **每日结算（daily_settlements）**：系统自动根据销售、支出数据计算的经营汇总，由管理员确认
   - 两者数据可能不一致，差异正是核对的目的
2. **凭证上传限制**：单张图片最大 5MB，一次最多上传 10 张。支持的格式取决于浏览器，通常包括 PNG/JPG/GIF
3. **入库 → 总仓库**：所有入库操作自动进入总仓库，需要通过"调拨"功能分发到各店铺
4. **设备弱绑定**：每店铺限一把扫描枪 + 一台投注机，但可以随时解绑并重新分配给其他店铺
5. **扫描枪余额是动态计算的**：不存储在数据库中，每次查询时从 scanner_records 聚合计算。大量历史记录可能影响查询速度
6. **投注机余额是实时维护的**：存储在 equipment.current_balance，每次充值/销售/调整操作都直接修改该字段
7. **每日结算唯一性**：同一店铺同一日期只能有一条结算记录 (UNIQUE约束)
8. **撤店结算唯一性**：每个店铺只能撤店一次 (closure_settlements.shop_id UNIQUE)
9. **销售删除回滚库存**：删除销售记录时，系统自动从对应库存记录中扣减 sold_quantity。如果库存记录已被删除，可能导致数据不一致
10. **银行卡软删除**：删除银行卡只是标记 is_active=0，关联的流水记录不会删除

### 9.4 技术限制

1. **sql.js 并发**：sql.js 是单线程同步操作数据库，不支持真正的并发写入。对于多用户同时操作的场景，可能出现写入冲突。当前通过 Express 单进程 + 同步 SQL 执行规避了此问题
2. **数据库大小**：sql.js 将整个数据库加载到内存，如果数据量增长到数百 MB 以上，内存占用会显著增加。对于彩票店场景（通常数据量在 GB 以内），这不是问题
3. **前端 Token 刷新**：当 accessToken 过期（默认 2 小时），axios 拦截器自动使用 refreshToken 刷新。如果 refreshToken 也过期（默认 7 天），用户需要重新登录
4. **无 WebSocket**：当前不支持实时数据推送，多用户同时使用时需要手动刷新页面获取最新数据
5. **文件上传路径**：凭证图片的访问路径硬编码为 `http://localhost:3001/uploads/xxx`。生产环境部署到域名后，需要将前端代码中的图片访问地址改为对应的生产域名

### 9.5 开发注意事项

1. **lucide-react 图标名称**：部分图标名在 lucide-react 中不存在（如 `StoreClose`、`Scanner`），需使用替代图标（如 `CircleOff`、`ScanLine`）。添加新图标前先确认是否存在于当前版本
2. **Dialog 组件模式**：项目使用 `Dialog + DialogContent + DialogHeader + DialogTitle + DialogFooter` 组合模式，`onOpenChange` 回调控制显隐。旧版 `onClose + title` 模式已废弃
3. **后端路由集中管理**：所有业务路由集中在 `server/src/routes/index.js`，使用 `wrap` 辅助函数处理异步错误。新增路由请在此文件中添加
4. **类型定义**：前端 TypeScript 类型在 `src/types.ts`，与后端 API 返回格式保持一致（camelCase）。修改后端返回字段时需同步更新类型定义
5. **API 代理**：开发时 Vite 将 `/api` 代理到 `http://localhost:3001`。生产环境由 Express 直接托管前端静态文件
6. **数据库迁移**：`server/src/db/index.js` 的 `initDb()` 函数会自动检测旧数据库并执行迁移（创建新表、放宽 users 表 role 约束）。迁移日志会输出到控制台

---

## 十、扩展建议

1. **数据备份**：添加定时任务，每日自动备份 `lottery.db` 文件和 `uploads/` 目录
2. **导出报表**：增加 Excel/PDF 导出功能，支持月度/季度财务报表
3. **操作日志**：记录用户关键操作（删除、修改），便于审计追踪
4. **WebSocket 通知**：实现多端实时同步，避免手动刷新
5. **移动端适配**：当前界面已基本响应式，可进一步优化手机端操作体验
6. **数据导入**：支持从 Excel 批量导入彩票品种和库存数据
7. **凭证预览优化**：当前凭证图片在前端以原图展示，大量大图可能影响加载速度，可添加缩略图生成
