# בוקרה קפיטל — Bukra Capital

**AI-powered investment research platform for long-term investors.**

Bukra Capital helps investors understand the business behind a stock — before making a decision. It analyzes real financial data from public companies and translates it into a clear 0–100 **Bukra Score** based on 5 principles of long-term business quality.

> Research only. Not investment advice. US stocks and ETFs only.

---

## What It Does

- **Bukra Score (0–100)** — composite score across growth, profitability, cash flow, stability, and debt health
- **Bukra Rules** — 5 binary rule checks per company (pass/fail)
- **AI Explanation** — Hebrew-first company breakdown powered by Claude (Anthropic)
- **Scanner** — ranks a universe of leading US stocks by Bukra Score; cache-first, refreshes weekly
- **Prediction Accuracy System** — tracks whether high-scoring companies outperform SPY over 3 months (alpha engine)
- **Hebrew/English** — fully bilingual UI with RTL support

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS + Recharts |
| Backend | Python 3.11 + FastAPI + uvicorn |
| Data | yahooquery (primary) + yfinance (fallback) |
| AI | Anthropic claude-sonnet-4-6 |
| Scheduler | APScheduler (weekly scanner) |
| DB | SQLite (prediction accuracy snapshots) |

---

## Local Setup

### Prerequisites

- Node.js 18+
- Python 3.11+
- An [Anthropic API key](https://console.anthropic.com/) (optional — app works without it, AI explanations will be disabled)

### 1. Clone

```bash
git clone https://github.com/YOUR_USERNAME/bukra-capital.git
cd bukra-capital
```

### 2. Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Create your .env from the example
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY (optional)

uvicorn main:app --reload --port 8000
```

The backend starts at `http://localhost:8000`.
On first startup, `init_db()` runs automatically and seeds sample prediction accuracy data.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

The app opens at `http://localhost:5173`.
The Vite dev proxy routes all `/api` calls to the backend — no env vars needed locally.

---

## Key Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start frontend dev server (HMR) |
| `npm run build` | Production build → `frontend/dist/` |
| `uvicorn main:app --reload --port 8000` | Start backend with hot-reload |
| `uvicorn main:app --host 0.0.0.0 --port $PORT` | Production start (Render) |

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/api/search?q=` | Search companies |
| `GET` | `/api/company/{ticker}/full` | Full company data + Bukra Score |
| `GET` | `/api/company/{ticker}/explain` | AI explanation (Hebrew) |
| `GET` | `/api/scanner/latest` | Cached scanner results (instant, no scan) |
| `POST` | `/api/scanner/refresh` | Trigger background scan |
| `GET` | `/api/scanner/status` | Live scan progress |
| `GET` | `/api/accuracy/summary` | Prediction accuracy stats |
| `GET` | `/api/accuracy/history` | Snapshot history |

---

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for the full guide.

**Short version:**

| | Platform | Key setting |
|---|---|---|
| Frontend | **Vercel** | Set `VITE_API_URL=https://your-backend.onrender.com/api` |
| Backend | **Render** | Set `ANTHROPIC_API_KEY`, `ALLOWED_ORIGINS`, `DATA_DIR=/data` |

The backend scheduler runs a full market scan every **Monday at 02:00 UTC** automatically.

---

## Project Structure

```
bukra-capital/
├── backend/
│   ├── main.py                  # FastAPI app + scheduler
│   ├── requirements.txt
│   ├── .env.example
│   ├── data/
│   │   └── stock_universe.json  # Universe of stocks to scan
│   ├── routers/
│   │   ├── company.py           # Company data + AI explanation
│   │   ├── scanner.py           # Cache-first scanner
│   │   └── accuracy.py          # Prediction accuracy system
│   └── services/
│       ├── bukra_score.py       # Core scoring algorithm
│       ├── bukra_rules.py       # 5 binary rules
│       ├── yahoo_finance.py     # Data layer (yahooquery + yfinance)
│       ├── ai_explanation.py    # Claude integration
│       └── accuracy_db.py       # SQLite schema + alpha engine
├── frontend/
│   ├── src/
│   │   ├── api/client.ts        # API calls (VITE_API_URL configurable)
│   │   ├── pages/               # Home, Company, Scanner, Accuracy
│   │   ├── components/          # SearchBar, PredictionAccuracyCard, ...
│   │   └── i18n/                # Hebrew + English translations
│   ├── public/vercel.json       # SPA routing for Vercel
│   └── vite.config.ts
├── DEPLOYMENT.md
└── README.md
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Optional | Enables Hebrew AI company explanations |
| `ALLOWED_ORIGINS` | Production | Comma-separated list of allowed frontend URLs |
| `DATA_DIR` | Production | Path to persistent data directory (e.g. `/data` on Render) |

### Frontend (Vercel environment)

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | Production | Full URL to backend API, e.g. `https://api.example.com/api` |

---

## License

Private project — Bukra Capital. All rights reserved.
