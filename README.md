# KOBİ Pilot — AI Destekli Operasyon Asistanı

KOBİ Pilot, küçük ve orta ölçekli işletmelerin günlük operasyonlarını yapay zeka ile otomatize eden bir web uygulamasıdır. Sipariş takibi, stok yönetimi ve müşteri sorguları tek bir akıllı arayüzden yönetilir.

## Çözdüğü Problem

Küçük işletme sahipleri günde 2-3 saatini "siparişim nerede?", "bu ürün stokta var mı?" gibi rutin soruları yanıtlamaya harcıyor. KOBİ Pilot bu yükü ortadan kaldırır:

- Doğal dil ile sipariş ve stok sorgulama
- Otomatik kritik stok uyarıları + gerçek zamanlı WebSocket bildirimleri
- Günlük operasyon özeti (proaktif AI — sayfa açılışında otomatik)
- AI destekli tedarikçi e-posta taslağı
- Dashboard üzerinden sipariş durumu güncelleme
- Ürün ekleme ve stok düzenleme formları
- Müşteri segmentasyonu (VIP / Sadık / Yeni)
- Tek tıkla Excel rapor indirme (siparişler + stok + müşteriler)
- Gerçek zamanlı dashboard, harita ve grafikler

## Mimari

```
┌──────────────────────────────────────────────────────────────┐
│              Vite + Vanilla JS Frontend                      │
│  Dashboard │ Siparişler │ Stok │ Müşteriler │ AI Chat        │
└───────────────────┬──────────────────────────────────────────┘
          HTTP (REST) │  ╔═══════╗  ws://localhost:8000/ws
                      │  ║  WS  ║◄──── Gerçek zamanlı bildirim
┌─────────────────────▼──╚═══════╝────────────────────────────┐
│                  FastAPI Backend (main.py)                   │
│  /chat  /dashboard  /orders  /products  /customers          │
│  /analytics  /forecast  /generate-action  /report/excel     │
│  PATCH /orders/{id}/status  POST /products                  │
│  PATCH /products/{id}/stock                                  │
└───────────────────┬─────────────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────────────┐
│              Gemini Agent (agent.py)                        │
│   Otomatik Function Calling — 5 araç                        │
│   • siparis_durumu_sorgula  • siparisleri_listele           │
│   • stok_durumu_kontrol     • gunluk_ozet_getir             │
│   • urun_ara                                                │
└───────────────────┬─────────────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────────────┐
│              SQLite (kobi_pilot.db)                         │
│          products table │ orders table                      │
└─────────────────────────────────────────────────────────────┘
```

## Kullanılan Teknolojiler

| Katman     | Teknoloji                         |
|------------|-----------------------------------|
| Backend    | FastAPI + Python                  |
| AI / LLM   | Google Gemini Flash               |
| Agent      | Gemini Automatic Function Calling |
| Frontend   | Vite + Vanilla JS + Tailwind CSS  |
| Grafikler  | Chart.js                          |
| Harita     | Leaflet.js                        |
| Veritabanı | SQLite                            |
| Rapor      | openpyxl (Excel)                  |
| Realtime   | WebSocket (FastAPI native)        |

## Kurulum

### 1. Gereksinimler

```bash
git clone https://github.com/<kullanici>/kobi-pilot.git
cd kobi-pilot
pip install -r requirements.txt
cd frontend && npm install && cd ..
```

### 2. API Anahtarı

```bash
# .env dosyası oluştur ve GEMINI_API_KEY değerini gir
echo "GEMINI_API_KEY=your_key_here" > .env
```

Gemini API anahtarı almak için: https://aistudio.google.com/app/apikey

### 3. Çalıştırma

**Tek komutla (önerilen):**
```bash
./start.sh
```

**Manuel olarak:**

Terminal 1 — Backend:
```bash
uvicorn main:app --reload --port 8000
```

Terminal 2 — Frontend:
```bash
cd frontend && npm run dev
```

Frontend `http://localhost:5173`, API `http://localhost:8000` adresinde açılır.

## Örnek Kullanım Senaryoları

```
"101 numaralı siparişim nerede?"
"Bugünkü operasyon özetini ver"
"Kritik stokta olan ürünleri listele"
"Bekleyen siparişleri göster"
"Zeytinyağı stoğu ne durumda?"
```

## Proje Yapısı

```
kobi-pilot/
├── main.py          # FastAPI endpoint'leri + WebSocket
├── agent.py         # Gemini agent + session yönetimi
├── tools.py         # Agent araçları (function calling)
├── database.py      # SQLite init + örnek veri
├── start.sh         # Backend + frontend tek seferde başlat
├── requirements.txt
├── .env
├── frontend/
│   ├── index.html   # Ana HTML (Dashboard, Siparişler, Stok, Müşteriler panelleri + modaller)
│   ├── main.js      # UI mantığı, WebSocket, API çağrıları, chat
│   ├── style.css    # Tailwind v4 tabanlı stiller
│   └── vite.config.js
└── README.md
```

## Yapay Zeka Yaklaşımı

Projede **agent mimarisi** kullanılmıştır. Gemini Flash modeli, kullanıcının doğal dildeki talebini anlayarak uygun araçları otomatik olarak çağırır (Automatic Function Calling). Model, kullanıcıya yanıt üretmeden önce gerekli veritabanı sorgularını arka planda gerçekleştirir — insan müdahalesi olmadan uçtan uca işlem tamamlanır.

**Proaktif AI:** Sayfa açılışında asistan otomatik olarak günlük özet ve kritik uyarıları getirir; kullanıcı hiçbir şey yazmadan bilgilendirilir.

**Chat-to-Action:** Chatbot yanıtında "kritik stok" geçiyorsa stok paneli, "müşteri" geçiyorsa müşteri paneli otomatik açılır. Tedarikçi e-postası için de anlık öneri butonu çıkar.

`generate_action` metodu, kritik stok durumlarında Gemini'yi direkt kullanarak tedarikçiye gönderilmek üzere e-posta taslağı oluşturur.

## API Endpoint Listesi

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| POST | `/chat` | AI asistan mesajı |
| GET | `/dashboard` | Metrik özeti |
| GET | `/orders` | Sipariş listesi |
| PATCH | `/orders/{id}/status` | Sipariş durumu güncelle |
| GET | `/products` | Ürün listesi |
| POST | `/products` | Yeni ürün ekle |
| PATCH | `/products/{id}/stock` | Stok miktarı güncelle |
| GET | `/customers` | Müşteri segmentasyonu |
| GET | `/analytics` | Grafik verileri |
| GET | `/forecast` | AI tahmin |
| GET | `/report/excel` | Excel rapor indir |
| POST | `/generate-action` | Tedarikçi e-posta taslağı |
| WS | `/ws` | Gerçek zamanlı bildirimler |

## Hackathon Kapsamı

Bu proje AI Hackathon için geliştirilmiştir ve şu alanları kapsar:
- Müşteri iletişiminin otomasyonu (chat + proaktif AI)
- Ürün ve sipariş takibi (arama, filtreleme, durum güncelleme)
- Stok ve envanter yönetimi (ekleme, güncelleme, kritik uyarılar)
- Müşteri segmentasyonu (VIP / Sadık / Yeni)
- İş akışı ve görev yönetimi (günlük özet, AI forecast, Excel rapor)
- Gerçek zamanlı bildirimler (WebSocket)
