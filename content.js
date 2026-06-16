/* ============================================================================
   Càlcul Nota Provisional FP  ·  Esfer@
   Calcula la QMP (Qualificació del Mòdul Professional) com a mitjana ponderada
   dels RAs, segons les programacions:

   0223 Aplicacions Ofimàtiques:
     QMP = 0,05·QRA1 + 0,15·QRA2 + 0,15·QRA3 + 0,15·QRA4 + 0,10·QRA5
         + 0,10·QRA6 + 0,10·QRA7 + 0,05·QRA8 + 0,05·QRA9 + 0,10·QEM

   1664 Digitalització aplicada als sectors productius:
     QMP = 0,12·QRA1 + 0,28·QRA2 + 0,24·QRA3 + 0,24·QRA4 + 0,12·QRA5
   ========================================================================== */

const MODULS = {
  '0223': {
    nom: 'Aplicacions Ofimàtiques',
    ra: { 1: 0.05, 2: 0.15, 3: 0.15, 4: 0.15, 5: 0.10, 6: 0.10, 7: 0.10, 8: 0.05, 9: 0.05 },
    em: 0.10
  },
  '1664': {
    nom: 'Digitalització aplicada als sectors productius',
    ra: { 1: 0.12, 2: 0.28, 3: 0.24, 4: 0.24, 5: 0.12 },
    em: 0
  }
};

const PANEL_ID = 'calcul-nota-prov-panel';
let actiu = true;
let costat = 'dreta';            // 'dreta' | 'esquerra'
let observer = null;
let debounce = null;

/* --- Utilitats --------------------------------------------------------- */

// Llegeix la qualificació d'un <select>. Retorna {status, num}.
// Assolit-5..10 -> num 5..10 ; NA/EP/PQ/PDT/NP/'' -> status sense num.
function gradeOf(sel) {
  if (!sel) return { status: '', num: null };
  const v = (sel.value || '').replace('string:', '').trim();
  const m = v.match(/^A(\d+)$/);
  if (m) return { status: 'A', num: parseInt(m[1], 10) };
  return { status: v || '', num: null };
}

function fmt(n) {
  return n.toFixed(2).replace('.', ',');
}

// Recull tots els mòduls coneguts presents a la pàgina amb els seus RAs i EM.
function collectModules() {
  const rows = [...document.querySelectorAll('tr.alturallistat')];
  const modules = {};

  // 1a passada: files de mòdul (codi tipus 0223_IC10, sense sufix _NN(RA|EM))
  rows.forEach(r => {
    const codi = (r.cells[0]?.textContent || '').trim();
    if (/_\d+(RA|EM)$/.test(codi)) return;            // és un fill, no un mòdul
    const m = codi.match(/^(\d{4})_/);
    if (!m || !MODULS[m[1]]) return;
    modules[codi] = {
      codi,
      prefix: m[1],
      cfg: MODULS[m[1]],
      provInput: r.querySelector('input[ng-model="contingut.qualificacioProv"]'),
      ras: {},
      em: null
    };
  });

  // 2a passada: fills (RA / EM)
  rows.forEach(r => {
    const codi = (r.cells[0]?.textContent || '').trim();
    const m = codi.match(/^(\d{4})_.*_(\d+)(RA|EM)$/);
    if (!m) return;
    const parentCodi = codi.replace(/_\d+(RA|EM)$/, '');
    const mod = modules[parentCodi];
    if (!mod) return;
    const idx = parseInt(m[2], 10);
    const sel = r.querySelector('select');
    if (m[3] === 'RA') mod.ras[idx] = sel;
    else mod.em = sel;
  });

  return modules;
}

// Calcula la QMP d'un mòdul. NA compta com a 0 (RA no superat).
// EP/PQ/PDT/NP/buit -> pendent (encara no qualificat).
function compute(mod) {
  const cfg = mod.cfg;
  const detall = [];
  let suma = 0;
  const pendents = [];

  const idxs = Object.keys(cfg.ra).map(Number).sort((a, b) => a - b);
  idxs.forEach(idx => {
    const w = cfg.ra[idx];
    const g = gradeOf(mod.ras[idx]);
    let val = null, estat = '';
    if (g.num != null) { val = g.num; suma += w * val; estat = 'Assolit-' + g.num; }
    else if (g.status === 'NA') { val = 0; suma += 0; estat = 'No assolit'; }
    else { pendents.push('RA' + idx); estat = textEstat(g.status); }
    detall.push({ label: 'RA' + idx, w, val, estat, na: g.status === 'NA' });
  });

  if (cfg.em > 0) {
    const g = gradeOf(mod.em);
    let val = null, estat = '';
    if (g.num != null) { val = g.num; suma += cfg.em * val; estat = 'Assolit-' + g.num; }
    else if (g.status === 'NA') { val = 0; estat = 'No assolit'; }
    else { pendents.push('EM'); estat = textEstat(g.status); }
    detall.push({ label: 'EM', w: cfg.em, val, estat, na: g.status === 'NA' });
  }

  const complet = pendents.length === 0;
  const arrodonit = Math.max(1, Math.min(10, Math.round(suma)));
  return { detall, qmp: suma, arrodonit, complet, pendents };
}

function textEstat(s) {
  switch (s) {
    case 'EP': return 'En procés';
    case 'PQ': return 'Pend. qualificar';
    case 'PDT': return 'Pendent';
    case 'NP': return 'No presentat';
    case '': return '—';
    default: return s;
  }
}

/* --- Aplicar el valor al camp de la pàgina ----------------------------- */
function aplicar(mod, valor) {
  const inp = mod.provInput;
  if (!inp) { toast('No s\'ha trobat el camp de qualificació provisional.'); return; }
  if (inp.disabled) { toast('El camp està bloquejat per Esfer@ (falten notes de RAs).'); return; }
  inp.value = valor;
  inp.dispatchEvent(new Event('input', { bubbles: true }));
  inp.dispatchEvent(new Event('change', { bubbles: true }));
  toast('Nota provisional ' + valor + ' aplicada a ' + mod.codi + '.');
}

/* --- Toast ------------------------------------------------------------- */
let toastTimer = null;
function toast(msg) {
  let t = document.getElementById('cnp-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'cnp-toast';
    Object.assign(t.style, {
      position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
      background: '#1d3557', color: '#fff', padding: '10px 18px', borderRadius: '8px',
      zIndex: '100000', fontFamily: "'Segoe UI',Tahoma,sans-serif", fontSize: '13px',
      boxShadow: '0 4px 12px rgba(0,0,0,.35)', maxWidth: '420px', textAlign: 'center'
    });
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.style.opacity = '0'; }, 3000);
}

/* --- Panell ------------------------------------------------------------ */
function refresh() {
  if (!actiu) { eliminarPanell(); return; }

  const modules = collectModules();
  const codis = Object.keys(modules);

  let panel = document.getElementById(PANEL_ID);
  if (!panel) panel = crearPanell();

  const cos = panel.querySelector('#cnp-body');

  if (codis.length === 0) {
    cos.innerHTML = '<div style="padding:10px;color:#555;font-size:12px;">' +
      'No es detecten els mòduls 0223 ni 1664 en aquesta pantalla.</div>';
    return;
  }

  cos.innerHTML = '';
  codis.forEach(codi => {
    const mod = modules[codi];
    const res = compute(mod);
    cos.appendChild(targetaModul(mod, res));
  });
}

function targetaModul(mod, res) {
  const card = document.createElement('div');
  card.className = 'cnp-card';

  const files = res.detall.map(d => {
    const valTxt = d.val != null
      ? `<b>${d.val}</b>`
      : `<span style="color:#c0392b;">${d.estat}</span>`;
    const contrib = d.val != null ? fmt(d.w * d.val) : '—';
    const naMark = d.na ? ' style="color:#c0392b;"' : '';
    return `<tr${naMark}>
      <td>${d.label}</td>
      <td style="text-align:center;">${fmt(d.w)}</td>
      <td style="text-align:center;">${valTxt}</td>
      <td style="text-align:right;">${contrib}</td>
    </tr>`;
  }).join('');

  const completBadge = res.complet
    ? `<span class="cnp-badge cnp-ok">Complet</span>`
    : `<span class="cnp-badge cnp-warn">Falten: ${res.pendents.join(', ')}</span>`;

  const aplicarDisabled = (mod.provInput && !mod.provInput.disabled) ? '' : 'disabled';

  card.innerHTML = `
    <div class="cnp-card-head">
      <span class="cnp-codi">${mod.prefix}</span>
      <span class="cnp-nom">${mod.cfg.nom}</span>
    </div>
    <table class="cnp-table">
      <thead><tr><th>RA</th><th>Pes</th><th>Nota</th><th>Pond.</th></tr></thead>
      <tbody>${files}</tbody>
    </table>
    <div class="cnp-result">
      <div class="cnp-qmp">
        <span class="cnp-qmp-num">${fmt(res.qmp)}</span>
        <span class="cnp-qmp-lbl">QMP &nbsp;→&nbsp; nota <b>${res.arrodonit}</b></span>
      </div>
      ${completBadge}
    </div>
    <button class="cnp-apply" ${aplicarDisabled}>Aplica ${res.arrodonit} al camp</button>
  `;

  card.querySelector('.cnp-apply').addEventListener('click', () => aplicar(mod, res.arrodonit));
  return card;
}

function crearPanell() {
  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.innerHTML = `
    <div id="cnp-toggle" title="Plegar/desplegar">▶</div>
    <div id="cnp-inner">
      <div id="cnp-header">
        <span>📊 Nota provisional</span>
        <span id="cnp-actions">
          <span id="cnp-move" title="Canvia de costat (esquerra/dreta)">⇄</span>
          <span id="cnp-close" title="Amaga">✕</span>
        </span>
      </div>
      <div id="cnp-body"></div>
      <div id="cnp-foot">NA = No assolit (compta com a 0). Comprova abans d'aplicar.</div>
    </div>
  `;
  document.body.appendChild(panel);

  aplicarCostat(panel, costat);

  panel.querySelector('#cnp-toggle').addEventListener('click', () => {
    panel.classList.toggle('cnp-collapsed');
    actualitzarFletxa(panel);
  });
  panel.querySelector('#cnp-move').addEventListener('click', () => {
    costat = (costat === 'esquerra') ? 'dreta' : 'esquerra';
    chrome.storage.local.set({ calculCostat: costat });
    aplicarCostat(panel, costat);
  });
  panel.querySelector('#cnp-close').addEventListener('click', () => {
    actiu = false;
    chrome.storage.local.set({ calculActiu: false });
    eliminarPanell();
  });

  injectarCSS();
  return panel;
}

// Col·loca el panell a l'esquerra o a la dreta i ajusta la fletxa de plegat.
function aplicarCostat(panel, c) {
  panel.classList.toggle('cnp-left', c === 'esquerra');
  actualitzarFletxa(panel);
}

function actualitzarFletxa(panel) {
  const esquerra = panel.classList.contains('cnp-left');
  const plegat = panel.classList.contains('cnp-collapsed');
  const t = panel.querySelector('#cnp-toggle');
  if (!t) return;
  if (esquerra) t.textContent = plegat ? '▶' : '◀';
  else t.textContent = plegat ? '◀' : '▶';
}

function eliminarPanell() {
  const p = document.getElementById(PANEL_ID);
  if (p) p.remove();
}

function injectarCSS() {
  if (document.getElementById('cnp-css')) return;
  const css = document.createElement('style');
  css.id = 'cnp-css';
  css.textContent = `
    #${PANEL_ID}{position:fixed;top:90px;right:0;z-index:9997;
      font-family:'Segoe UI',Tahoma,sans-serif;display:flex;align-items:flex-start;
      transition:transform .3s ease;}
    #${PANEL_ID}.cnp-collapsed{transform:translateX(calc(100% - 22px));}
    /* --- Costat esquerre (mirall) --- */
    #${PANEL_ID}.cnp-left{right:auto;left:0;flex-direction:row-reverse;}
    #${PANEL_ID}.cnp-left.cnp-collapsed{transform:translateX(calc(-100% + 22px));}
    #${PANEL_ID}.cnp-left #cnp-toggle{border-radius:0 6px 6px 0;
      box-shadow:2px 0 5px rgba(0,0,0,.2);}
    #${PANEL_ID}.cnp-left #cnp-inner{border-right:2px solid #2a9d8f;border-left:none;
      border-radius:0 8px 8px 0;}
    #cnp-toggle{background:#2a9d8f;color:#fff;cursor:pointer;padding:14px 4px;
      border-radius:6px 0 0 6px;font-size:12px;box-shadow:-2px 0 5px rgba(0,0,0,.2);
      align-self:center;}
    #cnp-inner{width:270px;background:rgba(247,250,250,.98);border:2px solid #2a9d8f;
      border-right:none;border-radius:8px 0 0 8px;box-shadow:0 4px 14px rgba(0,0,0,.25);
      overflow:hidden;}
    #cnp-header{background:#264653;color:#fff;padding:8px 10px;font-weight:bold;
      font-size:13px;display:flex;justify-content:space-between;align-items:center;}
    #cnp-actions{display:flex;gap:10px;align-items:center;}
    #cnp-move{cursor:pointer;opacity:.8;font-size:14px;}#cnp-move:hover{opacity:1;}
    #cnp-close{cursor:pointer;opacity:.8;}#cnp-close:hover{opacity:1;}
    #cnp-body{max-height:70vh;overflow-y:auto;padding:8px;}
    #cnp-foot{font-size:10px;color:#666;padding:6px 8px;border-top:1px solid #ddd;
      background:#eef3f3;}
    .cnp-card{border:1px solid #cbd5d3;border-radius:6px;margin-bottom:10px;
      background:#fff;overflow:hidden;}
    .cnp-card-head{padding:6px 8px;background:#e9f5f3;border-bottom:1px solid #cbd5d3;}
    .cnp-codi{display:inline-block;background:#2a9d8f;color:#fff;font-weight:bold;
      font-size:11px;padding:1px 6px;border-radius:4px;margin-right:6px;}
    .cnp-nom{font-size:12px;color:#264653;font-weight:600;}
    .cnp-table{width:100%;border-collapse:collapse;font-size:11px;}
    .cnp-table th{background:#f2f6f5;color:#555;font-weight:600;padding:3px 6px;
      border-bottom:1px solid #e0e6e5;text-align:center;}
    .cnp-table td{padding:3px 6px;border-bottom:1px solid #f0f3f3;}
    .cnp-table td:first-child{font-weight:600;color:#264653;}
    .cnp-result{display:flex;justify-content:space-between;align-items:center;
      padding:7px 8px;background:#f8fbfa;}
    .cnp-qmp-num{font-size:20px;font-weight:bold;color:#2a9d8f;}
    .cnp-qmp-lbl{display:block;font-size:10px;color:#555;}
    .cnp-badge{font-size:10px;padding:2px 7px;border-radius:10px;font-weight:bold;}
    .cnp-ok{background:#d4edda;color:#155724;}
    .cnp-warn{background:#fff3cd;color:#856404;}
    .cnp-apply{width:100%;border:none;background:#2a9d8f;color:#fff;padding:7px;
      cursor:pointer;font-size:12px;font-weight:bold;}
    .cnp-apply:hover:not(:disabled){background:#21867a;}
    .cnp-apply:disabled{background:#b9c6c4;cursor:not-allowed;}
  `;
  document.head.appendChild(css);
}

/* --- Observador i arrencada -------------------------------------------- */
function observar() {
  const target = document.querySelector('#mainView') || document.body;
  if (observer) observer.disconnect();
  observer = new MutationObserver(() => {
    clearTimeout(debounce);
    debounce = setTimeout(refresh, 300);
  });
  observer.observe(target, { childList: true, subtree: true });

  // Recalcular també en canviar qualsevol qualificació
  document.addEventListener('change', e => {
    if (e.target.matches('select, input[name="quantitativa"]')) {
      clearTimeout(debounce);
      debounce = setTimeout(refresh, 100);
    }
  }, true);
}

chrome.storage.local.get({ calculActiu: true, calculCostat: 'dreta' }, data => {
  actiu = data.calculActiu;
  costat = data.calculCostat;
  refresh();
  observar();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.calculActiu) {
    actiu = changes.calculActiu.newValue;
    refresh();
  }
  if (changes.calculCostat) {
    costat = changes.calculCostat.newValue;
    const panel = document.getElementById(PANEL_ID);
    if (panel) aplicarCostat(panel, costat);
  }
});
