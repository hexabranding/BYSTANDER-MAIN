import 'dotenv/config';
import connectDB from '../src/config/db.js';
import User from '../src/models/User.js';
import CaregiverProfile from '../src/models/CaregiverProfile.js';
import Document from '../src/models/Document.js';

const generateIdentitySvg = (name = 'Alexa Echo') => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 440" width="100%" height="100%">
    <defs>
      <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#FF9933" />
        <stop offset="50%" stop-color="#FFFFFF" />
        <stop offset="100%" stop-color="#138808" />
      </linearGradient>
      <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#ffffff" />
        <stop offset="100%" stop-color="#f8fafc" />
      </linearGradient>
    </defs>
    <!-- Background Card -->
    <rect x="10" y="10" width="680" height="420" rx="16" fill="url(#cardGrad)" stroke="#cbd5e1" stroke-width="2"/>
    
    <!-- Top Tricolor Band -->
    <rect x="10" y="10" width="680" height="12" rx="6" fill="url(#headerGrad)"/>
    
    <!-- Header Block -->
    <g transform="translate(30, 36)">
      <!-- Ashoka Emblem Symbol -->
      <circle cx="28" cy="24" r="20" fill="#0f172a" opacity="0.08" />
      <path d="M28 10 L32 20 L40 20 L34 26 L36 36 L28 30 L20 36 L22 26 L16 20 L24 20 Z" fill="#0f766e"/>
      <text x="60" y="20" font-family="system-ui, sans-serif" font-size="15" font-weight="bold" fill="#0f172a">UNIQUE IDENTIFICATION AUTHORITY OF INDIA</text>
      <text x="60" y="38" font-family="system-ui, sans-serif" font-size="12" fill="#475569">Government of India · National Identity Proof</text>
    </g>
    
    <line x1="30" y1="90" x2="670" y2="90" stroke="#e2e8f0" stroke-width="1.5" />
    
    <!-- Photo Box -->
    <g transform="translate(40, 110)">
      <rect x="0" y="0" width="140" height="175" rx="10" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1.5"/>
      <circle cx="70" cy="65" r="32" fill="#0d9488" opacity="0.3"/>
      <path d="M70 42 A 20 20 0 1 0 70 82 A 20 20 0 1 0 70 42 Z" fill="#0f766e" />
      <path d="M35 155 C 35 115 105 115 105 155 Z" fill="#0f766e" />
      <rect x="15" y="182" width="110" height="20" rx="4" fill="#0f172a" opacity="0.05"/>
      <text x="70" y="196" font-family="system-ui, sans-serif" font-size="10" font-weight="bold" fill="#334155" text-anchor="middle">VERIFIED CITIZEN</text>
    </g>
    
    <!-- Details -->
    <g transform="translate(210, 120)">
      <text x="0" y="15" font-family="system-ui, sans-serif" font-size="12" fill="#64748b" font-weight="600">NAME / नाम</text>
      <text x="0" y="38" font-family="system-ui, sans-serif" font-size="19" fill="#0f172a" font-weight="800">${name}</text>
      
      <text x="0" y="70" font-family="system-ui, sans-serif" font-size="12" fill="#64748b" font-weight="600">DOB / जन्म तारीख</text>
      <text x="0" y="90" font-family="system-ui, sans-serif" font-size="15" fill="#1e293b" font-weight="700">14/08/1996</text>
      
      <text x="160" y="70" font-family="system-ui, sans-serif" font-size="12" fill="#64748b" font-weight="600">GENDER / लिंग</text>
      <text x="160" y="90" font-family="system-ui, sans-serif" font-size="15" fill="#1e293b" font-weight="700">Female / महिला</text>
      
      <text x="0" y="125" font-family="system-ui, sans-serif" font-size="12" fill="#64748b" font-weight="600">ADDRESS / पता</text>
      <text x="0" y="145" font-family="system-ui, sans-serif" font-size="13" fill="#1e293b" font-weight="500">Flat 402, Sea View Apartments, Bandra West, Mumbai, MH - 400050</text>
    </g>
    
    <!-- QR Code Mockup -->
    <g transform="translate(550, 110)">
      <rect x="0" y="0" width="100" height="100" rx="8" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1"/>
      <rect x="10" y="10" width="24" height="24" fill="#0f172a"/>
      <rect x="14" y="14" width="16" height="16" fill="#f1f5f9"/>
      <rect x="18" y="18" width="8" height="8" fill="#0f172a"/>
      
      <rect x="66" y="10" width="24" height="24" fill="#0f172a"/>
      <rect x="70" y="14" width="16" height="16" fill="#f1f5f9"/>
      <rect x="74" y="18" width="8" height="8" fill="#0f172a"/>
      
      <rect x="10" y="66" width="24" height="24" fill="#0f172a"/>
      <rect x="14" y="70" width="16" height="16" fill="#f1f5f9"/>
      <rect x="18" y="74" width="8" height="8" fill="#0f172a"/>
      
      <rect x="42" y="42" width="16" height="16" fill="#0f766e"/>
      <circle cx="50" cy="50" r="4" fill="#ffffff"/>
      <text x="50" y="118" font-family="system-ui, sans-serif" font-size="9" fill="#64748b" text-anchor="middle">SECURE QR</text>
    </g>
    
    <!-- ID Number Band -->
    <g transform="translate(30, 335)">
      <rect x="0" y="0" width="640" height="65" rx="10" fill="#0f766e" opacity="0.08" stroke="#0d9488" stroke-dasharray="4 4"/>
      <text x="320" y="40" font-family="Courier, monospace" font-size="28" font-weight="bold" fill="#0f172a" text-anchor="middle" letter-spacing="4">8842  9102  3341</text>
    </g>
    
    <!-- Footer Slogan -->
    <text x="350" y="420" font-family="system-ui, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">मेरा आधार, मेरी पहचान · Unique Identification Authority of India</text>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
};

const generateNursingSvg = (name = 'Alexa Echo', regNo = 'MH-NUR-88421') => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 850" width="100%" height="100%">
    <defs>
      <radialGradient id="goldSeal" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#fbbf24" />
        <stop offset="70%" stop-color="#d97706" />
        <stop offset="100%" stop-color="#b45309" />
      </radialGradient>
    </defs>
    
    <!-- Certificate Parchment -->
    <rect x="15" y="15" width="670" height="820" rx="8" fill="#ffffff" stroke="#0f172a" stroke-width="4"/>
    <rect x="25" y="25" width="650" height="800" rx="4" fill="none" stroke="#d97706" stroke-width="1.5" stroke-dasharray="8 4"/>
    
    <!-- Header Emblem -->
    <g transform="translate(350, 80)">
      <circle cx="0" cy="0" r="36" fill="#0f766e" opacity="0.1"/>
      <path d="M-15 -10 L0 -25 L15 -10 L0 15 Z" fill="#0f766e"/>
      <circle cx="0" cy="0" r="10" fill="#d97706"/>
      <text x="0" y="45" font-family="Georgia, serif" font-size="22" font-weight="bold" fill="#0f172a" text-anchor="middle">MAHARASHTRA NURSING COUNCIL</text>
      <text x="0" y="66" font-family="system-ui, sans-serif" font-size="12" fill="#64748b" text-anchor="middle">Constitutional Statutory Body under Maharashtra Act XL of 1966</text>
      <text x="0" y="82" font-family="system-ui, sans-serif" font-size="11" fill="#94a3b8" text-anchor="middle">Grimston House, Mumbai - 400001, Maharashtra, India</text>
    </g>
    
    <!-- Title -->
    <g transform="translate(350, 215)">
      <rect x="-170" y="-18" width="340" height="36" fill="#0f766e" rx="4"/>
      <text x="0" y="6" font-family="Georgia, serif" font-size="17" font-weight="bold" fill="#ffffff" text-anchor="middle" letter-spacing="1.5">CERTIFICATE OF REGISTRATION</text>
    </g>
    
    <!-- Certificate Statement -->
    <g transform="translate(70, 290)">
      <text x="0" y="0" font-family="Georgia, serif" font-size="15" fill="#334155" line-height="2">This is to certify that the person named below has been duly registered as a</text>
      <text x="280" y="40" font-family="Georgia, serif" font-size="20" font-weight="bold" fill="#0f766e" text-anchor="middle">REGISTERED NURSE &amp; REGISTERED MIDWIFE (RN / RM)</text>
      <text x="0" y="80" font-family="Georgia, serif" font-size="14" fill="#334155">in accordance with the provisions of Section 14 of the Nurses and Midwives Council Act.</text>
      
      <!-- Box for Applicant Name -->
      <rect x="20" y="110" width="520" height="55" rx="8" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5"/>
      <text x="280" y="146" font-family="Georgia, serif" font-size="24" font-weight="bold" fill="#0f172a" text-anchor="middle">${name.toUpperCase()}</text>
      
      <!-- Qualifications Table -->
      <g transform="translate(20, 195)">
        <text x="0" y="15" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="#64748b">QUALIFICATION:</text>
        <text x="180" y="15" font-family="system-ui, sans-serif" font-size="14" font-weight="bold" fill="#0f172a">B.Sc. Nursing (Four Year Degree)</text>
        
        <text x="0" y="45" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="#64748b">REGISTRATION NO:</text>
        <text x="180" y="45" font-family="Courier, monospace" font-size="16" font-weight="bold" fill="#0f766e">${regNo}</text>
        
        <text x="0" y="75" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="#64748b">DATE OF REGISTRATION:</text>
        <text x="180" y="75" font-family="system-ui, sans-serif" font-size="14" font-weight="600" fill="#0f172a">12th July 2020</text>
        
        <text x="0" y="105" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="#64748b">VALIDITY PERIOD:</text>
        <text x="180" y="105" font-family="system-ui, sans-serif" font-size="14" font-weight="600" fill="#16a34a">Active &amp; Valid through 31 Dec 2028</text>
      </g>
    </g>
    
    <!-- Gold Official Seal -->
    <g transform="translate(160, 680)">
      <circle cx="0" cy="0" r="48" fill="url(#goldSeal)" stroke="#92400e" stroke-width="2"/>
      <circle cx="0" cy="0" r="40" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-dasharray="3 3"/>
      <text x="0" y="-10" font-family="system-ui, sans-serif" font-size="9" font-weight="bold" fill="#78350f" text-anchor="middle">COUNCIL SEAL</text>
      <text x="0" y="6" font-family="Georgia, serif" font-size="12" font-weight="bold" fill="#78350f" text-anchor="middle">OFFICIAL</text>
      <text x="0" y="20" font-family="system-ui, sans-serif" font-size="8" font-weight="bold" fill="#78350f" text-anchor="middle">MNC · MUMBAI</text>
    </g>
    
    <!-- Signatures -->
    <g transform="translate(480, 680)">
      <path d="M-80 0 Q -40 -30 0 -10 T 60 -15" fill="none" stroke="#1e293b" stroke-width="2"/>
      <line x1="-90" y1="15" x2="70" y2="15" stroke="#94a3b8" stroke-width="1"/>
      <text x="-10" y="32" font-family="Georgia, serif" font-size="13" font-weight="bold" fill="#0f172a" text-anchor="middle">Dr. S. K. Deshmukh</text>
      <text x="-10" y="48" font-family="system-ui, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">Registrar &amp; Secretary, MNC</text>
    </g>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
};

const generateAddressProofSvg = (name = 'Alexa Echo') => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 750" width="100%" height="100%">
    <!-- Bill Container -->
    <rect x="15" y="15" width="670" height="720" rx="10" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
    
    <!-- Top Header -->
    <rect x="15" y="15" width="670" height="85" rx="10" fill="#0284c7"/>
    <text x="45" y="52" font-family="system-ui, sans-serif" font-size="20" font-weight="bold" fill="#ffffff">MAHAVITARAN · MSEDCL</text>
    <text x="45" y="74" font-family="system-ui, sans-serif" font-size="12" fill="#e0f2fe">Maharashtra State Electricity Distribution Co. Ltd. — Domestic Utility Bill</text>
    
    <g transform="translate(50, 130)">
      <rect x="0" y="0" width="600" height="150" rx="8" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5"/>
      
      <text x="25" y="30" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="#64748b">CONSUMER NAME &amp; BILLING ADDRESS</text>
      <text x="25" y="58" font-family="system-ui, sans-serif" font-size="18" font-weight="bold" fill="#0f172a">${name}</text>
      <text x="25" y="85" font-family="system-ui, sans-serif" font-size="14" fill="#334155">Flat 402, Sea View Apartments, 14th Road</text>
      <text x="25" y="108" font-family="system-ui, sans-serif" font-size="14" fill="#334155">Bandra West, Mumbai - 400050, Maharashtra</text>
      
      <text x="360" y="30" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="#64748b">CONSUMER NO:</text>
      <text x="360" y="55" font-family="Courier, monospace" font-size="16" font-weight="bold" fill="#0284c7">021489004128</text>
      <text x="360" y="85" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="#64748b">BILL MONTH / DATE:</text>
      <text x="360" y="108" font-family="system-ui, sans-serif" font-size="14" font-weight="bold" fill="#0f172a">October 2026 (05-10-2026)</text>
    </g>
    
    <!-- Meter & Billing Table -->
    <g transform="translate(50, 310)">
      <rect x="0" y="0" width="600" height="180" rx="8" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/>
      <path d="M0 40 L600 40" stroke="#e2e8f0" stroke-width="1.5"/>
      
      <text x="25" y="26" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="#475569">METER NO</text>
      <text x="180" y="26" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="#475569">UNITS CONSUMED</text>
      <text x="350" y="26" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="#475569">TARIFF RATE</text>
      <text x="490" y="26" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="#475569">TOTAL</text>
      
      <text x="25" y="75" font-family="Courier, monospace" font-size="14" fill="#0f172a">MTR-98214-BND</text>
      <text x="180" y="75" font-family="system-ui, sans-serif" font-size="14" font-weight="bold" fill="#0f172a">214 kWh</text>
      <text x="350" y="75" font-family="system-ui, sans-serif" font-size="14" fill="#0f172a">₹ 7.85 / unit</text>
      <text x="490" y="75" font-family="system-ui, sans-serif" font-size="16" font-weight="bold" fill="#0f172a">₹ 1,679.90</text>
      
      <line x1="25" y1="110" x2="575" y2="110" stroke="#f1f5f9" stroke-width="1"/>
      <text x="25" y="145" font-family="system-ui, sans-serif" font-size="14" font-weight="bold" fill="#0f172a">NET AMOUNT PAYABLE:</text>
      <text x="490" y="145" font-family="system-ui, sans-serif" font-size="20" font-weight="extrabold" fill="#0284c7">₹ 1,840.00</text>
    </g>
    
    <!-- Paid Stamp Mockup -->
    <g transform="translate(420, 520) rotate(-8)">
      <rect x="0" y="0" width="220" height="75" rx="8" fill="#dcfce7" stroke="#16a34a" stroke-width="3" stroke-dasharray="4 2"/>
      <text x="110" y="32" font-family="system-ui, sans-serif" font-size="20" font-weight="900" fill="#15803d" text-anchor="middle" letter-spacing="2">PAID IN FULL</text>
      <text x="110" y="55" font-family="Courier, monospace" font-size="11" font-weight="bold" fill="#166534" text-anchor="middle">TXN-8829104 · 08 OCT 2026</text>
    </g>
    
    <!-- Address Proof Verification Stamp -->
    <g transform="translate(60, 520)">
      <rect x="0" y="0" width="300" height="80" rx="8" fill="#f0fdf4" stroke="#86efac" stroke-width="1.5"/>
      <text x="15" y="28" font-family="system-ui, sans-serif" font-size="13" font-weight="bold" fill="#166534">OFFICIAL PROOF OF RESIDENCE</text>
      <text x="15" y="50" font-family="system-ui, sans-serif" font-size="12" fill="#15803d">Address matches caregiver service radius</text>
      <text x="15" y="68" font-family="system-ui, sans-serif" font-size="11" fill="#4ade80">Verified for Bystander Healthcare Provider Registry</text>
    </g>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
};

const generatePoliceClearanceSvg = (name = 'Alexa Echo') => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 800" width="100%" height="100%">
    <!-- Paper -->
    <rect x="15" y="15" width="670" height="770" rx="8" fill="#ffffff" stroke="#1e293b" stroke-width="3"/>
    
    <!-- Police Department Header -->
    <g transform="translate(350, 70)">
      <circle cx="0" cy="0" r="32" fill="#1e3a8a" opacity="0.1"/>
      <path d="M0 -22 L18 8 L-18 8 Z" fill="#1e3a8a"/>
      <text x="0" y="45" font-family="system-ui, sans-serif" font-size="19" font-weight="extrabold" fill="#0f172a" text-anchor="middle" letter-spacing="1">GREATER MUMBAI POLICE DEPARTMENT</text>
      <text x="0" y="66" font-family="system-ui, sans-serif" font-size="13" font-weight="bold" fill="#1e3a8a" text-anchor="middle">SPECIAL BRANCH - II (CID)</text>
      <text x="0" y="84" font-family="system-ui, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">Police Headquarters, Mumbai - 400001 · Verification Cell</text>
    </g>
    
    <line x1="50" y1="180" x2="650" y2="180" stroke="#cbd5e1" stroke-width="1.5"/>
    
    <!-- Report Title -->
    <g transform="translate(350, 220)">
      <rect x="-210" y="-18" width="420" height="36" rx="6" fill="#1e3a8a"/>
      <text x="0" y="6" font-family="system-ui, sans-serif" font-size="15" font-weight="bold" fill="#ffffff" text-anchor="middle" letter-spacing="1">POLICE CLEARANCE CERTIFICATE (PCC)</text>
    </g>
    
    <g transform="translate(70, 280)">
      <text x="0" y="15" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="#64748b">CERTIFICATE REF NO:</text>
      <text x="180" y="15" font-family="Courier, monospace" font-size="14" font-weight="bold" fill="#0f172a">PCC/SB-II/MUM/2026/09412</text>
      
      <text x="0" y="45" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="#64748b">DATE OF ISSUE:</text>
      <text x="180" y="45" font-family="system-ui, sans-serif" font-size="14" font-weight="600" fill="#0f172a">10th October 2026</text>
      
      <text x="0" y="75" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="#64748b">PURPOSE:</text>
      <text x="180" y="75" font-family="system-ui, sans-serif" font-size="14" font-weight="600" fill="#0f766e">Caregiver Healthcare Employment &amp; Registry</text>
    </g>
    
    <!-- Verification Body -->
    <g transform="translate(70, 400)">
      <rect x="0" y="0" width="560" height="170" rx="10" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5"/>
      <text x="25" y="35" font-family="Georgia, serif" font-size="15" fill="#1e293b">This is to certify that an antecedent and background inquiry concerning:</text>
      <text x="25" y="70" font-family="Georgia, serif" font-size="20" font-weight="bold" fill="#1e3a8a">${name.toUpperCase()}</text>
      <text x="25" y="98" font-family="system-ui, sans-serif" font-size="13" fill="#475569">Residing at: Flat 402, Sea View Apartments, Bandra West, Mumbai</text>
      
      <rect x="25" y="118" width="510" height="36" rx="6" fill="#dcfce7" stroke="#86efac"/>
      <text x="280" y="141" font-family="system-ui, sans-serif" font-size="13" font-weight="bold" fill="#15803d" text-anchor="middle">STATUS: NO ADVERSE CRIMINAL RECORD FOUND · CLEAR RECORD</text>
    </g>
    
    <!-- Circular Police Seal -->
    <g transform="translate(180, 670)">
      <circle cx="0" cy="0" r="46" fill="none" stroke="#1d4ed8" stroke-width="2.5"/>
      <circle cx="0" cy="0" r="38" fill="none" stroke="#1d4ed8" stroke-width="1" stroke-dasharray="4 2"/>
      <text x="0" y="-8" font-family="system-ui, sans-serif" font-size="9" font-weight="bold" fill="#1e40af" text-anchor="middle">COMMISSIONER OF POLICE</text>
      <text x="0" y="8" font-family="system-ui, sans-serif" font-size="11" font-weight="extrabold" fill="#1e40af" text-anchor="middle">VERIFIED</text>
      <text x="0" y="22" font-family="system-ui, sans-serif" font-size="8" font-weight="bold" fill="#1e40af" text-anchor="middle">MUMBAI CITY</text>
    </g>
    
    <!-- Signatures -->
    <g transform="translate(480, 670)">
      <path d="M-60 0 Q -30 -20 10 -5 T 50 -10" fill="none" stroke="#1e293b" stroke-width="2"/>
      <line x1="-80" y1="15" x2="60" y2="15" stroke="#94a3b8" stroke-width="1"/>
      <text x="-10" y="32" font-family="system-ui, sans-serif" font-size="13" font-weight="bold" fill="#0f172a" text-anchor="middle">K. R. Patil</text>
      <text x="-10" y="48" font-family="system-ui, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">Assistant Commissioner of Police</text>
    </g>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
};

const generateBankVerificationSvg = (name = 'Alexa Echo') => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 380" width="100%" height="100%">
    <!-- Cheque Body -->
    <rect x="10" y="10" width="730" height="360" rx="8" fill="#f0fdf4" stroke="#86efac" stroke-width="2"/>
    <rect x="18" y="18" width="714" height="344" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1"/>
    
    <!-- Bank Header -->
    <g transform="translate(40, 45)">
      <rect x="0" y="0" width="28" height="28" rx="4" fill="#0284c7"/>
      <text x="14" y="20" font-family="system-ui, sans-serif" font-size="16" font-weight="bold" fill="#ffffff" text-anchor="middle">H</text>
      <text x="38" y="20" font-family="system-ui, sans-serif" font-size="18" font-weight="extrabold" fill="#0f172a">HDFC BANK</text>
      <text x="38" y="34" font-family="system-ui, sans-serif" font-size="11" fill="#64748b">Bandra West Branch · Mumbai 400050</text>
    </g>
    
    <g transform="translate(520, 45)">
      <text x="0" y="15" font-family="system-ui, sans-serif" font-size="11" font-weight="bold" fill="#64748b">IFSC: <tspan fill="#0f172a" font-family="Courier">HDFC0000123</tspan></text>
      <text x="0" y="32" font-family="system-ui, sans-serif" font-size="11" font-weight="bold" fill="#64748b">MICR: <tspan fill="#0f172a" font-family="Courier">400240012</tspan></text>
    </g>
    
    <!-- Cheque Fields -->
    <g transform="translate(40, 120)">
      <text x="0" y="20" font-family="system-ui, sans-serif" font-size="13" font-weight="bold" fill="#475569">PAY</text>
      <line x1="40" y1="20" x2="660" y2="20" stroke="#94a3b8" stroke-width="1.5"/>
      <text x="60" y="16" font-family="Georgia, serif" font-size="16" font-weight="bold" fill="#0f172a">${name.toUpperCase()}</text>
      
      <text x="0" y="60" font-family="system-ui, sans-serif" font-size="13" font-weight="bold" fill="#475569">RUPEES</text>
      <line x1="65" y1="60" x2="660" y2="60" stroke="#94a3b8" stroke-width="1.5"/>
      
      <text x="0" y="110" font-family="system-ui, sans-serif" font-size="13" font-weight="bold" fill="#475569">A/C NO.</text>
      <rect x="75" y="90" width="300" height="32" fill="#f8fafc" stroke="#64748b" stroke-width="1.5" rx="4"/>
      <text x="90" y="112" font-family="Courier, monospace" font-size="18" font-weight="bold" fill="#0f172a">50100492817420</text>
    </g>
    
    <!-- Big CANCELLED Stamp Across Cheque -->
    <g transform="translate(375, 175) rotate(-16)">
      <line x1="-300" y1="-28" x2="300" y2="-28" stroke="#ef4444" stroke-width="5" stroke-dasharray="8 4"/>
      <text x="0" y="8" font-family="Impact, sans-serif" font-size="52" fill="#ef4444" opacity="0.85" text-anchor="middle" letter-spacing="8">CANCELLED</text>
      <line x1="-300" y1="26" x2="300" y2="26" stroke="#ef4444" stroke-width="5" stroke-dasharray="8 4"/>
    </g>
    
    <!-- Signatory Box -->
    <g transform="translate(540, 230)">
      <text x="50" y="40" font-family="Georgia, serif" font-size="15" font-style="italic" fill="#0f172a" text-anchor="middle">${name}</text>
      <line x1="0" y1="48" x2="160" y2="48" stroke="#64748b" stroke-width="1"/>
      <text x="80" y="62" font-family="system-ui, sans-serif" font-size="10" font-weight="bold" fill="#64748b" text-anchor="middle">AUTHORIZED SIGNATURE</text>
    </g>
    
    <!-- MICR Band -->
    <g transform="translate(140, 340)">
      <text x="0" y="0" font-family="Courier, monospace" font-size="16" font-weight="bold" fill="#1e293b" letter-spacing="4">⑈884120⑈  400240012⑆  001234⑈  29</text>
    </g>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
};

async function seed() {
  await connectDB();
  const alexa = await User.findOne({ email: 'alexa@gmail.com' });
  if (!alexa) {
    console.error('Alexa user not found in database.');
    process.exit(1);
  }

  const profile = await CaregiverProfile.findOne({ user: alexa._id });
  const name = alexa.fullName || 'Alexa Echo';
  const regNo = profile?.nursingRegNo || 'MH-NUR-88421';

  const docData = {
    identity: {
      fileName: 'alexa_aadhaar_card.svg',
      fileKey: generateIdentitySvg(name),
      mimeType: 'image/svg+xml',
    },
    nursing_registration: {
      fileName: 'alexa_nursing_registration_certificate.svg',
      fileKey: generateNursingSvg(name, regNo),
      mimeType: 'image/svg+xml',
    },
    address_proof: {
      fileName: 'alexa_electricity_bill_address_proof.svg',
      fileKey: generateAddressProofSvg(name),
      mimeType: 'image/svg+xml',
    },
    police_clearance: {
      fileName: 'alexa_police_clearance_certificate.svg',
      fileKey: generatePoliceClearanceSvg(name),
      mimeType: 'image/svg+xml',
    },
    bank_verification: {
      fileName: 'alexa_bank_cancelled_cheque.svg',
      fileKey: generateBankVerificationSvg(name),
      mimeType: 'image/svg+xml',
    },
  };

  for (const [type, payload] of Object.entries(docData)) {
    const updated = await Document.findOneAndUpdate(
      {
        user: alexa._id,
        documentType: type,
      },
      {
        $set: {
          caregiverProfile: profile?._id || null,
          fileName: payload.fileName,
          fileKey: payload.fileKey,
          mimeType: payload.mimeType,
          fileSize: 14200,
        },
      },
      { new: true, upsert: true }
    );
    console.log(`Updated document [${type}]: ${updated.fileName} (${updated.verificationStatus})`);
  }

  console.log('Successfully seeded authentic realistic documents for Alexa Echo!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Error seeding documents:', err);
  process.exit(1);
});
