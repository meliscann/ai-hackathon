"""
Agent araçları — Gemini function calling için standalone fonksiyonlar.
Her fonksiyon doğrudan SQLite'a bağlanır ve dict döner.
"""

import sqlite3
from datetime import datetime
from typing import Optional

DB_PATH = "kobi_pilot.db"


def _conn():
    return sqlite3.connect(DB_PATH)


# ─────────────────────────────────────────────
# 1. Sipariş durumu sorgula
# ─────────────────────────────────────────────
def siparis_durumu_sorgula(siparis_id: int) -> dict:
    """
    Belirtilen sipariş numarasına ait güncel durum, kargo takip numarası,
    müşteri adı ve teslimat bilgilerini getirir.
    """
    conn = _conn()
    c = conn.cursor()
    c.execute(
        """
        SELECT o.id, o.customer_name, o.customer_phone, p.name,
               o.quantity, o.total_price, o.status,
               o.cargo_tracking, o.created_at, o.estimated_delivery
        FROM orders o
        JOIN products p ON o.product_id = p.id
        WHERE o.id = ?
        """,
        (siparis_id,),
    )
    row = c.fetchone()
    conn.close()

    if not row:
        return {"hata": f"#{siparis_id} numaralı sipariş bulunamadı."}

    return {
        "sipariş_no":        row[0],
        "müşteri":           row[1],
        "telefon":           row[2],
        "ürün":              row[3],
        "miktar":            row[4],
        "tutar":             f"{row[5]:.2f} TL",
        "durum":             row[6],
        "kargo_takip":       row[7] or "Henüz kargoya verilmedi",
        "sipariş_tarihi":    row[8],
        "tahmini_teslimat":  row[9],
    }


# ─────────────────────────────────────────────
# 2. Sipariş listesi
# ─────────────────────────────────────────────
def siparisleri_listele(durum: Optional[str] = None, limit: int = 10) -> dict:
    """
    Siparişleri listeler.
    durum parametresi: 'beklemede', 'hazırlanıyor', 'kargoda', 'teslim edildi', 'iptal'
    veya None (tüm siparişler).
    """
    conn = _conn()
    c = conn.cursor()

    base_sql = """
        SELECT o.id, o.customer_name, p.name, o.quantity, o.total_price, o.status, o.created_at
        FROM orders o
        JOIN products p ON o.product_id = p.id
        {where}
        ORDER BY o.created_at DESC LIMIT ?
    """

    if durum:
        c.execute(base_sql.format(where="WHERE o.status = ?"), (durum, limit))
    else:
        c.execute(base_sql.format(where=""), (limit,))

    rows = c.fetchall()
    conn.close()

    return {
        "siparişler": [
            {
                "no":      r[0],
                "müşteri": r[1],
                "ürün":    r[2],
                "miktar":  r[3],
                "tutar":   f"{r[4]:.2f} TL",
                "durum":   r[5],
                "tarih":   r[6],
            }
            for r in rows
        ],
        "toplam": len(rows),
    }


# ─────────────────────────────────────────────
# 3. Stok kontrolü
# ─────────────────────────────────────────────
def stok_durumu_kontrol(sadece_kritik: bool = False) -> dict:
    """
    Ürün stok seviyelerini döner.
    sadece_kritik=True ise yalnızca minimum stok eşiğinin altındaki ürünleri listeler.
    """
    conn = _conn()
    c = conn.cursor()

    if sadece_kritik:
        c.execute(
            "SELECT name, category, stock, min_stock, unit, price FROM products WHERE stock <= min_stock ORDER BY stock ASC"
        )
    else:
        c.execute(
            "SELECT name, category, stock, min_stock, unit, price FROM products ORDER BY stock ASC"
        )

    rows = c.fetchall()
    conn.close()

    items = [
        {
            "ürün":      r[0],
            "kategori":  r[1],
            "stok":      f"{r[2]} {r[4]}",
            "min_stok":  f"{r[3]} {r[4]}",
            "durum":     "KRİTİK" if r[2] <= r[3] else "Normal",
            "fiyat":     f"{r[5]:.2f} TL",
        }
        for r in rows
    ]

    return {
        "ürünler":            items,
        "kritik_ürün_sayısı": sum(1 for p in items if p["durum"] == "KRİTİK"),
    }


# ─────────────────────────────────────────────
# 4. Günlük özet
# ─────────────────────────────────────────────
def gunluk_ozet_getir() -> dict:
    """
    Bugünkü sipariş sayısı, ciro, tüm siparişlerin durum dağılımı,
    kritik stoklar ve bekleyen sipariş sayısını özetler.
    """
    conn = _conn()
    c = conn.cursor()
    today = datetime.now().strftime("%Y-%m-%d")

    c.execute(
        "SELECT COUNT(*), COALESCE(SUM(total_price), 0) FROM orders WHERE created_at LIKE ?",
        (f"{today}%",),
    )
    cnt, rev = c.fetchone()

    c.execute("SELECT status, COUNT(*) FROM orders GROUP BY status")
    dist = {r[0]: r[1] for r in c.fetchall()}

    c.execute("SELECT name FROM products WHERE stock <= min_stock")
    kritik_urunler = [r[0] for r in c.fetchall()]

    conn.close()

    return {
        "tarih":              today,
        "yeni_sipariş":       cnt,
        "günlük_ciro":        f"{rev:.2f} TL",
        "durum_dağılımı":     dist,
        "kritik_stok_sayısı": len(kritik_urunler),
        "kritik_ürünler":     kritik_urunler,
        "bekleyen_sipariş":   dist.get("beklemede", 0),
        "kargoda_sipariş":    dist.get("kargoda", 0),
    }


# ─────────────────────────────────────────────
# 5. Ürün ara
# ─────────────────────────────────────────────
def urun_ara(urun_adi: str) -> dict:
    """
    Ürün adına göre stok ve fiyat bilgisi arar. Kısmi eşleşme desteklenir.
    """
    conn = _conn()
    c = conn.cursor()
    c.execute(
        "SELECT name, category, stock, min_stock, unit, price FROM products WHERE name LIKE ?",
        (f"%{urun_adi}%",),
    )
    rows = c.fetchall()
    conn.close()

    if not rows:
        return {"hata": f"'{urun_adi}' ile eşleşen ürün bulunamadı."}

    return {
        "ürünler": [
            {
                "ad":       r[0],
                "kategori": r[1],
                "stok":     f"{r[2]} {r[4]}",
                "durum":    "KRİTİK" if r[2] <= r[3] else "Normal",
                "fiyat":    f"{r[5]:.2f} TL",
            }
            for r in rows
        ]
    }
