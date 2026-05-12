"""
KOBİ Pilot — FastAPI backend
Çalıştır: uvicorn main:app --reload --port 8000
"""

import sqlite3
from datetime import datetime

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from database import init_db, seed_data
from agent import KobiAgent

# ── App ─────────────────────────────────────────────────────────────────────
app = FastAPI(title="KOBİ Pilot API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

agent = KobiAgent()


@app.on_event("startup")
def startup():
    init_db()
    seed_data()


# ── Schemas ──────────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str
    session_id: str = "default"


class ChatResponse(BaseModel):
    response: str


# ── Chat ─────────────────────────────────────────────────────────────────────
@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    try:
        reply = agent.chat(req.session_id, req.message)
        return ChatResponse(response=reply)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/reset/{session_id}")
def reset_session(session_id: str):
    agent.reset(session_id)
    return {"status": "ok"}


class ActionRequest(BaseModel):
    product_name: str
    quantity: int = 50

@app.post("/generate-action")
def generate_action(req: ActionRequest):
    try:
        reply = agent.generate_action(req.product_name, req.quantity)
        return {"action_text": reply}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Dashboard ────────────────────────────────────────────────────────────────
@app.get("/dashboard")
def dashboard():
    conn = sqlite3.connect("kobi_pilot.db")
    c = conn.cursor()
    today = datetime.now().strftime("%Y-%m-%d")

    c.execute(
        "SELECT COUNT(*), COALESCE(SUM(total_price), 0) FROM orders WHERE created_at LIKE ?",
        (f"{today}%",),
    )
    today_cnt, today_rev = c.fetchone()

    c.execute("SELECT COUNT(*) FROM orders WHERE status='beklemede'")
    pending = c.fetchone()[0]

    c.execute("SELECT COUNT(*) FROM products WHERE stock <= min_stock")
    low_stock = c.fetchone()[0]

    c.execute("SELECT COUNT(*) FROM orders WHERE status='kargoda'")
    in_cargo = c.fetchone()[0]

    c.execute("SELECT status, COUNT(*) FROM orders GROUP BY status")
    status_dist = {r[0]: r[1] for r in c.fetchall()}

    conn.close()

    return {
        "today_orders":      today_cnt,
        "today_revenue":     round(today_rev, 2),
        "pending_orders":    pending,
        "low_stock_count":   low_stock,
        "in_cargo":          in_cargo,
        "status_distribution": status_dist,
    }


# ── Orders ───────────────────────────────────────────────────────────────────
@app.get("/orders")
def get_orders(status: str = None, limit: int = 50):
    conn = sqlite3.connect("kobi_pilot.db")
    c = conn.cursor()

    sql = """
        SELECT o.id, o.customer_name, p.name, o.quantity, o.total_price,
               o.status, o.cargo_tracking, o.created_at, o.estimated_delivery, o.lat, o.lng
        FROM orders o
        JOIN products p ON o.product_id = p.id
        {where}
        ORDER BY o.created_at DESC LIMIT ?
    """
    if status:
        c.execute(sql.format(where="WHERE o.status=?"), (status, limit))
    else:
        c.execute(sql.format(where=""), (limit,))

    rows = c.fetchall()
    conn.close()

    return [
        {
            "id":       r[0], "customer": r[1], "product": r[2],
            "quantity": r[3], "total":    round(r[4], 2), "status": r[5],
            "tracking": r[6], "created":  r[7], "delivery": r[8],
            "lat":      r[9], "lng":      r[10],
        }
        for r in rows
    ]


# ── Analytics & Forecast ───────────────────────────────────────────────────────
@app.get("/analytics")
def get_analytics():
    conn = sqlite3.connect("kobi_pilot.db")
    c = conn.cursor()

    c.execute("SELECT status, COUNT(*) FROM orders GROUP BY status")
    status_dist = {r[0]: r[1] for r in c.fetchall()}

    c.execute("""
        SELECT date(created_at) as d, COUNT(*) as cnt
        FROM orders
        GROUP BY d
        ORDER BY d DESC LIMIT 7
    """)
    daily_traffic = [{"date": r[0], "orders": r[1]} for r in c.fetchall()]
    daily_traffic.reverse()
    
    conn.close()
    return {"status_distribution": status_dist, "daily_traffic": daily_traffic}

@app.get("/forecast")
def get_forecast():
    conn = sqlite3.connect("kobi_pilot.db")
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM orders WHERE created_at >= date('now', '-7 days')")
    last_7_days = c.fetchone()[0]
    conn.close()

    forecast_orders = int(last_7_days * 1.15)
    return {
        "forecast_message": f"Gelecek hafta {forecast_orders} sipariş bekleniyor.",
        "forecast_orders": forecast_orders,
        "growth": "15%"
    }


# ── Products ─────────────────────────────────────────────────────────────────
@app.get("/products")
def get_products():
    conn = sqlite3.connect("kobi_pilot.db")
    c = conn.cursor()
    c.execute(
        "SELECT id, name, category, price, stock, min_stock, unit FROM products ORDER BY stock ASC"
    )
    rows = c.fetchall()
    conn.close()

    return [
        {
            "id": r[0], "name": r[1], "category": r[2],
            "price": r[3], "stock": r[4], "min_stock": r[5],
            "unit": r[6], "low": r[4] <= r[5],
        }
        for r in rows
    ]
