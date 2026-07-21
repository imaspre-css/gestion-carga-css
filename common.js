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
 
// true si el usuario es delegado Y tiene contratos asignados (el patrón que
// se repite en solicitudes/contratos/dashboard/index para filtrar por sus obras)
function cssFiltraPorContrato() {
  return cssEsDelegado() && cssGetContratos().length > 0;
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
  { href: 'nueva-obra.html', label: '+ Nueva obra', roles: ['staffer', 'delegado'] },
  { href: 'encuesta_semanal.html', label: 'Encuesta', roles: ['staffer'] },
  { href: 'carga-masiva.html', label: 'Carga masiva', roles: ['staffer'] }
];
 
/**
 * Genera el HTML de los enlaces del menú (sin el contenedor <div class="nav">,
 * que cada página ya tiene con su propio estilo). paginaActual es el nombre
 * de archivo de la página en la que estás (para marcarla como .active).
 *
 * Uso típico en una página migrada:
 *   document.querySelector('.nav').innerHTML = cssRenderNav('contratos.html');
 */
function cssRenderNav(paginaActual) {
  const rol = cssGetRol();
  const items = CSS_NAV_ITEMS.filter(function (it) { return !it.roles || it.roles.indexOf(rol) !== -1; });
  const links = items.map(function (it) {
    return '<a href="' + it.href + '"' + (it.href === paginaActual ? ' class="active"' : '') + '>' + escH(it.label) + '</a>';
  }).join('');
  return links + '<a href="#" onclick="cssLogout()" style="color:#ff8888;">Salir</a>';
}
