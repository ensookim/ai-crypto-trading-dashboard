# AI Crypto Trading Dashboard

AI 기반 암호화폐 자동매매 시스템과 실시간 트레이딩 대시보드입니다.  
React + Flask 구조로 구성되어 있으며 업비트 API를 활용해 계좌 정보, 가격 데이터, 주문 로그를 실시간으로 시각화합니다.

이 프로젝트는 자동 매매 전략, 실시간 데이터 처리, 프론트엔드 시각화 등을 학습하기 위해 개발하였습니다.

---

# Features

- 실시간 BTC 가격 차트
- AI 가격 예측 데이터 시각화
- 업비트 계좌 잔고 조회
- BTC 보유량 및 원화 환산 표시
- 거래 로그 조회
- 자동매매 전략 기반 예정 주문 표시
- WebSocket 기반 실시간 데이터 업데이트

---

# Tech Stack

## Frontend

- React
- Styled-components
- ECharts
- Axios
- Socket.io-client

## Backend

- Flask
- Flask-SocketIO
- Python

## External APIs

- Upbit Open API

---

# Dashboard

메인 대시보드에서는 다음 정보를 확인할 수 있습니다.

- BTC 가격 차트
- AI 예측 데이터
- 계좌 잔고
- 보유 코인 비율
- 거래 로그
- 수익률 및 평가 손익

---

# Project Structure

```
ai-crypto-trading-dashboard
│
├── backend
│   ├── app.py
│   ├── routes
│   ├── services
│   └── trading_logic
│
├── frontend
│   ├── src
│   │   ├── components
│   │   ├── Chart_modules
│   │   └── pages
│   │
│   └── package.json
│
└── README.md
```

---

# Installation

## 1. Clone repository

```
git clone https://github.com/ensookim/ai-crypto-trading-dashboard.git
cd ai-crypto-trading-dashboard
```

---

## 2. Backend setup

```
cd backend

python -m venv .venv
.venv\Scripts\activate

pip install -r requirements.txt
```

---

## 3. Frontend setup

```
cd frontend
npm install
```

---

# Environment Variables

프로젝트 루트에 `.env` 파일을 생성합니다.

```
UPBIT_ACCESS_KEY=your_access_key
UPBIT_SECRET_KEY=your_secret_key
```

---

# Run Project

## Backend

```
python app.py
```

Backend server

```
http://localhost:5000
```

---

## Frontend

```
npm start
```

Frontend server

```
http://localhost:3000
```

---

# Future Improvements

- 다중 코인 포트폴리오 관리
- 고급 트레이딩 전략
- 리스크 관리 모듈
- 트레이딩 성과 분석
- Docker 기반 배포

---

# Disclaimer

이 프로젝트는 연구 및 학습 목적의 프로젝트이며 실제 투자 손실에 대한 책임은 사용자에게 있습니다.

---

# Author

GitHub  
https://github.com/ensookim
