/**
 * CivicPulse Enterprise - Client Application Engine
 * High-performance UI Controller, Chart Visualizations & Spatial Engine
 */

// Global State
let APP_STATE = {
  meta: { DEPARTMENTS: [], CATEGORIES: [], WARDS: [], gemini: false },
  issues: [],
  analytics: null,
  activeTab: 'dashboard',
  isAdmin: false,
  adminToken: sessionStorage.getItem('civicpulse_pin') || '',
  selectedIssueId: null,
  map: null,
  mapMarkers: [],
  deptChart: null,
  catChart: null,
  searchDebounceTimer: null,
  preTriageDebounceTimer: null,
  attachedImageBase64: null
};

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', async () => {
  startClock();
  await loadMetadata();
  await refreshData();
  lucide.createIcons();
});

// Live Clock in Sub-header
function startClock() {
  const el = document.getElementById('system-time');
  const update = () => {
    if (el) el.textContent = new Date().toLocaleTimeString('en-US', { hour12: false });
  };
  update();
  setInterval(update, 1000);
}

// ================= API CALLS =================
async function apiRequest(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(APP_STATE.adminToken ? { 'x-admin-pin': APP_STATE.adminToken } : {}),
    ...(options.headers || {})
  };

  try {
    const res = await fetch(endpoint, { ...options, headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Server error occurred');
    return data;
  } catch (err) {
    console.error(`API Error on ${endpoint}:`, err);
    throw err;
  }
}

async function loadMetadata() {
  try {
    const meta = await apiRequest('/api/meta');
    APP_STATE.meta = meta;

    // AI Status Indicator
    const aiText = document.getElementById('ai-status-text');
    if (aiText) {
      aiText.textContent = meta.gemini ? `Gemini Active (${meta.model})` : 'Rules Triage Active';
    }

    // Populate Dropdowns
    populateDropdowns(meta);

    // Verify Admin session if token exists
    if (APP_STATE.adminToken) {
      try {
        const auth = await apiRequest('/api/admin/check');
        if (auth.ok) {
          APP_STATE.isAdmin = true;
          updateAuthUI();
        }
      } catch {
        APP_STATE.adminToken = '';
        sessionStorage.removeItem('civicpulse_pin');
      }
    }
  } catch (e) {
    showToast('Failed to load municipal taxonomy', 'error');
  }
}

function populateDropdowns(meta) {
  // Ward selectors
  const wardSelects = ['form-ward', 'public-filter-ward'];
  wardSelects.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    meta.WARDS.forEach(ward => {
      const opt = document.createElement('option');
      opt.value = ward;
      opt.textContent = ward;
      el.appendChild(opt);
    });
  });

  // Category selectors
  const catEl = document.getElementById('form-cat');
  if (catEl && meta.CATEGORIES) {
    meta.CATEGORIES.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      catEl.appendChild(opt);
    });
  }

  // Department filters
  const deptSelects = ['tbl-filter-dept', 'adm-set-dept'];
  deptSelects.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    meta.DEPARTMENTS.forEach(dept => {
      const opt = document.createElement('option');
      opt.value = dept;
      opt.textContent = dept;
      el.appendChild(opt);
    });
  });
}

// Fetch all issues & refresh UI
async function refreshData() {
  try {
    const [issues, analytics] = await Promise.all([
      apiRequest('/api/issues'),
      apiRequest('/api/analytics')
    ]);
    APP_STATE.issues = issues;
    APP_STATE.analytics = analytics;

    updateKPIs(analytics);
    renderDashboard();
    renderCharts(analytics);
    renderPublicFeed();
    if (APP_STATE.activeTab === 'map') renderMapMarkers();

    lucide.createIcons();
  } catch (err) {
    showToast('Data synchronization failed', 'error');
  }
}

// ================= NAVIGATION / TABS =================
function switchTab(tabId) {
  APP_STATE.activeTab = tabId;
  const tabs = ['dashboard', 'map', 'report', 'tracker'];

  tabs.forEach(t => {
    const view = document.getElementById(`view-${t}`);
    const btn = document.getElementById(`tab-btn-${t}`);
    if (view) view.classList.toggle('hidden', t !== tabId);
    if (btn) {
      if (t === tabId) {
        btn.className = 'nav-tab active flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all text-white bg-slate-700';
      } else {
        btn.className = 'nav-tab flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all text-slate-300 hover:text-white';
      }
    }
  });

  if (tabId === 'map') {
    setTimeout(initOrUpdateMap, 150);
  }

  lucide.createIcons();
}

// ================= KPI METRICS & CHARTS =================
function updateKPIs(analytics) {
  if (!analytics || !analytics.summary) return;
  const s = analytics.summary;

  document.getElementById('kpi-total').textContent = s.total;
  document.getElementById('kpi-active').textContent = s.active;
  document.getElementById('kpi-rate').textContent = `${s.resolutionRate}%`;
  document.getElementById('kpi-resolved-count').textContent = `(${s.resolved} resolved)`;
  document.getElementById('kpi-sla').textContent = `${s.slaComplianceRate}%`;

  // SLA hazard banner
  const alertBox = document.getElementById('sla-hazard-alert');
  const countEl = document.getElementById('sla-hazard-count');
  if (s.slaBreached > 0 || s.slaApproaching > 0) {
    alertBox.classList.remove('hidden');
    countEl.textContent = `${s.slaBreached + s.slaApproaching} high-urgency grievances`;
  } else {
    alertBox.classList.add('hidden');
  }
}

function renderCharts(analytics) {
  if (!analytics) return;

  // Department Workload Chart
  const deptCtx = document.getElementById('chart-departments');
  if (deptCtx) {
    const deptLabels = Object.keys(analytics.byDepartment).map(d => d.replace('&', '+'));
    const deptData = Object.values(analytics.byDepartment);

    if (APP_STATE.deptChart) {
      APP_STATE.deptChart.destroy();
    }

    APP_STATE.deptChart = new Chart(deptCtx, {
      type: 'bar',
      data: {
        labels: deptLabels,
        datasets: [{
          label: 'Active Grievances',
          data: deptData,
          backgroundColor: '#4f46e5',
          borderRadius: 6,
          barThickness: 16
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { family: 'Plus Jakarta Sans', size: 10 }, stepSize: 1 }
          },
          y: {
            grid: { display: false },
            ticks: { font: { family: 'Plus Jakarta Sans', size: 10 } }
          }
        }
      }
    });
  }

  // Category Donut Chart
  const catCtx = document.getElementById('chart-categories');
  if (catCtx) {
    const topCats = Object.entries(analytics.byCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const catLabels = topCats.map(c => c[0].split('/')[0].trim());
    const catData = topCats.map(c => c[1]);

    if (APP_STATE.catChart) {
      APP_STATE.catChart.destroy();
    }

    APP_STATE.catChart = new Chart(catCtx, {
      type: 'doughnut',
      data: {
        labels: catLabels,
        datasets: [{
          data: catData,
          backgroundColor: ['#4f46e5', '#0284c7', '#10b981', '#f59e0b', '#ef4444'],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 10, font: { family: 'Plus Jakarta Sans', size: 10 } }
          }
        }
      }
    });
  }
}

// ================= DASHBOARD TABLE =================
function renderDashboard() {
  const tbody = document.getElementById('dashboard-table-body');
  if (!tbody) return;

  const search = (document.getElementById('tbl-search')?.value || '').toLowerCase().trim();
  const deptFilter = document.getElementById('tbl-filter-dept')?.value || '';
  const statusFilter = document.getElementById('tbl-filter-status')?.value || '';
  const priorityFilter = document.getElementById('tbl-filter-priority')?.value || '';

  const filtered = APP_STATE.issues.filter(i => {
    if (deptFilter && i.department !== deptFilter) return false;
    if (statusFilter && i.status !== statusFilter) return false;
    if (priorityFilter && i.priority !== priorityFilter) return false;
    if (search) {
      return (
        i.id.toLowerCase().includes(search) ||
        i.title.toLowerCase().includes(search) ||
        i.location.toLowerCase().includes(search) ||
        i.department.toLowerCase().includes(search)
      );
    }
    return true;
  });

  document.getElementById('queue-count-badge').textContent = `${filtered.length} records`;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="py-8 text-center text-slate-400">
          <i data-lucide="inbox" class="w-8 h-8 mx-auto mb-2 opacity-50"></i>
          <p>No civic complaints match the selected filter criteria.</p>
        </td>
      </tr>
    `;
    lucide.createIcons();
    return;
  }

  tbody.innerHTML = filtered.map(item => {
    const prioBadge = getPriorityBadgeHtml(item.priority);
    const statusBadge = getStatusBadgeHtml(item.status);
    const slaBadge = getSlaBadgeHtml(item.slaStatus);

    return `
      <tr class="hover:bg-slate-50/80 transition-colors">
        <td class="py-3 px-4 font-mono font-bold text-indigo-600">
          <button onclick="openDetailsModal('${item.id}')" class="hover:underline flex items-center space-x-1">
            <span>${item.id}</span>
            <i data-lucide="external-link" class="w-3 h-3 text-slate-400"></i>
          </button>
        </td>
        <td class="py-3 px-4 max-w-xs">
          <div class="font-bold text-slate-900 truncate" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</div>
          <div class="text-[11px] text-slate-400 truncate">${escapeHtml(item.location)} &middot; ${escapeHtml(item.ward || 'Central')}</div>
        </td>
        <td class="py-3 px-4 text-slate-700">
          <div class="truncate max-w-[150px]" title="${escapeHtml(item.department)}">${escapeHtml(item.department)}</div>
        </td>
        <td class="py-3 px-4 whitespace-nowrap">
          <div class="flex items-center space-x-1.5">
            ${prioBadge}
            ${slaBadge}
          </div>
        </td>
        <td class="py-3 px-4 whitespace-nowrap">
          ${statusBadge}
        </td>
        <td class="py-3 px-4 whitespace-nowrap font-mono text-slate-600">
          <button onclick="upvoteIssue('${item.id}')" class="flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 transition">
            <i data-lucide="thumbs-up" class="w-3 h-3 text-slate-500"></i>
            <span>${item.upvotes || 1}</span>
          </button>
        </td>
        <td class="py-3 px-4 text-right whitespace-nowrap">
          <div class="flex items-center justify-end space-x-1.5">
            <button onclick="openDetailsModal('${item.id}')" title="Inspect Triage Dossier" class="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100">
              <i data-lucide="eye" class="w-4 h-4"></i>
            </button>
            <button onclick="openOfficerActionModal('${item.id}')" title="Officer Dispatch Action" class="px-2 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-[11px] font-bold flex items-center space-x-1">
              <i data-lucide="edit-3" class="w-3 h-3"></i>
              <span>Dispatch</span>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  lucide.createIcons();
}

function debounceFilter() {
  clearTimeout(APP_STATE.searchDebounceTimer);
  APP_STATE.searchDebounceTimer = setTimeout(renderDashboard, 200);
}

// ================= SPATIAL MAP (LEAFLET) =================
function initOrUpdateMap() {
  const mapContainer = document.getElementById('city-map');
  if (!mapContainer) return;

  if (!APP_STATE.map) {
    // Initialize Leaflet Map around city coordinates
    APP_STATE.map = L.map('city-map').setView([13.0827, 80.2707], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors | CivicPulse GIS'
    }).addTo(APP_STATE.map);
  } else {
    APP_STATE.map.invalidateSize();
  }

  renderMapMarkers();
}

function renderMapMarkers() {
  if (!APP_STATE.map) return;

  // Clear existing markers
  APP_STATE.mapMarkers.forEach(m => APP_STATE.map.removeLayer(m));
  APP_STATE.mapMarkers = [];

  const bounds = [];

  APP_STATE.issues.forEach(issue => {
    if (!issue.coordinates || !issue.coordinates.lat || !issue.coordinates.lng) return;

    const lat = issue.coordinates.lat;
    const lng = issue.coordinates.lng;
    bounds.push([lat, lng]);

    // Choose Pin Color Class
    let pinClass = 'pin-medium';
    if (issue.priority === 'Critical') pinClass = 'pin-critical';
    else if (issue.priority === 'High') pinClass = 'pin-high';
    else if (issue.priority === 'Low') pinClass = 'pin-low';

    const customIcon = L.divIcon({
      className: 'custom-leaflet-pin',
      html: `<div class="custom-map-pin ${pinClass}"><i data-lucide="alert-circle" style="width:16px;height:16px"></i></div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    const marker = L.marker([lat, lng], { icon: customIcon }).addTo(APP_STATE.map);

    const popupContent = `
      <div style="font-family: 'Plus Jakarta Sans', sans-serif; min-width: 200px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <strong style="font-size:11px; color:#4f46e5;">${issue.id}</strong>
          <span style="font-size:10px; font-weight:600; padding:1px 6px; border-radius:4px; background:#f1f5f9;">${issue.priority}</span>
        </div>
        <h4 style="font-size:13px; font-weight:bold; margin:0 0 4px; color:#0f172a;">${escapeHtml(issue.title)}</h4>
        <p style="font-size:11px; color:#64748b; margin:0 0 6px;">${escapeHtml(issue.location)}</p>
        <button onclick="openDetailsModal('${issue.id}')" style="background:#4f46e5; color:white; border:none; padding:4px 8px; font-size:11px; border-radius:4px; cursor:pointer; width:100%; font-weight:600;">
          Inspect Dossier
        </button>
      </div>
    `;

    marker.bindPopup(popupContent);
    APP_STATE.mapMarkers.push(marker);
  });

  if (bounds.length > 0) {
    APP_STATE.map.fitBounds(bounds, { padding: [40, 40] });
  }

  lucide.createIcons();
}

// ================= CITIZEN FORM & LIVE PRE-TRIAGE =================
function updateAiPreTriage() {
  clearTimeout(APP_STATE.preTriageDebounceTimer);
  APP_STATE.preTriageDebounceTimer = setTimeout(() => {
    const title = document.getElementById('form-title')?.value || '';
    const desc = document.getElementById('form-desc')?.value || '';
    const loc = document.getElementById('form-loc')?.value || '';

    const text = `${title} ${desc} ${loc}`.toLowerCase();
    const deptEl = document.getElementById('ai-live-dept');
    const prioEl = document.getElementById('ai-live-priority');
    const barEl = document.getElementById('ai-live-hazard-bar');
    const valEl = document.getElementById('ai-live-hazard-val');
    const slaEl = document.getElementById('ai-live-sla');
    const dupBox = document.getElementById('ai-live-dup-box');
    const dupText = document.getElementById('ai-live-dup-text');

    if (text.trim().length < 4) {
      deptEl.textContent = '-- Typing to predict --';
      prioEl.textContent = 'Medium (Estimated)';
      barEl.style.width = '35%';
      barEl.className = 'bg-emerald-500 h-2.5 rounded-full transition-all duration-300';
      valEl.textContent = '35/100';
      slaEl.textContent = '48 Hours turn-around';
      dupBox.classList.add('hidden');
      return;
    }

    let dept = 'Roads & Public Works';
    let prio = 'Medium';
    let hazard = 45;
    let sla = '120 Hours (5 Days)';

    if (/wire|electric|spark|shock|transformer|pole/.test(text)) {
      dept = 'Street Lighting & Electricity';
      prio = /spark|shock|live|fire/.test(text) ? 'Critical' : 'High';
      hazard = prio === 'Critical' ? 96 : 75;
      sla = prio === 'Critical' ? '24 Hours Emergency' : '48 Hours';
    } else if (/manhole|drain|flood|waterlog|monsoon/.test(text)) {
      dept = 'Drainage & Flood Management';
      prio = /open|missing|child|fall/.test(text) ? 'Critical' : 'High';
      hazard = prio === 'Critical' ? 98 : 80;
      sla = prio === 'Critical' ? '24 Hours Emergency' : '48 Hours';
    } else if (/garbage|waste|dump|trash|stench|bin/.test(text)) {
      dept = 'Sanitation & Solid Waste';
      prio = /hospital|school|rot/.test(text) ? 'High' : 'Medium';
      hazard = prio === 'High' ? 70 : 40;
      sla = '48 Hours Standard';
    } else if (/water|pipe|leak|burst|sewage/.test(text)) {
      dept = 'Water Supply & Sewage';
      prio = /burst|flood|contaminat/.test(text) ? 'High' : 'Medium';
      hazard = 78;
      sla = '48 Hours Rapid';
    } else if (/pothole|crater|asphalt|road/.test(text)) {
      dept = 'Roads & Public Works';
      prio = /accident|deep|skid/.test(text) ? 'High' : 'Medium';
      hazard = prio === 'High' ? 75 : 45;
      sla = '48 Hours Standard';
    }

    deptEl.textContent = dept;
    prioEl.textContent = `${prio} Urgency`;
    valEl.textContent = `${hazard}/100`;
    slaEl.textContent = sla;
    barEl.style.width = `${hazard}%`;

    if (hazard >= 85) {
      barEl.className = 'bg-red-500 h-2.5 rounded-full transition-all duration-300';
      prioEl.className = 'text-sm font-bold text-red-400 mt-0.5';
    } else if (hazard >= 60) {
      barEl.className = 'bg-amber-500 h-2.5 rounded-full transition-all duration-300';
      prioEl.className = 'text-sm font-bold text-amber-400 mt-0.5';
    } else {
      barEl.className = 'bg-emerald-500 h-2.5 rounded-full transition-all duration-300';
      prioEl.className = 'text-sm font-bold text-emerald-400 mt-0.5';
    }

    // Check Duplicate Similarity in client
    const similar = APP_STATE.issues.find(i =>
      i.status !== 'Resolved' &&
      i.department === dept &&
      loc && i.location.toLowerCase().includes(loc.toLowerCase())
    );

    if (similar) {
      dupBox.classList.remove('hidden');
      dupText.textContent = `A similar open report (${similar.id}: ${similar.title}) exists nearby.`;
    } else {
      dupBox.classList.add('hidden');
    }

    lucide.createIcons();
  }, 250);
}

// Image Compression & Preview
function previewImage(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      // Compress to max dimension 800px
      const canvas = document.createElement('canvas');
      const maxDim = 800;
      let w = img.width;
      let h = img.height;
      if (w > h && w > maxDim) {
        h = Math.round((h * maxDim) / w);
        w = maxDim;
      } else if (h > maxDim) {
        w = Math.round((w * maxDim) / h);
        h = maxDim;
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      APP_STATE.attachedImageBase64 = canvas.toDataURL('image/jpeg', 0.75);

      document.getElementById('dropzone-placeholder').classList.add('hidden');
      const previewContainer = document.getElementById('dropzone-preview-container');
      const previewImg = document.getElementById('dropzone-preview');
      previewImg.src = APP_STATE.attachedImageBase64;
      previewContainer.classList.remove('hidden');
      lucide.createIcons();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function clearImagePreview(e) {
  if (e) e.stopPropagation();
  APP_STATE.attachedImageBase64 = null;
  document.getElementById('form-img').value = '';
  document.getElementById('dropzone-preview-container').classList.add('hidden');
  document.getElementById('dropzone-placeholder').classList.remove('hidden');
}

// Grievance Submission
async function submitGrievance(event) {
  event.preventDefault();

  const title = document.getElementById('form-title').value.trim();
  const description = document.getElementById('form-desc').value.trim();
  const location = document.getElementById('form-loc').value.trim();
  const ward = document.getElementById('form-ward').value;
  const category = document.getElementById('form-cat').value;
  const reporter = document.getElementById('form-name').value.trim();
  const reporterPhone = document.getElementById('form-phone').value.trim();

  const submitBtn = document.getElementById('btn-submit-form');
  const submitText = document.getElementById('btn-submit-text');

  submitBtn.disabled = true;
  submitText.textContent = 'Autonomous Gemini AI Triaging...';

  try {
    const newIssue = await apiRequest('/api/issues', {
      method: 'POST',
      body: JSON.stringify({
        title,
        description,
        location,
        ward,
        category,
        reporter,
        reporterPhone,
        image: APP_STATE.attachedImageBase64
      })
    });

    showToast(`Grievance ${newIssue.id} registered successfully!`, 'success');

    // Reset Form
    document.getElementById('grievance-form').reset();
    clearImagePreview();
    updateAiPreTriage();

    await refreshData();

    // Switch to details of this newly created ticket
    openDetailsModal(newIssue.id);
  } catch (err) {
    showToast(err.message || 'Failed to file grievance', 'error');
  } finally {
    submitBtn.disabled = false;
    submitText.textContent = 'Transmit Complaint to Control Room';
  }
}

// ================= PUBLIC FEED & TRACKER =================
function renderPublicFeed() {
  const grid = document.getElementById('public-feed-grid');
  if (!grid) return;

  const search = (document.getElementById('public-search')?.value || '').toLowerCase().trim();
  const wardFilter = document.getElementById('public-filter-ward')?.value || '';
  const statusFilter = document.getElementById('public-filter-status')?.value || '';
  const sortBy = document.getElementById('public-sort')?.value || 'newest';

  let list = [...APP_STATE.issues];

  if (wardFilter) list = list.filter(i => i.ward === wardFilter);
  if (statusFilter) list = list.filter(i => i.status === statusFilter);
  if (search) {
    list = list.filter(i =>
      i.id.toLowerCase().includes(search) ||
      i.title.toLowerCase().includes(search) ||
      i.location.toLowerCase().includes(search) ||
      i.category.toLowerCase().includes(search)
    );
  }

  if (sortBy === 'upvotes') list.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));
  else if (sortBy === 'urgency') {
    const pOrder = { 'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1 };
    list.sort((a, b) => (pOrder[b.priority] || 0) - (pOrder[a.priority] || 0));
  } else {
    list.sort((a, b) => b.createdAt - a.createdAt);
  }

  if (list.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
        <i data-lucide="search-x" class="w-10 h-10 mx-auto mb-2 opacity-50"></i>
        <p class="text-sm">No grievances match the search filter.</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  grid.innerHTML = list.map(item => {
    const prioBadge = getPriorityBadgeHtml(item.priority);
    const statusBadge = getStatusBadgeHtml(item.status);
    const dateStr = new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    return `
      <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover-card flex flex-col justify-between space-y-4">
        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-mono font-bold text-indigo-600">${item.id}</span>
            <div class="flex items-center space-x-1.5">
              ${prioBadge}
              ${statusBadge}
            </div>
          </div>

          <h3 class="font-bold text-slate-900 text-sm line-clamp-1 cursor-pointer hover:text-indigo-600" onclick="openDetailsModal('${item.id}')">${escapeHtml(item.title)}</h3>
          <p class="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">${escapeHtml(item.description)}</p>

          ${item.image ? `
            <div class="mt-3 overflow-hidden rounded-lg border border-slate-100 max-h-36">
              <img src="${item.image}" alt="Grievance evidence" class="w-full h-36 object-cover hover:scale-105 transition-transform duration-300" />
            </div>
          ` : ''}

          <div class="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span class="flex items-center space-x-1">
              <i data-lucide="map-pin" class="w-3 h-3"></i>
              <span class="truncate max-w-[140px]">${escapeHtml(item.location)}</span>
            </span>
            <span>${dateStr}</span>
          </div>
        </div>

        <div class="pt-2 border-t border-slate-100 flex items-center justify-between">
          <button onclick="upvoteIssue('${item.id}')" class="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-xs font-semibold text-slate-700 transition">
            <i data-lucide="heart" class="w-3.5 h-3.5 text-rose-500"></i>
            <span>${item.upvotes || 1} Endorse</span>
          </button>

          <button onclick="openDetailsModal('${item.id}')" class="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1">
            <span>Dossier</span>
            <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');

  lucide.createIcons();
}

function debouncePublicFilter() {
  clearTimeout(APP_STATE.searchDebounceTimer);
  APP_STATE.searchDebounceTimer = setTimeout(renderPublicFeed, 200);
}

function lookupDirectTicket() {
  const input = document.getElementById('direct-ticket-input');
  const id = input?.value.trim().toUpperCase();
  if (!id) return;

  const found = APP_STATE.issues.find(i => i.id.toUpperCase() === id);
  if (found) {
    openDetailsModal(found.id);
  } else {
    showToast(`No ticket found matching ${id}`, 'error');
  }
}

// ================= MODAL: DETAILS DOSSIER =================
function openDetailsModal(issueId) {
  const issue = APP_STATE.issues.find(i => i.id === issueId);
  if (!issue) return;

  APP_STATE.selectedIssueId = issueId;

  document.getElementById('mdl-id').textContent = issue.id;
  document.getElementById('mdl-title').textContent = issue.title;
  document.getElementById('mdl-location').textContent = `${issue.location} · ${issue.ward || 'Central'}`;
  document.getElementById('mdl-desc').textContent = issue.description;

  // Badges
  const prioEl = document.getElementById('mdl-priority-badge');
  prioEl.className = `px-2 py-0.5 rounded text-xs font-semibold priority-${issue.priority.toLowerCase()}`;
  prioEl.textContent = `${issue.priority} Urgency`;

  const statusEl = document.getElementById('mdl-status-badge');
  statusEl.className = `px-2 py-0.5 rounded text-xs font-semibold badge-${issue.status.toLowerCase().replace(' ', '')}`;
  statusEl.textContent = issue.status;

  // Photo
  const photoBox = document.getElementById('mdl-photo-box');
  const photoImg = document.getElementById('mdl-photo');
  if (issue.image) {
    photoImg.src = issue.image;
    photoBox.classList.remove('hidden');
  } else {
    photoBox.classList.add('hidden');
  }

  // Lifecycle Progress Stepper
  const steps = ['Reported', 'Dispatched', 'In Progress', 'Resolved'];
  const curIdx = steps.indexOf(issue.status);

  steps.forEach(step => {
    const stepEl = document.getElementById(`step-${step.toLowerCase().replace(' ', '')}`);
    if (!stepEl) return;
    const sIdx = steps.indexOf(step);
    if (sIdx <= curIdx) {
      stepEl.className = 'py-2 px-1 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 font-bold';
    } else {
      stepEl.className = 'py-2 px-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-400';
    }
  });

  // AI Dossier
  document.getElementById('mdl-ai-source').textContent = issue.ai?.source === 'gemini' ? 'Gemini 2.5 Flash' : 'Municipal Smart Rules';
  document.getElementById('mdl-ai-dept').textContent = issue.department;
  document.getElementById('mdl-officer').textContent = issue.assignedOfficer || 'Queued for Dispatch';
  document.getElementById('mdl-ai-reason').textContent = issue.ai?.reasoning || 'Standard triage parameters evaluated.';
  document.getElementById('mdl-ai-action').textContent = issue.ai?.suggestedAction || 'Deploy on-site engineering team.';

  // Resolution Proof
  const resBox = document.getElementById('mdl-resolution-box');
  if (issue.status === 'Resolved' && issue.resolutionProof) {
    resBox.classList.remove('hidden');
    document.getElementById('mdl-resolution-note').textContent = issue.resolutionProof.note || 'Work completed.';
    document.getElementById('mdl-resolution-officer').textContent = `Certified by: ${issue.resolutionProof.officerName || 'Municipal Inspector'} at ${new Date(issue.resolutionProof.resolvedAt || issue.updatedAt).toLocaleString()}`;
  } else {
    resBox.classList.add('hidden');
  }

  // Audit History
  const histEl = document.getElementById('mdl-history');
  histEl.innerHTML = (issue.history || []).map(h => `
    <div class="flex items-start space-x-2 text-slate-600 border-l-2 border-indigo-300 pl-3 py-1">
      <div class="flex-1">
        <div class="flex items-center space-x-2">
          <span class="font-bold text-slate-800">${escapeHtml(h.author || 'System')}</span>
          <span class="text-[10px] text-slate-400">${new Date(h.at).toLocaleDateString()} ${new Date(h.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <p class="text-xs text-slate-600 mt-0.5">${escapeHtml(h.note || '')}</p>
      </div>
    </div>
  `).join('');

  document.getElementById('modal-details').classList.remove('hidden');
  lucide.createIcons();
}

function closeDetailsModal() {
  document.getElementById('modal-details').classList.add('hidden');
  APP_STATE.selectedIssueId = null;
}

// Add citizen comment to issue
async function postCitizenComment() {
  const input = document.getElementById('comment-input');
  const comment = input?.value.trim();
  if (!comment || !APP_STATE.selectedIssueId) return;

  try {
    await apiRequest(`/api/issues/${APP_STATE.selectedIssueId}/comment`, {
      method: 'POST',
      body: JSON.stringify({ comment })
    });
    input.value = '';
    showToast('Observation logged to public ledger', 'success');
    await refreshData();
    openDetailsModal(APP_STATE.selectedIssueId);
  } catch (e) {
    showToast('Failed to post observation', 'error');
  }
}

// Upvote Grievance
async function upvoteIssue(issueId) {
  try {
    const res = await apiRequest(`/api/issues/${issueId}/upvote`, { method: 'POST' });
    const target = APP_STATE.issues.find(x => x.id === issueId);
    if (target) target.upvotes = res.upvotes;
    renderDashboard();
    renderPublicFeed();
    showToast(`Endorsement recorded (+1) for ${issueId}`, 'info');
  } catch (err) {
    showToast('Failed to record endorsement', 'error');
  }
}

// ================= OFFICER ACTION MODAL (ADMIN) =================
function openOfficerActionModal(issueId) {
  if (!APP_STATE.isAdmin) {
    APP_STATE.selectedIssueId = issueId;
    openAdminModal();
    return;
  }

  const issue = APP_STATE.issues.find(i => i.id === issueId);
  if (!issue) return;

  APP_STATE.selectedIssueId = issueId;
  document.getElementById('adm-action-ticket').textContent = `Ticket: ${issue.id} (${escapeHtml(issue.title)})`;

  document.getElementById('adm-set-status').value = issue.status;
  document.getElementById('adm-set-dept').value = issue.department;
  document.getElementById('adm-set-priority').value = issue.priority;
  document.getElementById('adm-set-officer').value = issue.assignedOfficer || '';
  document.getElementById('adm-set-note').value = '';
  document.getElementById('adm-set-internal').value = '';

  document.getElementById('modal-officer-action').classList.remove('hidden');
  lucide.createIcons();
}

function closeOfficerActionModal() {
  document.getElementById('modal-officer-action').classList.add('hidden');
}

async function saveOfficerAction() {
  if (!APP_STATE.selectedIssueId) return;

  const status = document.getElementById('adm-set-status').value;
  const department = document.getElementById('adm-set-dept').value;
  const priority = document.getElementById('adm-set-priority').value;
  const assignedOfficer = document.getElementById('adm-set-officer').value.trim();
  const note = document.getElementById('adm-set-note').value.trim();
  const internalNote = document.getElementById('adm-set-internal').value.trim();

  try {
    await apiRequest(`/api/issues/${APP_STATE.selectedIssueId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status,
        department,
        priority,
        assignedOfficer,
        note,
        internalNote
      })
    });

    showToast(`Work order for ${APP_STATE.selectedIssueId} successfully updated!`, 'success');
    closeOfficerActionModal();
    await refreshData();
  } catch (err) {
    showToast(err.message || 'Failed to update work order', 'error');
  }
}

async function deleteTicketConfirm() {
  if (!APP_STATE.selectedIssueId) return;
  if (!confirm(`Permanently remove grievance ${APP_STATE.selectedIssueId} from records?`)) return;

  try {
    await apiRequest(`/api/issues/${APP_STATE.selectedIssueId}`, { method: 'DELETE' });
    showToast(`Grievance ${APP_STATE.selectedIssueId} deleted.`, 'info');
    closeOfficerActionModal();
    closeDetailsModal();
    await refreshData();
  } catch (e) {
    showToast('Failed to delete ticket', 'error');
  }
}

// ================= OFFICER AUTHENTICATION =================
function openAdminModal() {
  document.getElementById('modal-login').classList.remove('hidden');
  document.getElementById('admin-pin-input').value = '';
  document.getElementById('login-error-msg').classList.add('hidden');
  document.getElementById('admin-pin-input').focus();
}

function closeAdminModal() {
  document.getElementById('modal-login').classList.add('hidden');
}

async function submitAdminLogin() {
  const pin = document.getElementById('admin-pin-input').value.trim();
  const errEl = document.getElementById('login-error-msg');

  try {
    const res = await apiRequest('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ pin })
    });

    if (res.ok) {
      APP_STATE.isAdmin = true;
      APP_STATE.adminToken = pin;
      sessionStorage.setItem('civicpulse_pin', pin);
      updateAuthUI();
      closeAdminModal();
      showToast('Municipal Officer Console Unlocked!', 'success');

      // If an issue was pending action, open it
      if (APP_STATE.selectedIssueId) {
        openOfficerActionModal(APP_STATE.selectedIssueId);
      }
    }
  } catch (err) {
    errEl.classList.remove('hidden');
  }
}

function updateAuthUI() {
  const btn = document.getElementById('btn-officer-auth');
  const txt = document.getElementById('officer-btn-text');
  if (APP_STATE.isAdmin) {
    btn.className = 'flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition';
    txt.textContent = 'Officer Session Active';
  } else {
    btn.className = 'flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition';
    txt.textContent = 'Officer Portal';
  }
  lucide.createIcons();
}

// ================= EXPORT CSV & SEED DATA =================
function exportCSV() {
  window.location.href = '/api/export/csv';
  showToast('Downloading Municipal Grievance Report...', 'info');
}

async function seedDatabase() {
  if (!confirm('Re-seed the database with realistic demonstration grievance records?')) return;
  try {
    await apiRequest('/api/seed', { method: 'POST' });
    showToast('Database seeded with realistic municipal records!', 'success');
    await refreshData();
  } catch (e) {
    showToast('Failed to seed records', 'error');
  }
}

// ================= HELPERS & TOASTS =================
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getPriorityBadgeHtml(priority) {
  const p = (priority || 'Medium').toLowerCase();
  return `<span class="px-2 py-0.5 rounded text-[11px] font-semibold priority-${p}">${priority}</span>`;
}

function getStatusBadgeHtml(status) {
  const s = (status || 'Reported').toLowerCase().replace(' ', '');
  return `<span class="px-2 py-0.5 rounded text-[11px] font-semibold badge-${s}">${status}</span>`;
}

function getSlaBadgeHtml(slaStatus) {
  if (slaStatus === 'Breached') {
    return `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">SLA BREACH</span>`;
  }
  if (slaStatus === 'Approaching Breach') {
    return `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">SLA &lt;12H</span>`;
  }
  if (slaStatus === 'Met') {
    return `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">SLA MET</span>`;
  }
  return `<span class="px-1.5 py-0.5 rounded text-[10px] font-medium text-slate-500">On Time</span>`;
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const bg = type === 'success' ? 'bg-emerald-600' : type === 'error' ? 'bg-red-600' : 'bg-slate-900';
  toast.className = `${bg} text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-lg flex items-center space-x-2 transition-all transform duration-300 opacity-0 translate-y-2`;

  const iconName = type === 'success' ? 'check-circle' : type === 'error' ? 'alert-triangle' : 'info';
  toast.innerHTML = `<i data-lucide="${iconName}" class="w-4 h-4"></i><span>${escapeHtml(message)}</span>`;

  container.appendChild(toast);
  lucide.createIcons();

  // Animate in
  setTimeout(() => {
    toast.classList.remove('opacity-0', 'translate-y-2');
  }, 10);

  // Animate out
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
