# Ksolves MoM Tool

A full-featured Meeting Minutes Generator & Tracker built with React + Supabase.

## Features

- **Email OTP Authentication** (2FA — no passwords)
- **Company Workspaces** — create or join via invite code
- **Team Management** — add members, manage roles
- **MoM Generator** — create, edit, preview, export to PDF
- **AI Transcript Parsing** — paste/upload transcript → AI fills MoM (uses your own Claude API key)
- **Analytics Dashboard** — KPIs, client breakdown, status charts, 6-month timeline
- **Action Item Tracker** — cross-MoM action tracking with status updates
- **Tools Hub** — extensible sidebar for future tools (SOW Generator, Proposal Generator, etc.)
- **Per-user Claude API Key** — each user connects their own Anthropic key

---

## Quick Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd ksolves-mom-tool
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Go to **SQL Editor** and run the contents of `supabase-schema.sql`
3. Go to **Settings → API** and copy your:
   - Project URL
   - `anon` public key

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:
```
REACT_APP_SUPABASE_URL=https://yourproject.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJ...
```

### 4. Configure Supabase Auth

In your Supabase dashboard:
1. Go to **Authentication → Settings**
2. Under **Email**, ensure **Enable Email OTP** is on
3. Set **Site URL** to `http://localhost:3000` (or your production URL)
4. Add your production domain to **Redirect URLs**

### 5. Run locally

```bash
npm start
```

### 6. Deploy

**Vercel (recommended):**
```bash
npm install -g vercel
vercel
```
Set environment variables in Vercel dashboard.

**Netlify:**
```bash
npm run build
netlify deploy --prod --dir=build
```

---

## Adding a Claude API Key (per user)

Each user connects their own Claude API key:
1. Sign in → go to **Profile → Integrations**
2. Paste your key from [console.anthropic.com](https://console.anthropic.com)
3. Click **Test** then **Save Key**

Keys are stored in Supabase (encrypted at rest) and are never shared with other users.

---

## Adding New Tools

To add a new tool to the sidebar, edit `src/lib/constants.js`:

```js
export const TOOLS = [
  // existing tools...
  {
    id: 'my_tool',
    label: 'My New Tool',
    icon: '🛠',
    description: 'Description of what this tool does.',
    status: 'coming_soon',  // 'active' | 'coming_soon' | 'beta'
    route: 'my_tool',
  },
];
```

To activate it, change `status` to `'active'` and add a route handler in `App.js`.

---

## Database Schema

| Table | Purpose |
|-------|---------|
| `profiles` | User info + Claude API key |
| `companies` | Company workspaces + invite codes |
| `company_members` | Many-to-many user↔company with roles |
| `moms` | Meeting minutes (JSONB for flexible fields) |

---

## Tech Stack

- **React 18** (Create React App)
- **Supabase** (PostgreSQL + Auth + RLS)
- **@supabase/supabase-js** v2
- **DM Sans + DM Mono** fonts (Google Fonts)
- No CSS frameworks — all inline styles
