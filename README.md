# CoinAutomaticTradingSystem (Refactored)

This is a safer, repo-friendly refactor of the original CoinAutomaticTradingSystem.

## What changed (high level)
- Removed hard-coded Upbit keys (uses environment variables)
- Replaced `users.txt` with SQLite (username + bcrypt hash)
- Added safer order scheduling/execution (datetime-based window + price tolerance ratio)
- Simplified min/max planning to an O(n) best-profit scan
- Added basic risk controls (fractional position sizing + max trade cap)
- Added structured backend folder + requirements.txt

## Run backend (dev)
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# copy env and set keys
cp ../.env.example .env
# edit .env and set UPBIT_ACCESS_KEY / UPBIT_SECRET_KEY

python app.py
```

Backend runs on `http://localhost:5000`.

## API
- `GET /api/initial_data`
- Socket.IO event: `data_update`
- Auth:
  - `POST /api/register`
  - `POST /api/login`
  - `POST /api/logout`
  - `GET /api/me`

## Frontend
The original React source is preserved under `frontend_src/`.
Set your API base accordingly in the frontend (see `frontend_src/components/Chart.js`).
