# 📋 BYSTANDER — Project Documentation & Engineering Handover

> **Tagline:** *"Never Alone"*  
> **Repository:** `BYSTANDER-MAIN`  
> **Status:** Fully functional client-side interactive application (Single Page App with mock state persistence)  
> **Target Production State:** Production-ready full-stack healthtech marketplace connecting patients/families with verified caregivers, hospital bystanders, and nursing students.

---

## 1. Executive Summary & Problem Space

### What is Bystander?
**Bystander** is an on-demand medical attendant and caregiver marketplace. In hospital and home-recovery environments (particularly prominent across South Asia and emerging healthcare ecosystems), when a family member is admitted to a hospital or recovering from surgery, they require a constant **"bystander"** — a dedicated bedside attendant who monitors vitals, assists with feeding, mobility, and hygiene, liaises with hospital staff, and provides overnight vigilance.

Families often struggle to find reliable, background-checked attendants on short notice. Bystander bridges this gap with:
1. **Human-Vetted Caretakers:** Registered nurses (GNM, B.Sc), certified eldercare attendants, and final-year nursing students.
2. **Strict 4-Step Verification:** Government photo ID, state nursing council registration check, address proof, and police clearance/college credentials.
3. **Escrow-Protected Financials:** Customer funds are held securely upon booking and released to the caretaker only after digital shift completion and verification.
4. **Active Safety & 24/7 SOS:** In-app emergency SOS button with browser geolocation capture, automatic emergency contact alerts, and an admin command incident response room.
5. **Comprehensive Multi-Role Portal:** Tailored workflows for **Customers/Families**, **Caregivers/Bystanders**, and **Platform Administrators**.

---

## 2. Architecture & Technology Stack

| Layer | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Framework** | React | `^19.2.8` | Core UI library |
| **Build Tool** | Vite | `^8.3.0` | Ultra-fast HMR and bundle compilation |
| **Routing** | React Router DOM | `^7.18.4` | Declarative client-side routing & route guards |
| **Styling** | Tailwind CSS (Vite plugin) | `^4.3.3` | Modern utility-first styling with `@tailwindcss/vite` |
| **Animations** | Framer Motion | `^14.1.0` | Micro-interactions, page transitions, scroll animations |
| **Icons** | Lucide React | `^1.54.0` | Comprehensive icon design system |
| **Charts** | Recharts | `^3.10.1` | Financial analytics, revenue trends, bookings breakdown |
| **Notifications** | Sonner | `^2.0.8` | Toast notifications (rich colors, auto-dismiss, action hooks) |
| **Forms** | React Hook Form | `^7.89.0` | Performant form validation and handling |
| **Linter** | Oxlint | `^1.81.0` | High-speed Rust-based JavaScript linter |

### Design System & Theming (`src/index.css`)
- **Typography:** Display: `Plus Jakarta Sans`, Body: `Inter`
- **Color Palette:**
  - `primary` (Deep Teal): `#0f766e` / `#17a396` (Trust, medical professionalism)
  - `mint` (Soft Mint): `#ddf5ef` / `#8eddd0` (Calm, cleanliness)
  - `accent` (Sky Blue): `#0ea5e9` / `#38bdf8` (Technology, actions)
  - `canvas` / `surface`: `#f7fafc` / `#ffffff`
  - `ink`: `#172b3a` (High readability text)
  - `danger` / `warning` / `success`: Standardized accessible alert colors
- **Accessibility:** Reduced-motion detection configured globally in `App.jsx` with `<MotionConfig reducedMotion="user">`.

---

## 3. User Roles & Key Workflows

The application has 3 distinct authenticated roles, plus a public marketing website:

```
                          ┌──────────────────────────┐
                          │   Public Website & SEO   │
                          │   (Browse, Search, Trust)│
                          └─────────────┬────────────┘
                                        │
                         ┌──────────────┴──────────────┐
                         ▼                             ▼
                 [ Customer Portal ]           [ Caregiver Portal ]
               • Book Attendant              • Shift Job Board
               • Escrow Checkout             • Check-in / Check-out
               • Live Timeline & OTP         • Payouts & Earnings
               • SOS Emergency               • Document Upload
                         ▲                             ▲
                         │                             │
                         └──────────────┬──────────────┘
                                        │
                                        ▼
                           [ Admin Operations Deck ]
                         • 4-Step Verifications Desk
                         • 24/7 SOS Emergency Room
                         • Financials, Escrow & Payouts
                         • Blacklist Enforcement
```

### A. Customer / Family Portal (`/customer/*`)
1. **Book a Caretaker (`/customer/book-caregiver`):** Multi-step stepper selecting service type, hospital vs. home setting, patient condition, duration (hourly/shift/live-in), preferred caretaker, and instant escrow payment estimate.
2. **Find Caregivers (`/customer/caregivers`):** Filter by qualifications (GNM, B.Sc, Nursing Student), gender, hourly rate, location distance, language, and trust score.
3. **Booking Command & Timeline (`/customer/bookings/:id`):** 5-stage lifecycle tracker (`Requested` → `Assigned` → `Check-in / Started` → `Completed` → `Settled`). Includes OTP start verification, check-out confirmation, invoice download, and review rating.
4. **Safety & SOS (`SosButton.jsx`):** Geolocation-enabled one-tap emergency trigger, automatically notifying operations and emergency contacts.
5. **Support & Billing (`/customer/messages`, `/customer/complaints`, `/customer/invoices`):** Real-time masked chat, structured dispute submission with evidence upload, and GST invoice history.

### B. Caregiver / Bystander Portal (`/caregiver/*`)
1. **Job Board (`/caregiver/jobs`):** Browse open requests with patient background, required shifts, address distance, and transparent net payout.
3. **My Bookings (`/caregiver/bookings`):** Active, confirmed, and past visits tracking with quick actions.
4. **Earnings & Payouts (`/caregiver/earnings`):** Shift breakdown, platform commission (12%) deduction, pending bank transfers, and withdrawal triggers.
5. **Documents & Credentials (`/caregiver/documents`):** Upload Aadhaar/PAN, State Nursing Council registration, PCC, or Nursing College ID with live status badges.

### C. Admin & Operations Control Deck (`/admin/*`)
1. **Executive Dashboard (`/admin/dashboard`):** Real-time GMV, completed shifts, active attendants on duty, active SOS triggers, and platform revenue.
2. **Verifications Desk (`/admin/verifications`):** Inspect submitted documents, compare live selfie with ID, verify council registration numbers, approve or reject with audit trail.
3. **Emergency SOS Desk (`/admin/sos-alerts`):** High-priority operational triage with map coordinates, assigned desk agent, emergency contact dispatch status, and audit logs.
4. **Finance & Escrow (`/admin/payments`, `/admin/commissions`, `/admin/payouts`, `/admin/invoices`):** Escrow management (held, released, disputed, refunded), 12% platform fee calculations, and caregiver bank transfers.
5. **Trust & Safety (`/admin/blacklist`, `/admin/complaints`):** Manage suspended profiles, arbitrate disputes with pro-rata refunds.
6. **Network Directory (`/admin/hospitals`, `/admin/nursing-students`, `/admin/customers`, `/admin/caregivers`):** Relationship directories for hospital partners and university nursing programs.

---

## 4. Financial & Pricing Engine

The platform operates on a transparent, escrow-backed fee model defined in `src/utils/constants.js`:

```
Customer Total = (Caretaker Hourly Rate × Hours) + Platform Fee (₹49) + GST (18%)
Caregiver Net Payout = (Caretaker Hourly Rate × Hours) × (1 - 0.12 Platform Commission)
Platform Gross Margin = Platform Fee + Caregiver Commission (12%)
```

* **Escrow Mechanism:** On booking creation, payment status is set to `Escrow Held`.
* **Release:** Once the shift is marked `Completed` and verified, funds transition to `Released` and caregiver payout is queued.
* **Dispute Handling:** In complaints (e.g. late departure or no-show), admins can trigger full or pro-rata partial refunds.

---

## 5. Directory Structure & Key Files

The repository is structured as a clean monorepo with dedicated `frontend/` and `backend/` packages:

```
BYSTANDER-MAIN/
├── package.json                # Root workspace orchestrator (scripts for frontend & backend)
├── HANDOVER.md                 # This handover document
├── README.md                   # Repository overview
│
├── frontend/                   # Frontend SPA package (bystander-frontend)
│   ├── index.html              # HTML entry point (SEO metadata, Google Fonts)
│   ├── package.json            # Frontend dependencies and Vite scripts
│   ├── package-lock.json       # Frontend locked dependency tree
│   ├── vite.config.js          # Vite config (Tailwind v4 plugin, '@' path alias)
│   ├── .oxlintrc.json          # Oxlint configuration
│   ├── public/
│   │   ├── bystander-logo.png  # Brand mark & logo asset
│   │   ├── favicon.png         # Browser favicon
│   │   └── favicon.svg         # Vector favicon
│   └── src/
│       ├── main.jsx            # React root mount
│       ├── App.jsx             # App shell, Router, Auth/Data providers, Toaster
│       ├── index.css           # Tailwind CSS v4 design tokens and utilities
│       │
│       ├── context/
│       │   ├── AuthContext.jsx # User session, login, role persistence
│       │   └── DataContext.jsx # Central reactive store (CRUD for bookings, SOS, etc.)
│       │
│       ├── data/               # Rich seeded mock database
│       │   ├── demoUsers.js    # Seed credentials for Customer, Caregiver, Admin
│       │   ├── services.js     # 9 core care services & descriptions
│       │   ├── caregivers.js   # Directory of 16+ vetted caregiver profiles
│       │   ├── bookings.js     # Sample customer bookings & histories
│       │   ├── operations.js   # Available jobs, complaints, SOS alerts, blacklist
│       │   ├── finance.js      # Escrow transactions, payouts, earnings ledger
│       │   ├── verifications.js# Document verification records & audit logs
│       │   ├── messages.js     # Masked chat conversations
│       │   ├── charts.js       # Time-series datasets for analytics
│       │   └── content.js      # FAQs, testimonials, workflow guides
│       │
│       ├── routes/
│       │   ├── index.jsx       # AppRoutes mapping 44+ routes
│       │   ├── nav.js          # Navigation items for Customer, Caregiver, Admin
│       │   └── ScrollHelpers.jsx # Scroll-to-top and hash-link navigation handlers
│       │
│       ├── layouts/
│       │   ├── PublicLayout.jsx# Public site layout with header & footer
│       │   └── AuthLayout.jsx  # Clean split-screen authentication wrapper
│       │
│       ├── components/
│       │   ├── common/         # Button, Modal, Card, DataTable, StatusBadge, SosButton...
│       │   ├── layout/         # PublicNavbar, PublicFooter, DashboardLayout, Sidebar...
│       │   ├── booking/        # BookingCard, CheckInOutModal, RatingModal
│       │   ├── caregiver/      # CaregiverCard with badges and rating summaries
│       │   └── forms/          # FormField, Input, Select, FileUpload
│       │
│       ├── hooks/
│       │   ├── useLocalStorage.js # React hook synchronizing state with window.localStorage
│       │   ├── usePagination.js   # Table pagination state helper
│       │   └── useUi.js           # Page titles, outside clicks, viewport helpers
│       │
│       ├── utils/
│       │   ├── constants.js    # Status styles, cities, qualifications, commission rates
│       │   ├── format.js       # Currency (INR), date, phone, reference ID formatters
│       │   ├── duration.js     # Time math and shift calculators
│       │   ├── motion.js       # Framer motion variants (fade, slide, reveal)
│       │   └── cn.js           # Class variance utility (clsx + twMerge alternative)
│       │
│       └── pages/
│           ├── public/         # HomePage, AboutPage, ServicesPage, CaregiversPage...
│           ├── auth/           # LoginPage, RegisterCustomer, RegisterCaregiver, OTP...
│           ├── customer/       # 11 customer screens (Book, Bookings, Messages, SOS...)
│           ├── caregiver/      # 10 caregiver screens (Jobs, Schedule, Earnings, Docs...)
│           └── admin/          # 18 operational screens (Verifications, SOS, Payouts...)
│
└── backend/                    # Backend API package (bystander-backend)
    ├── package.json            # Express, Mongoose, crypto, test runners
    ├── .env.example            # Environment variable template
    ├── src/                    # Controllers, models, routes, services, middleware
    └── tests/                  # 8 test suites (96 tests passing)
```

---

## 6. Demo Accounts & Credentials

The platform is pre-configured with interactive demo accounts using a shared demo password:

| Role | Email | Password | Persona & Purpose |
| :--- | :--- | :--- | :--- |
| **Customer** | `priya.sharma@example.com` | `caremate123` | Family member seeking post-surgery recovery for mother |
| **Caregiver** | `ananya.deshmukh@example.com` | `caremate123` | B.Sc Nurse with 9 yrs ICU experience, active bookings |
| **Caregiver (New)** | `ritu.bansal@example.com` | `caremate123` | GNM Nurse awaiting verification approval |
| **Admin** | `admin@caremate.in` | `caremate123` | Head of Operations with full administrative control |

> **Resetting Data:** To reset state back to default seed records, trigger `clearStore()` via the UI or run `localStorage.clear()` in browser DevTools.

---

## 7. How to Run Locally

### Prerequisites
- Node.js `v18.0.0` or higher (Node 20+ recommended)
- npm or pnpm or yarn

### Installation & Launch
```bash
# 1. Install dependencies
npm install

# 2. Start development server
npm run dev
# Server starts at http://localhost:5173

# 3. Build for production
npm run build

# 4. Preview production build
npm run preview

# 5. Run linter
npm run lint
```

---

## 8. Backend & Production Engineering Roadmap

To convert this front-end application into an enterprise-grade production platform, the next engineering team should implement the following milestones:

### 1. Backend API & Authentication
- **Framework:** Node.js (Express/NestJS) or Go / Python (FastAPI).
- **Authentication:** JWT tokens with HTTP-only secure cookies, OAuth2, and SMS OTP verification via Twilio or Exotel.
- **Role-Based Access Control (RBAC):** Middleware verifying claims (`customer`, `caregiver`, `admin`, `ops_agent`).

### 2. Database Schema (PostgreSQL recommended)
- `users`: ID, email, phone, role, password_hash, status.
- `customer_profiles`: User reference, emergency contact, default address, patient medical summaries.
- `caregiver_profiles`: User reference, qualifications, reg_number, hourly_rate, bio, verification_status.
- `documents`: Caregiver reference, document_type, s3_file_url, verification_status, reviewer_notes.
- `bookings`: Customer ID, caregiver ID, service_id, shift_start, shift_end, status, escrow_status, OTP_start, OTP_end.
- `transactions`: Booking ID, amount, platform_commission, GST, caregiver_payout, payment_gateway_ref.
- `sos_incidents`: Booking ID, triggered_by, lat, lng, assigned_admin_id, status, resolution_notes.
- `messages`: Booking ID, sender_id, receiver_id, encrypted_text, read_at.

### 3. Payment Gateway & Escrow
- **Integrations:** Razorpay Route / Stripe Connect.
- **Workflow:**
  1. Customer creates booking → Create payment order.
  2. Payment captured → Funds held in platform escrow account.
  3. Caregiver checks out & OTP matches → Webhook triggers split payout (88% to caregiver connected bank account, 12% + fee retained by platform).

### 4. Communication Architecture
- **In-App Booking Messaging:** Secure, isolated one-to-one communication between customer and assigned caregiver scoped to active bookings (Step 10B). Real-time message history and unread tracking.
- **Phone Bridging / Telephony:** Removed per product directive. The application does not maintain third-party voice proxy or virtual phone bridge integrations; all direct communication is conducted within the secure booking-scoped messaging system.

### 5. Media & Document Storage
- Secure private AWS S3 / Cloudflare R2 bucket with pre-signed URLs for medical IDs, police clearances, and invoices.

---

## 9. Known Notes & Legacy Identifiers

1. **Brand Naming Transition:**
   - The primary brand and UI displays **"Bystander — Never Alone"** with the official `/bystander-logo.png`.
   - Internal mock keys in localStorage currently use the legacy prefix `caremate.store` and `caremate.auth`, and admin demo email uses `admin@caremate.in`. When setting up the real backend, standardize environment keys to `bystander.*` and `@bystander.care`.
2. **Offline Geolocation Fallback:**
   - The `SosButton` uses the browser's `navigator.geolocation` API. If permission is denied or running on an unencrypted HTTP origin, it safely falls back to standard demo coordinates (`19.0760, 72.8777` - Mumbai) so the application flow never crashes.

---

## 10. Backend Implementation Status (Implemented & Tested Workflows)

The `backend/` directory contains an enterprise Express + MongoDB backend with **100 passing automated tests across 9 test suites** (`auth.test.js`, `services.test.js`, `caregiver.test.js`, `booking.test.js`, `otp.test.js`, `sos.test.js`, `message.test.js`, `notification.test.js`, `remediation.test.js`).

### Completed Backend Modules
- **Authentication & RBAC (Steps 1–4, 11A):** JWT auth, bcrypt hashing (cost 12), cookie management, role authorization (`customer`, `caregiver`, `admin`). Strict production `JWT_ACCESS_SECRET` startup assertion (fails if missing or < 32 characters in production).
- **Reverse Proxy Support (Step 11A):** Reverse-proxy-aware rate limiting with configurable `TRUST_PROXY` (defaults to `1` in production to prevent IP spoofing while maintaining rate-limiter accuracy behind ALBs/Nginx).
- **Services Catalog (Step 5):** Admin service CRUD, pricing bounds, active catalog queries.
- **Caregiver Profile & Availability (Steps 6, 11A):** Profile management, 7-day schedule, IANA timezone conversion, date exceptions. Public directory search & catalog (`GET /api/caregivers`) with filters (city, service, qualification, minRating, maxRate), bounded pagination, and strict privacy shielding (zero phone/email/KYC exposure).
- **Customer Profile (Step 11A):** Customer profile management (`GET /api/customer/profile` and `PATCH /api/customer/profile`) with strict allowlists for emergency contact, default address, care notes, and patient records.
- **Booking Engine & Scheduling (Steps 7, 11A):** Concurrency lock via caregiver document mutation in multi-document ACID transactions. Double-booking prevention fully covers `pending`, `confirmed`, and `in_progress` intervals. Atomic cancellation and caregiver decline/rejection (`PATCH /api/bookings/:id/reject`).
- **Shift Check-in / Check-out OTP (Step 9):** Customer OTP generation, timing-safe HMAC SHA-256 verification with salt, atomic conditional 5-attempt lockouts, life-cycle transitions.
- **SOS Incident Reporting & Triage (Step 10A):**
  - **Model:** `SosIncident` (`incidentNumber` format `SOS-YYYYMMDD-XXXXX`, booking reference, customer and caregiver participants, priority, status, optional location, emergency contact dispatch audit, append-only timeline, resolution).
  - **API Endpoints:** `POST /api/sos`, `GET /api/sos`, `GET /api/sos/:id`, `PATCH /api/sos/:id/assign`, `POST /api/sos/:id/timeline`, `PATCH /api/sos/:id/resolve`.
  - **Safety & Integrity Guarantees:** Zero fabricated coordinates (`location.isAvailable: false` with `null` coordinates), zero fake dispatch claims (`status: 'not_configured'`), duplicate key retry on E11000.
- **Booking-Scoped Messaging (Step 10B):**
  - **Model:** `Message` (booking, sender, recipient, content, read, flagged).
  - **API Endpoints:** `POST /api/messages`, `GET /api/messages/booking/:bookingId`, `PATCH /api/messages/booking/:bookingId/read`, `GET /api/messages/unread`.
  - **Content & Privacy Guarantees:** 1–2000 chars, off-platform contact detection flags without hard-blocking, strict participant authorization.
- **Notification Infrastructure (Step 10C):**
  - **Model:** `Notification` (recipient, type, title, message, metadata, read, idempotencyKey).
  - **API Endpoints:** `GET /api/notifications`, `GET /api/notifications/unread`, `PATCH /api/notifications/:id/read`, `PATCH /api/notifications/read-all`.
  - **Idempotency & Fail-Safe Architecture:** Idempotent dispatch via `idempotencyKey` and `safeDispatchNotification` wrapper.

---

*Handover document updated for BYSTANDER-MAIN Step 11A engineering transition.*

