# בוקרה קפיטל — Bukra Capital

> **AI-powered investment research platform for long-term investors.**
> Research only · Not investment advice · US stocks and ETFs only.

---

## What Is Bukra Capital?

Most people buy stocks. Few understand the business behind them.

**Bukra Capital** helps retail investors make smarter decisions by analyzing the real financial quality of public companies — before they invest. The platform translates complex financial statements into a single, clear score: the **Bukra Score**.

It is built for long-term investors who want to understand what they own.

---

## The Bukra Score

A **0–100 composite score** based on five principles of long-term business quality:

| # | Principle | What It Measures |
|---|---|---|
| 1 | Consistent Growth | Revenue and net income trends over 5 years |
| 2 | Profitability | Net margins and return on capital |
| 3 | Free Cash Flow | Operating cash generation minus capex |
| 4 | Financial Stability | Liquidity and balance sheet strength |
| 5 | Debt Health | Debt-to-equity and coverage ratios |

The score does not predict prices. It answers a simpler question:
**Is this a business I would want to own?**

---

## Features

- **Company Analysis** — Full Bukra Score breakdown, 5-year financial charts, Bukra Rules (pass/fail), and plain-language AI explanation in Hebrew
- **Market Scanner** — Ranks a universe of leading US stocks by Bukra Score; cache-first architecture, refreshes weekly automatically
- **Prediction Accuracy System** — Tracks whether high-scoring companies outperform SPY over 3 months; alpha engine with confidence grades
- **Bilingual UI** — Hebrew-first with full English support, RTL/LTR toggle, persisted per session

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 · TypeScript · Vite · Tailwind CSS · Recharts |
| Backend | Python 3.11 · FastAPI · uvicorn |
| Data | yahooquery (primary) · yfinance (fallback) |
| AI | Anthropic `claude-sonnet-4-6` |
| Scheduler | APScheduler — weekly scanner (Mondays 02:00 UTC) |
| Storage | SQLite · JSON cache |

---

## Local Development

### Prerequisites

- Node.js 18+
- Python 3.11+
- Anthropic API key *(optional — app works without it; AI explanations will be disabled)*

### 1. Clone

```bash
git clone https://github.com/ronbukra231/Bukra-score.git
cd Bukra-score
```

### 2. Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Open .env and add your ANTHROPIC_API_KEY (optional)

uvicorn main:app --reload --port 8000
# → http://localhost:8000
```

On first startup, `init_db()` runs automatically and seeds sample prediction accuracy data.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

The Vite dev proxy routes all `/api` calls to `localhost:8000` — no environment variables needed locally.

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/api/search?q=` | Search companies by name or ticker |
| `GET` | `/api/company/{ticker}/full` | Full company data + Bukra Score |
| `GET` | `/api/company/{ticker}/explain` | AI explanation in Hebrew |
| `GET` | `/api/scanner/latest` | Cached scanner results (instant) |
| `POST` | `/api/scanner/refresh` | Trigger background scan |
| `GET` | `/api/scanner/status` | Live scan progress |
| `GET` | `/api/accuracy/summary` | Prediction accuracy stats + alpha |
| `GET` | `/api/accuracy/history` | Full snapshot history |
| `POST` | `/api/accuracy/recalculate` | Resolve pending predictions |

---

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for the complete guide.

**Recommended stack:**

| Layer | Platform | Notes |
|---|---|---|
| Frontend | **Vercel** | Import `frontend/` · set `VITE_API_URL` |
| Backend | **Render** | Import `backend/` · add Persistent Disk at `/data` |

### Environment Variables

**Backend (Render):**

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Optional | Enables Hebrew AI explanations |
| `ALLOWED_ORIGINS` | Yes | Comma-separated allowed frontend URLs |
| `DATA_DIR` | Yes | Path to persistent disk (e.g. `/data`) |

**Frontend (Vercel):**

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | Yes | Full backend API URL, e.g. `https://api.example.com/api` |

---

## Project Structure

```
Bukra-score/
├── backend/
│   ├── main.py                   # FastAPI app entry point + scheduler
│   ├── requirements.txt
│   ├── .env.example
│   ├── data/
│   │   └── stock_universe.json   # Universe of stocks to scan
│   ├── routers/
│   │   ├── company.py            # Company data + AI explanation
│   │   ├── scanner.py            # Cache-first scanner architecture
│   │   └── accuracy.py           # Prediction accuracy system
│   └── services/
│       ├── bukra_score.py        # Core scoring algorithm
│       ├── bukra_rules.py        # 5 binary quality rules
│       ├── yahoo_finance.py      # Data layer (yahooquery + yfinance)
│       ├── ai_explanation.py     # Claude integration
│       └── accuracy_db.py        # SQLite schema + alpha engine
├── frontend/
│   ├── src/
│   │   ├── api/client.ts         # API calls (VITE_API_URL configurable)
│   │   ├── pages/                # Home · Company · Scanner · Accuracy
│   │   ├── components/           # Reusable UI components
│   │   └── i18n/                 # Hebrew + English translations
│   ├── public/vercel.json        # SPA rewrite rules for Vercel
│   └── vite.config.ts
├── DEPLOYMENT.md
└── README.md
```

---

## Design Principles

- **No trading.** Bukra is research-only. No buy/sell execution, no options, no leverage, no crypto.
- **No hardcoded data.** All financial data is fetched live from public sources.
- **Never crash.** If one metric is unavailable, the score degrades gracefully — it never breaks.
- **Long-term focus.** The scanner refreshes weekly, not on every page load. Bukra Score measures business quality, not short-term momentum.
- **Transparency.** The accuracy system tracks every prediction the platform makes and publishes the results openly.

---

*Bukra Capital · בוקרה קפיטל · Research only · Not investment advice*
