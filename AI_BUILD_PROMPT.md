# Complete SaaS Build Specification: Keith's Superstores Production & Waste Tracking Platform

## 🎯 Business Overview

Build a production-ready **Shift Scheduling & Waste Tracking SaaS platform** for multi-location restaurant/grocery operations. The system helps executives reduce waste costs, optimize labor scheduling, and improve profitability through data-driven insights.

**Target Users:**
- Restaurant chains (bakeries, delis, prepared foods departments)
- Grocery stores with production departments
- Multi-location food retail operations

**Core Value Proposition:**
- Track production vs waste in real-time
- Identify high-waste employees and items
- Reduce waste by 10-20% ($thousands saved monthly)
- Optimize shift scheduling and labor costs
- Provide executive-level ROI reporting

---

## 🏗️ Tech Stack Requirements

### Frontend
- **Framework:** Next.js 14 (App Router)
- **React:** 18.3+ with TypeScript
- **Styling:** Tailwind CSS 3.4+
- **UI Components:** shadcn/ui (card, button, input, dialog, select, tabs, badge, progress)
- **Icons:** lucide-react
- **Charts:** Recharts (bar charts, line charts, pie charts)
- **Mobile-First:** Optimized for iPhone/Android with touch gestures

### Backend
- **API:** Next.js API Routes (serverless-ready)
- **Database:** PostgreSQL (Neon/Supabase compatible)
- **ORM:** None - use raw SQL with `pg` (node-postgres)
- **Auth:** JWT tokens (httpOnly cookies + localStorage fallback)
- **Password Hashing:** bcryptjs (cost factor 10)

### Additional Libraries
- **QR Codes:** qrcode (generation), jsqr (scanning)
- **OCR:** tesseract.js (receipt/order sheet scanning)
- **PDF Export:** html2pdf.js (for executive reports)

---

## 📊 Database Schema (PostgreSQL)

### Tables

#### 1. **users**
```sql
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(255) NOT NULL,
  email           VARCHAR(255) UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  role            VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'manager', 'employee')),
  store_id        VARCHAR(50),
  pin             VARCHAR(10),           -- Optional PIN for quick login
  active          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

**Roles:**
- `admin` - Full system access, can lock shifts, manage all stores
- `manager` - Approve shifts, view analytics for their store
- `employee` - Claim shifts, log production/waste, view own stats

#### 2. **scheduling_settings**
```sql
CREATE TABLE scheduling_settings (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id          VARCHAR(50) UNIQUE NOT NULL,
  require_approval  BOOLEAN DEFAULT TRUE,
  max_hours_week    INT DEFAULT 40,
  min_shift_gap_hrs INT DEFAULT 8,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
```

#### 3. **shifts**
```sql
CREATE TABLE shifts (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id          VARCHAR(50) NOT NULL,
  date              DATE NOT NULL,
  start_time        TIME NOT NULL,
  end_time          TIME NOT NULL,
  role_required     VARCHAR(100),          -- e.g., "Baker", "Deli Clerk"
  station           VARCHAR(100),          -- e.g., "Bakery", "Hot Foods"
  assigned_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  claimed_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'unassigned'
                    CHECK (status IN ('unassigned','pending','approved','completed','locked')),
  waste_total       NUMERIC(10,2) DEFAULT 0,
  production_total  NUMERIC(10,2) DEFAULT 0,
  approval_required BOOLEAN DEFAULT TRUE,
  notes             TEXT,
  event_flag        BOOLEAN DEFAULT FALSE,  -- Mark special events (holidays, promos)
  event_note        TEXT,
  created_by        UUID REFERENCES users(id),
  approved_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  clock_in          TIMESTAMPTZ,
  clock_out         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_shifts_store_date ON shifts(store_id, date);
CREATE INDEX idx_shifts_assigned ON shifts(assigned_user_id);
CREATE INDEX idx_shifts_status ON shifts(status);
```

**Shift Status Flow:**
```
unassigned → (employee claims) → pending → (manager approves) → approved
                                         ↘ (manager denies)  → unassigned

approved → (employee clocks in)  → [clock_in recorded]
         → (employee clocks out) → completed
                                 → (admin locks) → locked (no edits allowed)
```

#### 4. **waste_logs**
```sql
CREATE TABLE waste_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shift_id    UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  item_name   VARCHAR(255) NOT NULL,
  quantity    NUMERIC(10,2) NOT NULL,
  reason      VARCHAR(100),              -- e.g., "Expired", "Damaged", "Overproduction"
  cost        NUMERIC(10,2) DEFAULT 0,
  logged_by   UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_waste_logs_shift ON waste_logs(shift_id);
```

#### 5. **production_logs**
```sql
CREATE TABLE production_logs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shift_id          UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  item_name         VARCHAR(255) NOT NULL,
  quantity_produced NUMERIC(10,2) NOT NULL,
  cost              NUMERIC(10,2) DEFAULT 0,
  logged_by         UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_prod_logs_shift ON production_logs(shift_id);
```

#### 6. **swap_requests**
```sql
CREATE TABLE swap_requests (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shift_id     UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES users(id),
  to_user_id   UUID REFERENCES users(id),
  status       VARCHAR(20) DEFAULT 'pending'
               CHECK (status IN ('pending','approved','denied')),
  message      TEXT,
  reviewed_by  UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
```

#### 7. **notifications**
```sql
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        VARCHAR(50) NOT NULL,      -- e.g., "shift_approved", "swap_request", "waste_alert"
  title       VARCHAR(255) NOT NULL,
  message     TEXT,
  read        BOOLEAN DEFAULT FALSE,
  shift_id    UUID REFERENCES shifts(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, read);
```

#### 8. **employee_metrics** (View)
```sql
CREATE OR REPLACE VIEW employee_metrics AS
SELECT
  u.id AS user_id,
  u.name,
  u.store_id,
  COUNT(s.id) AS total_shifts,
  COALESCE(SUM(s.waste_total), 0) AS total_waste,
  COALESCE(SUM(s.production_total), 0) AS total_production,
  CASE
    WHEN COALESCE(SUM(s.production_total), 0) = 0 THEN 0
    ELSE ROUND(
      (COALESCE(SUM(s.waste_total), 0) / COALESCE(SUM(s.production_total), 1)) * 100, 2
    )
  END AS waste_ratio,
  CASE
    WHEN COALESCE(SUM(EXTRACT(EPOCH FROM (s.clock_out - s.clock_in)) / 3600), 0) = 0 THEN 0
    ELSE ROUND(
      (COALESCE(SUM(s.production_total), 0) - COALESCE(SUM(s.waste_total), 0))
      / NULLIF(SUM(EXTRACT(EPOCH FROM (s.clock_out - s.clock_in)) / 3600), 0), 2
    )
  END AS efficiency_score
FROM users u
LEFT JOIN shifts s ON s.assigned_user_id = u.id
  AND s.status IN ('completed', 'locked')
WHERE u.active = TRUE
GROUP BY u.id, u.name, u.store_id;
```

### Seed Data
```sql
INSERT INTO users (name, email, password_hash, role, store_id) VALUES
  ('Admin User',   'admin@keiths.com',   '$2b$10$vlyNbuenBogsO2r6gt0WHeW6pwzodRPLVN2kODMebJMZiGYG6IjHW', 'admin',    'store-01'),
  ('Manager Sue',  'manager@keiths.com', '$2b$10$vlyNbuenBogsO2r6gt0WHeW6pwzodRPLVN2kODMebJMZiGYG6IjHW', 'manager',  'store-01'),
  ('John Smith',   'john@keiths.com',    '$2b$10$vlyNbuenBogsO2r6gt0WHeW6pwzodRPLVN2kODMebJMZiGYG6IjHW', 'employee', 'store-01'),
  ('Jane Doe',     'jane@keiths.com',    '$2b$10$vlyNbuenBogsO2r6gt0WHeW6pwzodRPLVN2kODMebJMZiGYG6IjHW', 'employee', 'store-01')
ON CONFLICT (email) DO NOTHING;
-- Default password for all: "password123"
```

---

## 🔐 Authentication & Authorization

### JWT Implementation
- **Sign** tokens with `jsonwebtoken` using `JWT_SECRET` env var
- **Expire** after 8 hours
- **Store** in httpOnly cookies (production) or localStorage (dev)
- **Payload:** `{ userId, email, role, storeId }`

### API Middleware Pattern
```typescript
// withAuth wrapper
export function withAuth(handler, allowedRoles?: UserRole[]) {
  return async (req: NextRequest) => {
    const token = req.cookies.get('auth_token') || req.headers.get('Authorization')?.split(' ')[1]
    if (!token) return apiError('Unauthorized', 401)

    const user = jwt.verify(token, JWT_SECRET)
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      return apiError('Forbidden', 403)
    }

    return handler(req, user)
  }
}
```

### Password Hashing
```typescript
import bcrypt from 'bcryptjs'

// Hash on signup
const hash = await bcrypt.hash(password, 10)

// Verify on login
const valid = await bcrypt.compare(password, user.password_hash)
```

---

## 🛣️ API Routes

### Authentication
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | Public | Login with email/password, returns JWT |
| POST | `/api/auth/logout` | Public | Clear auth cookie |
| GET | `/api/auth/me` | Any | Get current user from JWT |

### Shifts
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/shifts` | Any | List shifts (filter by store, date, status) |
| POST | `/api/shifts` | Admin/Manager | Create new shift |
| GET | `/api/shifts/[id]` | Any | Get shift detail + waste/prod logs |
| PUT | `/api/shifts/[id]` | Admin/Manager | Update shift details |
| DELETE | `/api/shifts/[id]` | Admin | Delete shift |
| POST | `/api/shifts/[id]/claim` | Employee | Claim unassigned shift → pending |
| POST | `/api/shifts/[id]/approve` | Manager/Admin | Approve/deny pending shift |
| POST | `/api/shifts/[id]/lock` | Admin | Lock completed shift (prevent edits) |
| POST | `/api/shifts/[id]/clock` | Any | Clock in/out (records timestamps) |

### Waste & Production Logs
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/waste-logs?shift_id=...` | Any | List waste logs for shift |
| POST | `/api/waste-logs` | Any | Create waste log (auto-updates shift.waste_total) |
| DELETE | `/api/waste-logs/[id]` | Manager/Admin | Delete waste log |
| GET | `/api/production-logs?shift_id=...` | Any | List production logs |
| POST | `/api/production-logs` | Any | Create production log (auto-updates shift.production_total) |
| DELETE | `/api/production-logs/[id]` | Manager/Admin | Delete production log |

### Users
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/users` | Manager/Admin | List users (filter by store, role) |
| POST | `/api/users` | Admin | Create new user |
| GET | `/api/users/[id]` | Any | Get user profile |
| PUT | `/api/users/[id]` | Admin | Update user (name, role, store) |
| DELETE | `/api/users/[id]` | Admin | Deactivate user (set active=false) |

### Swap Requests
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/swap-requests` | Any | List swap requests (my requests + to me) |
| POST | `/api/swap-requests` | Employee | Create swap request |
| PATCH | `/api/swap-requests/[id]` | Manager/Admin | Approve/deny swap |

### Notifications
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/notifications` | Any | List my notifications |
| PATCH | `/api/notifications` | Any | Mark as read (batch or single) |

### Analytics
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/analytics?days=30` | Manager/Admin | Get analytics summary (waste trends, top items, employee metrics) |

---

## 🖥️ Frontend Pages & Features

### 1. **Login Page** (`/login`)
- Email + password form
- JWT stored in cookie/localStorage
- Redirect to `/scheduling/dashboard` on success
- Mobile-optimized with large touch targets

### 2. **Dashboard** (`/scheduling/dashboard`)

**For Employees:**
- "Today's Shift" card with clock in/out button
- Upcoming shifts (next 7 days)
- Personal stats (total shifts, waste ratio, efficiency score)
- Quick actions: View schedule, log waste/production

**For Managers/Admins:**
- Today's shift coverage (who's working, gaps)
- Pending shift approvals (approve/deny in-line)
- Smart alerts (high waste items, risky employees)
- Analytics preview (waste cost this week, top wasters)

### 3. **Schedule View** (`/scheduling/schedule`)

**Week Calendar Component:**
- 7-day horizontal scroll (Mon-Sun)
- Color-coded shift dots per status:
  - Gray: unassigned
  - Yellow: pending
  - Green: approved
  - Blue: completed
  - Black: locked
- Tap day → see all shifts for that day
- Swipe left/right to change week

**Shift Cards:**
- Display: date, time, station, assigned user
- Actions (role-dependent):
  - **Employee:** "Claim" (unassigned), "Request Swap"
  - **Manager:** "Approve/Deny" (pending), "Edit"
  - **Admin:** "Lock" (completed), "Delete"

**Create Shift (Manager/Admin):**
- Form: date, start/end time, role, station, notes
- Option to assign directly or leave unassigned
- Validation: no overlaps for same user

### 4. **Shift Detail Page** (`/scheduling/shifts/[id]`)

**Shift Info Card:**
- Date, time, station, assigned user, status
- Clock in/out timestamps
- Notes, event flag

**Waste Log Section:**
- List of all waste entries (item, qty, reason, cost)
- "Add Waste" button → modal form
  - Item name (text or dropdown)
  - Quantity (number)
  - Reason (dropdown: Expired, Damaged, Overproduction, Other)
  - Cost per unit (auto-calculate total)
- Real-time update of shift.waste_total

**Production Log Section:**
- List of all production entries (item, qty produced, cost)
- "Add Production" button → modal form
- Real-time update of shift.production_total

**Actions:**
- "Clock In" (if approved, not clocked in)
- "Clock Out" (if clocked in, not clocked out)
- "Complete Shift" (manager/admin, after clock out → status: completed)
- "Lock Shift" (admin only, prevents all edits)

### 5. **Team Management** (`/scheduling/users`)
*(Manager/Admin only)*

- List of all users (filterable by store, role)
- User cards: name, email, role, store, active status
- "Add User" button → modal form
  - Name, email, password, role, store, PIN (optional)
- Edit/deactivate users in-line

### 6. **Profile Page** (`/scheduling/profile`)
- User info (name, email, role, store)
- Change password form
- Personal stats:
  - Total shifts worked
  - Total production logged
  - Total waste logged
  - Waste ratio % (vs team average)
  - Efficiency score

### 7. **Executive Dashboard** (`/executive`)
*(Admin only, mobile-optimized)*

**5 Tabs:**

#### A. **Money Tab**
- Date range selector (7/30/90 days)
- Top cards:
  - Total Waste Cost ($)
  - Total Production Value ($)
  - Waste % (of production)
  - Savings if waste reduced 10%
- Savings projections:
  - 10% reduction → $X saved
  - 20% reduction → $Y saved
- Year-over-year comparison
- Top 10 money-wasting items (ranked list with item name, qty wasted, $ cost)
- **Item Cost Editor:**
  - Inline form to set cost-per-unit for all inventory items
  - Recalculates all $ totals dynamically

#### B. **Smart Alerts Tab**
- AI-generated alerts:
  - **Critical:** High-waste employees (>30% waste ratio)
  - **Warning:** Items with waste spike (>2x normal)
  - **Info:** Low-stock predictions, seasonal trends
- Each alert shows:
  - Title, detail, severity badge
  - Estimated loss ($)
  - Category (employee, item, trend)
- "Print Action Sheet" button → printer-friendly summary

#### C. **What-If Simulator**
- Dropdown: Select item
- Slider: Reduce production by X% (5-50%)
- "Run Simulation" button
- Results card:
  - Current avg waste/shift
  - Projected waste/shift
  - Estimated savings $/month
  - Sales risk assessment (high/medium/low)
  - Risk note (e.g., "Item sells out 60% of time, high risk of lost sales")

#### D. **Store Scorecard**
- Leaderboard of all stores (ranked by waste %)
- Badges: 🥇🥈🥉 for top 3
- Each store card shows:
  - Rank, store name, waste %, sell-through %
  - Total waste cost, total entries

#### E. **ROI Report**
- Month-over-month comparison
- Cards:
  - Waste cost this month
  - Waste cost last month
  - % change (green if down, red if up)
  - Estimated $ saved
- Top improvements (bullet list, e.g., "Bread waste down 15%")
- Areas of concern (bullet list, e.g., "Deli meat waste up 22%")
- Recommended actions (bullet list)
- "Download PDF" button (uses html2pdf.js)

### 8. **Legacy App** (Production Entry, Waste Entry, Print Forms, Store Items, Count)
*(Uses localStorage, separate from scheduling DB)*

**Production Entry Page** (`/production`):
- Scan QR code or manual entry
- OCR receipt scanning (tesseract.js)
- Form: employee, shift, items (name, qty, unit)
- Stores to localStorage as ProductionEntry[]

**Waste Entry Page** (`/waste`):
- Same UX as production entry
- Additional field: reason (dropdown)
- Stores to localStorage as WasteEntry[]

**Print Forms Page** (`/print`):
- Generate printable production/waste forms
- QR codes for each employee

**Store Items Page** (`/store-items`):
- Manage inventory master list (localStorage)
- Add/edit/delete items: name, category, unit, cost-per-unit

**Count Page** (`/count`):
- Physical inventory count interface
- Input current stock levels

**Home Page** (`/`):
- Quick stats: today's production, waste, waste rate
- Smart alerts preview
- Quick action buttons to all features

---

## 🎨 UI/UX Requirements

### Design System
- **Colors:**
  - Green: production, approved, positive metrics
  - Red: waste, critical alerts, costs
  - Yellow: pending, warnings
  - Blue: completed, info, analytics
  - Gray: unassigned, neutral
- **Typography:**
  - Headings: font-bold, text-sm to text-2xl
  - Body: text-xs to text-sm
  - Mobile-optimized: minimum 44px touch targets
- **Components:**
  - All from shadcn/ui (card, button, input, dialog, select, tabs, badge)
  - Custom: SchedulingShell, ShiftCard, WeekCalendar, NotificationBell

### Mobile Optimizations
- Bottom navigation (Home, Schedule, Profile, More)
- Swipe gestures for calendar navigation
- Large touch-friendly buttons
- Sticky headers with scroll-up hide
- Pull-to-refresh on dashboards
- Haptic feedback on important actions (clock in/out)

### Accessibility
- ARIA labels on all interactive elements
- Keyboard navigation support
- Color-blind friendly palettes (not relying only on color)
- Screen reader compatible

---

## 🧠 Business Logic & Calculations

### Waste Ratio Formula
```
waste_ratio = (total_waste / total_production) * 100
```

### Efficiency Score Formula
```
efficiency_score = (total_production - total_waste) / total_hours_worked
```

### Shift Overlap Detection
Before assigning/claiming shift:
```sql
SELECT COUNT(*) FROM shifts
WHERE assigned_user_id = $userId
AND date = $date
AND (
  (start_time < $endTime AND end_time > $startTime)
)
```
If count > 0, reject with error.

### Smart Alert Triggers
1. **High-Waste Employee:**
   - Waste ratio > 30% over last 30 days
   - At least 5 shifts worked
2. **Waste Spike:**
   - Item waste qty this week > 2x avg of last 4 weeks
3. **Low Stock Prediction:**
   - Production trend up, but inventory not restocked
4. **Seasonal Trend:**
   - Current waste % vs same period last year

### What-If Sales Risk
```
if (production_reduction > 30%) → high risk
else if (production_reduction > 15%) → medium risk
else → low risk
```

### Year-Over-Year Comparison
```sql
SELECT
  SUM(CASE WHEN EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW()) THEN cost ELSE 0 END) AS this_year,
  SUM(CASE WHEN EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW()) - 1 THEN cost ELSE 0 END) AS last_year
FROM waste_logs
WHERE created_at >= NOW() - INTERVAL '2 years'
```

---

## 🔔 Notification System

### Trigger Events
1. **Shift approved/denied** → notify employee
2. **Shift claimed** → notify manager
3. **Swap request received** → notify target employee
4. **Swap request approved/denied** → notify requester
5. **Waste alert triggered** → notify manager/admin
6. **Shift starting in 1 hour** → notify assigned employee

### NotificationBell Component
- Bell icon in header (lucide-react)
- Red badge with unread count
- Dropdown list of recent notifications (5 max)
- "Mark all as read" button
- Tap notification → navigate to related shift (if shift_id present)

---

## 📦 Environment Variables

```bash
DATABASE_URL=postgresql://user:pass@host:5432/dbname?sslmode=require
JWT_SECRET=your-32-char-secret-key-here
NODE_ENV=production
```

---

## 🚀 Deployment

### Vercel
1. Connect GitHub repo
2. Set environment variables in dashboard
3. Deploy (auto-builds on push)

### Database (Neon or Supabase)
1. Create project
2. Run migration SQL (`migrations/001_initial.sql`)
3. Copy connection string to `DATABASE_URL`

---

## 🧪 Testing Scenarios

### 1. Employee Flow
- Login as employee
- View dashboard → see today's shift
- Navigate to schedule
- Claim an unassigned shift → status: pending
- Wait for manager approval
- Clock in → records timestamp
- Log production (5 items)
- Log waste (2 items, reason: Expired)
- Clock out → status: completed
- View profile → see updated stats

### 2. Manager Flow
- Login as manager
- Dashboard shows 3 pending shift claims
- Approve 2, deny 1
- Create new shift for next week
- Assign to employee directly
- View analytics → top wasters, waste cost this month
- Receive notification → employee claimed shift

### 3. Admin Flow
- Login as admin
- View executive dashboard
- Money tab: see waste cost $2,450 this month
- Alerts tab: 2 critical alerts (high-waste employees)
- What-If: simulate reducing bread production 20% → save $350/month
- Lock completed shift → no longer editable
- Create new manager user
- Download ROI report PDF

### 4. Edge Cases
- Employee tries to claim overlapping shift → rejected
- Manager tries to delete locked shift → 403 Forbidden
- Employee tries to clock in without approval → error
- Logout → JWT invalidated, redirect to login

---

## 🎯 Success Metrics

After launch, track:
1. **User Adoption:** Active users per store
2. **Waste Reduction:** % change month-over-month
3. **Labor Cost Savings:** Optimized shift scheduling
4. **Shift Claim Rate:** % of shifts claimed vs manually assigned
5. **Alert Action Rate:** % of alerts that lead to process changes

---

## 🛠️ Additional Features (Nice-to-Have)

1. **Push Notifications** (Web Push API)
2. **Shift Templates** (recurring weekly schedules)
3. **Mobile App** (React Native or PWA)
4. **Bulk Shift Import** (CSV upload)
5. **Inventory Integration** (auto-sync with POS systems)
6. **Multi-Language Support** (i18n)
7. **Dark Mode** (Tailwind dark: classes)
8. **Advanced Analytics** (Recharts with drill-down)
9. **AI Forecasting** (OpenAI API for demand prediction)
10. **Slack/Teams Integration** (webhook notifications)

---

## 📝 File Structure

```
smarter-production-app/
├── src/
│   ├── app/
│   │   ├── (scheduling)/
│   │   │   ├── login/page.tsx
│   │   │   └── scheduling/
│   │   │       ├── dashboard/page.tsx
│   │   │       ├── schedule/page.tsx
│   │   │       ├── shifts/[id]/page.tsx
│   │   │       ├── users/page.tsx
│   │   │       └── profile/page.tsx
│   │   ├── executive/page.tsx
│   │   ├── production/page.tsx
│   │   ├── waste/page.tsx
│   │   ├── print/page.tsx
│   │   ├── store-items/page.tsx
│   │   ├── count/page.tsx
│   │   ├── page.tsx
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── login/route.ts
│   │       │   ├── logout/route.ts
│   │       │   └── me/route.ts
│   │       ├── shifts/
│   │       │   ├── route.ts
│   │       │   └── [id]/
│   │       │       ├── route.ts
│   │       │       ├── claim/route.ts
│   │       │       ├── approve/route.ts
│   │       │       ├── lock/route.ts
│   │       │       └── clock/route.ts
│   │       ├── waste-logs/route.ts
│   │       ├── production-logs/route.ts
│   │       ├── users/
│   │       │   ├── route.ts
│   │       │   └── [id]/route.ts
│   │       ├── swap-requests/route.ts
│   │       ├── notifications/route.ts
│   │       └── analytics/route.ts
│   ├── components/
│   │   ├── scheduling/
│   │   │   ├── SchedulingShell.tsx
│   │   │   ├── ShiftCard.tsx
│   │   │   ├── WeekCalendar.tsx
│   │   │   └── NotificationBell.tsx
│   │   ├── ui/ (shadcn components)
│   │   ├── Header.tsx
│   │   ├── BottomNav.tsx
│   │   ├── Scanner.tsx
│   │   ├── QRCodeCanvas.tsx
│   │   └── ManualEntryForm.tsx
│   ├── context/
│   │   ├── AuthContext.tsx
│   │   └── StoreContext.tsx
│   ├── lib/
│   │   ├── db.ts (PostgreSQL pool)
│   │   ├── auth.ts (JWT helpers)
│   │   ├── apiMiddleware.ts (withAuth, apiOk, apiError)
│   │   ├── apiClient.ts (typed fetch wrappers)
│   │   ├── storage.ts (localStorage helpers for legacy app)
│   │   ├── analytics.ts (smart alerts, what-if, ROI)
│   │   └── seed.ts (localStorage seeding for legacy app)
│   └── types/
│       ├── scheduling.ts (Shift, User, WasteLog, etc.)
│       └── index.ts (ProductionEntry, WasteEntry, etc.)
├── migrations/
│   └── 001_initial.sql
├── scripts/
│   └── migrate.ts
├── .env.local
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

---

## 🎯 Build Instructions for AI

**Step 1:** Set up Next.js 14 project with TypeScript, Tailwind CSS, and shadcn/ui.

**Step 2:** Create PostgreSQL database schema (copy from migrations/001_initial.sql).

**Step 3:** Build authentication system (JWT, bcrypt, httpOnly cookies).

**Step 4:** Implement all API routes with role-based authorization.

**Step 5:** Build frontend pages (dashboard, schedule, shift detail, users, profile, executive).

**Step 6:** Add notification system (bell icon, real-time updates).

**Step 7:** Implement analytics (smart alerts, what-if simulator, ROI report).

**Step 8:** Build legacy app features (production entry, waste entry, QR/OCR scanning).

**Step 9:** Add mobile optimizations (bottom nav, swipe gestures, touch targets).

**Step 10:** Test all user flows (employee, manager, admin).

**Step 11:** Deploy to Vercel + Neon/Supabase.

---

## 📞 Support & Maintenance

- **Bug Reports:** GitHub Issues
- **Feature Requests:** GitHub Discussions
- **Security Issues:** Email security@keiths.com
- **Documentation:** README.md + inline code comments

---

**END OF SPECIFICATION**

This prompt contains every detail needed to rebuild the entire SaaS platform from scratch. Use it with any AI code assistant (Claude, ChatGPT, Cursor, etc.) to generate a production-ready codebase.
