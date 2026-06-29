"""
SQLite persistence for Bukra Score snapshots and accuracy tracking.
DB lives at backend/data/accuracy.db

Schema v2 — adds:
  alpha_3m, alpha_6m, alpha_12m      (excess return vs SPY)
  price_1m / 6m / 12m                (future prices at those horizons)
  spy_price_1m / 6m / 12m
  return_1m / 6m / 12m
  spy_return_1m / 6m / 12m
All new columns added via ALTER TABLE so existing rows are preserved.
"""

import os
import sqlite3
from datetime import datetime, timezone, timedelta
from typing import Optional

_DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "accuracy.db")


def _conn() -> sqlite3.Connection:
    con = sqlite3.connect(_DB_PATH)
    con.row_factory = sqlite3.Row
    return con


# ── Schema migration ──────────────────────────────────────────────────────────

_NEW_COLS = [
    # Alpha (excess return vs SPY)
    ("alpha_3m",          "REAL"),
    # 1-month horizon
    ("price_1m",          "REAL"),
    ("spy_price_1m",      "REAL"),
    ("return_1m",         "REAL"),
    ("spy_return_1m",     "REAL"),
    ("alpha_1m",          "REAL"),
    ("beat_spy_1m",       "INTEGER"),
    # 6-month horizon
    ("price_6m",          "REAL"),
    ("spy_price_6m",      "REAL"),
    ("return_6m",         "REAL"),
    ("spy_return_6m",     "REAL"),
    ("alpha_6m",          "REAL"),
    ("beat_spy_6m",       "INTEGER"),
    # 12-month horizon
    ("price_12m",         "REAL"),
    ("spy_price_12m",     "REAL"),
    ("return_12m",        "REAL"),
    ("spy_return_12m",    "REAL"),
    ("alpha_12m",         "REAL"),
    ("beat_spy_12m",      "INTEGER"),
]


def _migrate(con: sqlite3.Connection):
    """Add new columns to existing table without losing data."""
    existing = {row[1] for row in con.execute("PRAGMA table_info(snapshots)").fetchall()}
    for col_name, col_type in _NEW_COLS:
        if col_name not in existing:
            con.execute(f"ALTER TABLE snapshots ADD COLUMN {col_name} {col_type}")
    con.commit()


def init_db():
    """Create table if needed, run migration, seed sample data on first run."""
    with _conn() as con:
        con.execute("""
            CREATE TABLE IF NOT EXISTS snapshots (
                id               INTEGER PRIMARY KEY AUTOINCREMENT,
                ticker           TEXT NOT NULL,
                company_name     TEXT,
                sector           TEXT,
                bukra_score      INTEGER NOT NULL,
                price_at_score   REAL,
                snapshot_date    TEXT NOT NULL,
                is_sample        INTEGER DEFAULT 0,
                price_3m         REAL,
                spy_price_at     REAL,
                spy_price_3m     REAL,
                return_3m        REAL,
                spy_return_3m    REAL,
                beat_spy_3m      INTEGER,
                outcome_status   TEXT DEFAULT 'pending',
                created_at       TEXT NOT NULL
            )
        """)
        con.execute("CREATE INDEX IF NOT EXISTS idx_ticker ON snapshots(ticker)")
        con.execute("CREATE INDEX IF NOT EXISTS idx_date   ON snapshots(snapshot_date)")
        con.commit()

        _migrate(con)

        count = con.execute("SELECT COUNT(*) FROM snapshots").fetchone()[0]
        if count == 0:
            _seed_sample_data(con)
        else:
            # Backfill alpha_3m for existing completed rows that have it null
            _backfill_alpha(con)


def _backfill_alpha(con: sqlite3.Connection):
    """Compute alpha_3m for completed rows where it's missing."""
    rows = con.execute("""
        SELECT id, return_3m, spy_return_3m FROM snapshots
        WHERE outcome_status='completed'
          AND return_3m IS NOT NULL
          AND spy_return_3m IS NOT NULL
          AND alpha_3m IS NULL
    """).fetchall()
    for r in rows:
        alpha = round(r["return_3m"] - r["spy_return_3m"], 2)
        con.execute("UPDATE snapshots SET alpha_3m=? WHERE id=?", (alpha, r["id"]))
    if rows:
        con.commit()
        print(f"[accuracy] backfilled alpha_3m for {len(rows)} rows")


# ── Seed data ─────────────────────────────────────────────────────────────────

def _seed_sample_data(con: sqlite3.Connection):
    today = datetime.now(timezone.utc).date()

    # (ticker, name, sector, score, price_at, spy_at, beat_spy, return_3m, spy_return_3m, months_ago)
    # alpha_3m = return_3m - spy_return_3m
    samples = [
        # ── High scorers (>=85) ──────────────────────────────────────────────
        ("NVDA", "NVIDIA Corporation",       "Technology",          95, 480.0,  420.0, 1,  38.5,  8.2, 14),
        ("MSFT", "Microsoft Corporation",    "Technology",          92, 310.0,  415.0, 1,  22.1,  6.4, 13),
        ("AAPL", "Apple Inc.",               "Technology",          90, 175.0,  430.0, 1,  18.3,  7.1, 12),
        ("MA",   "Mastercard Inc.",          "Financial Services",  89, 420.0,  440.0, 1,  14.7,  5.9, 11),
        ("V",    "Visa Inc.",                "Financial Services",  88, 250.0,  445.0, 1,  12.4,  4.8, 10),
        ("COST", "Costco Wholesale",         "Consumer Defensive",  87, 580.0,  450.0, 1,  16.2,  5.3,  9),
        ("LLY",  "Eli Lilly and Company",    "Healthcare",          91, 650.0,  455.0, 1,  29.8,  6.1,  8),
        ("GOOGL","Alphabet Inc.",            "Communication Svcs.", 88, 140.0,  460.0, 1,  19.5,  5.7,  7),
        ("META", "Meta Platforms Inc.",      "Communication Svcs.", 86, 340.0,  465.0, 1,  24.3,  5.2,  6),
        ("AVGO", "Broadcom Inc.",            "Technology",          93, 900.0,  470.0, 1,  21.7,  5.5,  5),
        ("ASML", "ASML Holding N.V.",        "Technology",          90, 680.0,  475.0, 0,   3.2,  5.8, 15),
        ("TSM",  "Taiwan Semiconductor",     "Technology",          87, 115.0,  410.0, 0,   2.1,  8.9, 16),
        ("UNH",  "UnitedHealth Group",       "Healthcare",          85, 530.0,  405.0, 1,  11.3,  7.6, 17),
        ("HD",   "Home Depot Inc.",          "Consumer Cyclical",   86, 340.0,  400.0, 1,   9.8,  6.3, 18),
        ("NKE",  "Nike Inc.",                "Consumer Cyclical",   85, 112.0,  395.0, 0,  -2.4,  6.9, 13),
        # ── 80–84 ────────────────────────────────────────────────────────────
        ("AMZN", "Amazon.com Inc.",          "Consumer Cyclical",   82, 180.0,  430.0, 1,  15.2,  7.4, 12),
        ("NFLX", "Netflix Inc.",             "Communication Svcs.", 81, 450.0,  395.0, 1,  18.6,  6.9,  7),
        ("ADBE", "Adobe Inc.",               "Technology",          83, 550.0,  440.0, 1,  12.1,  6.4,  8),
        ("WMT",  "Walmart Inc.",             "Consumer Defensive",  80, 165.0,  455.0, 1,   9.4,  5.4,  8),
        # ── 75–79 ────────────────────────────────────────────────────────────
        ("JPM",  "JPMorgan Chase",           "Financial Services",  79, 190.0,  445.0, 1,   8.7,  5.3, 10),
        ("JNJ",  "Johnson & Johnson",        "Healthcare",          78, 152.0,  450.0, 0,   1.2,  5.9,  9),
        ("AMD",  "Advanced Micro Devices",   "Technology",          78, 170.0,  445.0, 0,  -3.7,  5.9,  9),
        ("PG",   "Procter & Gamble Co.",     "Consumer Defensive",  77, 155.0,  460.0, 0,   3.1,  5.7,  7),
        ("PFE",  "Pfizer Inc.",              "Healthcare",          75, 32.0,   405.0, 0,  -5.8,  7.6, 17),
        ("CVX",  "Chevron Corporation",      "Energy",              76, 158.0,  400.0, 0,   2.3,  6.3, 18),
        # ── 70–74 ────────────────────────────────────────────────────────────
        ("TSLA", "Tesla Inc.",               "Consumer Cyclical",   74, 225.0,  440.0, 0,  -8.3,  6.1, 11),
        ("BAC",  "Bank of America Corp.",    "Financial Services",  73, 35.0,   470.0, 1,   7.1,  5.5,  5),
        ("XOM",  "Exxon Mobil Corp.",        "Energy",              72, 115.0,  465.0, 0,  -1.4,  5.2,  6),
        ("DIS",  "Walt Disney Co.",          "Communication Svcs.", 71, 88.0,   475.0, 0,  -4.2,  5.8, 15),
        ("INTC", "Intel Corporation",        "Technology",          70, 42.0,   410.0, 0,  -9.7,  8.9, 16),
        # ── 65–69 ────────────────────────────────────────────────────────────
        ("GE",   "GE Aerospace",             "Industrials",         65, 130.0,  425.0, 0,  -3.1,  7.2, 12),
        ("RCL",  "Royal Caribbean Cruises",  "Consumer Cyclical",   63, 110.0,  410.0, 1,   9.8,  7.4, 12),
        # ── 60–64 ────────────────────────────────────────────────────────────
        ("C",    "Citigroup Inc.",           "Financial Services",  61, 55.0,   450.0, 0,  -2.8,  5.4,  8),
        ("DVN",  "Devon Energy Corp.",       "Energy",              62, 42.0,   405.0, 0,  -8.2,  7.6, 17),
        ("KEY",  "KeyCorp",                  "Financial Services",  60, 15.0,   410.0, 0,  -4.7,  8.9, 16),
        # ── Below 60 ─────────────────────────────────────────────────────────
        ("F",    "Ford Motor Company",       "Consumer Cyclical",   55, 12.0,   430.0, 0, -11.4,  6.5, 11),
        ("T",    "AT&T Inc.",                "Communication Svcs.", 52, 17.0,   440.0, 0,  -7.6,  6.1, 10),
        ("VZ",   "Verizon Communications",   "Communication Svcs.", 58, 39.0,   445.0, 0,  -4.3,  5.9,  9),
        ("GM",   "General Motors Co.",       "Consumer Cyclical",   57, 42.0,   455.0, 0, -13.2,  5.7,  7),
        ("MO",   "Altria Group Inc.",        "Consumer Defensive",  54, 44.0,   460.0, 0,  -5.1,  5.2,  6),
        ("WBA",  "Walgreens Boots Alliance", "Consumer Defensive",  48, 23.0,   465.0, 0, -18.9,  5.5,  5),
        ("PARA", "Paramount Global",         "Communication Svcs.", 44, 18.0,   470.0, 0, -22.3,  5.8, 15),
        ("SLB",  "SLB (Schlumberger)",       "Energy",              59, 50.0,   400.0, 0,  -6.1,  6.3, 18),
        ("AAL",  "American Airlines Group",  "Industrials",         45, 14.0,   395.0, 0, -19.5,  6.9, 13),
        ("CCL",  "Carnival Corporation",     "Consumer Cyclical",   51, 18.0,   400.0, 1,  12.4,  7.1, 14),
        # ── Pending (< 90 days old) ──────────────────────────────────────────
        ("NVDA", "NVIDIA Corporation",       "Technology",          97, 890.0,  520.0, None, None, None, 1),
        ("MSFT", "Microsoft Corporation",    "Technology",          93, 415.0,  520.0, None, None, None, 1),
        ("AAPL", "Apple Inc.",               "Technology",          91, 195.0,  518.0, None, None, None, 2),
        ("LLY",  "Eli Lilly and Company",    "Healthcare",          92, 810.0,  515.0, None, None, None, 2),
        ("AVGO", "Broadcom Inc.",            "Technology",          94, 1700.0, 510.0, None, None, None, 1),
    ]

    rows = []
    for (ticker, name, sector, score, price, spy, beat, ret3m, spy3m, months_ago) in samples:
        snap_date = today - timedelta(days=months_ago * 30)
        created   = datetime.combine(snap_date, datetime.min.time()).replace(tzinfo=timezone.utc).isoformat()

        if beat is not None:
            price_3m     = price * (1 + ret3m / 100)
            spy_price_3m = spy   * (1 + spy3m / 100)
            alpha_3m     = round(ret3m - spy3m, 2)
            rows.append((
                ticker, name, sector, score, price,
                snap_date.isoformat(), 1,
                price_3m, spy, spy_price_3m,
                ret3m, spy3m, beat, alpha_3m,
                "completed", created,
            ))
        else:
            rows.append((
                ticker, name, sector, score, price,
                snap_date.isoformat(), 1,
                None, spy, None,
                None, None, None, None,
                "pending", created,
            ))

    con.executemany("""
        INSERT INTO snapshots
          (ticker, company_name, sector, bukra_score, price_at_score,
           snapshot_date, is_sample, price_3m, spy_price_at, spy_price_3m,
           return_3m, spy_return_3m, beat_spy_3m, alpha_3m,
           outcome_status, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, rows)
    con.commit()
    print(f"[accuracy] Seeded {len(rows)} sample snapshots.")


# ── Write API ─────────────────────────────────────────────────────────────────

def save_snapshot(
    ticker: str,
    company_name: str,
    sector: str,
    bukra_score: int,
    price_at_score: Optional[float],
    spy_price_at: Optional[float] = None,
) -> int:
    now = datetime.now(timezone.utc)
    with _conn() as con:
        cur = con.execute("""
            INSERT INTO snapshots
              (ticker, company_name, sector, bukra_score, price_at_score,
               snapshot_date, is_sample, spy_price_at, outcome_status, created_at)
            VALUES (?,?,?,?,?,?,0,?,'pending',?)
        """, (ticker, company_name, sector, bukra_score, price_at_score,
              now.date().isoformat(), spy_price_at, now.isoformat()))
        con.commit()
        return cur.lastrowid


def update_outcome(
    snapshot_id: int,
    *,
    price_3m: float,
    spy_price_3m: float,
    return_3m: float,
    spy_return_3m: float,
    beat_spy_3m: int,
    alpha_3m: float,
):
    with _conn() as con:
        con.execute("""
            UPDATE snapshots SET
                price_3m=?, spy_price_3m=?,
                return_3m=?, spy_return_3m=?,
                beat_spy_3m=?, alpha_3m=?,
                outcome_status='completed'
            WHERE id=?
        """, (price_3m, spy_price_3m, return_3m, spy_return_3m,
              beat_spy_3m, alpha_3m, snapshot_id))
        con.commit()


def update_horizon(
    snapshot_id: int,
    horizon: str,          # '1m' | '6m' | '12m'
    price: float,
    spy_price: float,
    ret: float,
    spy_ret: float,
    beat: int,
    alpha: float,
):
    h = horizon.replace("m", "")
    with _conn() as con:
        con.execute(f"""
            UPDATE snapshots SET
                price_{h}m=?, spy_price_{h}m=?,
                return_{h}m=?, spy_return_{h}m=?,
                beat_spy_{h}m=?, alpha_{h}m=?
            WHERE id=?
        """, (price, spy_price, ret, spy_ret, beat, alpha, snapshot_id))
        con.commit()


# ── Read API ──────────────────────────────────────────────────────────────────

def get_pending_snapshots() -> list[dict]:
    """Pending snapshots where snapshot_date is old enough for 3M resolution (90+ days)."""
    cutoff = (datetime.now(timezone.utc).date() - timedelta(days=90)).isoformat()
    with _conn() as con:
        rows = con.execute("""
            SELECT * FROM snapshots
            WHERE outcome_status='pending' AND snapshot_date <= ?
        """, (cutoff,)).fetchall()
    return [dict(r) for r in rows]


def get_all_snapshots(include_sample: bool = True) -> list[dict]:
    with _conn() as con:
        q = "SELECT * FROM snapshots" if include_sample else "SELECT * FROM snapshots WHERE is_sample=0"
        rows = con.execute(q + " ORDER BY snapshot_date DESC").fetchall()
    return [dict(r) for r in rows]


# ── Summary stats ─────────────────────────────────────────────────────────────

def get_summary_stats() -> dict:
    with _conn() as con:
        all_rows = [dict(r) for r in con.execute("SELECT * FROM snapshots").fetchall()]

    completed      = [r for r in all_rows if r["outcome_status"] == "completed"]
    pending        = [r for r in all_rows if r["outcome_status"] == "pending"]
    real_completed = [r for r in completed if not r["is_sample"]]
    has_real_data  = len(real_completed) > 0

    # Use real-only rows for stats when available; fall back to sample-only.
    # This prevents seeded demo data from inflating or distorting accuracy metrics.
    stat_rows = real_completed if has_real_data else completed

    # ── data_mode ─────────────────────────────────────────────────────────────
    sample_count = len([r for r in completed if r["is_sample"]])
    if not has_real_data:
        data_mode = "sample_only"
    elif sample_count > 0:
        data_mode = "real"          # real data exists; sample rows are ignored in stats
    else:
        data_mode = "real"

    # ── Accuracy (directional) ────────────────────────────────────────────────
    def is_correct(r):
        if r.get("beat_spy_3m") is None:
            return None
        if r["bukra_score"] >= 85:
            return r["beat_spy_3m"] == 1
        if r["bukra_score"] < 70:
            return r["beat_spy_3m"] == 0
        return None

    measurable   = [r for r in stat_rows if is_correct(r) is not None]
    correct      = [r for r in measurable if is_correct(r)]
    accuracy_pct = round(len(correct) / len(measurable) * 100, 1) if measurable else None

    # ── Hit rate ──────────────────────────────────────────────────────────────
    beatables = [r for r in stat_rows if r.get("beat_spy_3m") is not None]
    beats     = [r for r in beatables if r["beat_spy_3m"] == 1]
    hit_rate  = round(len(beats) / len(beatables) * 100, 1) if beatables else None

    # ── Alpha ─────────────────────────────────────────────────────────────────
    alphas        = [r["alpha_3m"] for r in stat_rows if r.get("alpha_3m") is not None]
    avg_alpha     = round(sum(alphas) / len(alphas), 2) if alphas else None
    best_alpha    = max(alphas) if alphas else None
    worst_alpha   = min(alphas) if alphas else None

    last10        = sorted(
        [r for r in stat_rows if r.get("alpha_3m") is not None],
        key=lambda r: r["snapshot_date"], reverse=True,
    )[:10]
    rolling_alpha = round(sum(r["alpha_3m"] for r in last10) / len(last10), 2) if last10 else None

    # ── SPY avg return ────────────────────────────────────────────────────────
    spy_rets = [r["spy_return_3m"] for r in stat_rows if r.get("spy_return_3m") is not None]
    avg_spy  = round(sum(spy_rets) / len(spy_rets), 1) if spy_rets else None

    # ── Score-range breakdown (9 buckets) — real only ─────────────────────────
    _ranges = [
        ("95_100", 95, 101),
        ("90_94",  90,  95),
        ("85_89",  85,  90),
        ("80_84",  80,  85),
        ("75_79",  75,  80),
        ("70_74",  70,  75),
        ("65_69",  65,  70),
        ("60_64",  60,  65),
        ("below60",  0,  60),
    ]

    def range_stats(lo, hi):
        rows       = [r for r in stat_rows if lo <= r["bukra_score"] < hi]
        ret_rows   = [r for r in rows if r.get("return_3m")   is not None]
        alpha_rows = [r for r in rows if r.get("alpha_3m")    is not None]
        beat_rows  = [r for r in rows if r.get("beat_spy_3m") is not None]
        return {
            "count":      len(rows),
            "avg_return": round(sum(r["return_3m"] for r in ret_rows)   / len(ret_rows),   1) if ret_rows   else None,
            "avg_alpha":  round(sum(r["alpha_3m"]  for r in alpha_rows) / len(alpha_rows), 2) if alpha_rows else None,
            "hit_rate":   round(sum(1 for r in beat_rows if r["beat_spy_3m"]) / len(beat_rows) * 100, 1) if beat_rows else None,
        }

    score_ranges = {key: range_stats(lo, hi) for key, lo, hi in _ranges}

    # ── Legacy 4-bucket (PredictionAccuracyCard) — real only ─────────────────
    def bucket_stats(lo, hi):
        rows = [r for r in stat_rows if lo <= r["bukra_score"] < hi and r.get("return_3m") is not None]
        if not rows:
            return {"count": 0, "avg_return": None, "avg_alpha": None, "beat_spy_pct": None}
        avg_ret    = round(sum(r["return_3m"] for r in rows) / len(rows), 1)
        alpha_vals = [r["alpha_3m"] for r in rows if r.get("alpha_3m") is not None]
        avg_a      = round(sum(alpha_vals) / len(alpha_vals), 2) if alpha_vals else None
        beat_pct   = round(sum(1 for r in rows if r.get("beat_spy_3m")) / len(rows) * 100, 1)
        return {"count": len(rows), "avg_return": avg_ret, "avg_alpha": avg_a, "beat_spy_pct": beat_pct}

    # ── Best / worst predictions ── from real data only ───────────────────────
    alpha_sortable = [r for r in stat_rows if r.get("alpha_3m") is not None]
    alpha_sorted   = sorted(alpha_sortable, key=lambda r: r["alpha_3m"], reverse=True)
    best_pred      = _fmt_prediction(alpha_sorted[0])  if alpha_sorted else None
    worst_pred     = _fmt_prediction(alpha_sorted[-1]) if alpha_sorted else None

    # ── Confidence grade ──────────────────────────────────────────────────────
    confidence = _compute_confidence(len(measurable), accuracy_pct)

    # ── Last real scan date ───────────────────────────────────────────────────
    real_pending   = [r for r in pending if not r["is_sample"]]
    real_all       = real_completed + real_pending
    last_real_scan = max((r["snapshot_date"] for r in real_all), default=None)
    real_companies = list({r["ticker"] for r in real_all})

    return {
        # Core metrics — always from real data when available
        "accuracy_pct":       accuracy_pct,
        "hit_rate":           hit_rate,
        "avg_alpha":          avg_alpha,
        "best_alpha":         best_alpha,
        "worst_alpha":        worst_alpha,
        "rolling_alpha":      rolling_alpha,
        "confidence_grade":   confidence,
        # Data source metadata
        "data_mode":          data_mode,
        "has_real_data":      has_real_data,
        "real_count":         len(real_completed),
        "sample_count":       sample_count,
        "completed_count":      len(stat_rows),   # reflects source used for stats
        "pending_count":        len(real_pending) if has_real_data else len(pending),
        "real_pending_count":   len(real_pending),
        "real_companies":       real_companies,
        "measurable_count":     len(measurable),
        "correct_count":        len(correct),
        "last_real_scan":       last_real_scan,
        "minimum_for_accuracy": 10,             # real completed scans needed for meaningful stats
        # SPY benchmark
        "avg_spy_return_3m":  avg_spy,
        # Score buckets
        "buckets": {
            "score_90plus":   bucket_stats(90, 101),
            "score_80_89":    bucket_stats(80,  90),
            "score_70_79":    bucket_stats(70,  80),
            "score_below_70": bucket_stats(0,   70),
        },
        "score_ranges": score_ranges,
        # Best / worst
        "best_prediction":   best_pred,
        "worst_prediction":  worst_pred,
    }


def _compute_confidence(n_measurable: int, accuracy: Optional[float]) -> str:
    """
    Assign a confidence grade based on sample size and measured accuracy.
    Confidence reflects data quantity and directional reliability.
    """
    if n_measurable < 5:
        return "D"
    if n_measurable < 15:
        return "C" if (accuracy or 0) >= 55 else "D"
    if n_measurable < 30:
        return "B" if (accuracy or 0) >= 60 else "C"
    if n_measurable < 60:
        return "A" if (accuracy or 0) >= 65 else "B"
    return "A+" if (accuracy or 0) >= 70 else "A"


def _fmt_prediction(r: Optional[dict]) -> Optional[dict]:
    if not r:
        return None
    return {
        "ticker":        r["ticker"],
        "company_name":  r.get("company_name", ""),
        "sector":        r.get("sector", ""),
        "bukra_score":   r["bukra_score"],
        "return_3m":     r.get("return_3m"),
        "spy_return_3m": r.get("spy_return_3m"),
        "alpha_3m":      r.get("alpha_3m"),
        "beat_spy":      bool(r.get("beat_spy_3m")),
        "snapshot_date": r.get("snapshot_date"),
        "is_sample":     bool(r.get("is_sample")),
    }
