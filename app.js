// ====== CONFIGURACION: pega aqui tus datos de Supabase ======
const SUPABASE_URL = "https://ssfvfyokapwgeiuiyein.supabase.co";
const SUPABASE_KEY = "sb_publishable_9g9HyNswm0AW5Ziumi2zZw_EyYgY6WR";
// ============================================================

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = (id) => document.getElementById(id);

let usuario = null;
let categorias = [];
let movimientos = [];
let editandoId = null;

const dinero = (n) =>
  Number(n).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

function mensaje(el, texto, ok = false) {
  el.textContent = texto;
  el.classList.toggle("ok", ok);
}

// ---------- SESION ----------
db.auth.onAuthStateChange((_evento, session) => {
  const nuevo = session ? session.user : null;
  if (nuevo && usuario && nuevo.id === usuario.id) return;
  usuario = nuevo;
  if (usuario) {
    $("auth").classList.add("oculto");
    $("app").classList.remove("oculto");
    $("user-email").textContent = usuario.email;
    cargarTodo();
  } else {
    $("app").classList.add("oculto");
    $("auth").classList.remove("oculto");
  }
});

function validarAuth() {
  const email = $("auth-email").value.trim();
  const pass = $("auth-pass").value;
  if (!/^\S+@\S+\.\S+$/.test(email)) { mensaje($("auth-msg"), "Escribe un correo valido."); return null; }
  if (pass.length < 6) { mensaje($("auth-msg"), "La contrasena debe tener minimo 6 caracteres."); return null; }
  return { email, password: pass };
}

$("form-auth").addEventListener("submit", async (e) => {
  e.preventDefault();
  const datos = validarAuth();
  if (!datos) return;
  const { error } = await db.auth.signInWithPassword(datos);
  if (error) mensaje($("auth-msg"), "Error: " + error.message);
});

$("btn-registro").addEventListener("click", async () => {
  const datos = validarAuth();
  if (!datos) return;
  const { data, error } = await db.auth.signUp(datos);
  if (error) return mensaje($("auth-msg"), "Error: " + error.message);
  if (!data.session) mensaje($("auth-msg"), "Cuenta creada. Revisa tu correo para confirmarla.", true);
});

$("btn-logout").addEventListener("click", async () => {
  await db.auth.signOut();
});

// ---------- CARGA DE DATOS ----------
async function cargarTodo() {
  await cargarCategorias();
  await cargarMovimientos();
  $("fecha").value = hoy();
}

function hoy() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

async function cargarCategorias() {
  let { data, error } = await db.from("categorias").select("*").order("nombre");
  if (error) return mensaje($("cat-msg"), error.message);
  if (data.length === 0) {
    const base = ["Comida", "Transporte", "Sueldo", "Otros"].map((nombre) => ({ nombre }));
    await db.from("categorias").insert(base);
    ({ data } = await db.from("categorias").select("*").order("nombre"));
  }
  categorias = data;
  renderCategorias();
}

async function cargarMovimientos() {
  const { data, error } = await db
    .from("movimientos")
    .select("*, categorias(nombre)")
    .order("fecha", { ascending: false })
    .order("id", { ascending: false });
  if (error) return mensaje($("mov-msg"), error.message);
  movimientos = data;
  renderMovimientos();
}

// ---------- CATEGORIAS ----------
function renderCategorias() {
  const sel = $("categoria");
  const filtro = $("f-cat");
  const filtroActual = filtro.value;
  sel.innerHTML = "";
  filtro.innerHTML = "";

  const todas = document.createElement("option");
  todas.value = "";
  todas.textContent = "Todas las categorias";
  filtro.appendChild(todas);

  const lista = $("lista-cat");
  lista.innerHTML = "";

  categorias.forEach((c) => {
    const o1 = document.createElement("option");
    o1.value = c.id; o1.textContent = c.nombre;
    sel.appendChild(o1);

    const o2 = document.createElement("option");
    o2.value = c.id; o2.textContent = c.nombre;
    filtro.appendChild(o2);

    const li = document.createElement("li");
    const span = document.createElement("span");
    span.textContent = c.nombre;
    const x = document.createElement("button");
    x.type = "button"; x.textContent = "x"; x.title = "Eliminar categoria";
    x.addEventListener("click", () => eliminarCategoria(c));
    li.append(span, x);
    lista.appendChild(li);
  });
  filtro.value = filtroActual;
}

$("form-cat").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nombre = $("cat-nombre").value.trim();
  if (nombre.length < 2) return mensaje($("cat-msg"), "El nombre debe tener minimo 2 caracteres.");
  if (categorias.some((c) => c.nombre.toLowerCase() === nombre.toLowerCase()))
    return mensaje($("cat-msg"), "Esa categoria ya existe.");
  const { error } = await db.from("categorias").insert({ nombre });
  if (error) return mensaje($("cat-msg"), error.message);
  $("cat-nombre").value = "";
  mensaje($("cat-msg"), "Categoria agregada.", true);
  cargarCategorias();
});

async function eliminarCategoria(c) {
  if (!confirm(`Eliminar la categoria "${c.nombre}"? Sus movimientos quedaran sin categoria.`)) return;
  const { error } = await db.from("categorias").delete().eq("id", c.id);
  if (error) return mensaje($("cat-msg"), error.message);
  await cargarCategorias();
  await cargarMovimientos();
}

// ---------- MOVIMIENTOS ----------
$("form-mov").addEventListener("submit", async (e) => {
  e.preventDefault();
  const concepto = $("concepto").value.trim();
  const monto = parseFloat($("monto").value);
  const tipo = $("tipo").value;
  const categoria_id = $("categoria").value ? Number($("categoria").value) : null;
  const fecha = $("fecha").value;

  if (concepto.length < 3) return mensaje($("mov-msg"), "El concepto debe tener minimo 3 caracteres.");
  if (!monto || monto <= 0) return mensaje($("mov-msg"), "El monto debe ser mayor a 0.");
  if (!categoria_id) return mensaje($("mov-msg"), "Elige una categoria.");
  if (!fecha) return mensaje($("mov-msg"), "Elige una fecha.");

  const fila = { concepto, monto, tipo, categoria_id, fecha };
  const { error } = editandoId
    ? await db.from("movimientos").update(fila).eq("id", editandoId)
    : await db.from("movimientos").insert(fila);

  if (error) return mensaje($("mov-msg"), error.message);
  mensaje($("mov-msg"), editandoId ? "Movimiento actualizado." : "Movimiento agregado.", true);
  salirEdicion();
  cargarMovimientos();
});

function entrarEdicion(m) {
  editandoId = m.id;
  $("concepto").value = m.concepto;
  $("monto").value = m.monto;
  $("tipo").value = m.tipo;
  $("categoria").value = m.categoria_id || "";
  $("fecha").value = m.fecha;
  $("titulo-form").textContent = "Editar movimiento";
  $("btn-guardar").textContent = "Guardar cambios";
  $("btn-cancelar").classList.remove("oculto");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function salirEdicion() {
  editandoId = null;
  $("form-mov").reset();
  $("fecha").value = hoy();
  $("titulo-form").textContent = "Registrar movimiento";
  $("btn-guardar").textContent = "Agregar";
  $("btn-cancelar").classList.add("oculto");
}
$("btn-cancelar").addEventListener("click", () => { salirEdicion(); mensaje($("mov-msg"), ""); });

async function eliminarMovimiento(m) {
  if (!confirm(`Eliminar "${m.concepto}"?`)) return;
  const { error } = await db.from("movimientos").delete().eq("id", m.id);
  if (error) return mensaje($("mov-msg"), error.message);
  if (editandoId === m.id) salirEdicion();
  cargarMovimientos();
}

// ---------- RENDER ----------
["buscar", "f-tipo", "f-cat"].forEach((id) => {
  $(id).addEventListener("input", renderMovimientos);
});

function renderMovimientos() {
  const texto = $("buscar").value.trim().toLowerCase();
  const tipo = $("f-tipo").value;
  const cat = $("f-cat").value;

  const lista = movimientos.filter((m) =>
    (!texto || m.concepto.toLowerCase().includes(texto)) &&
    (!tipo || m.tipo === tipo) &&
    (!cat || String(m.categoria_id) === cat)
  );

  const tbody = $("tbody");
  tbody.innerHTML = "";
  $("vacio").classList.toggle("oculto", lista.length > 0);

  lista.forEach((m) => {
    const tr = document.createElement("tr");
    const celdas = [
      m.fecha,
      m.concepto,
      m.categorias ? m.categorias.nombre : "Sin categoria",
      dinero(m.monto),
    ];
    celdas.forEach((t) => {
      const td = document.createElement("td");
      td.textContent = t;
      tr.appendChild(td);
    });

    const tdTipo = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = "badge badge-" + m.tipo;
    badge.textContent = m.tipo === "ingreso" ? "Ingreso" : "Gasto";
    tdTipo.appendChild(badge);
    tr.appendChild(tdTipo);

    const tdAcc = document.createElement("td");
    tdAcc.className = "acciones";
    const bEd = document.createElement("button");
    bEd.className = "btn btn-chico btn-azul"; bEd.textContent = "Editar";
    bEd.addEventListener("click", () => entrarEdicion(m));
    const bDel = document.createElement("button");
    bDel.className = "btn btn-chico btn-rojo"; bDel.textContent = "Eliminar";
    bDel.addEventListener("click", () => eliminarMovimiento(m));
    tdAcc.append(bEd, bDel);
    tr.appendChild(tdAcc);

    tbody.appendChild(tr);
  });

  // Totales (sobre todos los movimientos, no solo los filtrados)
  const ing = movimientos.filter((m) => m.tipo === "ingreso").reduce((s, m) => s + Number(m.monto), 0);
  const gas = movimientos.filter((m) => m.tipo === "gasto").reduce((s, m) => s + Number(m.monto), 0);
  $("tot-ingresos").textContent = dinero(ing);
  $("tot-gastos").textContent = dinero(gas);
  $("tot-saldo").textContent = dinero(ing - gas);
}
