# First Restaurant Onboarding Tutorial

**Version 1.0 · May 2026 · Complete Onboarding Guide**

> This tutorial guides you through onboarding your first restaurant on the lole platform. You'll create accounts, build menus, configure hardware, and conduct staff training following the proven 7-day onboarding arc.

---

## Learning Objectives

By completing this tutorial, you will:

1. [ ] Create restaurant owner account and configure profile
2. [ ] Build a bilingual English/Amharic menu with modifiers
3. [ ] Set up staff accounts with secure PINs
4. [ ] Configure POS and KDS tablets as Progressive Web Apps
5. [ ] Install and configure thermal receipt printer
6. [ ] Generate and deploy QR codes for table ordering
7. [ ] Conduct Day 1, 2, 3, 7, 30, and 60 check-ins
8. [ ] Troubleshoot common onboarding issues

**Estimated Time:** 3-4 hours (Day 1) + scheduled follow-ups  
**Risk Level:** Production — follow every step carefully

---

## Prerequisites Checklist

**Information to Collect from Owner:**

- [ ] Restaurant full name (English and Amharic)
- [ ] Physical address with WiFi coverage
- [ ] Owner full name, phone, and email
- [ ] Number of tables and waitstaff
- [ ] KDS stations needed (Kitchen, Bar, Coffee, Dessert, Expeditor)
- [ ] Payment methods (Cash, Telebirr, Chapa)
- [ ] TIN/VAT registration status (if applicable)

**Hardware Required:**

- [ ] Android tablet(s) for POS (Samsung Galaxy Tab A8 recommended)
- [ ] Android tablet(s) for KDS (minimum 10-inch screen)
- [ ] Thermal printer (Xprinter XP-80 or compatible)
- [ ] USB OTG adapter for tablet-printer connection
- [ ] WiFi network with coverage in kitchen area
- [ ] QR code stands or lamination sheets

---

## Day 1: Restaurant Setup (3-4 Hours)

### Step 1: Create Restaurant Account (30 Minutes)

#### 1.1 Register Owner Account

Navigate to `https://lole.app/register`:

1. Enter owner's email address
2. Create strong password
3. Verify email in owner's inbox

#### 1.2 Complete Restaurant Profile

Navigate to `/merchant/profile`:

| Field                       | Required                       |
| --------------------------- | ------------------------------ |
| Restaurant Name (English)   | Yes                            |
| Restaurant Name (Amharic)   | Yes (dictate to owner)         |
| Address (English + Amharic) | Yes                            |
| Phone Number                | Yes                            |
| Logo                        | Yes (photo of sign acceptable) |
| Timezone                    | Africa/Addis_Ababa             |

#### 1.3 Add Tables

Navigate to `/merchant/tables`:

1. Click **Add Table**
2. Enter table names as used by restaurant (e.g., "A1", "Window 1")
3. Repeat for all physical tables

#### 1.4 Configure Payment Methods

Navigate to `/merchant/settings/payments`:

- **Cash:** Always enabled
- **Telebirr:** Enable if merchant account exists (API key required)
- **Chapa:** Enable if card payments desired

---

### Step 2: Build the Menu (45-60 Minutes)

#### 2.1 Create Menu Categories

Navigate to `/merchant/menu`:

| Category   | Amharic | KDS Station |
| ---------- | ------- | ----------- |
| Breakfast  | ቁርስ     | Kitchen     |
| Lunch      | ምሳ      | Kitchen     |
| Dinner     | እራት     | Kitchen     |
| Drinks     | መጠጥ     | Bar         |
| Coffee/Tea | ቡና / ሻይ | Coffee      |
| Dessert    | ጣፋጭ     | Dessert     |

For each category, add group, Amharic name, and assign KDS station.

#### 2.2 Add Menu Items

Within each category, click **Add Item**:

| Field        | Notes                                |
| ------------ | ------------------------------------ |
| English name | As dictated                          |
| Amharic name | Critical — dictation accuracy        |
| Price        | In ETB (whole numbers or +50 santim) |
| Photo        | Phone camera acceptable              |

**Common Items:** Ful Medames (ፍል ሜዳሜስ), Chechebsa (ጭተብሳ), Tibs (ጥብስ), Doro Wat (ዶሮ ወጥ)

#### 2.3 Configure Modifiers

**Example — Beef Tibs:**

- Group: "Cooking" (Amharic: "በአንድ መንገድ")
- Required: Yes
- Options: Rare, Medium, Well Done (0 ETB each)

**Example — Juice:**

- Group: "Size" (Amharic: "መጠን")
- Options: Small (0 ETB), Large (+15 ETB)

---

### Step 3: Add Staff Accounts (20 Minutes)

Navigate to `/merchant/staff`:

For each waiter/cashier:

| Field     | Input                        |
| --------- | ---------------------------- |
| Full Name | As dictated                  |
| Role      | Waiter / Cashier             |
| PIN       | Assign unique 4-digit number |

**Create PIN Card:**

```
lole Staff PINs - [Restaurant Name]
[Staff Name] — PIN: [xxxx]
```

**Important:** KDS-only staff (kitchen, bar) do NOT need individual accounts.

---

### Step 4: Set Up POS Tablet (45 Minutes)

#### 4.1 Connect and Install PWA

1. Connect tablet to restaurant WiFi
2. Open Chrome → `https://lole.app/pos/waiter`
3. Log in with owner account (one-time link)
4. Menu → **Add to Home screen** → Name: "lole POS"

#### 4.2 Configure Settings

```
Settings → Screen Pinning → On
Settings → Screen Timeout → 10 minutes
```

#### 4.3 Verify Setup

- [ ] PWA opens fullscreen
- [ ] Menu loads in Amharic
- [ ] Waiter PIN login works

---

### Step 5: Set Up Thermal Printer (45 Minutes)

#### 5.1 Install Termux

1. Chrome → `https://f-droid.org` → Install F-Droid
2. F-Droid → Search "Termux" → Install
3. Also install "Termux:Boot"

#### 5.2 Connect and Verify

1. Plug USB OTG + printer
2. Power on printer
3. In Termux: `ls /dev/usb/` → Should show `lp0`

#### 5.3 Install Print Server

```bash
pkg update -y
pkg install nodejs-lts -y
mkdir -p ~/lole-print && cd ~/lole-print
npm init -y
npm install express node-thermal-printer
```

Create `server.js` with UTF-8 configuration for Amharic support.

#### 5.4 Test Printing

1. Run: `node server.js` in Termux
2. In Chrome: `http://localhost:3001/health` → Should return `{"status":"ok"}`
3. In POS: Place order → Print Receipt

---

### Step 6: Set Up KDS Tablets (15 Minutes Each)

For each station:

1. Chrome → Station URL (`lole.app/kds/[station]`)
2. Login with owner account
3. Add to Home screen as "lole KDS [Station]"
4. **Critical:** Settings → Screen Timeout → **Never**
5. Mount at eye level for standing staff

---

### Step 7: Generate and Place QR Codes (20 Minutes)

#### 7.1 Generate

Navigate to `/merchant/tables` → Click QR icon on each table.

#### 7.2 Print Options

- **Best:** Print shop with lamination
- **Good:** Chrome print → PDF → Print shop
- **Test:** Regular paper (replace within 24 hours)

#### 7.3 Place on Tables

Add instruction text:

```
አማርኛ: "QR ኮዱን ስካን ያድርጉ ለማዘዝ"
English: "Scan to order"
```

---

### Step 8: Day 1 Completion Sign-Off

#### 8.1 Verification Checklist

**Accounts & Configuration:**

- [ ] Owner account verified
- [ ] Restaurant profile complete (Amharic names ✓)
- [ ] All tables added with correct names
- [ ] Full menu with Amharic names
- [ ] Modifiers configured
- [ ] Payment methods set up
- [ ] Staff PINs created + PIN card given

**Hardware & Software:**

- [ ] POS tablet: PWA installed, fullscreen, Amharic menu
- [ ] KDS tablet(s): PWA installed, timeout = Never
- [ ] Printer: Test receipt prints correctly
- [ ] QR codes: Generated and placed on tables

**Offline Test (MANDATORY):**

- [ ] Menu loads offline
- [ ] Order placed offline
- [ ] Offline order syncs when WiFi restored

**Owner Handoff:**

- [ ] Email/password written down (not memorized)
- [ ] Termux restart knowledge transferred
- [ ] Telegram support contact shared
- [ ] Day 2 training scheduled

---

## Days 2-60: Follow-Up Sequence

### Day 2: Staff Training (2 Hours)

**Basic POS Operation (30 min):**

- Login with PIN → Open table → Add items → Modifiers → Send to kitchen

**Advanced Features (30 min):**

- Splitting orders → Void items → Transfer tables → Print receipts

**KDS for Kitchen Staff (30 min):**

- Reading tickets → Marking prepared → Handling modifications

**Q&A Practice (30 min):**

- Staff practice → Questions → Concerns addressed

### Day 3: Soft Launch (1 Hour)

**Silent Observation:**

- Be present for first service
- Watch for: full flow usage, KDS updates, printing habits, KDS adoption

**Common Issues & Fixes:**
| Issue | Fix |
|-------|-----|
| KDS not showing | Timeout = Never |
| Wrong station | Fix category assignment |
| No printing | Restart Termux print server |
| Forgot PIN | Show /merchant/staff |
| Missing item | Add via /merchant/menu |

### Day 7: Check-In Call (30 Minutes)

Ask in Amharic:

1. "ፒኤስ ሁሉም ትዕዛዞች ለ ያስገቡ?" — POS for every order?
2. "ኩሽናው KDS ን ይጠቀማሉ?" — Kitchen using KDS?
3. "ምናሌ ላይ የጎደሉ ነገሮች አሉ?" — Missing items/prices?
4. "ዳሶበርዱን ተመልክቷቸዋል?" — Dashboard checked?
5. "ክፍያ ችግር ነበር?" — Payment issues?

### Day 30: Analytics Review + Upgrade

**Share Metrics:**

- Total orders and revenue
- Top 3 selling items
- Busiest day/hour
- Payment method split

**Upgrade Script:**
"Pro plan ሊጨምር የሚችለው: 재고 ማንቂያዎች, ታማኝነት ነጥቦች, ሙሉ ትንታሳ ታሪክ. 1,200 ብር ወርሃዊ — እናንቃ?"

### Day 60: Referral Ask

"ምግብ ቤቶች ባለቤቶች ጓደኞችዎ አሉ? ስልካቸውን ካጋሩ 2 ወር Pro ነፃ ያገኛሉ."

---

## Troubleshooting

**Printer:**

- No `/dev/usb/lp0`: Try different cable, power printer first
- No Amharic: Confirm UTF-8 firmware (2022+ models)
- Permission denied: `chmod 666 /dev/usb/lp0`

**WiFi:**

- KDS delayed: Check kitchen coverage
- Offline issues: Verify PowerSync configuration

**Staff:**

- Forgotten PIN: /merchant/staff → view PIN
- Not using POS: Find root cause (speed, confidence, missing items)
- Resisting KDS: Remove paper tickets, force digital transition

---

## Summary

| Phase     | Duration | Deliverables    |
| --------- | -------- | --------------- |
| Pre-visit | 1 hour   | Info collected  |
| Day 1     | 3-4 hrs  | Restaurant live |
| Day 2     | 2 hrs    | Staff trained   |
| Day 3     | 1 hr     | Real orders     |
| Day 7     | 30 min   | Issues resolved |
| Day 30    | 30 min   | Upgrade ready   |
| Day 60    | 15 min   | Referrals       |

**Success Metrics:**

- [ ] 100% order capture via POS
- [ ] Kitchen using KDS
- [ ] Zero critical tickets
- [ ] Owner confident with dashboard

---

## Next Steps

With your first restaurant onboarded:

1. **[Database Migrations Runbook](../how-to/operational-runbooks/database-migrations.md)** — Learn production deployment procedures
2. [Security Policies](../reference/security/security-policy.md) — Understand platform security requirements
