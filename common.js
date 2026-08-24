// ═══════════════════════════════════════════════════════════════
// common.js — Gestión de Carga CSS (Imaspre)
// Constantes y helpers compartidos entre páginas.
// Bloque 4 del plan de acción: consolidación técnica.
//
// IMPORTANTE: este archivo, por sí solo, no cambia el comportamiento
// de ninguna página existente — ninguna lo referencia todavía.
// Las páginas se migran una a una (ver PLAN_DE_ACCION_CSS.md, 4.4).
//
// Uso en una página ya migrada:
//   <script src="common.js"></script>
//   ... antes que el resto de scripts de la página ...
// ═══════════════════════════════════════════════════════════════

// ── CONEXIÓN A SUPABASE ─────────────────────────────────────────
const CSS_SUPABASE_URL = 'https://niwnyoxsesbesotumolm.supabase.co';
const CSS_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5pd255b3hzZXNiZXNvdHVtb2xtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NzQ4NzAsImV4cCI6MjA5NjA1MDg3MH0.ScugENQtfGYuo5ZZKAuXhqOZLzOvLwEQXlr55XpMT5s';

// ── SESIÓN REAL DE SUPABASE AUTH (Bloque 5) ───────────────────────
// Si la página TAMBIÉN carga el SDK de Supabase antes de este archivo:
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
// ... entonces cualquier fetch() a Supabase que use la anon key como Bearer
// se sustituye aquí, de forma transparente, por el token de la sesión real
// (si existe) — sin tener que tocar ninguna de las llamadas fetch existentes
// una por una, estén donde estén. Si la página no carga el SDK, o si no hay
// sesión real (p.ej. entrada por PIN), el comportamiento es exactamente el
// de siempre: se sigue usando la anon key, sin ningún cambio.
var cssSupabaseClient = (typeof supabase !== 'undefined')
  ? supabase.createClient(CSS_SUPABASE_URL, CSS_SUPABASE_KEY)
  : null;

if (cssSupabaseClient && !window._cssFetchPatched) {
  window._cssFetchPatched = true;
  var _cssFetchOriginal = window.fetch.bind(window);
  window.fetch = async function(url, options) {
    options = options || {};
    var urlStr = (typeof url === 'string') ? url : ((url && url.url) || '');
    var headers = options.headers || {};
    var esLlamadaConAnonKey = urlStr.indexOf(CSS_SUPABASE_URL) === 0 && headers.Authorization === 'Bearer ' + CSS_SUPABASE_KEY;
    if (esLlamadaConAnonKey) {
      try {
        var sesion = await cssSupabaseClient.auth.getSession();
        if (sesion.data.session) {
          headers = Object.assign({}, headers, { Authorization: 'Bearer ' + sesion.data.session.access_token });
          options = Object.assign({}, options, { headers: headers });
        }
      } catch (e) {}
    }
    return _cssFetchOriginal(url, options);
  };
}

/**
 * Fetch genérico contra Supabase con los headers de autenticación ya puestos.
 * options acepta lo mismo que fetch() normal (method, headers extra, body...).
 * Devuelve la Response cruda (útil cuando hace falta comprobar res.ok o el status).
 */
async function cssFetch(path, options) {
  options = options || {};
  const headers = Object.assign(
    { apikey: CSS_SUPABASE_KEY, Authorization: 'Bearer ' + CSS_SUPABASE_KEY },
    options.headers || {}
  );
  return fetch(CSS_SUPABASE_URL + path, Object.assign({}, options, { headers: headers }));
}

/**
 * Igual que cssFetch, pero ya parsea el JSON y garantiza devolver un array
 * (nunca null/undefined), que es lo que casi todas las páginas necesitan
 * para poder hacer .filter()/.map() sin comprobaciones repetidas.
 */
async function cssFetchJSON(path, options) {
  try {
    const res = await cssFetch(path, options);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error('cssFetchJSON error:', path, e);
    return [];
  }
}

// ── SESIÓN Y ROLES ──────────────────────────────────────────────
function cssGetRol() { return localStorage.getItem('css_rol'); }
function cssGetEmail() { return (localStorage.getItem('css_ms_email') || '').toLowerCase(); }
function cssGetNombreTecnico() { return localStorage.getItem('css_tecnico') || ''; }

function cssGetContratos() {
  try { return JSON.parse(localStorage.getItem('css_contratos') || '[]'); }
  catch (e) { return []; }
}

function cssEsStaffer() { return cssGetRol() === 'staffer'; }
function cssEsDelegado() { return cssGetRol() === 'delegado'; }
function cssEsTecnico() { return cssGetRol() === 'tecnico'; }
function cssEsRepresentante() { return cssGetRol() === 'representante'; }
function cssEsAdmin() { return localStorage.getItem('css_admin_total') === 'true'; }

// true si el usuario debe ver solo sus contratos asignados: delegado siempre,
// o staffer/representante sin el permiso de administración total (un
// representante nunca es admin_total, pero se deja la comprobación por
// coherencia con el resto). Admin_total nunca se filtra.
function cssFiltraPorContrato() {
  if (cssEsAdmin()) return false;
  return (cssEsDelegado() || cssEsStaffer() || cssEsRepresentante()) && cssGetContratos().length > 0;
}

/**
 * Guard de sesión. Llamar al principio de cada página, dentro de un <script>
 * colocado antes que el resto del contenido (igual que se hace hoy).
 *
 * cssRequireRole()                       -> exige estar logueado, cualquier rol
 * cssRequireRole(['staffer'])            -> exige ser staffer
 * cssRequireRole(['staffer','delegado']) -> exige ser uno de esos roles
 *
 * Si no cumple, redirige y devuelve false (por si la página quiere cortar ejecución).
 */
function cssRequireRole(rolesPermitidos) {
  const rol = cssGetRol();
  const pagina = window.location.pathname.split('/').pop();
  if (!rol) {
    window.location.href = 'login.html?redirect=' + encodeURIComponent(pagina);
    return false;
  }
  if (rolesPermitidos && rolesPermitidos.length && rolesPermitidos.indexOf(rol) === -1) {
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

function cssLogout() {
  localStorage.clear();
  window.location.href = 'login.html';
}

// ── ESTADOS CANÓNICOS DE OBRA ───────────────────────────────────
const CSS_ESTADOS = [
  'PDTE. DESIG. CSS', 'PDTE. INICIO', 'ACTIVA', 'SIN ACTIVIDAD',
  'SUSPENDIDA', 'EN PROCESO DE FINALIZACIÓN', 'FINALIZADA'
];
const CSS_ESTADOS_ENCUESTABLES = ['PDTE. INICIO', 'ACTIVA', 'EN PROCESO DE FINALIZACIÓN'];
const CSS_ESTADOS_EN_CURSO = ['ACTIVA', 'PDTE. INICIO', 'EN PROCESO DE FINALIZACIÓN'];
const CSS_ESTADOS_EN_PAUSA = ['PDTE. DESIG. CSS', 'SIN ACTIVIDAD', 'SUSPENDIDA'];

function cssGetEstadoClass(estado) {
  if (!estado) return 'estado-SUSPENDIDA';
  const e = estado.toUpperCase();
  if (e === 'ACTIVA') return 'estado-ACTIVA';
  if (e === 'SIN ACTIVIDAD') return 'estado-SINACTIVIDAD';
  if (e.indexOf('PENDIENTE') !== -1 || e.indexOf('PDTE') !== -1) return 'estado-PDTE';
  if (e === 'SUSPENDIDA') return 'estado-SUSPENDIDA';
  if (e.indexOf('PROCESO DE FINALIZACIÓN') !== -1) return 'estado-PROCESOFIN';
  if (e === 'FINALIZADA') return 'estado-FINALIZADA';
  return 'estado-SUSPENDIDA';
}

// ── PRODUCTOS ────────────────────────────────────────────────────
const CSS_PRODUCTOS_VALIDOS = ['CSS', 'AUTOPROTECCION', 'CONSULTORIA', 'CAE'];

// ── ESCAPE HTML (evita inyección al pintar texto libre en innerHTML) ──
function escH(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ── SELECTOR DE TÉCNICO: pool del contrato → territorio → todos ─
// Esta es la pieza que hoy está triplicada (nueva-obra, reasignación en
// contratos, añadir coordinador) con nombres distintos en cada copia.
// A partir de aquí, una sola implementación para las tres.

/** Devuelve el array de emails preseleccionados de un contrato (o []). */
async function cssGetPoolContrato(codContrato) {
  if (!codContrato) return [];
  try {
    const rows = await cssFetchJSON(
      '/rest/v1/contratos?cod_contrato=eq.' + encodeURIComponent(codContrato) + '&select=tecnicos_preseleccionados'
    );
    return (rows[0] && Array.isArray(rows[0].tecnicos_preseleccionados)) ? rows[0].tecnicos_preseleccionados : [];
  } catch (e) { return []; }
}

/**
 * Construye la "ficha" de carga de una lista de nombres de técnico a partir
 * de las obras ya cargadas en memoria (obrasArr). excluir puede ser un string
 * o un array de strings (para no proponer al propio técnico actual de la obra,
 * o a quienes ya son coordinadores de ella).
 */
function cssConstruirFichaTecnico(nombres, obrasArr, excluir) {
  const excluirArr = Array.isArray(excluir) ? excluir : (excluir ? [excluir] : []);
  return nombres.filter(function (t) { return excluirArr.indexOf(t) === -1; }).map(function (t) {
    const obrasTec = obrasArr.filter(function (o) { return o.tecnico === t; });
    const cargaTeorica = obrasTec.reduce(function (s, o) { return s + (parseFloat(o.carga_teorica_semanal) || 0); }, 0);
    const email = (obrasTec[0] && obrasTec[0].email) || '';
    return { name: t, email: email, obras: obrasTec.length, cargaTeorica: Math.round(cargaTeorica) };
  });
}

/**
 * Calcula las 3 vistas (pool / territorio / todos) y cuál conviene mostrar
 * por defecto (la primera que tenga resultados). Necesita las obras y los
 * técnicos ya cargados en memoria por la página que lo usa.
 *
 * Devuelve { vistas: {pool, territorio, todos}, defecto: 'pool'|'territorio'|'todos' }
 */
function cssGetVistasTecnicos(territorio, poolEmails, obrasArr, tecnicosDBArr, excluir) {
  const todosNombres = Array.from(new Set((tecnicosDBArr && tecnicosDBArr.length ? tecnicosDBArr.map(function(t){return t.nombre;}) : obrasArr.map(function (o) { return o.tecnico; })))).sort();

  let poolNombres = [];
  if (poolEmails && poolEmails.length) {
    const poolLower = poolEmails.map(function (e) { return (e || '').toLowerCase(); });
    poolNombres = Array.from(new Set(obrasArr.filter(function (o) { return poolLower.indexOf((o.email || '').toLowerCase()) !== -1; }).map(function (o) { return o.tecnico; }))).sort();
    if (!poolNombres.length && tecnicosDBArr) {
      poolNombres = tecnicosDBArr.filter(function (t) { return poolLower.indexOf((t.email || '').toLowerCase()) !== -1; }).map(function (t) { return t.nombre; }).sort();
    }
  }

  let territorioNombres = [];
  if (territorio) {
    const tUpper = territorio.toUpperCase();
    territorioNombres = Array.from(new Set(obrasArr.filter(function (o) { return (o.territorio || '').toUpperCase() === tUpper; }).map(function (o) { return o.tecnico; }))).sort();
  }

  const vistas = {
    pool: cssConstruirFichaTecnico(poolNombres, obrasArr, excluir),
    territorio: cssConstruirFichaTecnico(territorioNombres, obrasArr, excluir),
    todos: cssConstruirFichaTecnico(todosNombres, obrasArr, excluir)
  };
  const defecto = vistas.pool.length ? 'pool' : (vistas.territorio.length ? 'territorio' : 'todos');
  return { vistas: vistas, defecto: defecto };
}

// ── MENÚ SUPERIOR SEGÚN ROL ──────────────────────────────────────
// Esto es lo más rentable de todo el archivo: un cambio de menú (añadir,
// quitar o renombrar una página) pasa a ser una edición en un solo sitio,
// no N ediciones manuales repartidas por todas las páginas.
const CSS_NAV_ITEMS = [
  { href: 'index.html', label: 'Inicio' },
  { href: 'dashboard.html', label: 'Dashboard' },
  { href: 'tecnicos.html', label: 'Técnicos' },
  { href: 'contratos.html', label: 'Contratos' },
  { href: 'solicitudes.html', label: 'Solicitudes', roles: ['staffer', 'delegado'] },
  { href: 'nueva-obra.html', label: '+ Nueva obra', roles: ['staffer', 'delegado'] },
  { href: 'encuesta_semanal.html', label: 'Encuesta', adminOnly: true },
  { href: 'carga-masiva.html', label: 'Carga masiva', adminOnly: true }
];

/**
 * Genera el HTML de los enlaces del menú (sin el contenedor <div class="nav">,
 * que cada página ya tiene con su propio estilo). paginaActual es el nombre
 * de archivo de la página en la que estás (para marcarla como .active).
 *
 * Uso típico en una página migrada:
 *   document.querySelector('.nav').innerHTML = cssRenderNav('contratos.html');
 */
/**
 * salirOnClick (opcional): código JS a ejecutar en el "Salir" en vez del
 * cssLogout() por defecto. Úsalo cuando una página necesite preservar algo
 * de localStorage al cerrar sesión (p.ej. encuesta_semanal.html conserva el
 * respaldo local de respuestas importadas por email antes de limpiar todo).
 */
function cssRenderNav(paginaActual, salirOnClick) {
  const rol = cssGetRol();
  const esAdmin = cssEsAdmin();
  const items = CSS_NAV_ITEMS.filter(function (it) {
    if (it.adminOnly) return esAdmin;
    return !it.roles || it.roles.indexOf(rol) !== -1;
  });
  const links = items.map(function (it) {
    return '<a href="' + it.href + '"' + (it.href === paginaActual ? ' class="active"' : '') + '>' + escH(it.label) + '</a>';
  }).join('');
  const salir = salirOnClick
    ? '<a href="#" onclick="' + salirOnClick + '" style="color:#ff8888;">Salir</a>'
    : '<a href="#" onclick="cssLogout()" style="color:#ff8888;">Salir</a>';
  return links + salir;
}


// ═══════════════════════════════════════════════════════════════
// NOTIFICACIONES (campanita) — Bloque 8
// Vive en su propio elemento, con posición fija, completamente al
// margen del #navContainer de cada página. Esto es deliberado: cada
// página reescribe su propio nav de forma asíncrona (tras cargar sus
// datos), y si la campanita viviera ahí dentro, esa reescritura la
// borraría en cuanto la página terminara de pintar su menú. Al vivir
// aparte, ninguna página puede hacerla desaparecer sin querer, sea
// cual sea su estructura interna — funciona igual en las 9 páginas
// sin que ninguna tenga que llamarla ni saber que existe.
// ═══════════════════════════════════════════════════════════════
var cssNotifCache = [];

async function cssCargarNotificaciones() {
  const email = cssGetEmail();
  if (!email) return;
  try {
    const res = await fetch(CSS_SUPABASE_URL + '/rest/v1/notificaciones?destinatario_email=eq.' + encodeURIComponent(email) + '&order=created_at.desc&limit=20', {
      headers: { apikey: CSS_SUPABASE_KEY, Authorization: 'Bearer ' + CSS_SUPABASE_KEY }
    });
    const rows = await res.json();
    cssNotifCache = Array.isArray(rows) ? rows : [];
    cssRenderNotifBadge();
  } catch(e) {}
}

function cssRenderNotifBadge() {
  const noLeidas = cssNotifCache.filter(function(n) { return !n.leida; }).length;
  const badge = document.getElementById('cssNotifBadge');
  if (!badge) return;
  if (noLeidas > 0) {
    badge.textContent = noLeidas > 9 ? '9+' : noLeidas;
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
  }
}

function cssTiempoRelativoNotif(fechaISO) {
  const ms = Date.now() - new Date(fechaISO).getTime();
  const horas = Math.floor(ms / 36e5);
  if (horas < 1) return 'hace unos minutos';
  if (horas < 24) return 'hace ' + horas + 'h';
  const dias = Math.floor(horas / 24);
  return 'hace ' + dias + ' día' + (dias>1?'s':'');
}

function cssRenderNotifPanel() {
  const panel = document.getElementById('cssNotifPanel');
  if (!panel) return;
  if (!cssNotifCache.length) {
    panel.innerHTML = '<div style="padding:1.5rem;text-align:center;color:#bbb;font-size:0.82rem;">Sin notificaciones</div>';
    return;
  }
  panel.innerHTML = cssNotifCache.map(function(n) {
    return '<div onclick="cssAbrirNotificacion(\'' + n.id + '\')" style="padding:0.75rem 1rem;border-bottom:0.5px solid #f0f0e8;cursor:pointer;' + (n.leida ? '' : 'background:#f8f8fe;') + '">'
      + '<div style="font-size:0.82rem;font-weight:' + (n.leida?'400':'500') + ';color:#1a1a2e;">' + escH(n.titulo) + '</div>'
      + (n.mensaje ? '<div style="font-size:0.76rem;color:#888;margin-top:2px;">' + escH(n.mensaje) + '</div>' : '')
      + '<div style="font-size:0.68rem;color:#aaa;margin-top:3px;">' + cssTiempoRelativoNotif(n.created_at) + '</div>'
      + '</div>';
  }).join('');
}

function cssToggleNotifPanel(event) {
  event.stopPropagation();
  const panel = document.getElementById('cssNotifPanel');
  if (!panel) return;
  const abierto = panel.style.display === 'block';
  if (abierto) {
    panel.style.display = 'none';
  } else {
    cssRenderNotifPanel();
    panel.style.display = 'block';
  }
}

async function cssAbrirNotificacion(id) {
  const n = cssNotifCache.find(function(x) { return x.id === id; });
  if (!n) return;
  if (!n.leida) {
    n.leida = true;
    cssRenderNotifBadge();
    fetch(CSS_SUPABASE_URL + '/rest/v1/notificaciones?id=eq.' + id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', apikey: CSS_SUPABASE_KEY, Authorization: 'Bearer ' + CSS_SUPABASE_KEY, Prefer: 'return=minimal' },
      body: JSON.stringify({ leida: true })
    }).catch(function(){});
  }
  if (n.link) { window.location.href = n.link; }
  else { cssRenderNotifPanel(); }
}

function cssInitNotificaciones() {
  if (!cssGetRol() || document.getElementById('cssNotifBell')) return;
  const navContainer = document.getElementById('navContainer');
  if (!navContainer) return; // página sin header estándar (login, encuesta) — sin campanita ahí

  // En vez de flotar encima con position:fixed (que no sabe dónde termina el
  // menú de cada página y puede solaparse con "Salir"), se envuelve el propio
  // #navContainer junto a la campanita en un mismo grupo — así el header los
  // trata como un solo bloque a la derecha, y nunca chocan entre sí, sea cual
  // sea el número de opciones de menú de cada página. Como navContainer se
  // MUEVE (no se recrea), su propio id sigue intacto: cuando la página haga
  // más tarde su propio "getElementById('navContainer').innerHTML = ...",
  // seguirá encontrándolo y actualizándolo con normalidad, sin ningún conflicto.
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'display:flex;align-items:center;gap:14px;';
  navContainer.parentNode.insertBefore(wrapper, navContainer);
  wrapper.appendChild(navContainer);

  const bell = document.createElement('div');
  bell.id = 'cssNotifBell';
  bell.style.cssText = 'position:relative;flex-shrink:0;';
  bell.innerHTML =
    '<div onclick="cssToggleNotifPanel(event)" style="position:relative;width:30px;height:30px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.1);border-radius:50%;font-size:0.95rem;cursor:pointer;">'
    + '🔔'
    + '<span id="cssNotifBadge" style="display:none;position:absolute;top:-2px;right:-2px;background:#e24b4a;color:#fff;font-size:0.6rem;font-weight:600;padding:1px 5px;border-radius:10px;min-width:15px;text-align:center;line-height:1.3;"></span>'
    + '</div>'
    + '<div id="cssNotifPanel" style="display:none;position:absolute;top:38px;right:0;background:#fff;color:#1a1a1a;border-radius:10px;box-shadow:0 4px 24px rgba(0,0,0,0.18);width:320px;max-height:420px;overflow-y:auto;z-index:500;"></div>';
  wrapper.appendChild(bell);

  document.addEventListener('click', function(e) {
    const p = document.getElementById('cssNotifPanel');
    if (p && p.style.display === 'block' && !bell.contains(e.target)) p.style.display = 'none';
  });
  cssCargarNotificaciones();
}

document.addEventListener('DOMContentLoaded', cssInitNotificaciones);
