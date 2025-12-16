(function() {
  'use strict';

  // ====== PARTIE 1 : Gestion des images (anciennement script.js) ======
  function initImageLoading() {
    const imgs = document.querySelectorAll('.card img');
    imgs.forEach(img => {
      if (img.complete) {
        img.classList.add('loaded');
      } else {
        img.addEventListener('load', () => img.classList.add('loaded'), { once: true });
      }
    });
  }

  // ====== PARTIE 2 : Widget de métriques (anciennement metrics.js) ======
  const state = {
    fcp: null,
    lcp: null,
    cls: 0,
    totalBlockingTime: 0,
    totalRequests: 0,
    totalBytes: 0
  };

  // Formatters
  const fmtMs = v => (v == null ? '-' : v.toFixed(0) + ' ms');
  const fmtKB = v => (v == null ? '-' : (v / 1024).toFixed(1) + ' KB');

  // Observer FCP
  try {
    const poPaint = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (e.name === 'first-contentful-paint' && state.fcp == null) {
          state.fcp = e.startTime;
          update();
          poPaint.disconnect();
        }
      }
    });
    poPaint.observe({ type: 'paint', buffered: true });
  } catch (err) {}

  // Observer LCP
  try {
    const poLcp = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        state.lcp = e.renderTime || e.loadTime || e.startTime;
      }
      update();
    });
    poLcp.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (err) {}

  // Observer CLS
  try {
    const poCls = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (!e.hadRecentInput) {
          state.cls += e.value;
        }
      }
      update();
    });
    poCls.observe({ type: 'layout-shift', buffered: true });
  } catch (err) {}

  // Observer Long Tasks
  try {
    const poLT = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        state.totalBlockingTime += Math.max(0, e.duration - 50);
      }
      update();
    });
    poLT.observe({ entryTypes: ['longtask'] });
  } catch (err) {}

  // Collecte des ressources
  function collectResources() {
    const entries = performance.getEntriesByType('resource');
    state.totalRequests = entries.length + 1;
    
    let total = 0;
    for (const r of entries) {
      const bytes = (r.transferSize && r.transferSize > 0) ? r.transferSize : (r.encodedBodySize || 0);
      total += bytes;
    }
    state.totalBytes = total;
  }

  // Création du panneau UI
  function createPanel() {
    const panel = document.createElement('div');
    panel.setAttribute('id', 'perf-panel');
    Object.assign(panel.style, {
      position: 'fixed',
      right: '16px',
      bottom: '16px',
      zIndex: '9999',
      width: '320px',
      maxWidth: '90vw',
      fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial',
      background: 'rgba(10,12,28,.9)',
      color: '#E8ECF1',
      border: '1px solid rgba(255,255,255,.12)',
      borderRadius: '12px',
      boxShadow: '0 10px 40px rgba(0,0,0,.5)',
      backdropFilter: 'blur(6px) saturate(120%)',
      padding: '12px 14px'
    });
    
    panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px">
        <strong style="letter-spacing:.2px">Évaluation perfs</strong>
        <div>
          <button id="perf-refresh" style="background:#7C5CFF;color:white;border:0;border-radius:8px;padding:6px 10px;cursor:pointer">Mesurer</button>
          <button id="perf-close" style="background:transparent;color:#c9d1d9;border:1px solid rgba(255,255,255,.2);border-radius:8px;padding:6px 8px;margin-left:6px;cursor:pointer">×</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px">
        <div><div style="opacity:.8">FCP</div><div id="m-fcp" style="font-weight:600">-</div></div>
        <div><div style="opacity:.8">LCP</div><div id="m-lcp" style="font-weight:600">-</div></div>
        <div><div style="opacity:.8">CLS</div><div id="m-cls" style="font-weight:600">-</div></div>
        <div><div style="opacity:.8">TBT (≈)</div><div id="m-tbt" style="font-weight:600">-</div></div>
        <div><div style="opacity:.8">Requêtes</div><div id="m-req" style="font-weight:600">-</div></div>
        <div><div style="opacity:.8">Poids total</div><div id="m-bytes" style="font-weight:600">-</div></div>
      </div>
      <div style="margin-top:8px;font-size:12px;opacity:.8">
        <div id="m-note">Cliquez sur <em>Mesurer</em> après vos modifications.</div>
      </div>
    `;
    
    document.body.appendChild(panel);
    return panel;
  }

  let panel;

  // Mise à jour du panneau
  function update() {
    if (!panel) return;
    
    collectResources();

    const $ = id => panel.querySelector(id);
    $('#m-fcp').textContent = fmtMs(state.fcp);
    $('#m-lcp').textContent = fmtMs(state.lcp);
    $('#m-cls').textContent = state.cls ? state.cls.toFixed(3) : '-';
    $('#m-tbt').textContent = state.totalBlockingTime ? fmtMs(state.totalBlockingTime) : '-';
    $('#m-req').textContent = String(state.totalRequests || '-');
    $('#m-bytes').textContent = state.totalBytes ? fmtKB(state.totalBytes) : '-';

    // Export pour comparaison
    window.__metrics = {
      fcp: state.fcp,
      lcp: state.lcp,
      cls: state.cls,
      tbtApprox: state.totalBlockingTime,
      totalRequests: state.totalRequests,
      totalBytes: state.totalBytes
    };
  }

  // Gestion des événements
  function setupEventListeners() {
    document.addEventListener('click', (e) => {
      if (e.target && e.target.id === 'perf-refresh') {
        update();
      }
      if (e.target && e.target.id === 'perf-close') {
        panel.remove();
      }
    });
  }

  // Initialisation après DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initImageLoading();
      panel = createPanel();
      setupEventListeners();
    });
  } else {
    initImageLoading();
    panel = createPanel();
    setupEventListeners();
  }

  // Mise à jour finale après load complet
  window.addEventListener('load', () => {
    setTimeout(update, 0);
  });

})();