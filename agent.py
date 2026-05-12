"""
KOBİ Pilot — Gemini tabanlı ajan.
Otomatik function calling ile tools.py'deki araçları kullanır.
"""

import os
import google.generativeai as genai
from dotenv import load_dotenv

from tools import (
    siparis_durumu_sorgula,
    siparisleri_listele,
    stok_durumu_kontrol,
    gunluk_ozet_getir,
    urun_ara,
)

load_dotenv()

SYSTEM_PROMPT = """Sen KOBİ Pilot'sun — küçük ve orta ölçekli işletmelerin yapay zeka destekli operasyon asistanısın.

Türkçe konuşursun. Samimi, hızlı ve net yanıtlar verirsin; gereksiz uzatmadan asıl bilgiyi öne çıkarırsın.

Sahip olduğun araçlar:
• siparis_durumu_sorgula  → belirli bir siparişin detayını getirir
• siparisleri_listele     → tüm veya filtrelenmiş sipariş listesi
• stok_durumu_kontrol     → ürün stoklarını kontrol eder
• gunluk_ozet_getir       → günün operasyon özetini üretir
• urun_ara                → ürün adına göre arama yapar

Kritik stok veya çok sayıda bekleyen sipariş tespit ettiğinde daima vurgula ve işletme sahibine somut aksiyon öner.
Yanıtlarını kısa ve profesyonel tut."""

TOOLS = [
    siparis_durumu_sorgula,
    siparisleri_listele,
    stok_durumu_kontrol,
    gunluk_ozet_getir,
    urun_ara,
]


class KobiAgent:
    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY ortam değişkeni tanımlı değil. .env dosyasını kontrol et.")

        genai.configure(api_key=api_key)

        self._model = genai.GenerativeModel(
            model_name="gemini-flash-latest",
            tools=TOOLS,
            system_instruction=SYSTEM_PROMPT,
        )

        # session_id → chat nesnesi
        self._sessions: dict = {}

    # ── public API ──────────────────────────────────────────────────────────

    def chat(self, session_id: str, message: str) -> str:
        """Kullanıcı mesajını işler ve yanıt döner."""
        session = self._get_or_create(session_id)
        response = session.send_message(message)
        return response.text

    def reset(self, session_id: str) -> None:
        """Oturumu sıfırlar (konuşma geçmişi temizlenir)."""
        self._sessions.pop(session_id, None)

    def generate_action(self, product_name: str, quantity: int) -> str:
        """Tedarikçiye stok talebi için e-posta taslağı oluşturur."""
        prompt = f"Şu ürünün stoğu kritik seviyeye düştü: {product_name}. Acil olarak tedarikçiye atılacak resmi, kısa ve net bir e-posta taslağı hazırla. {quantity} adet sipariş geçmek istiyoruz. Konu başlığı dahil olsun. Merhaba diyerek başla."
        response = self._model.generate_content(prompt)
        return response.text

    # ── private ─────────────────────────────────────────────────────────────

    def _get_or_create(self, session_id: str):
        if session_id not in self._sessions:
            self._sessions[session_id] = self._model.start_chat(
                enable_automatic_function_calling=True
            )
        return self._sessions[session_id]
