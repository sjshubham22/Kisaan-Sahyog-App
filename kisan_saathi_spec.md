# Kisan Saathi — Farmer Advisory System
## Technical Specification for Development

> **Version:** 1.0  
> **Scope:** Crop Advisory Agent + Weather Alert Agent  
> **Input / Output channel:** In-app chatbot only  
> **Target users:** Indian smallholder farmers (≤ 2 hectares)  
> **Languages supported:** Hindi + 21 other scheduled Indian languages via Bhashini API

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Updated Architecture](#2-updated-architecture)
3. [System Components](#3-system-components)
4. [Agent Specifications](#4-agent-specifications)
   - 4.1 [Orchestrator Agent](#41-orchestrator-agent)
   - 4.2 [Crop Advisory Agent](#42-crop-advisory-agent)
   - 4.3 [Weather Alert Agent](#43-weather-alert-agent)
5. [In-App Chatbot UI Specification](#5-in-app-chatbot-ui-specification)
6. [API Reference](#6-api-reference)
7. [Data Models](#7-data-models)
8. [Claude Prompt Templates](#8-claude-prompt-templates)
9. [Error Handling](#9-error-handling)
10. [Build Sequence](#10-build-sequence)
11. [Environment Variables](#11-environment-variables)
12. [Folder Structure](#12-folder-structure)

---

## 1. Project Overview

Kisan Saathi is a multi-agent AI advisory system that gives Indian smallholder farmers personalised crop and weather guidance through an in-app chatbot. The farmer types (or speaks) a question inside the mobile/web app; the system calls real Indian government and open data APIs, synthesises the results using Claude, and displays the response as a chat message — all within the same app screen.

### Key Design Decisions (Updated)

| Aspect | Previous design | Updated design |
|---|---|---|
| Input channels | WhatsApp, SMS, IVR voice, PWA | **In-app chatbot only** |
| Output channels | SMS, WhatsApp push, IVR callback | **In-app chat response only** |
| Delivery agent | Bhashini + WATI + MSG91 + Exotel | **Bhashini (translation only, in-app)** |
| Authentication | Phone OTP per channel | **App login (OTP or Google Sign-In)** |
| Async push alerts | Scheduled background polling | **On-demand + in-app notification badge** |

### What This System Does

- Farmer opens the app and types a question in their language (Hindi, Marathi, Telugu, etc.)
- The orchestrator classifies intent and routes to one or both agents
- Each agent calls free Indian government APIs to fetch live data
- Claude synthesises the data into plain, actionable advice in the farmer's language
- The response appears in the chat window, formatted for a mobile screen

---

## 2. Updated Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      MOBILE / WEB APP                       │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                  In-App Chatbot UI                   │   │
│  │                                                      │   │
│  │  [Farmer types query in any Indian language]         │   │
│  │  [Chat bubbles display response]                     │   │
│  │  [Notification badge for proactive weather alerts]   │   │
│  └────────────────────────┬─────────────────────────────┘   │
└───────────────────────────│─────────────────────────────────┘
                            │ HTTPS POST /api/chat
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                        BACKEND SERVER                       │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Bhashini NLP — detect language, translate to English│   │
│  └──────────────────────┬───────────────────────────────┘   │
│                         ▼                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Orchestrator Agent — classify intent, route         │   │
│  └───────────┬──────────────────────────┬───────────────┘   │
│              ▼                          ▼                   │
│  ┌───────────────────┐      ┌───────────────────────────┐   │
│  │  Crop Advisory    │      │  Weather Alert Agent      │   │
│  │  Agent            │      │                           │   │
│  │  • data.gov.in    │      │  • Open-Meteo API         │   │
│  │  • ICAR variety DB│      │  • NDMA Sachet API        │   │
│  │  • MSP prices     │      │  • IMD agromet bulletins  │   │
│  │  • Open-Meteo     │      │  • Threshold rules engine │   │
│  │    soil/ET0       │      │                           │   │
│  └───────────┬───────┘      └──────────────┬────────────┘   │
│              └──────────────┬──────────────┘               │
│                             ▼                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Claude (claude-sonnet-4-6) — synthesis & reasoning  │   │
│  └──────────────────────────┬───────────────────────────┘   │
│                             ▼                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Bhashini — translate response to farmer's language  │   │
│  └──────────────────────────┬───────────────────────────┘   │
└────────────────────────────│────────────────────────────────┘
                             │ JSON response
                             ▼
                     In-App Chat Bubble
```

### Proactive Weather Alert Flow (Background)

```
Cron job (every 6 hours)
        │
        ▼
Weather Alert Agent polls Open-Meteo + NDMA
        │
        ▼
Threshold rules engine evaluates
        │
   ┌────┴────┐
   │ Alert?  │
   └────┬────┘
     YES│                NO
        ▼                 ▼
  Push notification   No action
  badge in app        (silent)
        │
        ▼
  Farmer opens app → sees alert in chat
```

---

## 3. System Components

### 3.1 Frontend (In-App Chatbot)

| Component | Technology | Notes |
|---|---|---|
| Mobile app | React Native / Flutter | Cross-platform iOS + Android |
| Web app | React.js | PWA for low-end Android browsers |
| Chat UI | Custom component | WhatsApp-style bubbles |
| Language input | Bhashini ASR (optional) | Voice-to-text in regional languages |
| Notification badge | Firebase Cloud Messaging | For proactive weather alerts |
| Farmer profile | Local AsyncStorage + backend | District, crop, language preference |

### 3.2 Backend (Node.js / Python)

| Component | Technology | Notes |
|---|---|---|
| API server | Node.js (Express) or Python (FastAPI) | REST endpoints |
| Orchestrator | Claude function calling | Intent classification |
| Agent runner | Async parallel execution | Both agents run simultaneously |
| Cache | Redis | API response caching (1 hr TTL) |
| Farmer DB | PostgreSQL | Profiles, conversation history |
| Cron scheduler | node-cron / Celery | Weather polling every 6 hrs |

### 3.3 External Services (All Free)

| Service | Purpose | Cost |
|---|---|---|
| Claude API (Anthropic) | Reasoning + synthesis | Pay per token |
| Bhashini (MeitY) | Translation + TTS | Free |
| data.gov.in | ICAR, MSP datasets | Free (API key required) |
| Open-Meteo | Weather + soil data | Free, no key needed |
| NDMA Sachet | Disaster alerts | Free (registration required) |
| IMD Agromet | District crop bulletins | Free (institutional registration) |
| Firebase | Push notifications | Free tier |

---

## 4. Agent Specifications

### 4.1 Orchestrator Agent

**Responsibility:** Receive the translated English query, classify intent, and route to the correct agent(s).

**Intent categories:**

| Intent | Keywords / patterns | Route to |
|---|---|---|
| `crop_advice` | sow, plant, fertiliser, variety, seed, harvest date | Crop Advisory Agent |
| `weather_query` | rain, weather, temperature, forecast, storm | Weather Alert Agent |
| `pest_disease` | insect, pest, disease, yellow leaves, spots | *(future agent — return fallback for now)* |
| `market_price` | price, mandi, rate, sell, MSP | Crop Advisory Agent (MSP sub-task) |
| `combined` | "should I sow given the weather" | Both agents in parallel |

**Orchestrator logic (pseudocode):**

```javascript
async function orchestrate(farmerQuery, farmerProfile) {
  const intent = await classifyIntent(farmerQuery);

  const tasks = [];
  if (intent.includes('crop_advice') || intent.includes('market_price')) {
    tasks.push(runCropAdvisoryAgent(farmerQuery, farmerProfile));
  }
  if (intent.includes('weather_query') || intent.includes('combined')) {
    tasks.push(runWeatherAlertAgent(farmerProfile.district, farmerProfile.state));
  }

  // Run agents in parallel
  const results = await Promise.all(tasks);

  // Pass all results to Claude for final synthesis
  return await synthesiseWithClaude(results, farmerQuery, farmerProfile);
}
```

---

### 4.2 Crop Advisory Agent

**Responsibility:** Provide personalised sowing, variety, fertiliser, irrigation, and income guidance.

#### Step-by-Step Execution

```
Step 1 → Query ICAR variety database (data.gov.in)
Step 2 → Query MSP prices (data.gov.in)
Step 3 → Query soil moisture + ET0 (Open-Meteo)
Step 4 → Query IMD agromet bulletin (imdpune.gov.in) [optional, cache 12 hrs]
Step 5 → Pass all results to Claude with synthesis prompt
Step 6 → Return structured advisory object
```

#### API Calls

**Step 1 — ICAR Variety Database**

```http
GET https://data.gov.in/api/datastore/resource/9ef84268-d588-465a-a308-a864a43d0070
  ?api-key={{DATA_GOV_API_KEY}}
  &filters={"crop":"{{crop}}","state":"{{state}}"}
  &limit=3
```

Sample response:
```json
{
  "records": [
    {
      "variety_name": "HD-3086",
      "crop": "Wheat",
      "state": "Uttar Pradesh",
      "year_released": "2016",
      "yield_qtl_ha": "55.1",
      "maturity_days": "143",
      "special_traits": "Heat tolerant, rust resistant",
      "recommended_zone": "Northern Plains"
    }
  ]
}
```

**Step 2 — MSP Price Lookup**

```http
GET https://data.gov.in/api/datastore/resource/35985678-0d79-46b4-9ed6-6f13308a1d24
  ?api-key={{DATA_GOV_API_KEY}}
  &filters={"commodity":"{{crop}}","year":"2024-25"}
```

Sample response:
```json
{
  "records": [
    {
      "commodity": "Wheat",
      "msp_per_quintal": "2275",
      "year": "2024-25",
      "season": "Rabi",
      "announcement_date": "2024-10-16"
    }
  ]
}
```

**Step 3 — Open-Meteo Soil and Evapotranspiration Data**

```http
GET https://api.open-meteo.com/v1/forecast
  ?latitude={{lat}}
  &longitude={{lon}}
  &daily=et0_fao_evapotranspiration,precipitation_sum,temperature_2m_max
  &hourly=soil_moisture_0_to_1cm,soil_temperature_0cm
  &timezone=Asia/Kolkata
  &forecast_days=7
```

No API key required.

Sample response:
```json
{
  "daily": {
    "time": ["2025-06-20", "2025-06-21"],
    "et0_fao_evapotranspiration": [5.2, 4.8],
    "precipitation_sum": [0.0, 12.4],
    "temperature_2m_max": [38.0, 36.5]
  },
  "hourly": {
    "time": ["2025-06-20T00:00", "2025-06-20T01:00"],
    "soil_moisture_0_to_1cm": [0.21, 0.20],
    "soil_temperature_0cm": [28.4, 27.9]
  }
}
```

**Step 4 — IMD Agromet Bulletin (optional, cache 12 hrs)**

```http
GET https://mausam.imd.gov.in/imd_latest/contents/agromet-api
  ?district={{district}}&state={{state}}
  Authorization: Bearer {{IMD_API_TOKEN}}
```

> **Note:** IMD machine-readable access requires institutional registration at `mausam.imd.gov.in`. While awaiting approval, fall back to Open-Meteo data only.

---

### 4.3 Weather Alert Agent

**Responsibility:** Monitor weather conditions and deliver timely, crop-stage-specific protective actions.

#### Execution Modes

| Mode | Trigger | Behaviour |
|---|---|---|
| On-demand | Farmer asks about weather in chat | Fetch + respond immediately |
| Proactive | Cron every 6 hours | Fetch silently; push notification if threshold crossed |

#### Step-by-Step Execution

```
Step 1 → Fetch 3-day forecast from Open-Meteo (always)
Step 2 → Fetch active NDMA Sachet alerts for farmer's state
Step 3 → Apply threshold rules engine
Step 4 → If threshold crossed → generate alert via Claude → push notification badge
Step 5 → If on-demand query → generate 7-day advisory via Claude → return to chat
```

#### API Calls

**Step 1 — Open-Meteo Forecast (backbone)**

```http
GET https://api.open-meteo.com/v1/forecast
  ?latitude={{lat}}
  &longitude={{lon}}
  &daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,weathercode
  &hourly=temperature_2m,precipitation,windspeed_10m,weathercode
  &timezone=Asia/Kolkata
  &forecast_days=7
```

No API key required. Cache response for 1 hour.

Sample response:
```json
{
  "latitude": 19.99,
  "longitude": 73.79,
  "daily": {
    "time": ["2025-06-20", "2025-06-21", "2025-06-22"],
    "temperature_2m_max": [42.1, 39.4, 38.0],
    "precipitation_sum": [0.0, 55.2, 18.0],
    "windspeed_10m_max": [22.4, 67.1, 34.0],
    "weathercode": [0, 65, 61]
  }
}
```

**Step 2 — NDMA Sachet Active Alerts**

```http
GET https://sachet.ndma.gov.in/cap/warningapi/api/warning
  ?state={{state}}&type=all&active=true
  Authorization: Bearer {{NDMA_SACHET_TOKEN}}
```

Register free at: `https://sachet.ndma.gov.in`

Sample response:
```json
{
  "alerts": [
    {
      "id": "NDMA-2025-MH-001",
      "type": "HeavyRainfall",
      "severity": "Extreme",
      "districts": ["Nashik", "Pune"],
      "issued_at": "2025-06-20T08:00:00+05:30",
      "valid_until": "2025-06-22T18:00:00+05:30",
      "message": "Heavy to very heavy rainfall expected."
    }
  ]
}
```

**Step 3 — Threshold Rules Engine**

```javascript
const ALERT_THRESHOLDS = {
  heatwave: {
    field: 'temperature_2m_max',
    operator: '>',
    value: 40,
    consecutive_days: 2,
    severity: 'HIGH',
    action_template: 'irrigate_and_shade'
  },
  heavy_rain: {
    field: 'precipitation_sum',
    operator: '>',
    value: 50,
    severity: 'HIGH',
    action_template: 'harvest_immediately'
  },
  storm: {
    field: 'windspeed_10m_max',
    operator: '>',
    value: 60,
    severity: 'EXTREME',
    action_template: 'secure_crops'
  },
  frost: {
    field: 'temperature_2m_min',
    operator: '<',
    value: 4,
    severity: 'HIGH',
    action_template: 'cover_seedlings'
  },
  drought_risk: {
    field: 'precipitation_sum',
    operator: '<',
    value: 2,
    consecutive_days: 7,
    severity: 'MEDIUM',
    action_template: 'schedule_irrigation'
  }
};

function evaluateThresholds(forecast, thresholds) {
  const triggered = [];
  for (const [name, rule] of Object.entries(thresholds)) {
    const values = forecast.daily[rule.field];
    // evaluate rule against values array
    if (ruleMatches(values, rule)) {
      triggered.push({ name, severity: rule.severity, action: rule.action_template });
    }
  }
  return triggered;
}
```

---

## 5. In-App Chatbot UI Specification

### 5.1 Chat Screen Layout

```
┌─────────────────────────────────────────┐
│  Kisan Saathi         [Profile] [Alert🔔]│  ← Header
├─────────────────────────────────────────┤
│                                         │
│  [Weather alert card — if active]       │  ← Proactive alert banner
│  ┌─────────────────────────────────┐    │
│  │ ⚠️ भारी बारिश चेतावनी          │    │
│  │ अगले 24 घंटों में 55mm बारिश   │    │
│  │ [विवरण देखें →]                │    │
│  └─────────────────────────────────┘    │
│                                         │
│          ┌──────────────────────┐       │  ← Bot message bubble
│          │ नमस्ते Ramesh जी!    │       │
│          │ आप क्या जानना        │       │
│          │ चाहते हैं?           │       │
│          └──────────────────────┘       │
│                                         │
│  ┌──────────────────────────────┐       │  ← Farmer message bubble
│  │ गेहूं कब बोऊं?              │       │
│  └──────────────────────────────┘       │
│                                         │
│  [Typing indicator ...]                 │
│                                         │
│          ┌──────────────────────┐       │  ← Advisory response
│          │ 📋 फसल सलाह          │       │
│          │ ─────────────────    │       │
│          │ किस्म: HD-3086       │       │
│          │ बुवाई: 10-25 नवंबर   │       │
│          │ खाद: 2 बोरी DAP/बीघा│       │
│          │ MSP: ₹2275/क्विंटल  │       │
│          └──────────────────────┘       │
│                                         │
├─────────────────────────────────────────┤
│  [Quick replies: मौसम | खाद | MSP]     │  ← Suggested prompts
├─────────────────────────────────────────┤
│  [🎤] [Type your question...]  [Send →] │  ← Input bar
└─────────────────────────────────────────┘
```

### 5.2 UI Component Specifications

| Component | Specification |
|---|---|
| Chat bubble (bot) | Left-aligned, light green background, max-width 80% |
| Chat bubble (farmer) | Right-aligned, white background, max-width 80% |
| Alert banner | Full-width, amber background, dismissible |
| Quick reply chips | Scrollable horizontal row, 3–5 suggestions per turn |
| Voice input button | Holds to record, Bhashini ASR for regional language |
| Typing indicator | 3-dot animation while agents are running |
| Response card | Structured card for crop advisory (icon + key fields) |
| Language selector | In profile settings — saved to farmer profile |

### 5.3 Chat API Contract

**Request (frontend → backend):**

```http
POST /api/chat
Content-Type: application/json
Authorization: Bearer {{APP_JWT_TOKEN}}

{
  "farmer_id": "farmer_abc123",
  "message": "गेहूं कब बोऊं?",
  "message_language": "hi",
  "session_id": "session_xyz789",
  "timestamp": "2025-06-20T10:30:00+05:30"
}
```

**Response (backend → frontend):**

```json
{
  "session_id": "session_xyz789",
  "response_language": "hi",
  "message": "HD-3086 गेहूं की किस्म 10 से 25 नवंबर के बीच बोएं। ...",
  "structured_data": {
    "type": "crop_advisory",
    "variety": "HD-3086",
    "sowing_window": "10-25 Nov",
    "fertiliser": "2 bags DAP per bigha",
    "msp_price": "₹2275 per quintal",
    "yield_estimate": "18-20 quintals per bigha"
  },
  "quick_replies": ["मौसम कैसा रहेगा?", "और किस्में बताओ", "MSP कितना है?"],
  "agents_used": ["crop_advisory", "weather"],
  "response_time_ms": 2400
}
```

**Proactive alert endpoint (cron → backend → frontend push):**

```http
POST /api/internal/weather-check
X-Cron-Secret: {{CRON_SECRET}}

→ For each registered farmer:
  → Run weather agent
  → If alert triggered → POST to Firebase FCM
  → Store alert in DB → Show in chat on next open
```

---

## 6. API Reference

### 6.1 All External APIs Summary

| API | Base URL | Auth | Rate limit | Cache TTL |
|---|---|---|---|---|
| data.gov.in (ICAR varieties) | `https://data.gov.in/api/datastore/resource/` | API key (header) | 500 req/day | 24 hours |
| data.gov.in (MSP prices) | `https://data.gov.in/api/datastore/resource/` | API key (header) | 500 req/day | 24 hours |
| Open-Meteo forecast | `https://api.open-meteo.com/v1/forecast` | None | ~10,000/day | 1 hour |
| Open-Meteo soil/ET0 | `https://api.open-meteo.com/v1/forecast` | None | ~10,000/day | 1 hour |
| NDMA Sachet | `https://sachet.ndma.gov.in/cap/warningapi/api/` | Bearer token | Unlimited | 30 min |
| IMD Agromet | `https://mausam.imd.gov.in/` | Bearer token | Varies | 12 hours |
| Bhashini translation | `https://dhruva-api.bhashini.gov.in/services/inference/pipeline` | API key | 1000 req/day free | No cache |
| Claude API | `https://api.anthropic.com/v1/messages` | API key | Per plan | No cache |

### 6.2 API Registration Steps

**data.gov.in:**
1. Visit `https://data.gov.in/user/register`
2. Create account → go to My Account → API Keys
3. Generate key → use in all data.gov.in requests as `api-key` query param
4. ICAR resource ID: `9ef84268-d588-465a-a308-a864a43d0070`
5. MSP resource ID: `35985678-0d79-46b4-9ed6-6f13308a1d24`

**Bhashini:**
1. Visit `https://bhashini.gov.in/`
2. Register as developer → get `userId` and `ulcaApiKey`
3. Use Dhruva API endpoint for inference

**NDMA Sachet:**
1. Visit `https://sachet.ndma.gov.in`
2. Register organisation → request API access
3. Receive Bearer token via email

**IMD Agromet:**
1. Visit `https://mausam.imd.gov.in/imd_latest/contents/data-supply-policy.php`
2. Submit institutional request form
3. Approval takes 1–2 weeks

> **Development tip:** Use Open-Meteo exclusively during early development. It requires zero registration and covers 90% of weather use cases. Add IMD only after core features are working.

---

## 7. Data Models

### 7.1 Farmer Profile

```typescript
interface FarmerProfile {
  farmer_id: string;           // UUID
  name: string;                // e.g. "Ramesh Yadav"
  phone: string;               // +91 format
  district: string;            // e.g. "Varanasi"
  state: string;               // e.g. "Uttar Pradesh"
  gps_lat: number;             // From app GPS permission
  gps_lon: number;             // From app GPS permission
  primary_crop: string;        // e.g. "Wheat"
  secondary_crops: string[];   // e.g. ["Mustard"]
  land_size_bigha: number;     // e.g. 3.5
  irrigation_type: 'rainfed' | 'canal' | 'borewell' | 'drip';
  preferred_language: string;  // BCP-47 e.g. "hi", "mr", "te"
  created_at: string;          // ISO 8601
  last_active: string;         // ISO 8601
}
```

### 7.2 Chat Message

```typescript
interface ChatMessage {
  message_id: string;          // UUID
  session_id: string;          // UUID
  farmer_id: string;           // FK to FarmerProfile
  role: 'farmer' | 'assistant';
  content: string;             // Message text in farmer's language
  content_en: string;          // English translation (stored for debugging)
  structured_data?: AdvisoryCard | WeatherCard; // Rich content
  agents_used: string[];       // ['crop_advisory', 'weather']
  timestamp: string;           // ISO 8601
}
```

### 7.3 Advisory Card (Rich Response)

```typescript
interface AdvisoryCard {
  type: 'crop_advisory';
  variety: string;
  sowing_window: string;
  fertiliser_schedule: string;
  irrigation_advice: string;
  msp_price: string;
  yield_estimate: string;
  data_sources: string[];      // ['ICAR', 'MSP_2024-25', 'Open-Meteo']
}

interface WeatherCard {
  type: 'weather_alert' | 'weather_summary';
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  alert_type?: string;         // e.g. 'HeavyRainfall'
  forecast_days: number;
  key_risk: string;            // e.g. "Heavy rain on Jun 21"
  recommended_action: string;  // e.g. "Harvest groundnut today"
  valid_until?: string;        // ISO 8601
  ndma_official?: boolean;     // true if NDMA issued this
}
```

### 7.4 Database Schema (PostgreSQL)

```sql
-- Farmer profiles
CREATE TABLE farmers (
  farmer_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  phone         TEXT UNIQUE NOT NULL,
  district      TEXT NOT NULL,
  state         TEXT NOT NULL,
  gps_lat       DECIMAL(9,6),
  gps_lon       DECIMAL(9,6),
  primary_crop  TEXT,
  land_bigha    DECIMAL(6,2),
  irrigation    TEXT,
  language      TEXT DEFAULT 'hi',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  last_active   TIMESTAMPTZ DEFAULT NOW()
);

-- Chat sessions
CREATE TABLE chat_sessions (
  session_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id     UUID REFERENCES farmers(farmer_id),
  started_at    TIMESTAMPTZ DEFAULT NOW(),
  ended_at      TIMESTAMPTZ
);

-- Messages
CREATE TABLE messages (
  message_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID REFERENCES chat_sessions(session_id),
  farmer_id     UUID REFERENCES farmers(farmer_id),
  role          TEXT CHECK (role IN ('farmer','assistant')),
  content       TEXT NOT NULL,
  content_en    TEXT,
  structured    JSONB,
  agents_used   TEXT[],
  latency_ms    INTEGER,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Proactive weather alerts
CREATE TABLE weather_alerts (
  alert_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id     UUID REFERENCES farmers(farmer_id),
  alert_type    TEXT NOT NULL,
  severity      TEXT NOT NULL,
  message       TEXT NOT NULL,
  message_hi    TEXT,
  valid_until   TIMESTAMPTZ,
  seen          BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- API response cache
CREATE TABLE api_cache (
  cache_key     TEXT PRIMARY KEY,
  response      JSONB NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 8. Claude Prompt Templates

### 8.1 System Prompt (All Interactions)

```
You are Kisan Saathi, a trusted agricultural advisor for Indian smallholder farmers.

Rules:
- Respond ONLY in {{farmer_language}} (e.g. Hindi, Marathi, Telugu)
- Use familiar units: bigha (not hectare), quintal (not kg), bags (not kg for fertiliser)
- Explain as if talking to a Class 5-educated farmer — no jargon
- Always end with ONE clear action the farmer can take TODAY or THIS WEEK
- Keep responses under 200 words
- Format structured advice as simple numbered lists, not paragraphs
- If data is unavailable for the farmer's specific crop/district, say so clearly and give general advice

You have access to:
- Live ICAR variety recommendations for their state and crop
- Current MSP (Minimum Support Price) from the government
- 7-day weather forecast and soil moisture for their GPS location
- NDMA official disaster alerts for their state
```

### 8.2 Crop Advisory Synthesis Prompt

```
Farmer profile:
- Name: {{farmer_name}}
- District: {{district}}, {{state}}
- Crop: {{crop}}
- Land: {{land_bigha}} bigha
- Irrigation: {{irrigation_type}}
- Season: {{current_season}} (Kharif/Rabi/Zaid)

Data fetched from APIs:
ICAR recommended variety: {{variety_name}}
  - Yield: {{yield_qtl_ha}} qtl/ha, Matures in: {{maturity_days}} days
  - Special traits: {{special_traits}}

Soil data (Open-Meteo):
  - Soil moisture: {{soil_moisture}} m³/m³
  - Evapotranspiration (ET0): {{et0}} mm/day
  - 7-day rainfall forecast: {{rainfall_7day}} mm total

Government MSP for {{crop}}: ₹{{msp_price}} per quintal ({{msp_year}})

IMD agromet advice (if available): {{imd_advice}}

Farmer's question: "{{farmer_query}}"

Generate personalised advice covering:
1. Best sowing window (give exact date range)
2. Recommended variety with one-line reason
3. Fertiliser schedule in bags per bigha (not kg/ha)
4. Irrigation frequency based on soil moisture and ET0
5. Expected income calculation vs MSP

Keep to under 200 words. Use simple {{farmer_language}}.
```

### 8.3 Weather Alert Generation Prompt

```
Farmer: {{farmer_name}}, growing {{crop}} (current stage: {{crop_stage}})
Location: {{district}}, {{state}}

Weather data (next 3 days):
{{weather_json_summary}}

NDMA official alerts active: {{ndma_alerts_list}}

Triggered thresholds: {{triggered_alerts}}

Generate a SHORT weather alert message (3 sentences maximum) that:
1. States what weather is coming and when (be specific — "Tuesday" not "in 2 days")
2. Gives ONE protective action specific to {{crop}} at {{crop_stage}} stage
3. States urgency: TODAY / within 48 hours / this week

Output as plain conversational text in {{farmer_language}}.
No bullet points. No headers. No emojis.
```

### 8.4 On-Demand Weather Summary Prompt

```
Farmer: {{farmer_name}}, crop: {{crop}} in {{district}}, {{state}}

7-day forecast data:
{{weather_json_7day}}

Generate a friendly 7-day weather summary in {{farmer_language}} that covers:
1. Overall monsoon/season outlook for the week
2. Best days for field work (spraying, harvesting, ploughing)
3. Any days to avoid (rain, extreme heat)
4. One irrigation recommendation based on rainfall forecast

Keep under 150 words. Mention specific days of the week (e.g. "शुक्रवार" not "day 5").
```

---

## 9. Error Handling

### 9.1 API Failure Fallbacks

| Failed API | Fallback behaviour |
|---|---|
| data.gov.in (ICAR) | Return cached response if < 24 hrs old; else return generic zone advice |
| data.gov.in (MSP) | Return last known MSP with "prices may have changed" disclaimer |
| Open-Meteo | Retry once after 2s; if still fails, skip weather section in response |
| NDMA Sachet | Skip official alerts; rely on Open-Meteo thresholds only |
| IMD Agromet | Skip IMD section; use Open-Meteo data only |
| Bhashini translation | Return English response with apology in English + Hindi |
| Claude API | Return static fallback message: "Service temporarily unavailable. Try again in a few minutes." |

### 9.2 Error Response Format

```json
{
  "session_id": "session_xyz789",
  "response_language": "hi",
  "message": "माफ़ करें, अभी सेवा उपलब्ध नहीं है। कुछ मिनट बाद कोशिश करें।",
  "error": {
    "code": "API_TIMEOUT",
    "affected_service": "data.gov.in",
    "fallback_used": true
  },
  "partial_response": true
}
```

### 9.3 Input Validation

```javascript
const MAX_MESSAGE_LENGTH = 500;  // characters
const SUPPORTED_LANGUAGES = ['hi', 'mr', 'te', 'ta', 'kn', 'bn', 'gu', 'pa', 'ml', 'or'];
const RATE_LIMIT = { requests: 20, window_minutes: 60 }; // per farmer

function validateChatRequest(req) {
  if (!req.message || req.message.trim().length === 0) {
    throw new Error('EMPTY_MESSAGE');
  }
  if (req.message.length > MAX_MESSAGE_LENGTH) {
    throw new Error('MESSAGE_TOO_LONG');
  }
  if (!req.farmer_id) {
    throw new Error('MISSING_FARMER_ID');
  }
}
```

---

## 10. Build Sequence

Follow this sequence to reach a working MVP in 2–3 weeks:

### Week 1 — Core pipeline (no auth, hardcoded farmer)

- [ ] Set up Node.js/FastAPI project with `/api/chat` endpoint
- [ ] Hardcode one test farmer profile (Varanasi, Wheat, Hindi)
- [ ] Implement Open-Meteo weather fetch (no API key — works immediately)
- [ ] Implement weather threshold rules engine
- [ ] Integrate Claude API — test crop advisory synthesis prompt with dummy data
- [ ] Build basic React chat UI (bubbles, input bar, send button)
- [ ] Wire UI → backend → Claude → response bubble

**End of Week 1 goal:** Type "गेहूं कब बोऊं?" in the app and get a real Claude response using live Open-Meteo soil data.

### Week 2 — Real Indian data APIs

- [ ] Register on data.gov.in → get API key
- [ ] Implement ICAR variety lookup with district/crop filters
- [ ] Implement MSP price lookup
- [ ] Add Redis caching for all API responses
- [ ] Register on NDMA Sachet → implement alert polling
- [ ] Implement Bhashini translation (English Claude output → farmer's language)
- [ ] Add farmer profile screen (crop, district, language, GPS)
- [ ] Implement PostgreSQL schema and farmer profile storage

**End of Week 2 goal:** Full crop advisory with real ICAR data, live MSP prices, and Hindi output.

### Week 3 — Proactive alerts and polish

- [ ] Implement cron job (every 6 hours) for proactive weather monitoring
- [ ] Integrate Firebase Cloud Messaging for push notification badge
- [ ] Add weather alert banner in chat UI (dismissible)
- [ ] Add quick reply suggestion chips
- [ ] Add voice input via Bhashini ASR (optional)
- [ ] Implement rate limiting and input validation
- [ ] Add error handling and API fallbacks
- [ ] Test with 5 real farmers in different states/crops

**End of Week 3 goal:** Production-ready MVP with proactive weather alerts.

---

## 11. Environment Variables

Create a `.env` file in your project root:

```bash
# Anthropic
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-sonnet-4-6

# data.gov.in
DATA_GOV_API_KEY=your_data_gov_key

# Bhashini
BHASHINI_USER_ID=your_bhashini_user_id
BHASHINI_API_KEY=your_bhashini_ulca_key

# NDMA Sachet
NDMA_SACHET_TOKEN=your_ndma_bearer_token

# IMD (add after approval)
IMD_API_TOKEN=your_imd_token

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/kisan_saathi

# Redis
REDIS_URL=redis://localhost:6379

# Firebase (for push notifications)
FIREBASE_PROJECT_ID=your_firebase_project
FIREBASE_PRIVATE_KEY=your_firebase_key
FIREBASE_CLIENT_EMAIL=your_firebase_email

# App
JWT_SECRET=your_jwt_secret_min_32_chars
CRON_SECRET=your_internal_cron_secret
NODE_ENV=development
PORT=3000
```

---

## 12. Folder Structure

```
kisan-saathi/
├── README.md
├── .env
├── .env.example
├── package.json
│
├── src/
│   ├── index.js                    # App entry point
│   │
│   ├── routes/
│   │   ├── chat.js                 # POST /api/chat
│   │   ├── farmer.js               # GET/POST /api/farmer (profile CRUD)
│   │   └── internal.js             # POST /api/internal/weather-check (cron)
│   │
│   ├── agents/
│   │   ├── orchestrator.js         # Intent classification + routing
│   │   ├── cropAdvisoryAgent.js    # Crop advisory logic
│   │   └── weatherAlertAgent.js    # Weather alert logic
│   │
│   ├── services/
│   │   ├── claude.js               # Anthropic API client + prompt builder
│   │   ├── bhashini.js             # Translation + language detection
│   │   ├── dataGovIn.js            # data.gov.in (ICAR + MSP) client
│   │   ├── openMeteo.js            # Open-Meteo weather + soil client
│   │   ├── ndmaSachet.js           # NDMA alert client
│   │   └── imdAgromet.js           # IMD agromet client (optional)
│   │
│   ├── thresholds/
│   │   └── weatherRules.js         # Alert threshold constants + evaluator
│   │
│   ├── prompts/
│   │   ├── systemPrompt.js         # Base system prompt
│   │   ├── cropAdvisoryPrompt.js   # Crop synthesis prompt template
│   │   ├── weatherAlertPrompt.js   # Alert generation prompt template
│   │   └── weatherSummaryPrompt.js # On-demand weather summary prompt
│   │
│   ├── models/
│   │   ├── farmer.js               # Farmer DB queries
│   │   ├── message.js              # Chat message DB queries
│   │   └── cache.js                # API cache DB queries
│   │
│   ├── middleware/
│   │   ├── auth.js                 # JWT verification
│   │   ├── rateLimit.js            # Per-farmer rate limiting
│   │   └── validate.js             # Request validation
│   │
│   ├── cron/
│   │   └── weatherPoller.js        # 6-hourly weather check cron job
│   │
│   └── utils/
│       ├── cache.js                # Redis cache helpers
│       ├── logger.js               # Structured logging
│       └── gps.js                  # District → GPS coordinate lookup
│
├── client/                         # React chat UI
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── ChatWindow.jsx      # Main chat container
│   │   │   ├── MessageBubble.jsx   # Individual message rendering
│   │   │   ├── AdvisoryCard.jsx    # Structured crop advisory card
│   │   │   ├── WeatherCard.jsx     # Structured weather card
│   │   │   ├── AlertBanner.jsx     # Proactive alert dismissible banner
│   │   │   ├── QuickReplies.jsx    # Suggested reply chips
│   │   │   └── InputBar.jsx        # Text + voice input
│   │   └── hooks/
│   │       ├── useChat.js          # Chat state management
│   │       └── useFarmerProfile.js # Profile management
│   └── public/
│
├── database/
│   └── migrations/
│       ├── 001_create_farmers.sql
│       ├── 002_create_sessions.sql
│       ├── 003_create_messages.sql
│       ├── 004_create_alerts.sql
│       └── 005_create_api_cache.sql
│
└── docs/
    ├── kisan_saathi_spec.md        # ← This file
    └── api_testing/
        ├── test_crop_advisory.http # VS Code REST Client test file
        └── test_weather_alert.http
```

---

*Document end. For questions about implementation, refer to each section's inline code samples and API endpoints.*
