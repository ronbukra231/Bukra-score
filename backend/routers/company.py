import threading
from fastapi import APIRouter, HTTPException, Query
from services.yahoo_finance import get_company_info, get_five_year_financials, search_companies
from services.bukra_score import compute_bukra_score
from services.ai_explanation import get_hebrew_explanation
from services.accuracy_db import save_snapshot

router = APIRouter(prefix="/api", tags=["company"])


def _save_snapshot_bg(info: dict, score_data: dict):
    """Fire-and-forget: save a score snapshot without blocking the response."""
    def _run():
        try:
            score = score_data.get("score")
            if score is None:
                return
            save_snapshot(
                ticker=info.get("symbol", ""),
                company_name=info.get("name", ""),
                sector=info.get("sector", ""),
                bukra_score=int(score),
                price_at_score=info.get("price"),
            )
        except Exception as e:
            print(f"[accuracy] snapshot save failed: {e}")
    threading.Thread(target=_run, daemon=True).start()


@router.get("/search")
def search(q: str = Query(..., min_length=1)):
    results = search_companies(q)
    if not results:
        raise HTTPException(status_code=404, detail="לא נמצאו תוצאות")
    return results


@router.get("/company/{symbol}")
def company_overview(symbol: str):
    info = get_company_info(symbol)
    if not info.get("name"):
        raise HTTPException(status_code=404, detail=f"הסימבול {symbol} לא נמצא")
    return info


@router.get("/company/{symbol}/financials")
def company_financials(symbol: str):
    data = get_five_year_financials(symbol)
    if not data or not data.get("history"):
        raise HTTPException(status_code=404, detail="אין נתונים פיננסיים")
    return data


@router.get("/company/{symbol}/score")
def company_score(symbol: str):
    info = get_company_info(symbol)
    financials = get_five_year_financials(symbol)
    return compute_bukra_score(financials, info)


@router.get("/company/{symbol}/explain")
def company_explain(symbol: str):
    info = get_company_info(symbol)
    financials = get_five_year_financials(symbol)
    score_data = compute_bukra_score(financials, info)
    return get_hebrew_explanation(info, financials, score_data)


@router.get("/company/{symbol}/full")
def company_full(symbol: str):
    info = get_company_info(symbol)
    financials = get_five_year_financials(symbol)
    score_data = compute_bukra_score(financials, info)

    # Save snapshot asynchronously — never blocks or crashes the response
    _save_snapshot_bg(info, score_data)

    return {
        "info": info,
        "financials": financials,
        "score": score_data,
    }
