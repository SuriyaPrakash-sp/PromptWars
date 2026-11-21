# CivicPulse Enterprise 🏛️
### Autonomous AI-Powered Municipal Grievance Triage & Executive Command Center

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![AI Engine](https://img.shields.io/badge/AI-Google%20Gemini%202.5%20Flash-blue.svg)](https://aistudio.google.com/)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FSuriyaPrakash-sp%2FPromptWars)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/SuriyaPrakash-sp/PromptWars)
[![License](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)
[![Architecture](https://img.shields.io/badge/Architecture-Zero--Dependency%20Native%20Engine-orange.svg)]()

**CivicPulse Enterprise** is an end-to-end municipal governance and civic grievance intelligence platform. It bridges citizens and city administrators through real-time autonomous multimodal AI triage, dynamic SLA monitoring, geospatial hazard visualization, and an executive command dashboard.

---

## 🌟 Executive Features & Capabilities

### 1. 🤖 Autonomous Gemini AI Multimodal Triage Engine
- **Multimodal Perception**: Evaluates citizen text statements and high-resolution photo evidence simultaneously.
- **Categorization & Department Routing**: Accurately classifies grievances into 14 civic categories and routes them across 10 municipal engineering departments.
- **Dynamic SLA Allocation**: Assigns strict legal resolution deadlines based on hazard severity:
  - **Critical (24h SLA)**: Imminent threat to life (e.g. open storm drains, live sparking wires, bridge fissures).
  - **High (48h SLA)**: Major arterial road damage, drinking water main ruptures, hospital corridor sanitation delays.
  - **Medium (120h SLA)**: Residential streetlights, localized pipeline leaks, routine bin overflows.
  - **Low (240h SLA)**: Aesthetic park maintenance, non-obstructive signage.
- **Hazard Risk Index (1–100)**: Quantitative safety metric computed for risk prioritization.
- **Duplicate & Cluster Detection**: Flags duplicate or clustered grievances in the same geographic vicinity to prevent duplicate work orders.
- **Smart Fallback Engine**: If the Gemini API key is not supplied or network limits are exceeded, a built-in municipal semantic rules engine takes over seamlessly without breaking service.

### 2. 📊 Executive Command & Control Dashboard ($500 Enterprise Template Design)
- **C-Suite Metric KPIs**: Real-time counter of total grievances, active engineering squads in the field, verified resolution rate, and SLA compliance percentage.
- **Interactive Visualizations (Chart.js)**:
  - **Department Workload Distribution**: Horizontal telemetry bar chart showing backlog by municipal department.
  - **Taxonomy Breakdown**: Donut visualization of urban grievance categories.
- **Municipal Triage Workbench**: Searchable, filterable, and sortable table with instant search across ticket IDs, descriptions, and wards.
- **Work Order Dispatcher**: Admin modal to transition lifecycle states, reassign departments, override priorities, allocate field engineers, and record internal confidential notes.
- **Official CSV Export**: One-click download of timestamped, audit-ready municipal CSV reports for review meetings.

### 3. 🗺️ Civic Spatial Explorer (Interactive GIS Map)
- **Interactive Leaflet Engine**: Real-time city map plotting complaints with color-coded severity pins:
  - 🔴 **Red**: Critical (pulsing hazard animation)
  - 🟠 **Orange**: High Urgency
  - 🔵 **Blue**: Medium
  - 🟢 **Green**: Low
- **Ward Boundaries & Details**: Click any pin to open an interactive card with photo, department allocation, and one-click dossier inspection.

### 4. 👥 Transparent Citizen Portal
- **Interactive Submission Wizard**:
  - Live AI Pre-Triage meter showing predicted department, hazard score, and target SLA in real-time as the citizen types.
  - Client-side canvas photo compression before upload.
  - Automatic GPS coordinate resolution and Ward assignment.
- **Public Grievance Tracker**:
  - Direct search by Ticket ID (`CR-XXXX`).
  - Community Endorsement (+1 Upvote button) allowing neighborhoods to amplify pressing issues.
  - Public Community Feedback stream for on-site citizen observations.
  - Complete lifecycle progress tracker (`Reported` → `Dispatched` → `In Progress` → `Resolved`).
  - Photographic proof of resolution and certifying officer signature upon closure.

---

## 🏗️ Architecture & Technical Stack

```
PromptWars/
├── server.js               # Zero-dependency native Node HTTP server, REST API, & Gemini integration
├── package.json            # Project manifest & metadata
├── .env.example            # Environment configuration template
├── .gitignore              # Ignored paths (data.json, .env, logs)
└── public/
    ├── index.html          # High-performance SPA with Tailwind, Lucide icons, & Leaflet
    ├── app.js              # State management, Chart.js telemetry, map controller, and REST client
    └── styles.css          # Custom enterprise styling, glassmorphism, map pins, and scrollbars
```

- **Backend**: Node.js 18+ (Zero third-party runtime dependencies using native `http`, `crypto`, `fs`, `path`).
- **Frontend**: Clean modern SPA using Tailwind CSS, Lucide Icons, Chart.js, and Leaflet.
- **Storage**: Structured JSON document store with automated audit logging.

---

## 🚀 Quickstart & Setup

### 1. Prerequisites
- **Node.js 18+** installed (`node -v`)
- No `npm install` required! (Runs with pure Node built-ins)

### 2. Configure Environment
```bash
# Copy example configuration
cp .env.example .env
```
Edit `.env` with your settings:
```ini
GEMINI_API_KEY=your_key_from_aistudio.google.com
GEMINI_MODEL=gemini-2.5-flash
ADMIN_PIN=admin123
PORT=3000
```
> **Note**: If `GEMINI_API_KEY` is not provided, CivicPulse automatically operates on its built-in Municipal Smart Rules Engine without breaking.

### 3. Launch Platform
```bash
node server.js
```
Open your browser at **`http://localhost:3000`**.

Default Officer PIN: `admin123`

---

## 📡 API Reference

| Endpoint | Method | Access | Description |
|---|---|---|---|
| `/api/meta` | `GET` | Public | Taxonomy (Departments, Categories, Wards) & Gemini status |
| `/api/issues` | `GET` | Public | List grievances with search, filter, and sorting |
| `/api/issues` | `POST` | Public | Submit new complaint with multimodal AI triage |
| `/api/issues/:id` | `GET` | Public | Fetch comprehensive grievance dossier by ID |
| `/api/issues/:id` | `PATCH` | Officer | Update status, reassign department, assign field crew |
| `/api/issues/:id` | `DELETE` | Officer | Remove grievance record |
| `/api/issues/:id/upvote` | `POST` | Public | Citizen community endorsement (+1) |
| `/api/issues/:id/comment` | `POST` | Public | Post community observation note |
| `/api/analytics` | `GET` | Public | Executive KPI metrics, department load, and category data |
| `/api/export/csv` | `GET` | Officer | Download official municipal CSV report |
| `/api/admin/login` | `POST` | Public | Authenticate officer security PIN |
| `/api/seed` | `POST` | Public | Reset/re-seed database with realistic sample grievances |

---

## 🛡️ License
Built with ❤️ for Smart Municipal Governance under the [MIT License](LICENSE).
