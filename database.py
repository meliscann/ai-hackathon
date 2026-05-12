import sqlite3
from datetime import datetime, timedelta
import random

DB_PATH = "kobi_pilot.db"


def get_connection():
    return sqlite3.connect(DB_PATH)


def init_db():
    conn = get_connection()
    c = conn.cursor()

    c.execute("""
        CREATE TABLE IF NOT EXISTS products (
            id       INTEGER PRIMARY KEY,
            name     TEXT NOT NULL,
            category TEXT,
            price    REAL,
            stock    INTEGER,
            min_stock INTEGER,
            unit     TEXT DEFAULT 'adet'
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS orders (
            id                INTEGER PRIMARY KEY,
            customer_name     TEXT,
            customer_phone    TEXT,
            product_id        INTEGER,
            quantity          INTEGER,
            total_price       REAL,
            status            TEXT,
            cargo_tracking    TEXT,
            created_at        TEXT,
            estimated_delivery TEXT,
            lat               REAL,
            lng               REAL,
            FOREIGN KEY (product_id) REFERENCES products(id)
        )
    """)

    conn.commit()
    conn.close()


def seed_data():
    conn = get_connection()
    c = conn.cursor()

    c.execute("SELECT COUNT(*) FROM products")
    if c.fetchone()[0] > 0:
        conn.close()
        return

    products = [
        ("Organik Domates",         "Sebze",          45.0,  120, 50,  "kg"),
        ("Çilek Reçeli 350g",        "Konserve",        85.0,   8,  15, "adet"),   # kritik
        ("Zeytinyağı 1L",            "Yağ",            250.0,  45,  20, "şişe"),
        ("Organik Bal 500g",         "Arı Ürünleri",   180.0,  12,  20, "kavanoz"),# kritik
        ("Tam Buğday Unu 1kg",       "Tahıl",           35.0, 200,  50, "paket"),
        ("El Yapımı Lavanta Sabunu", "Kişisel Bakım",   65.0,  30,  25, "adet"),
        ("Organik Yumurta (12'li)",  "Süt & Yumurta",   75.0,  60,  30, "kutu"),
        ("Ceviz İçi 250g",           "Kuruyemiş",      120.0,   5,  10, "paket"),  # kritik
        ("Kuru İncir 500g",          "Kuruyemiş",       95.0,  80,  30, "paket"),
        ("Organik Nohut 1kg",        "Bakliyat",        55.0, 150,  50, "paket"),
        ("Tarhana Çorbası 500g",     "Hazır Gıda",      70.0,  40,  20, "paket"),
        ("Doğal Çiçek Balı 1kg",     "Arı Ürünleri",   320.0,   9,  15, "kavanoz"),# kritik
    ]

    c.executemany(
        "INSERT INTO products (name, category, price, stock, min_stock, unit) VALUES (?,?,?,?,?,?)",
        products,
    )

    customers = [
        ("Ayşe Kaya",      "0532 111 2233"),
        ("Mehmet Yılmaz",  "0541 333 4455"),
        ("Fatma Demir",    "0555 666 7788"),
        ("Ali Çelik",      "0544 999 0011"),
        ("Zeynep Arslan",  "0533 222 3344"),
    ]
    statuses = ["beklemede", "beklemede", "hazırlanıyor", "kargoda", "kargoda", "teslim edildi", "teslim edildi", "teslim edildi"]
    cargo_cos = ["A-Kargo", "B-Kargo", "C-Kargo", "D-Kargo"]

    now = datetime.now()
    orders = []
    for i in range(22):
        cust = random.choice(customers)
        pid  = random.randint(1, 12)
        qty  = random.randint(1, 5)

        c.execute("SELECT price FROM products WHERE id=?", (pid,))
        price = c.fetchone()[0]

        status   = random.choice(statuses)
        days_ago = random.randint(0, 6)
        created  = (now - timedelta(days=days_ago, hours=random.randint(0, 23))).strftime("%Y-%m-%d %H:%M")
        delivery = (now + timedelta(days=random.randint(1, 4))).strftime("%Y-%m-%d")

        cargo = None
        if status in ("kargoda", "teslim edildi"):
            cargo = f"{random.choice(cargo_cos)}-{random.randint(100000, 999999)}"

        lat = random.uniform(36.5, 41.5)
        lng = random.uniform(27.0, 44.0)

        orders.append((100 + i + 1, cust[0], cust[1], pid, qty,
                       round(price * qty, 2), status, cargo, created, delivery, lat, lng))

    c.executemany(
        """INSERT INTO orders
           (id, customer_name, customer_phone, product_id, quantity,
            total_price, status, cargo_tracking, created_at, estimated_delivery, lat, lng)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
        orders,
    )

    conn.commit()
    conn.close()
    print("✅ Veritabanı hazır ve örnek veri yüklendi.")
