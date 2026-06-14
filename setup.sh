#!/bin/bash
set -e

echo "🚀 Ron AI Capital — Setup"
echo ""

# ── Backend ──────────────────────────────────────────────────────────────────
echo "📦 Setting up Python backend..."
cd backend

if ! command -v python3 &>/dev/null; then
  echo "❌ Python3 not found. Install from https://python.org"
  exit 1
fi

python3 -m venv venv
source venv/bin/activate
pip install -q --upgrade pip
pip install -q -r requirements.txt

if [ ! -f .env ]; then
  cp .env.example .env
  echo ""
  echo "⚠️  Created backend/.env — add your ANTHROPIC_API_KEY there."
  echo ""
fi

cd ..

# ── Frontend ─────────────────────────────────────────────────────────────────
echo "📦 Setting up Node frontend..."
cd frontend

if ! command -v node &>/dev/null; then
  echo "❌ Node.js not found. Install from https://nodejs.org"
  exit 1
fi

npm install

cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "To run the app:"
echo "  Terminal 1 (backend):  cd backend && source venv/bin/activate && uvicorn main:app --reload"
echo "  Terminal 2 (frontend): cd frontend && npm run dev"
echo ""
echo "Then open: http://localhost:5173"
