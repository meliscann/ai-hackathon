# 🚀 KOBİ Pilot — AI Destekli Operasyon Asistanı

KOBİ Pilot, küçük ve orta ölçekli işletmelerin günlük operasyonlarını yapay zeka ile otomatize eden bir web uygulamasıdır. Sipariş takibi, stok yönetimi ve müşteri sorguları tek bir akıllı arayüzden yönetilir.

## 🎯 Çözdüğü Problem

Küçük işletme sahipleri günde 2-3 saatini "siparişim nerede?", "bu ürün stokta var mı?" gibi rutin soruları yanıtlamaya harcıyor. KOBİ Pilot bu yükü ortadan kaldırır:

- Doğal dil ile sipariş sorgulama
- Otomatik kritik stok uyarıları
- Günlük operasyon özeti (tek tıkla)
- Gerçek zamanlı dashboard

## 🏗️ Mimari

```
┌─────────────────────────────────────────────────────┐
│             Streamlit Frontend (app.py)             │
│    Chat UI │ Sipariş Tablosu │ Stok Dashboard       │
└───────────────────┬─────────────────────────────────┘
                    │ HTTP (REST)
┌───────────────────▼─────────────────────────────────┐
│              FastAPI Backend (main.py)              │
│         /chat  /dashboard  /orders  /products       │
└───────────────────┬─────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────┐
│           Gemini Agent (agent.py)                   │
│   Otomatik Function Calling — 5 araç                │
│   • siparis_durumu_sorgula                          │
│   • siparisleri_listele                             │
│   • stok_durumu_kontrol                             │
│   • gunluk_ozet_getir                               │
│   • urun_ara                                        │
└───────────────────┬─────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────┐
│              SQLite (kobi_pilot.db)                 │
│          products table │ orders table              │
└─────────────────────────────────────────────────────┘
```

## 🛠️ Kullanılan Teknolojiler

| Katman    | Teknoloji                        |
|-----------|----------------------------------|
| Backend   | FastAPI + Python                 |
| AI / LLM  | Google Gemini 1.5 Flash          |
| Agent     | Gemini Automatic Function Calling|
| Frontend  | Streamlit                        |
| Veritabanı| SQLite                           |

## ⚙️ Kurulum

### 1. Gereksinimler

```bash
git clone https://github.com/<kullanici>/kobi-pilot.git
cd kobi-pilot
pip install -r requirements.txt
```

### 2. API Anahtarı

```bash
cp .env.example .env
# .env dosyasını aç ve GEMINI_API_KEY değerini gir
```

Gemini API anahtarı almak için: https://aistudio.google.com/app/apikey

### 3. Çalıştırma

**Terminal 1 — Backend:**
```bash
uvicorn main:app --reload --port 8000
```

**Terminal 2 — Frontend:**
```bash
streamlit run app.py
```

Uygulama `http://localhost:8501` adresinde açılır.

## 💡 Örnek Kullanım Senaryoları

```
"101 numaralı siparişim nerede?"
"Bugünkü operasyon özetini ver"
"Kritik stokta olan ürünleri listele"
"Bekleyen siparişleri göster"
"Zeytinyağı stoğu ne durumda?"
```

## 📁 Proje Yapısı

```
kobi-pilot/
├── main.py          # FastAPI endpoints
├── agent.py         # Gemini agent + session yönetimi
├── tools.py         # Agent araçları (function calling)
├── database.py      # SQLite init + örnek veri
├── app.py           # Streamlit arayüzü
├── requirements.txt
├── .env.example
└── README.md
```

## 👥 Yapay Zeka Yaklaşımı

Projede **agent mimarisi** kullanılmıştır. Gemini 1.5 Flash modeli, kullanıcının doğal dildeki talebini anlayarak uygun araçları otomatik olarak çağırır (Automatic Function Calling). Model, kullanıcıya yanıt üretmeden önce gerekli veritabanı sorgularını arka planda gerçekleştirir — insan müdahalesi olmadan uçtan uca işlem tamamlanır.

## 📋 Hackathon Kapsamı

Bu proje AI Hackathon için geliştirilmiştir ve şu alanları kapsar:
- ✅ Müşteri iletişiminin otomasyonu
- ✅ Ürün ve sipariş takibi
- ✅ Stok ve envanter yönetimi
- ✅ İş akışı ve görev yönetimi (günlük özet)
