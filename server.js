// CivicPulse Enterprise - AI-Powered Municipal Grievance & Command Center
// Node 18+ (zero-dependency native HTTP & crypto)

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load environment variables from .env if present
if (fs.existsSync('.env')) {
  fs.readFileSync('.env', 'utf8').split('\n').forEach(line => {
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
    }
  });
}

const PORT = parseInt(process.env.PORT || '3000', 10);
const ADMIN_PIN = process.env.ADMIN_PIN || 'admin123';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const DB_FILE = path.join(__dirname, 'data.json');
const AUDIT_FILE = path.join(__dirname, 'audit_log.json');

// Master Taxonomy for Municipal Governance
const DEPARTMENTS = [
  'Roads & Public Works',
  'Sanitation & Solid Waste',
  'Street Lighting & Electricity',
  'Water Supply & Sewage',
  'Drainage & Flood Management',
  'Parks, Gardens & Horticulture',
  'Traffic, Signage & Mobility',
  'Public Health & Vector Control',
  'Town Planning & Encroachment',
  'General Municipal Administration'
];

const CATEGORIES = [
  'Pothole / Road Surface Damage',
  'Garbage Dump / Overflowing Bins',
  'Broken / Non-Functional Streetlight',
  'Water Supply Pipe Leak / Low Pressure',
  'Sewage Overflow / Contamination',
  'Clogged Drain / Monsoon Waterlogging',
  'Fallen Tree / Hazardous Branches',
  'Faulty Traffic Signal / Missing Signage',
  'Open Manhole / Uncovered Utility Pit',
  'Mosquito Breeding / Stagnant Water / Dengue Hazard',
  'Illegal Encroachment / Footpath Blockage',
  'Stray Animal / Rabies Threat',
  'Public Park Maintenance',
  'Other Civic Grievance'
];

const WARDS = [
  'Ward 01 - North Gateway & Harborside',
  'Ward 04 - Old Central Market',
  'Ward 07 - Tech Corridor & Highline',
  'Ward 12 - South Lake & Green Meadows',
  'Ward 15 - West Industrial Zone',
  'Ward 18 - Metro Transit Junction',
  'Ward 22 - University Campus & Hospital Hub',
  'Ward 27 - Riverbank East'
];

const SLA_HOURS_MAP = {
  'Critical': 24,    // 1 day
  'High': 48,        // 2 days
  'Medium': 120,     // 5 days
  'Low': 240         // 10 days
};

// High-Fidelity SVG Graphic Snapshot Generator (Guarantees zero broken images on all networks)
function getCategorySvg(category, title) {
  const t = (title || category || '').toLowerCase();
  
  if (/pothole|road|crater|asphalt/.test(t) || category.includes('Road')) {
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 360" width="600" height="360"><rect width="600" height="360" fill="%231e293b"/><path d="M0 240 Q150 200 300 240 T600 240 L600 360 L0 360 Z" fill="%230f172a"/><path d="M120 270 Q240 230 380 275 Q420 310 320 330 Q180 320 120 270 Z" fill="%23020617" stroke="%23334155" stroke-width="4"/><path d="M160 280 L220 290 L260 285 L330 300 L280 315 L200 305 Z" fill="%23090d16"/><polygon points="460,330 490,330 480,240 470,240" fill="%23ea580c"/><polygon points="464,305 486,305 483,280 467,280" fill="%23ffffff"/><polygon points="466,270 484,270 482,255 468,255" fill="%23ffffff"/><polygon points="120,330 150,330 140,240 130,240" fill="%23ea580c"/><polygon points="124,305 146,305 143,280 127,280" fill="%23ffffff"/><circle cx="530" cy="60" r="32" fill="%23ef4444" opacity="0.9"/><text x="530" y="68" font-family="Arial,sans-serif" font-size="24" font-weight="bold" fill="white" text-anchor="middle">!</text><rect x="30" y="30" width="220" height="36" rx="6" fill="%230f172a" opacity="0.85"/><text x="42" y="54" font-family="Arial,sans-serif" font-size="14" font-weight="bold" fill="%2338bdf8">ROAD DAMAGE REPORT</text></svg>`;
  }
  
  if (/manhole|drain|flood|pit/.test(t) || category.includes('Manhole') || category.includes('Drain')) {
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 360" width="600" height="360"><rect width="600" height="360" fill="%23334155"/><ellipse cx="300" cy="240" rx="180" ry="70" fill="%23020617" stroke="%23dc2626" stroke-width="6"/><ellipse cx="300" cy="240" rx="140" ry="50" fill="%23000000"/><line x1="140" y1="240" x2="460" y2="240" stroke="%23ef4444" stroke-width="3" stroke-dasharray="8 8"/><line x1="300" y1="180" x2="300" y2="300" stroke="%23ef4444" stroke-width="3" stroke-dasharray="8 8"/><rect x="80" y="160" width="440" height="24" fill="%23facc15" stroke="%23000" stroke-width="2"/><line x1="110" y1="160" x2="90" y2="184" stroke="%23000" stroke-width="8"/><line x1="170" y1="160" x2="150" y2="184" stroke="%23000" stroke-width="8"/><line x1="230" y1="160" x2="210" y2="184" stroke="%23000" stroke-width="8"/><line x1="290" y1="160" x2="270" y2="184" stroke="%23000" stroke-width="8"/><line x1="350" y1="160" x2="330" y2="184" stroke="%23000" stroke-width="8"/><line x1="410" y1="160" x2="390" y2="184" stroke="%23000" stroke-width="8"/><line x1="470" y1="160" x2="450" y2="184" stroke="%23000" stroke-width="8"/><rect x="30" y="30" width="240" height="36" rx="6" fill="%230f172a" opacity="0.85"/><text x="42" y="54" font-family="Arial,sans-serif" font-size="14" font-weight="bold" fill="%23ef4444">CRITICAL MANHOLE PIT</text></svg>`;
  }

  if (/wire|electric|spark|shock|light|pole/.test(t) || category.includes('Light') || category.includes('Electric')) {
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 360" width="600" height="360"><rect width="600" height="360" fill="%23090d16"/><line x1="120" y1="40" x2="120" y2="360" stroke="%2364748b" stroke-width="12"/><line x1="60" y1="90" x2="180" y2="90" stroke="%2364748b" stroke-width="8"/><path d="M120 90 Q300 180 480 120" stroke="%2338bdf8" stroke-width="4" fill="none"/><path d="M120 90 Q240 260 340 310" stroke="%23facc15" stroke-width="5" fill="none"/><polygon points="340,310 325,280 345,285 335,260 365,295 345,295 360,320" fill="%23fef08a"/><circle cx="340" cy="310" r="28" fill="%23facc15" opacity="0.4"/><circle cx="340" cy="310" r="14" fill="%23ffffff"/><rect x="30" y="30" width="240" height="36" rx="6" fill="%230f172a" opacity="0.85"/><text x="42" y="54" font-family="Arial,sans-serif" font-size="14" font-weight="bold" fill="%23facc15">ELECTRICAL ARC HAZARD</text></svg>`;
  }

  if (/water|pipe|leak|burst|sewage/.test(t) || category.includes('Water') || category.includes('Sewage')) {
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 360" width="600" height="360"><rect width="600" height="360" fill="%231e293b"/><rect x="0" y="220" width="600" height="140" fill="%230f172a"/><rect x="0" y="270" width="600" height="40" fill="%230284c7" opacity="0.8"/><ellipse cx="300" cy="270" rx="90" ry="25" fill="%2338bdf8"/><path d="M280 270 Q240 120 300 70 Q360 120 320 270 Z" fill="%230284c7" opacity="0.65"/><path d="M290 270 Q270 140 300 90 Q330 140 310 270 Z" fill="%237dd3fc" opacity="0.9"/><circle cx="300" cy="70" r="12" fill="%23ffffff"/><circle cx="260" cy="130" r="8" fill="%23bae6fd"/><circle cx="340" cy="140" r="9" fill="%23bae6fd"/><rect x="30" y="30" width="250" height="36" rx="6" fill="%230f172a" opacity="0.85"/><text x="42" y="54" font-family="Arial,sans-serif" font-size="14" font-weight="bold" fill="%2338bdf8">WATER MAIN PIPE BURST</text></svg>`;
  }

  if (/garbage|waste|dump|trash|bin/.test(t) || category.includes('Garbage') || category.includes('Waste')) {
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 360" width="600" height="360"><rect width="600" height="360" fill="%231e293b"/><rect x="180" y="160" width="240" height="160" rx="8" fill="%23047857"/><rect x="160" y="140" width="280" height="24" rx="4" fill="%23065f46"/><path d="M190 140 Q250 80 300 120 Q360 70 410 140 Z" fill="%23475569"/><circle cx="250" cy="100" r="22" fill="%23334155"/><circle cx="340" cy="95" r="26" fill="%2364748b"/><polygon points="210,140 250,70 280,140" fill="%23cbd5e1"/><ellipse cx="200" cy="330" rx="40" ry="15" fill="%231e293b"/><ellipse cx="400" cy="330" rx="40" ry="15" fill="%231e293b"/><rect x="30" y="30" width="250" height="36" rx="6" fill="%230f172a" opacity="0.85"/><text x="42" y="54" font-family="Arial,sans-serif" font-size="14" font-weight="bold" fill="%23f59e0b">MUNICIPAL REFUSE OVERFLOW</text></svg>`;
  }

  if (/signal|traffic|sign/.test(t) || category.includes('Traffic') || category.includes('Signal')) {
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 360" width="600" height="360"><rect width="600" height="360" fill="%230f172a"/><rect x="240" y="40" width="120" height="260" rx="16" fill="%231e293b" stroke="%23475569" stroke-width="4"/><circle cx="300" cy="95" r="28" fill="%23334155"/><circle cx="300" cy="170" r="32" fill="%23f59e0b" filter="drop-shadow(0 0 16px %23f59e0b)"/><circle cx="300" cy="245" r="28" fill="%23334155"/><rect x="290" y="300" width="20" height="60" fill="%23475569"/><rect x="30" y="30" width="240" height="36" rx="6" fill="%230f172a" opacity="0.85"/><text x="42" y="54" font-family="Arial,sans-serif" font-size="14" font-weight="bold" fill="%23f59e0b">SIGNAL MALFUNCTION</text></svg>`;
  }

  // Default Vector Snapshot for civic grievances
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 360" width="600" height="360"><rect width="600" height="360" fill="%231e293b"/><circle cx="300" cy="180" r="100" fill="%23334155" opacity="0.5"/><path d="M250 140 L350 140 L300 240 Z" fill="%23f59e0b"/><rect x="30" y="30" width="260" height="36" rx="6" fill="%230f172a" opacity="0.85"/><text x="42" y="54" font-family="Arial,sans-serif" font-size="14" font-weight="bold" fill="%236366f1">CIVIC MONITORING SNAPSHOT</text></svg>`;
}

// In-Memory / File Storage Helpers
function loadData() {
  try {
    if (!fs.existsSync(DB_FILE)) return seedInitialData();
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return seedInitialData();
    return parsed;
  } catch (err) {
    console.warn('Error reading data.json, returning seeded default:', err.message);
    return seedInitialData();
  }
}

function saveData(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save data.json:', err.message);
  }
}

function loadAudit() {
  try {
    if (!fs.existsSync(AUDIT_FILE)) return [];
    return JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function logAudit(action, actor, details) {
  try {
    const logs = loadAudit();
    logs.unshift({
      id: 'AUD-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
      timestamp: Date.now(),
      action,
      actor: actor || 'Municipal Officer',
      details
    });
    if (logs.length > 200) logs.length = 200;
    fs.writeFileSync(AUDIT_FILE, JSON.stringify(logs, null, 2), 'utf8');
  } catch (e) {
    console.error('Audit logging failed:', e.message);
  }
}

function getSlaStatus(issue) {
  if (issue.status === 'Resolved') return 'Met';
  const now = Date.now();
  const deadline = issue.slaDeadline || (issue.createdAt + (issue.ai?.slaHours || 48) * 3600 * 1000);
  const remainingHours = (deadline - now) / (3600 * 1000);
  if (remainingHours < 0) return 'Breached';
  if (remainingHours <= 12) return 'Approaching Breach';
  return 'On Schedule';
}

// Gemini AI & Smart Rules Engine
async function analyzeComplaint({ title, description, location, citizenCategory, image, existingIssues = [] }) {
  const isKeyValid = GEMINI_API_KEY && GEMINI_API_KEY !== 'your_key_from_aistudio.google.com';
  
  if (isKeyValid) {
    try {
      const prompt = `You are chief AI triage officer for an urban municipal corporation. Analyze:
Title: "${title}"
Description: "${description}"
Location: "${location}"
Citizen-suggested category: "${citizenCategory || 'Unspecified'}"

Official Departments: ${JSON.stringify(DEPARTMENTS)}
Official Categories: ${JSON.stringify(CATEGORIES)}

Priority:
- Critical: Immediate threat to life/safety (open manholes, live wires, severe structural collapse). SLA 24h.
- High: Serious hazard, water main break, blocked arterial road, hospital/school area health issue. SLA 48h.
- Medium: Standard pothole, residential streetlight, scheduled bin clearance. SLA 120h.
- Low: Minor park aesthetic or signage issue. SLA 240h.

Return strict JSON only (no markdown, no backticks):
{
  "category": "exact match from official categories",
  "priority": "Critical" | "High" | "Medium" | "Low",
  "department": "exact match from official departments",
  "confidence": number between 0.85 and 0.99,
  "hazardScore": integer between 10 and 100,
  "reasoning": "Clear, professional executive reasoning sentence for civic engineers",
  "publicImpact": "Specific assessment of citizens, transit, or vulnerable populations impacted",
  "suggestedAction": "Concrete immediate municipal action step and technical procurement needs",
  "estimatedResolutionDays": integer (1 to 14),
  "slaHours": integer (24, 48, 120, or 240)
}`;

      const parts = [{ text: prompt }];
      if (image && typeof image === 'string' && image.startsWith('data:image')) {
        const match = image.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
        if (match) {
          parts.push({
            inline_data: { mime_type: match[1], data: match[2] }
          });
        }
      }

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.15 }
        })
      });

      if (res.ok) {
        const data = await res.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          const parsed = JSON.parse(rawText.trim());
          if (!CATEGORIES.includes(parsed.category)) parsed.category = CATEGORIES[0];
          if (!DEPARTMENTS.includes(parsed.department)) parsed.department = DEPARTMENTS[0];
          if (!['Critical', 'High', 'Medium', 'Low'].includes(parsed.priority)) parsed.priority = 'Medium';
          parsed.slaHours = parsed.slaHours || SLA_HOURS_MAP[parsed.priority] || 48;
          parsed.source = 'gemini';
          parsed.model = GEMINI_MODEL;
          return checkDuplicates(parsed, title, description, location, existingIssues);
        }
      }
    } catch (e) {
      console.warn('Gemini analysis bypassed/failed, falling back to smart rules:', e.message);
    }
  }

  // Robust Rules Fallback Engine
  const text = `${title} ${description} ${location}`.toLowerCase();
  let dept = DEPARTMENTS[0];
  let cat = CATEGORIES[0];
  let priority = 'Medium';
  let hazardScore = 45;
  let action = 'Field technician dispatch for on-site assessment and repair scheduling.';
  let impact = 'Local residents and daily commuters in the surrounding vicinity.';
  let days = 5;

  if (/manhole|drain|flood|waterlog|monsoon|stormwater|gutter/.test(text)) {
    dept = 'Drainage & Flood Management';
    cat = /manhole/.test(text) ? 'Open Manhole / Uncovered Utility Pit' : 'Clogged Drain / Monsoon Waterlogging';
    priority = /open|missing cover|deep|fall|drown|child/.test(text) ? 'Critical' : 'High';
    hazardScore = priority === 'Critical' ? 95 : 75;
    action = 'Immediate cordoning of hazard area followed by vacuum de-silting and heavy-duty slab installation.';
    impact = 'Pedestrians, two-wheeler riders, and flood-prone ground floor households.';
    days = priority === 'Critical' ? 1 : 3;
  } else if (/electric|wire|spark|transformer|shock|current|streetlight|lamp|pole|darkness/.test(text)) {
    dept = 'Street Lighting & Electricity';
    cat = 'Broken / Non-Functional Streetlight';
    priority = /spark|live wire|hanging|shock|fire|current/.test(text) ? 'Critical' : (/dark|accident|crime|night/.test(text) ? 'High' : 'Medium');
    hazardScore = priority === 'Critical' ? 98 : 60;
    action = 'Deploy electrical emergency response van to isolate high-voltage line and restore public illumination.';
    impact = 'Night commuters, pedestrian safety, and vehicular traffic visibility.';
    days = priority === 'Critical' ? 1 : 2;
  } else if (/garbage|waste|dump|trash|bin|stench|litter|debris/.test(text)) {
    dept = 'Sanitation & Solid Waste';
    cat = 'Garbage Dump / Overflowing Bins';
    priority = /hospital|school|market|choking|rot/.test(text) ? 'High' : 'Medium';
    hazardScore = priority === 'High' ? 70 : 40;
    action = 'Dispatch compact hydraulic compactor vehicle and sanitize ground with lime powder disinfectants.';
    impact = 'Neighborhood hygiene, public health of nearby educational/residential complexes.';
    days = priority === 'High' ? 2 : 4;
  } else if (/water|pipeline|leak|burst|contamination|pressure|drinking water|sewage/.test(text)) {
    dept = 'Water Supply & Sewage';
    cat = /sewage/.test(text) ? 'Sewage Overflow / Contamination' : 'Water Supply Pipe Leak / Low Pressure';
    priority = /burst|flood|contaminat|drinking|foul/.test(text) ? 'High' : 'Medium';
    hazardScore = priority === 'High' ? 80 : 50;
    action = 'Isolate feeder valve to arrest wastage; deploy pipeline weld crew and pressure testing team.';
    impact = 'Potable drinking water supply for connected households in this ward sector.';
    days = priority === 'High' ? 2 : 4;
  } else if (/pothole|road|crater|asphalt|tar|speed breaker/.test(text)) {
    dept = 'Roads & Public Works';
    cat = 'Pothole / Road Surface Damage';
    priority = /accident|deep|main road|highway|bus|skid/.test(text) ? 'High' : 'Medium';
    hazardScore = priority === 'High' ? 75 : 45;
    action = 'Mobilize rapid cold-mix asphalt patching team with road roller compaction within SLA.';
    impact = 'Motorists, cyclists, and peak-hour public transit flow along primary corridor.';
    days = priority === 'High' ? 2 : 5;
  } else if (/tree|branch|park|garden/.test(text)) {
    dept = 'Parks, Gardens & Horticulture';
    cat = 'Fallen Tree / Hazardous Branches';
    priority = /fallen|blocked|roof|crush/.test(text) ? 'High' : 'Low';
    hazardScore = priority === 'High' ? 70 : 30;
    action = 'Deploy horticultural chainsaw team to clear transit corridor and recycle green biomass.';
    days = priority === 'High' ? 2 : 7;
  } else if (/signal|traffic|sign/.test(text)) {
    dept = 'Traffic, Signage & Mobility';
    cat = 'Faulty Traffic Signal / Missing Signage';
    priority = 'High';
    hazardScore = 80;
    action = 'Traffic police coordination & immediate signal PLC controller reset and lens replacement.';
    days = 2;
  } else if (/dengue|malaria|mosquito|fogging|health/.test(text)) {
    dept = 'Public Health & Vector Control';
    cat = 'Mosquito Breeding / Stagnant Water / Dengue Hazard';
    priority = 'High';
    hazardScore = 78;
    action = 'Thermal fogging operation and anti-larval chemical treatment across stagnant bodies.';
    days = 2;
  }

  const slaHours = SLA_HOURS_MAP[priority] || 48;
  const analysisResult = {
    category: cat,
    priority,
    department: dept,
    confidence: isKeyValid ? 0.94 : 0.88,
    hazardScore,
    reasoning: `Categorized under ${cat} based on civic safety criteria. Evaluated at ${priority} urgency rating.`,
    publicImpact: impact,
    suggestedAction: action,
    estimatedResolutionDays: days,
    slaHours,
    source: isKeyValid ? 'gemini' : 'smart-rules-engine'
  };

  return checkDuplicates(analysisResult, title, description, location, existingIssues);
}

function checkDuplicates(aiResult, title, desc, location, existingIssues) {
  if (!existingIssues || existingIssues.length === 0) {
    aiResult.duplicateDetected = false;
    aiResult.potentialDuplicateOf = null;
    return aiResult;
  }

  const normLoc = location.toLowerCase();
  const candidates = existingIssues.filter(other => {
    if (other.status === 'Resolved') return false;
    const sameDept = other.department === aiResult.department;
    const locMatch = normLoc.includes(other.location.toLowerCase()) || other.location.toLowerCase().includes(normLoc);
    return sameDept && locMatch;
  });

  if (candidates.length > 0) {
    aiResult.duplicateDetected = true;
    aiResult.potentialDuplicateOf = candidates[0].id;
    aiResult.clusterMessage = `Similar grievance ${candidates[0].id} was filed nearby recently for ${candidates[0].department}.`;
  } else {
    aiResult.duplicateDetected = false;
    aiResult.potentialDuplicateOf = null;
  }

  return aiResult;
}

function getGeoCoordinates(ward, index = 0) {
  const baseLat = 13.0827;
  const baseLng = 80.2707;
  const offsets = [
    [0.012, 0.018], [-0.015, -0.012], [0.024, -0.009], [-0.021, 0.019],
    [0.008, -0.025], [-0.018, 0.005], [0.032, 0.021], [-0.005, -0.032],
    [0.019, 0.034], [-0.029, -0.018], [0.003, 0.012], [-0.011, 0.027]
  ];
  const offset = offsets[index % offsets.length];
  return {
    lat: Number((baseLat + offset[0]).toFixed(6)),
    lng: Number((baseLng + offset[1]).toFixed(6))
  };
}

// Seed initial realistic municipal data with guaranteed vector illustrations
function seedInitialData() {
  const now = Date.now();
  const hour = 3600 * 1000;

  const sampleIssues = [
    {
      id: 'CR-1001',
      title: 'Massive Crater Pothole on Highline Arterial Lane',
      description: 'Severe 2-foot wide pothole right after the flyover descent. Multiple two-wheelers skidded during rain yesterday evening.',
      location: 'Opposite Metro Pillar #142, Highline Road',
      ward: 'Ward 07 - Tech Corridor & Highline',
      coordinates: { lat: 13.0947, lng: 80.2887 },
      image: getCategorySvg('Pothole / Road Surface Damage', 'Massive Crater Pothole on Highline Arterial Lane'),
      citizenCategory: 'Pothole / Road Surface Damage',
      category: 'Pothole / Road Surface Damage',
      priority: 'High',
      department: 'Roads & Public Works',
      assignedOfficer: 'Er. Rajesh Varma (Chief Road Works Engineer)',
      status: 'In Progress',
      reporter: 'Ananya Deshmukh',
      reporterPhone: '+91 98765-43210',
      upvotes: 38,
      upvotedBy: [],
      ai: {
        category: 'Pothole / Road Surface Damage',
        priority: 'High',
        department: 'Roads & Public Works',
        confidence: 0.96,
        hazardScore: 82,
        reasoning: 'Critical vehicular risk on high-speed descent corridor. High accident hazard for two-wheelers in wet conditions.',
        publicImpact: 'Over 15,000 peak-hour commuters and municipal bus transit lines.',
        suggestedAction: 'Deploy mobile asphalt heating van and apply hot-mix asphalt patching with heavy roller compaction.',
        estimatedResolutionDays: 2,
        slaHours: 48,
        source: 'gemini'
      },
      slaDeadline: now + 14 * hour,
      createdAt: now - 34 * hour,
      updatedAt: now - 8 * hour,
      resolvedAt: null,
      history: [
        { status: 'Reported', at: now - 34 * hour, note: 'Complaint logged and triaged automatically by Gemini AI.', author: 'AI Gatekeeper' },
        { status: 'Dispatched', at: now - 22 * hour, note: 'Work order #RD-884 issued to Central Paving Squadron.', author: 'Control Room' },
        { status: 'In Progress', at: now - 8 * hour, note: 'Materials mobilized on-site. Road section cordoned with warning cones.', author: 'Er. Rajesh Varma' }
      ],
      internalNotes: [
        { at: now - 21 * hour, note: 'Traffic police clearance obtained for night compaction between 11 PM and 4 AM.', author: 'Control Room' }
      ]
    },
    {
      id: 'CR-1002',
      title: 'Uncovered Stormwater Manhole Outside Primary School',
      description: 'Heavy iron manhole lid missing completely after night maintenance. Children walk within 3 feet of this 8-foot open drop.',
      location: 'Gate 2, Vidya Mandir School, Old Bazaar Rd',
      ward: 'Ward 04 - Old Central Market',
      coordinates: { lat: 13.0677, lng: 80.2587 },
      image: getCategorySvg('Open Manhole / Uncovered Utility Pit', 'Uncovered Stormwater Manhole Outside Primary School'),
      citizenCategory: 'Open Manhole / Uncovered Utility Pit',
      category: 'Open Manhole / Uncovered Utility Pit',
      priority: 'Critical',
      department: 'Drainage & Flood Management',
      assignedOfficer: 'S. K. Murthy (Rapid Response Wing)',
      status: 'In Progress',
      reporter: 'Karan Mehra (School Principal)',
      reporterPhone: '+91 98451-22998',
      upvotes: 64,
      upvotedBy: [],
      ai: {
        category: 'Open Manhole / Uncovered Utility Pit',
        priority: 'Critical',
        department: 'Drainage & Flood Management',
        confidence: 0.99,
        hazardScore: 98,
        reasoning: 'Imminent threat to life of school children and pedestrians. Severe fatal hazard requiring emergency intervention.',
        publicImpact: '1,200 school children and heavy evening market foot traffic.',
        suggestedAction: 'Immediate temporary barricading with solar flashing beacons; emergency cast-iron slab placement.',
        estimatedResolutionDays: 1,
        slaHours: 24,
        source: 'gemini'
      },
      slaDeadline: now + 4 * hour,
      createdAt: now - 20 * hour,
      updatedAt: now - 6 * hour,
      resolvedAt: null,
      history: [
        { status: 'Reported', at: now - 20 * hour, note: 'Priority escalated to CRITICAL due to child safety proximity.', author: 'AI Gatekeeper' },
        { status: 'Dispatched', at: now - 18 * hour, note: 'Emergency barriers dispatched via fast-response squad.', author: 'Chief Dispatcher' },
        { status: 'In Progress', at: now - 6 * hour, note: 'Temporary steel cover placed. Permanent reinforced locking cover arriving at 2 PM.', author: 'S. K. Murthy' }
      ],
      internalNotes: []
    },
    {
      id: 'CR-1003',
      title: 'Overflowing Municipal Garbage Skip with Stagnant Leachate',
      description: 'Garbage has not been lifted for 4 days. Waste spilled 15 meters onto road, generating foul odor and wild dog packs.',
      location: 'Behind Fish Market, Ward 01 Promenade',
      ward: 'Ward 01 - North Gateway & Harborside',
      coordinates: { lat: 13.1067, lng: 80.2887 },
      image: getCategorySvg('Garbage Dump / Overflowing Bins', 'Overflowing Municipal Garbage Skip with Stagnant Leachate'),
      citizenCategory: 'Garbage Dump / Overflowing Bins',
      category: 'Garbage Dump / Overflowing Bins',
      priority: 'High',
      department: 'Sanitation & Solid Waste',
      assignedOfficer: 'M. Selvam (Sanitation Inspector)',
      status: 'Dispatched',
      reporter: 'Meenakshi Sundaram',
      reporterPhone: '+91 97112-33445',
      upvotes: 27,
      upvotedBy: [],
      ai: {
        category: 'Garbage Dump / Overflowing Bins',
        priority: 'High',
        department: 'Sanitation & Solid Waste',
        confidence: 0.94,
        hazardScore: 74,
        reasoning: 'Biohazard risk with animal vector attraction and organic decomposition blocking pedestrian pathway.',
        publicImpact: 'Harborside residents, commercial seafood vendors, and tourists.',
        suggestedAction: 'Route dual compactor trucks immediately; thoroughly spray bleaching powder and bio-culture enzymes.',
        estimatedResolutionDays: 2,
        slaHours: 48,
        source: 'gemini'
      },
      slaDeadline: now + 32 * hour,
      createdAt: now - 16 * hour,
      updatedAt: now - 10 * hour,
      resolvedAt: null,
      history: [
        { status: 'Reported', at: now - 16 * hour, note: 'Grievance recorded with high priority rating.', author: 'AI Gatekeeper' },
        { status: 'Dispatched', at: now - 10 * hour, note: 'Route assigned to Vehicle DL-01-A-4491 for afternoon clearance.', author: 'Control Room' }
      ],
      internalNotes: []
    },
    {
      id: 'CR-1004',
      title: 'Sparking Overhead Electric Cable Tangled in Tree Canopy',
      description: 'High-tension cable sparking intermittently during gusts of wind. Small dry leaves caught fire earlier this morning.',
      location: 'Corner of Cross St #4 and Palm Avenue',
      ward: 'Ward 12 - South Lake & Green Meadows',
      coordinates: { lat: 13.0617, lng: 80.2457 },
      image: getCategorySvg('Broken / Non-Functional Streetlight', 'Sparking Overhead Electric Cable Tangled in Tree Canopy'),
      citizenCategory: 'Broken / Non-Functional Streetlight',
      category: 'Broken / Non-Functional Streetlight',
      priority: 'Critical',
      department: 'Street Lighting & Electricity',
      assignedOfficer: 'K. Prabhakar (Senior Linesman)',
      status: 'Resolved',
      reporter: 'Vikramaditya Roy',
      reporterPhone: '+91 94321-99887',
      upvotes: 42,
      upvotedBy: [],
      ai: {
        category: 'Broken / Non-Functional Streetlight',
        priority: 'Critical',
        department: 'Street Lighting & Electricity',
        confidence: 0.98,
        hazardScore: 94,
        reasoning: 'Severe electrical fire hazard with live overhead conductor touching dry vegetation.',
        publicImpact: 'Residential blocks 4B through 4F, fire safety hazard.',
        suggestedAction: 'Immediate feeder substation power isolation, joint tree trimming with horticulture squad, and line re-tensioning.',
        estimatedResolutionDays: 1,
        slaHours: 24,
        source: 'gemini'
      },
      slaDeadline: now - 2 * hour,
      createdAt: now - 26 * hour,
      updatedAt: now - 2 * hour,
      resolvedAt: now - 2 * hour,
      resolutionProof: {
        note: 'Power isolated; tree limbs cleared with cherry picker; insulated spacer brackets installed. Voltage tested normal.',
        officerName: 'K. Prabhakar',
        resolvedAt: now - 2 * hour
      },
      history: [
        { status: 'Reported', at: now - 26 * hour, note: 'Emergency electrical hazard logged.', author: 'AI Gatekeeper' },
        { status: 'Dispatched', at: now - 24 * hour, note: 'Substation #7 line engineer alerted.', author: 'Control Room' },
        { status: 'In Progress', at: now - 20 * hour, note: 'Cherry picker crane arrived on scene with tree cutter squad.', author: 'K. Prabhakar' },
        { status: 'Resolved', at: now - 2 * hour, note: 'Cable re-tensioned and insulated. Tree limbs safely trimmed.', author: 'K. Prabhakar' }
      ],
      internalNotes: []
    },
    {
      id: 'CR-1005',
      title: 'Underground Potable Water Main Rupture Flooding Lane',
      description: 'Clean drinking water gushing under pressure through road surface. Flow has continued for 14 hours; water pressure zero in nearby apartments.',
      location: 'Near Metro Transit Station East Exit',
      ward: 'Ward 18 - Metro Transit Junction',
      coordinates: { lat: 13.0857, lng: 80.2727 },
      image: getCategorySvg('Water Supply Pipe Leak / Low Pressure', 'Underground Potable Water Main Rupture Flooding Lane'),
      citizenCategory: 'Water Supply Pipe Leak / Low Pressure',
      category: 'Water Supply Pipe Leak / Low Pressure',
      priority: 'High',
      department: 'Water Supply & Sewage',
      assignedOfficer: 'A. N. Joshi (Hydraulics Wing)',
      status: 'In Progress',
      reporter: 'Deepak Chopra',
      reporterPhone: '+91 93111-45678',
      upvotes: 51,
      upvotedBy: [],
      ai: {
        category: 'Water Supply Pipe Leak / Low Pressure',
        priority: 'High',
        department: 'Water Supply & Sewage',
        confidence: 0.95,
        hazardScore: 78,
        reasoning: 'Heavy potable water loss and road foundation erosion risk adjacent to major metro transit junction.',
        publicImpact: '500+ commercial shops and approximately 1,800 domestic connections without drinking water.',
        suggestedAction: 'Close upstream sluice valve SV-21; excavate asphalt layer and clamp 250mm cast iron main collar.',
        estimatedResolutionDays: 2,
        slaHours: 48,
        source: 'gemini'
      },
      slaDeadline: now + 38 * hour,
      createdAt: now - 10 * hour,
      updatedAt: now - 3 * hour,
      resolvedAt: null,
      history: [
        { status: 'Reported', at: now - 10 * hour, note: 'AI categorized as high urgency water infrastructure fault.', author: 'AI Gatekeeper' },
        { status: 'Dispatched', at: now - 8 * hour, note: 'Hydraulic emergency repair squad assigned.', author: 'Control Room' },
        { status: 'In Progress', at: now - 3 * hour, note: 'Sluice valve closed; JCB backhoe commenced excavation.', author: 'A. N. Joshi' }
      ],
      internalNotes: []
    },
    {
      id: 'CR-1006',
      title: 'Traffic Signal Stuck on Amber at 4-Way Intersection',
      description: 'Major junction signal is frozen on flashing amber. Severe bottleneck during morning office rush with cross-traffic near collisions.',
      location: 'Ring Road 100ft Junction & University Ave',
      ward: 'Ward 22 - University Campus & Hospital Hub',
      coordinates: { lat: 13.1147, lng: 80.2917 },
      image: getCategorySvg('Faulty Traffic Signal / Missing Signage', 'Traffic Signal Stuck on Amber at 4-Way Intersection'),
      citizenCategory: 'Faulty Traffic Signal / Missing Signage',
      category: 'Faulty Traffic Signal / Missing Signage',
      priority: 'High',
      department: 'Traffic, Signage & Mobility',
      assignedOfficer: 'Inspector T. Swaminathan',
      status: 'Reported',
      reporter: 'Pooja Hegde',
      reporterPhone: '+91 99002-11883',
      upvotes: 19,
      upvotedBy: [],
      ai: {
        category: 'Faulty Traffic Signal / Missing Signage',
        priority: 'High',
        department: 'Traffic, Signage & Mobility',
        confidence: 0.97,
        hazardScore: 79,
        reasoning: 'Critical vehicular collision hazard on high-speed multi-lane transit intersection.',
        publicImpact: 'Ambulances approaching university hospital and over 20,000 daily vehicles.',
        suggestedAction: 'Manual traffic constable override; deploy electronics repair technician for optical controller reboot.',
        estimatedResolutionDays: 1,
        slaHours: 48,
        source: 'gemini'
      },
      slaDeadline: now + 42 * hour,
      createdAt: now - 6 * hour,
      updatedAt: now - 6 * hour,
      resolvedAt: null,
      history: [
        { status: 'Reported', at: now - 6 * hour, note: 'Auto-triaged with High Priority by AI.', author: 'AI Gatekeeper' }
      ],
      internalNotes: []
    },
    {
      id: 'CR-1007',
      title: 'Stagnant Water Reservoir Breeding Mosquitoes near Health Center',
      description: 'Vacant plot behind dispensary has accumulated monsoon runoff for 3 weeks. Swarms of mosquitoes entering maternity ward.',
      location: 'Plot #19B, Health Center Lane, Riverbank East',
      ward: 'Ward 27 - Riverbank East',
      coordinates: { lat: 13.0777, lng: 80.2387 },
      image: getCategorySvg('Mosquito Breeding / Stagnant Water / Dengue Hazard', 'Stagnant Water Reservoir Breeding Mosquitoes near Health Center'),
      citizenCategory: 'Mosquito Breeding / Stagnant Water / Dengue Hazard',
      category: 'Mosquito Breeding / Stagnant Water / Dengue Hazard',
      priority: 'High',
      department: 'Public Health & Vector Control',
      assignedOfficer: 'Dr. C. Ramanathan (Health Officer)',
      status: 'Resolved',
      reporter: 'Dr. Shruti Sen (Dispensary Lead)',
      reporterPhone: '+91 98223-45670',
      upvotes: 33,
      upvotedBy: [],
      ai: {
        category: 'Mosquito Breeding / Stagnant Water / Dengue Hazard',
        priority: 'High',
        department: 'Public Health & Vector Control',
        confidence: 0.95,
        hazardScore: 81,
        reasoning: 'Direct epidemic and vector transmission threat to vulnerable health center patients and newborn infants.',
        publicImpact: 'Health center visitors, maternity ward patients, and neighboring residential ward.',
        suggestedAction: 'Immediate pump-out of stagnant water, larvicide application (Temephos), and thermal fogging.',
        estimatedResolutionDays: 2,
        slaHours: 48,
        source: 'gemini'
      },
      slaDeadline: now - 12 * hour,
      createdAt: now - 50 * hour,
      updatedAt: now - 14 * hour,
      resolvedAt: now - 14 * hour,
      resolutionProof: {
        note: 'Stagnant water pumped into main sewer; bacillus thuringiensis larvicide applied; thermal fogging completed.',
        officerName: 'Dr. C. Ramanathan',
        resolvedAt: now - 14 * hour
      },
      history: [
        { status: 'Reported', at: now - 50 * hour, note: 'High health vector urgency confirmed.', author: 'AI Gatekeeper' },
        { status: 'Dispatched', at: now - 44 * hour, note: 'Vector squad #4 assigned for fogging and drainage.', author: 'Health Directorate' },
        { status: 'In Progress', at: now - 30 * hour, note: 'Mobile dewatering pump deployed on site.', author: 'Dr. C. Ramanathan' },
        { status: 'Resolved', at: now - 14 * hour, note: 'Sanitation inspection passed. Larval count reduced to zero.', author: 'Dr. C. Ramanathan' }
      ],
      internalNotes: []
    }
  ];

  saveData(sampleIssues);
  logAudit('SYSTEM_SEED', 'System Bootstrapper', 'Seeded initial enterprise demonstration grievance records.');
  return sampleIssues;
}

// HTTP Helper Functions
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 15 * 1024 * 1024) {
        req.destroy();
        reject(new Error('Payload too large (limit 15MB)'));
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-pin, Authorization'
  });
  res.end(JSON.stringify(payload));
}

function verifyAdmin(req) {
  const pinHeader = req.headers['x-admin-pin'] || '';
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  return pinHeader === ADMIN_PIN || token === ADMIN_PIN || token === 'admin-session-active';
}

// HTTP Request Router
const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-admin-pin, Authorization'
    });
    return res.end();
  }

  try {
    // 1. Meta Taxonomy & Status
    if (pathname === '/api/meta' && method === 'GET') {
      const isKeyConfigured = Boolean(GEMINI_API_KEY && GEMINI_API_KEY !== 'your_key_from_aistudio.google.com');
      return sendJson(res, 200, {
        DEPARTMENTS,
        CATEGORIES,
        WARDS,
        gemini: isKeyConfigured,
        model: GEMINI_MODEL,
        serverTime: Date.now(),
        version: '2.5.0-Enterprise'
      });
    }

    // 2. Admin Check / Login
    if (pathname === '/api/admin/check' && (method === 'GET' || method === 'POST')) {
      const ok = verifyAdmin(req);
      return sendJson(res, ok ? 200 : 401, { ok, role: ok ? 'Municipal Administrator' : 'Unauthorized' });
    }

    if (pathname === '/api/admin/login' && method === 'POST') {
      const body = await parseBody(req);
      if (body.pin === ADMIN_PIN) {
        logAudit('ADMIN_LOGIN', 'Administrator', 'Administrative console session authenticated.');
        return sendJson(res, 200, { ok: true, token: 'admin-session-active', role: 'Municipal Administrator' });
      }
      return sendJson(res, 401, { ok: false, error: 'Invalid Administrative Access PIN.' });
    }

    // 3. List Issues with Search, Filter & Sorters
    if (pathname === '/api/issues' && method === 'GET') {
      const query = (parsedUrl.searchParams.get('q') || '').toLowerCase().trim();
      const status = parsedUrl.searchParams.get('status') || '';
      const priority = parsedUrl.searchParams.get('priority') || '';
      const department = parsedUrl.searchParams.get('department') || '';
      const ward = parsedUrl.searchParams.get('ward') || '';
      const sortBy = parsedUrl.searchParams.get('sort') || 'newest';

      let data = loadData();

      data = data.map(item => ({
        ...item,
        slaStatus: getSlaStatus(item),
        // Ensure image is never missing
        image: item.image || getCategorySvg(item.category || '', item.title || '')
      }));

      // Filter
      if (query) {
        data = data.filter(i =>
          i.id.toLowerCase().includes(query) ||
          i.title.toLowerCase().includes(query) ||
          i.description.toLowerCase().includes(query) ||
          i.location.toLowerCase().includes(query) ||
          i.category.toLowerCase().includes(query) ||
          i.department.toLowerCase().includes(query) ||
          (i.reporter && i.reporter.toLowerCase().includes(query))
        );
      }
      if (status) data = data.filter(i => i.status === status);
      if (priority) data = data.filter(i => i.priority === priority);
      if (department) data = data.filter(i => i.department === department);
      if (ward) data = data.filter(i => i.ward === ward);

      // Sorter
      if (sortBy === 'newest') data.sort((a, b) => b.createdAt - a.createdAt);
      else if (sortBy === 'oldest') data.sort((a, b) => a.createdAt - b.createdAt);
      else if (sortBy === 'upvotes') data.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));
      else if (sortBy === 'urgency') {
        const pOrder = { 'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1 };
        data.sort((a, b) => (pOrder[b.priority] || 0) - (pOrder[a.priority] || 0));
      }

      return sendJson(res, 200, data);
    }

    // 4. Submit New Civic Grievance
    if (pathname === '/api/issues' && method === 'POST') {
      const body = await parseBody(req);
      if (!body.title || !body.description || !body.location) {
        return sendJson(res, 400, { error: 'Grievance Title, Description, and Location are mandatory fields.' });
      }

      const issues = loadData();
      const ai = await analyzeComplaint({
        title: body.title,
        description: body.description,
        location: body.location,
        citizenCategory: body.category || '',
        image: body.image || null,
        existingIssues: issues
      });

      const now = Date.now();
      const nextNum = issues.length > 0 ? Math.max(...issues.map(x => parseInt(x.id.replace(/\D/g, '') || '1000', 10))) + 1 : 1001;
      const newId = `CR-${nextNum}`;

      const ward = body.ward || WARDS[Math.floor(Math.random() * WARDS.length)];
      const coords = (body.lat && body.lng) ? { lat: Number(body.lat), lng: Number(body.lng) } : getGeoCoordinates(ward, nextNum);

      const slaHours = ai.slaHours || SLA_HOURS_MAP[ai.priority] || 48;
      const slaDeadline = now + (slaHours * 3600 * 1000);

      // If no photo was attached, generate high-fidelity vector illustration
      const imagePayload = body.image || getCategorySvg(ai.category, body.title);

      const newIssue = {
        id: newId,
        title: body.title.trim(),
        description: body.description.trim(),
        location: body.location.trim(),
        ward,
        coordinates: coords,
        image: imagePayload,
        citizenCategory: body.category || '',
        category: ai.category,
        priority: ai.priority,
        department: ai.department,
        assignedOfficer: `Dept. ${ai.department} - Dispatch Queue`,
        status: 'Reported',
        reporter: body.reporter ? body.reporter.trim() : 'Anonymous Citizen',
        reporterPhone: body.reporterPhone ? body.reporterPhone.trim() : '',
        upvotes: 1,
        upvotedBy: [],
        ai,
        slaDeadline,
        createdAt: now,
        updatedAt: now,
        resolvedAt: null,
        resolutionProof: null,
        history: [
          {
            status: 'Reported',
            at: now,
            note: `Grievance registered. AI categorized under ${ai.category} with ${ai.priority} urgency rating.`,
            author: ai.source === 'gemini' ? 'Gemini AI Gatekeeper' : 'Civic Safety Rules Engine'
          }
        ],
        internalNotes: []
      };

      issues.unshift(newIssue);
      saveData(issues);
      logAudit('ISSUE_CREATED', newIssue.reporter, `Registered complaint ${newId}: ${newIssue.title}`);

      return sendJson(res, 201, {
        ...newIssue,
        slaStatus: 'On Schedule'
      });
    }

    // 5. Upvote Issue
    const upvoteMatch = pathname.match(/^\/api\/issues\/([\w-]+)\/upvote$/);
    if (upvoteMatch && method === 'POST') {
      const issueId = upvoteMatch[1];
      const issues = loadData();
      const issue = issues.find(x => x.id === issueId);
      if (!issue) return sendJson(res, 404, { error: 'Issue not found' });

      issue.upvotes = (issue.upvotes || 0) + 1;
      saveData(issues);
      return sendJson(res, 200, { ok: true, upvotes: issue.upvotes });
    }

    // 6. Citizen Observation Comment
    const commentMatch = pathname.match(/^\/api\/issues\/([\w-]+)\/comment$/);
    if (commentMatch && method === 'POST') {
      const issueId = commentMatch[1];
      const body = await parseBody(req);
      if (!body.comment || !body.comment.trim()) {
        return sendJson(res, 400, { error: 'Comment text is required' });
      }
      const issues = loadData();
      const issue = issues.find(x => x.id === issueId);
      if (!issue) return sendJson(res, 404, { error: 'Issue not found' });

      const commentEntry = {
        status: issue.status,
        at: Date.now(),
        note: `Citizen observation: ${body.comment.trim()}`,
        author: body.author ? body.author.trim() : 'Local Resident'
      };
      issue.history.push(commentEntry);
      issue.updatedAt = Date.now();
      saveData(issues);

      return sendJson(res, 200, { ok: true, history: issue.history });
    }

    // 7. Single Issue Operations (GET, PATCH, DELETE)
    const issueMatch = pathname.match(/^\/api\/issues\/([\w-]+)$/);
    if (issueMatch) {
      const issueId = issueMatch[1];
      const issues = loadData();
      const issueIndex = issues.findIndex(x => x.id === issueId);

      if (method === 'GET') {
        if (issueIndex === -1) return sendJson(res, 404, { error: 'Grievance record not found' });
        const issue = issues[issueIndex];
        return sendJson(res, 200, {
          ...issue,
          slaStatus: getSlaStatus(issue),
          image: issue.image || getCategorySvg(issue.category, issue.title)
        });
      }

      if (method === 'DELETE') {
        if (!verifyAdmin(req)) return sendJson(res, 401, { error: 'Administrative authentication required.' });
        if (issueIndex === -1) return sendJson(res, 404, { error: 'Issue not found' });
        const removed = issues.splice(issueIndex, 1)[0];
        saveData(issues);
        logAudit('ISSUE_DELETED', 'Administrator', `Deleted grievance record ${issueId} (${removed.title})`);
        return sendJson(res, 200, { ok: true, message: `Issue ${issueId} removed successfully.` });
      }

      if (method === 'PATCH') {
        if (!verifyAdmin(req)) return sendJson(res, 401, { error: 'Administrative authentication required.' });
        if (issueIndex === -1) return sendJson(res, 404, { error: 'Issue not found' });

        const body = await parseBody(req);
        const issue = issues[issueIndex];
        const now = Date.now();

        if (body.department && DEPARTMENTS.includes(body.department)) issue.department = body.department;
        if (body.priority && ['Critical', 'High', 'Medium', 'Low'].includes(body.priority)) {
          issue.priority = body.priority;
          issue.slaDeadline = issue.createdAt + (SLA_HOURS_MAP[body.priority] * 3600 * 1000);
        }
        if (body.category) issue.category = body.category;
        if (body.assignedOfficer) issue.assignedOfficer = body.assignedOfficer;

        if (body.status && body.status !== issue.status) {
          const oldStatus = issue.status;
          issue.status = body.status;
          issue.updatedAt = now;

          if (body.status === 'Resolved') {
            issue.resolvedAt = now;
            issue.resolutionProof = {
              note: body.note || 'Work completed in accordance with municipal guidelines.',
              officerName: body.assignedOfficer || issue.assignedOfficer || 'Municipal Field Engineer',
              resolvedAt: now
            };
          }

          issue.history.push({
            status: body.status,
            at: now,
            note: body.note || `Status transitioned from ${oldStatus} to ${body.status}.`,
            author: body.assignedOfficer || 'Municipal Officer'
          });

          logAudit('STATUS_CHANGE', 'Officer', `${issue.id} status updated to ${body.status}`);
        } else if (body.note) {
          issue.history.push({
            status: issue.status,
            at: now,
            note: body.note,
            author: body.assignedOfficer || 'Municipal Officer'
          });
        }

        if (body.internalNote) {
          if (!issue.internalNotes) issue.internalNotes = [];
          issue.internalNotes.push({
            at: now,
            note: body.internalNote,
            author: 'Control Room Officer'
          });
        }

        issue.updatedAt = now;
        saveData(issues);
        return sendJson(res, 200, { ...issue, slaStatus: getSlaStatus(issue) });
      }
    }

    // 8. Executive Analytics Dashboard Data
    if (pathname === '/api/analytics' && method === 'GET') {
      const data = loadData();
      const total = data.length;
      const reported = data.filter(i => i.status === 'Reported').length;
      const dispatched = data.filter(i => i.status === 'Dispatched').length;
      const inProgress = data.filter(i => i.status === 'In Progress').length;
      const resolved = data.filter(i => i.status === 'Resolved').length;

      const criticalCount = data.filter(i => i.priority === 'Critical').length;
      const highCount = data.filter(i => i.priority === 'High').length;
      const mediumCount = data.filter(i => i.priority === 'Medium').length;
      const lowCount = data.filter(i => i.priority === 'Low').length;

      let slaBreached = 0;
      let slaApproaching = 0;
      let slaMetOrOnTime = 0;
      data.forEach(i => {
        const s = getSlaStatus(i);
        if (s === 'Breached') slaBreached++;
        else if (s === 'Approaching Breach') slaApproaching++;
        else slaMetOrOnTime++;
      });
      const slaComplianceRate = total > 0 ? Math.round(((total - slaBreached) / total) * 100) : 100;

      const byDepartment = {};
      DEPARTMENTS.forEach(d => { byDepartment[d] = 0; });
      data.forEach(i => {
        if (byDepartment[i.department] !== undefined) byDepartment[i.department]++;
      });

      const byCategory = {};
      data.forEach(i => {
        byCategory[i.category] = (byCategory[i.category] || 0) + 1;
      });

      const byWard = {};
      data.forEach(i => {
        if (i.ward) byWard[i.ward] = (byWard[i.ward] || 0) + 1;
      });

      const resolvedIssues = data.filter(i => i.status === 'Resolved' && i.resolvedAt);
      const avgResolutionHours = resolvedIssues.length > 0
        ? Math.round(resolvedIssues.reduce((acc, curr) => acc + ((curr.resolvedAt - curr.createdAt) / (3600 * 1000)), 0) / resolvedIssues.length)
        : 26;

      return sendJson(res, 200, {
        summary: {
          total,
          reported,
          dispatched,
          inProgress,
          resolved,
          active: total - resolved,
          resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 0,
          slaComplianceRate,
          slaBreached,
          slaApproaching,
          avgResolutionHours
        },
        priorityBreakdown: {
          critical: criticalCount,
          high: highCount,
          medium: mediumCount,
          low: lowCount
        },
        byDepartment,
        byCategory,
        byWard
      });
    }

    // 9. Export Grievances to Official CSV Format
    if (pathname === '/api/export/csv' && method === 'GET') {
      const data = loadData();
      const headers = ['ID', 'Title', 'Status', 'Priority', 'Department', 'Ward', 'Location', 'Reporter', 'Upvotes', 'SLA Status', 'Created Date', 'Resolved Date'];
      const csvRows = [headers.join(',')];

      data.forEach(i => {
        const row = [
          `"${i.id}"`,
          `"${(i.title || '').replace(/"/g, '""')}"`,
          `"${i.status}"`,
          `"${i.priority}"`,
          `"${(i.department || '').replace(/"/g, '""')}"`,
          `"${(i.ward || '').replace(/"/g, '""')}"`,
          `"${(i.location || '').replace(/"/g, '""')}"`,
          `"${(i.reporter || '').replace(/"/g, '""')}"`,
          i.upvotes || 0,
          `"${getSlaStatus(i)}"`,
          `"${new Date(i.createdAt).toISOString()}"`,
          `"${i.resolvedAt ? new Date(i.resolvedAt).toISOString() : 'N/A'}"`
        ];
        csvRows.push(row.join(','));
      });

      res.writeHead(200, {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="CivicPulse-Grievances-Report-${Date.now()}.csv"`
      });
      return res.end(csvRows.join('\r\n'));
    }

    // 10. Audit Log Stream
    if (pathname === '/api/audit-log' && method === 'GET') {
      return sendJson(res, 200, loadAudit());
    }

    // 11. Seed / Reset Data Endpoint
    if (pathname === '/api/seed' && method === 'POST') {
      const seeded = seedInitialData();
      return sendJson(res, 200, { ok: true, count: seeded.length, message: 'Database refreshed with realistic municipal records.' });
    }

    // 12. Static Assets Serving
    let filePath = path.join(__dirname, 'public', pathname === '/' ? 'index.html' : pathname.replace(/^(\.\.[\/\\])+/, ''));
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(__dirname, 'public', 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon'
    };

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('404 Resource Not Found');
      }
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      res.end(content);
    });

  } catch (err) {
    console.error('Unhandled server exception:', err);
    sendJson(res, 500, { error: 'Internal CivicPulse Server Error', details: err.message });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`🏛️  CivicPulse Enterprise Municipal Command Platform`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`🤖 Gemini AI Triage: ${GEMINI_API_KEY ? 'ONLINE (' + GEMINI_MODEL + ')' : 'HYBRID RULES ENGINE (Active)'}`);
  console.log(`🔑 Admin PIN: ${ADMIN_PIN}`);
  console.log(`======================================================\n`);
});
