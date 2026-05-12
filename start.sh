#!/bin/bash

echo "🚀 Uygulama başlatılıyor (Backend ve Frontend)..."

# Backend'i arka planda başlat
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!

# Terminal kapatıldığında veya Ctrl+C yapıldığında backend'i de kapat (arkada açık kalmaması için)
trap "kill $BACKEND_PID 2>/dev/null" EXIT

# Frontend'i başlat
echo "Modern Web Frontend başlatılıyor..."
cd frontend && npm run dev
