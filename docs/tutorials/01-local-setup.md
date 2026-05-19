# Local Development Setup

**Version 1.0 · May 2026 · 30-45 Minute Guide**

> This tutorial walks you through setting up a complete local development environment for the lole Restaurant OS. By the end, you'll have a running instance on your machine ready for feature development and testing.

---

## Learning Objectives

By completing this tutorial, you will:

1. [ ] Install required development tools
2. [ ] Clone and configure the lole repository
3. [ ] Set up local Supabase for database
4. [ ] Run the development server
5. [ ] Test on an Android tablet
6. [ ] Configure thermal printer for testing

**Estimated Time:** 30-45 minutes  
**Risk Level:** Low — all changes are local

---

## Prerequisites Verification

| Tool    | Minimum Version | Verification Command |
| ------- | --------------- | -------------------- |
| Node.js | 22.0.0          | `node --version`     |
| pnpm    | 10.0.0          | `pnpm --version`     |
| Git     | 2.30.0          | `git --version`      |

### 2.1 Install Missing Tools

**Node.js + pnpm (macOS/Linux):**

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 22
npm install -g pnpm
```

**Node.js + pnpm (Windows):**

```powershell
winget install OpenJS.NodeJS
npm install -g pnpm
```

**Verification:**

```bash
node --version  # Expected: v22.x.x
pnpm --version  # Expected: 10.x.x
git --version   # Expected: 2.30.x or higher
```

---

## Step 1: Clone the Repository

### 1.1 Clone the Monorepo

```bash
git clone https://github.com/lole-app/lole.git
cd lole
```

**Expected Structure:**

```
.git
.editorconfig
.env.example
.kilo/
.vscode/
docs/
package.json
pnpm-workspace.yaml
README.md
```

### 1.2 Install Dependencies

```bash
pnpm install
```

This may take 2-5 minutes.

---

## Step 2: Set Up Environment Variables

### 2.1 Copy Example Environment

```bash
cp .env.example .env.local
code .env.local
```

### 2.2 Configure Supabase

**Option A: Supabase Cloud (Recommended)**

1. Create free project at [supabase.com](https://supabase.com)
2. Navigate to Settings → API
3. Copy to `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT-REF].supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=[YOUR-PUBLISHABLE-KEY]
SUPABASE_SECRET_KEY=[YOUR-SERVICE-ROLE-KEY]
SUPABASE_PROJECT_REF=[PROJECT-REF]
```

**Option B: Local Supabase via Docker**

```bash
pnpm add -g supabase
supabase start
```

### 2.3 Configure Additional Variables

```bash
UPSTASH_REDIS_REST_URL=[your-upstash-url]
UPSTASH_REDIS_REST_TOKEN=[your-upstash-token]
```

---

## Step 3: Database Setup

### 3.1 Apply Database Migrations

```bash
pnpm supabase:cli db push
```

### 3.2 Seed Development Data

```bash
pnpm seed
```

This creates demo restaurant, test users, and sample orders.

---

## Step 4: Run the Development Server

### 4.1 Start Development Mode

```bash
pnpm dev
```

**Expected Output:**

```
▲ Next.js 16.x.x
  - Local:    http://localhost:3000
  - Network:  http://192.168.x.x:3000
```

### 4.2 Verify Running Services

- POS: `http://localhost:3000/pos/waiter`
- Dashboard: `http://localhost:3000/dashboard`
- GraphQL: `http://localhost:3000/api/graphql`

---

## Step 5: Connect Android Tablet

### 5.1 Find Computer IP

```bash
# macOS/Linux
ipconfig getifaddr en0
```

### 5.2 Connect Tablet

1. Ensure tablet and computer on same WiFi
2. Chrome on tablet → `http://[YOUR-IP]:3000/pos/waiter`
3. Log in with demo PIN: `1234`

### 5.3 Install as PWA

1. Chrome Menu (⋮) → **Add to Home screen**
2. Name: "lole POS Dev"
3. Verify icon on home screen

---

## Step 6: Configure Thermal Printer

### 6.1 Install Termux

1. Chrome → `https://f-droid.org`
2. Install F-Droid
3. F-Droid → Search "Termux" → Install

### 6.2 Connect Printer

```bash
# On Android tablet
pkg update -y
pkg install nodejs-lts -y
mkdir -p ~/lole-print
cd ~/lole-print
npm init -y
npm install express node-thermal-printer
```

### 6.3 Create Server

Create `server.js` with UTF-8 configuration for Amharic support.

### 6.4 Test Printing

1. Connect printer via USB OTG
2. Run: `node server.js`
3. Test: `curl http://localhost:3001/print/test`

---

## Step 7: Development Workflow

### 7.1 Project Structure

```bash
lole/
├── apps/
│   ├── pos/              # POS frontend
│   ├── kds/              # Kitchen Display System
│   └── dashboard/        # Management dashboard
├── packages/
│   ├── ui/               # Shared components
│   ├── graphql/          # GraphQL schema/types
│   └── utils/            # Shared utilities
└── supabase/
    ├── migrations/       # Database migrations
    └── functions/        # Edge functions
```

### 7.2 Common Development Commands

```bash
pnpm typecheck  # Type checking
pnpm lint       # Linting
pnpm test       # Tests
pnpm build      # Production build
pnpm format     # Code formatting
```

### 7.3 Making Changes

```bash
git checkout -b feature/your-feature
# Make changes
pnpm test
git commit -m "feat(pos): add modifier selection UI"
```

---

## Step 8: Verify Your Setup

### 8.1 Checklist

- [ ] Repository cloned successfully
- [ ] Dependencies installed via `pnpm install`
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Development server starts
- [ ] POS loads on localhost:3000
- [ ] Tablet can access dev server
- [ ] Printer test works (if applicable)

### 8.2 Hot Reload Test

1. Open POS on tablet
2. Edit `apps/pos/app/page.tsx`
3. Save file
4. **Verification:** App updates within 2-3 seconds

---

## Troubleshooting

| Issue                       | Solution                                  |
| --------------------------- | ----------------------------------------- |
| `pnpm install` fails        | `pnpm store prune` then retry             |
| Supabase connection refused | Check project not paused, regenerate keys |
| Tablet can't connect        | Check same network, firewall port 3000    |
| Printer permission denied   | `chmod 666 /dev/usb/lp0` in Termux        |

---

## Next Steps

With your local development environment ready:

1. **[02-first-feature.md](./02-first-feature.md)** — Apply your skills to real restaurant setup
2. [Coding Standards](../reference/coding-standards.md) — Learn the codebase conventions

---

## Summary

| Section       | Key Learning             |
| ------------- | ------------------------ |
| Prerequisites | Tool installation        |
| Repository    | Cloning and workspace    |
| Environment   | Supabase configuration   |
| Database      | Migrations and seeding   |
| Development   | Server startup           |
| Hardware      | Tablet and printer setup |

**You now have:**

- Complete local development environment
- Working POS and KDS on tablet
- Understanding of development workflow

---

_Local Development Guide v1.0 · Updated May 2026 · For setup issues, contact dev@lole.app_
