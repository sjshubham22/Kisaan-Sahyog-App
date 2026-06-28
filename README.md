# Kisaan Sahyog — Farmer Advisory System

Kisaan Sahyog is an English-only, multi-agent AI advisory system that provides personalized crop and weather guidance to Indian smallholder farmers through an interactive web-app chatbot. The system leverages Gemini 2.5 Flash for agent orchestration and advisory synthesis, fetching real-time Open-Meteo weather/soil data, and running robust local database queries and APIs.

---

## Getting Started

### 1. Prerequisites
- **Node.js:** Version 20 or later.
- **Gemini API Key:** Already configured in your `.env` file.

### 2. Installation
To install dependencies for both the Backend server and the React frontend client, run:
```bash
npm run install-all
```

### 3. Run Locally (Development Mode)
Start the backend and React client concurrently:
```bash
npm run dev-all
```
This command starts:
- The Express Backend on [http://localhost:3000](http://localhost:3000)
- The React Frontend (Vite) on [http://localhost:5173](http://localhost:5173)

Open your browser at `http://localhost:5173` to interact with Kisaan Sahyog!

---

## Directory Structure

```
kisaan-sahyog/
├── package.json               # Root scripts & dependencies
├── .env                       # API keys & configurations
├── kisaan_sahyog_db.json      # Local JSON-file database
│
├── src/                       # Backend Express Server
│   ├── index.js               # Entry point
│   ├── db.js                  # Database models & seeding
│   ├── routes/                # Express API endpoints
│   │   ├── chat.js            # Chatbot query routing
│   │   └── farmer.js          # Farmer profile & alerts CRUD
│   ├── agents/                # AI Agents (Orchestrator, Crop, Weather)
│   ├── services/              # API Client wrappers (Gemini, OpenMeteo, mocks)
│   ├── thresholds/            # Weather threshold rules evaluator
│   ├── middleware/            # Auth, Rate limiting, Validation
│   └── utils/                 # Coordinate lookup & cache utilities
│
└── client/                    # React Frontend (Vite)
    ├── src/
    │   ├── App.jsx            # Sleek chat & settings layout
    │   └── index.css          # Glassmorphic, agricultural CSS system
    └── package.json           # Frontend dependencies
```

---

## Key Features & Design Details

- **Multitasking Agents:** Uses Gemini 2.5 Flash (`gemini-2.5-flash`) to parse user queries, route to specialized agents in parallel, and synthesize detailed, cohesive responses.
- **Live Soil & Forecast Data:** Connects directly to Open-Meteo API to obtain real-time soil moisture and evapotranspiration (ET0) profiles.
- **Transition-Ready Mocks:** Integrates mock clients for `data.gov.in` (ICAR and MSP prices) and `NDMA Sachet` warnings. Simply configure the real keys in your `.env` to switch to live production feeds.
- **Robust Guardrails:** Blocks non-agricultural inquiries automatically (e.g., general knowledge, politics, coding) with a friendly fallback notification.
- **Sleek Agricultural Aesthetics:** Visual experience inspired by organic styling with forest green panels, warm amber cards, notification bubbles, and sliding drawer transitions.
