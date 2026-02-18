# Life Planner — Ashleigh

A personal wellness dashboard that syncs your Notion databases every 15 minutes via GitHub Actions and displays on GitHub Pages.

---

## Setup (5 steps)

### 1. Create a GitHub repo

Create a new **public** GitHub repo (GitHub Pages requires public for free accounts).
Push this folder to it:
```bash
git init
git add .
git commit -m "init"
git remote add origin https://github.com/YOUR_USERNAME/life-planner.git
git push -u origin main
```

---

### 2. Enable GitHub Pages

Go to your repo → **Settings** → **Pages** → Source: **Deploy from branch** → Branch: `main` / `/ (root)` → Save.

Your app will be live at: `https://YOUR_USERNAME.github.io/life-planner/`

---

### 3. Create a Notion Integration

1. Go to [notion.so/my-integrations](https://notion.so/my-integrations)
2. Click **New Integration** → name it "Life Planner Sync"
3. Give it **Read content** permission (and **Update content** if you want write-back later)
4. Copy the **Internal Integration Secret** (starts with `secret_...`)

Then share each database with the integration:
- Open each database in Notion → click `···` → **Add connections** → select "Life Planner Sync"

---

### 4. Get your Database IDs

Open each database in Notion. The URL looks like:
```
https://www.notion.so/YOUR_NAME/DATABASE_TITLE-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx?v=...
```
Copy the 32-character ID (the `xxx...` part, no dashes needed — the SDK handles formatting).

---

### 5. Add GitHub Secrets

Go to your repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add these 5 secrets:

| Secret Name       | Value                                     |
|-------------------|-------------------------------------------|
| `NOTION_API_KEY`  | `secret_xxxxxxxxxxxx` (your integration key) |
| `DB_HABITS`       | 32-char ID of your Habit Tracker database |
| `DB_JOURNAL`      | 32-char ID of your Journal database       |
| `DB_SKINCARE`     | 32-char ID of your Skincare & Tool Inventory |
| `DB_TREATMENTS`   | 32-char ID of your Treatments Log         |

---

### 6. Run the first sync

Go to **Actions** tab in your repo → click **Sync Notion Data** → **Run workflow** → **Run workflow**.

After ~1 minute it will commit `data/notion-data.json` to your repo and your live site will update.

After that it runs automatically every 15 minutes.

---

## How it works

```
Every 15 min:
  GitHub Actions → scripts/fetch-notion.js
                → queries all 4 Notion DBs
                → writes data/notion-data.json
                → commits & pushes to repo

Your browser:
  index.html → fetches ./data/notion-data.json
             → renders habits, journal, skincare, tracker
```

---

## Notion Database Property Names

The sync script tries to auto-detect common property names. If your properties have different names, edit `scripts/fetch-notion.js` and update the `getProperty(page, 'YourPropertyName')` calls.

**Habits DB** — expects checkbox properties (one per habit) on a page with a `Date` property for today.

**Journal DB** — expects: `Name`/`Title`, `Date`/`Created`, `Mood`/`Emoji` (optional select/text)

**Skincare DB** — expects: `Name`/`Product`, `Brand`, `Category`/`Type`, `Tags`/`When`, `Stock Level` (number 0-100, optional)

**Treatments DB** — expects: `Name`/`Treatment`, `Date`, `Duration`/`Time`, `Notes`/`Details`, `Type`/`Category`

---

## Writing back to Notion

The GitHub Actions approach is read-only (it runs on a schedule, not on-demand). To write journal entries or habit check-offs back to Notion in real time, you'd add a small serverless function:

- **Cloudflare Workers** (free, ~5 min setup) — recommended
- **Vercel Functions** (free tier)

Happy to build that as a next step!
