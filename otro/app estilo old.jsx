import { useState, useEffect, useRef } from "react";

/* ═══════════════════════════════════════════════════════
   CONFIG — ya están tus credenciales
═══════════════════════════════════════════════════════ */
const SUPABASE_URL = "https://giwzlwtvgfgdyedggtoi.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdpd3psd3R2Z2ZnZHllZGdndG9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5OTQ1OTUsImV4cCI6MjA5NTU3MDU5NX0.D78fhZoTuPLhQil_xYsBkYZT2xoyhvs0rHFXz2k1cQ4";
// Registrate gratis en web3forms.com y pegá tu access key aquí:
const WEB3FORMS_KEY = "43e0cc82-50ea-48fb-9570-e9fea1ff0ca9";
const VENTAS_EMAIL  = "facugrade27@gmail.com";

/* ═══════════════════════════════════════════════════════
   SUPABASE HELPERS
═══════════════════════════════════════════════════════ */
const sb = async (path, opts = {}) => {
  const { extraHeaders = {}, ...rest } = opts;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...extraHeaders,
    },
    ...rest,
  });
  if (!res.ok) throw new Error(await res.text());
  const t = await res.text();
  return t ? JSON.parse(t) : null;
};

const hashPwd = async (pwd) => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pwd));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
};

const uploadImage = async (file) => {
  const ext  = file.name.split(".").pop();
  const name = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const res  = await fetch(`${SUPABASE_URL}/storage/v1/object/product-images/${name}`, {
    method:  "POST",
    headers: {
      apikey:        SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": file.type,
      "x-upsert":    "true",
    },
    body: file,
  });
  if (!res.ok) throw new Error("Error subiendo imagen: " + (await res.text()));
  return `${SUPABASE_URL}/storage/v1/object/public/product-images/${name}`;
};

const db = {
  products:   {
    list:   ()       => sb("products?select=*&order=id"),
    insert: (d)      => sb("products", { method: "POST", body: JSON.stringify(d) }),
    update: (id, d)  => sb(`products?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(d) }),
    remove: (id)     => sb(`products?id=eq.${id}`, { method: "DELETE" }),
  },
  notebooks:  {
    get:  (code) => sb(`notebooks?code=eq.${encodeURIComponent(code)}&select=*`),
    save: (d)    => sb("notebooks", { method: "POST", body: JSON.stringify(d), extraHeaders: { Prefer: "resolution=merge-duplicates,return=representation" } }),
  },
  coupons:    {
    list:   ()       => sb("coupons?select=*&order=id"),
    insert: (d)      => sb("coupons", { method: "POST", body: JSON.stringify(d) }),
    update: (id, d)  => sb(`coupons?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(d) }),
    remove: (id)     => sb(`coupons?id=eq.${id}`, { method: "DELETE" }),
  },
  orders:     {
    insert: (d) => sb("orders", { method: "POST", body: JSON.stringify(d) }),
  },
  adminUsers: {
    check: (username, password_hash) =>
      sb(`admin_users?username=eq.${username}&password_hash=eq.${password_hash}&select=role`),
  },
};

/* ═══════════════════════════════════════════════════════
   EMAIL VIA WEB3FORMS
═══════════════════════════════════════════════════════ */
const sendOrderEmail = async (order) => {
  if (!WEB3FORMS_KEY || WEB3FORMS_KEY === "TU_WEB3FORMS_KEY") return;
  const lines = order.items.map(i => {
    let s = `• ${i.name} x${i.qty} — $${(i.finalPrice * i.qty).toLocaleString("es-AR")}`;
    if (i.customization?.hojas) s += `\n    Hojas: ${i.customization.hojas}`;
    if (i.customization?.tapa)  s += `\n    Tapa: ${i.customization.tapa}`;
    if (i.customization?.qr)    s += `\n    QR: ${i.customization.qr}`;
    return s;
  }).join("\n");
  await fetch("https://api.web3forms.com/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      access_key: WEB3FORMS_KEY,
      to:         VENTAS_EMAIL,
      subject:    `🛒 Nuevo pedido LUMANOTES — ${order.customer_name} ${order.customer_lastname}`,
      from_name:  "LUMANOTES",
      message:
        `NUEVO PEDIDO\n\n` +
        `Cliente: ${order.customer_name} ${order.customer_lastname}\n` +
        `Email: ${order.customer_email}\n` +
        `Teléfono: ${order.customer_phone}\n\n` +
        `PRODUCTOS:\n${lines}\n\n` +
        (order.coupon ? `Cupón: ${order.coupon}\n` : "") +
        `Subtotal:  $${order.subtotal.toLocaleString("es-AR")}\n` +
        `Descuento: $${order.discount.toLocaleString("es-AR")}\n` +
        `TOTAL:     $${order.total.toLocaleString("es-AR")}`,
    }),
  });
};

/* ═══════════════════════════════════════════════════════
   VERSÍCULOS
═══════════════════════════════════════════════════════ */
const VERSICULOS = [
  { text: "Todo lo puedo en Cristo que me fortalece.", ref: "Filipenses 4:13" },
  { text: "El SEÑOR es mi pastor; nada me faltará.", ref: "Salmos 23:1" },
  { text: "Confía en el SEÑOR con todo tu corazón.", ref: "Proverbios 3:5" },
  { text: "Porque yo sé los planes que tengo para ustedes, planes de bienestar y no de calamidad.", ref: "Jeremías 29:11" },
  { text: "No temas, porque yo estoy contigo; no desmayes, porque yo soy tu Dios.", ref: "Isaías 41:10" },
  { text: "El amor es paciente, es bondadoso. El amor no tiene envidia.", ref: "1 Corintios 13:4" },
  { text: "Sean fuertes y valientes. El SEÑOR tu Dios va contigo.", ref: "Deuteronomio 31:6" },
  { text: "Den gracias al SEÑOR, porque él es bueno; su gran amor perdura para siempre.", ref: "Salmos 107:1" },
  { text: "Busquen primero el reino de Dios y su justicia.", ref: "Mateo 6:33" },
  { text: "Porque tanto amó Dios al mundo, que dio a su Hijo único.", ref: "Juan 3:16" },
  { text: "El SEÑOR te bendiga y te guarde.", ref: "Números 6:24" },
  { text: "La fe es la garantía de lo que se espera, la certeza de lo que no se ve.", ref: "Hebreos 11:1" },
  { text: "Sé fuerte y valiente. No te atemorices ni te desanimes.", ref: "Josué 1:9" },
  { text: "Ámense los unos a los otros como yo los he amado.", ref: "Juan 15:12" },
  { text: "Pide, y se te dará; busca, y encontrarás.", ref: "Mateo 7:7" },
  { text: "Alégrense siempre en el Señor. ¡Alégrense!", ref: "Filipenses 4:4" },
  { text: "Mi gracia te basta, porque mi poder se perfecciona en la debilidad.", ref: "2 Corintios 12:9" },
  { text: "Encomienda al SEÑOR tus afanes, y él te sostendrá.", ref: "Salmos 55:22" },
  { text: "Renueven su mente, y así podrán conocer cuál es la voluntad de Dios.", ref: "Romanos 12:2" },
  { text: "El SEÑOR pelea por ustedes; sólo quédense quietos.", ref: "Éxodo 14:14" },
  { text: "Crea en mí, oh Dios, un corazón puro.", ref: "Salmos 51:10" },
  { text: "Dios es nuestro amparo y nuestra fortaleza.", ref: "Salmos 46:1" },
  { text: "Pon en manos del SEÑOR todas tus obras.", ref: "Proverbios 16:3" },
  { text: "El que comenzó tan buena obra en ustedes la irá perfeccionando.", ref: "Filipenses 1:6" },
  { text: "Vengan a mí todos ustedes que están cansados y agobiados.", ref: "Mateo 11:28" },
  { text: "Estén siempre alegres, oren sin cesar, den gracias a Dios.", ref: "1 Tesalonicenses 5:16-18" },
  { text: "El SEÑOR es justo en todos sus caminos y bondadoso en todas sus obras.", ref: "Salmos 145:17" },
  { text: "Sé tú mi roca de refugio, adonde pueda acudir continuamente.", ref: "Salmos 71:3" },
  { text: "El corazón del hombre traza su rumbo, pero sus pasos los dirige el SEÑOR.", ref: "Proverbios 16:9" },
  { text: "Jesús le dijo: Yo soy el camino, la verdad y la vida.", ref: "Juan 14:6" },
];
const getDailyVerse = () => {
  const d = new Date();
  const s = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  return VERSICULOS[s % VERSICULOS.length];
};

const TEAM = [
  { name: "Agustina R.", role: "CEO & Fundadora",    ini: "A", color: "#d4a843" },
  { name: "Mateo G.",    role: "Diseño & Producto",  ini: "M", color: "#e74c3c" },
  { name: "Lucía P.",    role: "Ventas & Marketing", ini: "L", color: "#3498db" },
  { name: "Santiago V.", role: "Tecnología",          ini: "S", color: "#2ecc71" },
  { name: "Valentina C.",role: "Contenidos",          ini: "V", color: "#9b59b6" },
  { name: "Facundo H.",  role: "Finanzas",            ini: "F", color: "#e67e22" },
];

const HOJAS_OPTS = ["Rayadas", "Cuadriculadas", "Lisas"];
const TAPA_OPTS  = ["Personalizada", "Color fijo", "Stickers"];
const QR_OPTS    = ["mensaje", "versiculo", "video", "aleatorio"];

/* ═══════════════════════════════════════════════════════
   THEME
═══════════════════════════════════════════════════════ */
const C = {
  bg: "#0a0703", surface: "#130d05", card: "#1e1408",
  accent: "#c9993a", text: "#ede0c8", muted: "#7a5f38",
  border: "#2e1f0a", success: "#2ecc71", danger: "#e74c3c", info: "#3498db",
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=DM+Sans:wght@300;400;500;600&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:${C.bg}}
  ::-webkit-scrollbar{width:5px}
  ::-webkit-scrollbar-track{background:${C.bg}}
  ::-webkit-scrollbar-thumb{background:${C.accent};border-radius:3px}
  @keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes slideRight{from{transform:translateX(100%)}to{transform:translateX(0)}}
  @keyframes spin{to{transform:rotate(360deg)}}
  .fade-up{animation:fadeUp .5s ease both}
  .fade-in{animation:fadeIn .4s ease both}
  .slide-right{animation:slideRight .3s cubic-bezier(.4,0,.2,1)}
  .hover-card:hover{border-color:${C.accent}50!important;transform:translateY(-2px)}
  .hover-card{transition:all .25s ease}
  .spin{animation:spin .8s linear infinite;display:inline-block}
`;

/* ═══════════════════════════════════════════════════════
   SHARED UI
═══════════════════════════════════════════════════════ */
const inp = { background: C.card, border: `1px solid ${C.border}`, color: C.text, padding: "11px 14px", fontFamily: "'DM Sans',sans-serif", fontSize: 14, width: "100%", outline: "none", borderRadius: 0 };
const lbl = { display: "block", fontSize: 11, fontWeight: 600, letterSpacing: 1.2, color: C.muted, marginBottom: 6, textTransform: "uppercase" };

function Spinner() { return <span className="spin" style={{ fontSize: 16 }}>⟳</span>; }

function Btn({ children, v = "primary", onClick, style = {}, disabled }) {
  const vars = {
    primary: { background: C.accent, color: "#0a0703", border: "none" },
    outline:  { background: "transparent", color: C.accent, border: `1px solid ${C.accent}` },
    ghost:    { background: "transparent", color: C.text, border: `1px solid ${C.border}` },
    danger:   { background: C.danger, color: "#fff", border: "none" },
    success:  { background: C.success, color: "#fff", border: "none" },
  };
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ ...vars[v], padding: "11px 26px", fontFamily: "'DM Sans',sans-serif", fontWeight: 600, fontSize: 13, letterSpacing: .6, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? .5 : 1, transition: "all .2s", ...style }}>
      {children}
    </button>
  );
}

function Field({ label, children }) { return <div style={{ marginBottom: 16 }}>{label && <label style={lbl}>{label}</label>}{children}</div>; }
function Input({ label, ...p }) { return <Field label={label}><input style={inp} {...p} /></Field>; }
function Textarea({ label, ...p }) { return <Field label={label}><textarea style={{ ...inp, resize: "vertical", minHeight: 90 }} {...p} /></Field>; }
function Tag({ children, color = C.accent }) { return <span style={{ background: `${color}18`, color, border: `1px solid ${color}40`, padding: "3px 10px", fontSize: 11, fontWeight: 600, letterSpacing: .8, textTransform: "uppercase", display: "inline-block" }}>{children}</span>; }
function Badge({ children, color = C.danger }) { return <span style={{ background: color, color: "#fff", padding: "2px 8px", fontSize: 10, fontWeight: 700, borderRadius: 999 }}>{children}</span>; }
function Divider() { return <div style={{ height: 1, background: C.border, margin: "24px 0" }} />; }

function Modal({ title, onClose, children, width = 520 }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000095", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="fade-in" style={{ background: C.surface, border: `1px solid ${C.border}`, width: "100%", maxWidth: width, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: `1px solid ${C.border}` }}>
          <h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, color: C.text }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 18 }}>✕</button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  );
}

function Toast({ toast }) {
  if (!toast) return null;
  return <div className="fade-in" style={{ position: "fixed", top: 20, right: 20, zIndex: 999, padding: "14px 22px", background: { success: C.success, error: C.danger, info: C.info }[toast.type] || C.success, color: "#fff", fontFamily: "'DM Sans',sans-serif", fontWeight: 600, fontSize: 14, boxShadow: "0 8px 32px #00000060", maxWidth: 340 }}>{toast.msg}</div>;
}

/* ═══════════════════════════════════════════════════════
   NAVBAR
═══════════════════════════════════════════════════════ */
function Navbar({ page, navigate, cartCount }) {
  return (
    <nav style={{ position: "sticky", top: 0, zIndex: 100, background: `${C.bg}e8`, backdropFilter: "blur(12px)", borderBottom: `1px solid ${C.border}` }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 28px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 62 }}>
        <button onClick={() => navigate("home")} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>📓</span>
          <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, color: C.accent, fontWeight: 700 }}>NotaQ</span>
        </button>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {[["home","Inicio"],["shop","Tienda"],["qr","Ver codigo"],].map(([id, label]) => (
            <button key={id} onClick={() => navigate(id)}
              style={{ background: "none", border: "none", cursor: "pointer", color: page === id ? C.accent : C.muted, fontWeight: page === id ? 600 : 400, fontSize: 13, fontFamily: "'DM Sans',sans-serif", padding: "6px 14px 4px", borderBottom: `2px solid ${page === id ? C.accent : "transparent"}`, transition: "all .2s", position: "relative" }}>
              {label}
              {id === "shop" && cartCount > 0 && <span style={{ position: "absolute", top: 0, right: 6, background: C.danger, color: "#fff", borderRadius: 999, width: 16, height: 16, fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{cartCount}</span>}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}

/* ═══════════════════════════════════════════════════════
   LANDING
═══════════════════════════════════════════════════════ */
function LandingPage({ navigate }) {
  const features = [
    { e: "✉️", t: "Mensaje personalizado", d: "Escribí lo que querés que vea tu destinatario al ingresar el codigo" },
    { e: "✝️", t: "Versículo bíblico",     d: "Acompañá el regalo con la Palabra que más inspire" },
    { e: "🎲", t: "Versículo diario",       d: "Un versículo diferente cada día, automático" },
    { e: "🎬", t: "Video mensaje",          d: "Grabate y hacé que tu regalo cobre vida" },
  ];
  return (
    <div>
      <section style={{ minHeight: "92vh", display: "flex", alignItems: "center", position: "relative", overflow: "hidden", padding: "0 28px" }}>
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 70% 60% at 65% 50%,${C.accent}12 0%,transparent 70%)` }} />
        <div style={{ maxWidth: 1200, margin: "0 auto", width: "100%", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center" }}>
          <div className="fade-up">
            <div style={{ marginBottom: 20 }}><Tag>Junior Achievement — Aprender a Emprender</Tag></div>
            <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 68, fontWeight: 700, lineHeight: 1.05, color: C.text, marginBottom: 22 }}>Anotadores que<br /><em style={{ color: C.accent }}>hablan</em><br />por vos</h1>
            <p style={{ fontSize: 17, color: C.muted, lineHeight: 1.75, marginBottom: 36, maxWidth: 460 }}>Cada anotador lleva en su contratapa un código único. Cuando el cliente lo ingresa, ve exactamente lo que quiso compartir.</p>
            <div style={{ display: "flex", gap: 14 }}>
              <Btn onClick={() => navigate("shop")} style={{ padding: "14px 32px", fontSize: 14 }}>Ver productos →</Btn>
              <Btn v="outline" onClick={() => navigate("qr")} style={{ padding: "14px 28px", fontSize: 14 }}>Probar QR</Btn>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {features.map((f, i) => (
              <div key={i} className="hover-card fade-up" style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 24, animationDelay: `${i * 0.1}s` }}>
                <div style={{ fontSize: 32, marginBottom: 14 }}>{f.e}</div>
                <div style={{ fontWeight: 600, color: C.text, marginBottom: 8, fontSize: 15 }}>{f.t}</div>
                <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>{f.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ background: C.surface, padding: "90px 28px", borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 820, margin: "0 auto", textAlign: "center" }}>
          <Tag>Nuestra historia</Tag>
          <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 48, margin: "20px 0 28px", color: C.text }}>De una idea en el aula<br />al mercado real</h2>
          <p style={{ fontSize: 16, color: C.muted, lineHeight: 1.85, marginBottom: 18 }}>Nacimos en el marco del programa <strong style={{ color: C.text }}>Junior Achievement</strong>. Así surgió <strong style={{ color: C.accent }}>NotaQ</strong>: la fusión entre el anotador de toda la vida y la tecnología del presente.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24, marginTop: 52 }}>
            {[{ n:"2025", l:"Año de fundación"}, { n:"∞", l:"Posibilidades de mensaje"}, { n:"100%", l:"Hecho por estudiantes"}].map((s,i)=>(
              <div key={i} style={{ padding: 28, background: C.card, border: `1px solid ${C.border}` }}>
                <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 44, color: C.accent, fontWeight: 700 }}>{s.n}</div>
                <div style={{ fontSize: 13, color: C.muted, marginTop: 8 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: "90px 28px", textAlign: "center" }}>
        <blockquote style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 40, fontStyle: "italic", color: C.text, maxWidth: 750, margin: "0 auto 20px", lineHeight: 1.4 }}>
          "Cada página es un nuevo comienzo.<br />Cada QR, un mensaje del corazón."
        </blockquote>
        <p style={{ color: C.muted, letterSpacing: 2, textTransform: "uppercase", fontSize: 11 }}>— Lema NotaQ</p>
      </section>

      <section style={{ background: C.surface, padding: "90px 28px", borderTop: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <Tag>El equipo</Tag>
            <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 48, margin: "20px 0 12px", color: C.text }}>Las personas detrás de NotaQ</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 20 }}>
            {TEAM.map((m, i) => (
              <div key={i} className="hover-card" style={{ background: C.card, border: `1px solid ${C.border}`, padding: "28px 16px", textAlign: "center" }}>
                <div style={{ width: 72, height: 72, borderRadius: "50%", background: `${m.color}20`, border: `2px solid ${m.color}50`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 28, fontWeight: 700, color: m.color, fontFamily: "'Cormorant Garamond',serif" }}>{m.ini}</div>
                <div style={{ fontWeight: 600, color: C.text, fontSize: 13, marginBottom: 4 }}>{m.name}</div>
                <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.4 }}>{m.role}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer style={{ background: C.bg, borderTop: `1px solid ${C.border}`, padding: "32px 28px", textAlign: "center" }}>
        <p style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, color: C.accent, marginBottom: 8 }}>NotaQ</p>
        <p style={{ fontSize: 12, color: C.muted }}>Empresa del programa Junior Achievement — Aprender a Emprender © 2025</p>
      </footer>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   CHECKOUT MODAL
═══════════════════════════════════════════════════════ */
function CheckoutModal({ cart, coupons, onClose, onSuccess, showToast }) {
  const [form, setForm] = useState({ name: "", lastname: "", phone: "", email: "" });
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [sending, setSending] = useState(false);
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const finalPrice = (p) => Math.round(p.price * (1 - (p.discount || 0) / 100));
  const subtotal = cart.reduce((s, i) => s + finalPrice(i) * i.qty, 0);
  const couponDiscount = appliedCoupon ? Math.round(subtotal * appliedCoupon.discount / 100) : 0;
  const total = subtotal - couponDiscount;

  const applyCoupon = () => {
    const c = coupons.find(c => c.code.toLowerCase() === couponInput.toLowerCase() && c.active);
    if (c) { setAppliedCoupon(c); showToast(`✓ Cupón ${c.code} — ${c.discount}% OFF`); }
    else showToast("Cupón inválido o expirado", "error");
  };

  const submit = async () => {
    if (!form.name || !form.lastname || !form.phone || !form.email) {
      showToast("Completá todos los datos", "error"); return;
    }
    setSending(true);
    try {
      const items = cart.map(i => ({
        id: i.id, name: i.name, qty: i.qty, finalPrice: finalPrice(i),
        customization: i.customization || null,
      }));
      const [order] = await db.orders.insert({
        customer_name: form.name, customer_lastname: form.lastname,
        customer_phone: form.phone, customer_email: form.email,
        items, coupon: appliedCoupon?.code || null,
        subtotal, discount: couponDiscount, total,
      });
      await sendOrderEmail({ ...order, customer_name: form.name, customer_lastname: form.lastname, customer_email: form.email, customer_phone: form.phone, items, coupon: appliedCoupon?.code, subtotal, discount: couponDiscount, total });
      showToast("¡Pedido enviado! Te contactaremos pronto 🎉");
      onSuccess();
    } catch (e) { showToast("Error al enviar: " + e.message, "error"); }
    setSending(false);
  };

  return (
    <Modal title="Confirmar pedido" onClose={onClose} width={560}>
      <p style={{ color: C.muted, fontSize: 13, marginBottom: 20 }}>Completá tus datos para finalizar la compra. Te contactaremos para coordinar la entrega.</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Input label="Nombre"   value={form.name}     onChange={e => setF("name", e.target.value)}     placeholder="Juan" />
        <Input label="Apellido" value={form.lastname}  onChange={e => setF("lastname", e.target.value)}  placeholder="García" />
      </div>
      <Input label="Teléfono" type="tel"   value={form.phone} onChange={e => setF("phone", e.target.value)} placeholder="+54 11 1234-5678" autoComplete="off" />
      <Input label="Email"    type="email" value={form.email} onChange={e => setF("email", e.target.value)} placeholder="tu@email.com"      autoComplete="off" />
      <Divider />
      <div style={{ marginBottom: 16 }}>
        <p style={{ ...lbl, marginBottom: 10 }}>Resumen del pedido</p>
        {cart.map(i => (
          <div key={i.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.muted, marginBottom: 6 }}>
            <span>{i.name} x{i.qty}{i.customization?.hojas ? ` · ${i.customization.hojas}` : ""}{i.customization?.tapa ? ` · ${i.customization.tapa}` : ""}{i.customization?.qr ? ` · QR: ${i.customization.qr}` : ""}</span>
            <span style={{ color: C.text }}>${(Math.round(i.price * (1-(i.discount||0)/100)) * i.qty).toLocaleString("es-AR")}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input value={couponInput} onChange={e => setCouponInput(e.target.value)} placeholder="Código de cupón..." style={{ ...inp, flex: 1 }} />
        <Btn onClick={applyCoupon} style={{ padding: "10px 16px", fontSize: 12 }}>Aplicar</Btn>
      </div>
      {appliedCoupon && <div style={{ marginBottom: 12, padding: "8px 14px", background: `${C.success}15`, border: `1px solid ${C.success}40`, color: C.success, fontSize: 13 }}>✓ {appliedCoupon.code} — {appliedCoupon.discount}% OFF</div>}
      <div style={{ fontSize: 13, color: C.muted, display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span>Subtotal</span><span>${subtotal.toLocaleString("es-AR")}</span></div>
      {couponDiscount > 0 && <div style={{ fontSize: 13, color: C.success, display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span>Descuento</span><span>−${couponDiscount.toLocaleString("es-AR")}</span></div>}
      <Divider />
      <div style={{ display: "flex", justifyContent: "space-between", color: C.text, fontWeight: 700, fontSize: 22, fontFamily: "'Cormorant Garamond',serif", marginBottom: 20 }}>
        <span>Total</span><span style={{ color: C.accent }}>${total.toLocaleString("es-AR")}</span>
      </div>
      <Btn onClick={submit} disabled={sending} style={{ width: "100%", padding: 14, fontSize: 14, textAlign: "center" }}>
        {sending ? <><Spinner /> Enviando pedido...</> : "Confirmar pedido →"}
      </Btn>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════
   CUSTOMIZATION MODAL
═══════════════════════════════════════════════════════ */
function CustomModal({ product, onConfirm, onClose }) {
  const [sel, setSel] = useState({ hojas: "", tapa: "", qr: "" });
  const hojas = product.hojas_opts || [];
  const tapa  = product.tapa_opts  || [];
  const qr    = product.qr_opts    || [];

  const allDone = (
    (hojas.length === 0 || sel.hojas) &&
    (tapa.length  === 0 || sel.tapa)  &&
    (qr.length    === 0 || sel.qr)
  );

  const qrLabels = { mensaje: "✉️ Mensaje", versiculo: "✝️ Versículo fijo", video: "🎬 Video", aleatorio: "🎲 Versículo diario" };

  const OptGroup = ({ label, opts, field }) => opts.length === 0 ? null : (
    <Field label={label}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {opts.map(o => (
          <button key={o} onClick={() => setSel(s => ({ ...s, [field]: o }))}
            style={{ padding: "10px 18px", background: sel[field] === o ? `${C.accent}18` : C.card, border: `1px solid ${sel[field] === o ? C.accent : C.border}`, color: sel[field] === o ? C.accent : C.muted, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: sel[field] === o ? 700 : 400, transition: "all .2s" }}>
            {field === "qr" ? qrLabels[o] || o : o}
          </button>
        ))}
      </div>
    </Field>
  );

  return (
    <Modal title={`Personalizar: ${product.name}`} onClose={onClose} width={480}>
      <p style={{ color: C.muted, fontSize: 13, marginBottom: 20 }}>Elegí las opciones para este anotador.</p>
      <OptGroup label="Tipo de hojas" opts={hojas} field="hojas" />
      <OptGroup label="Tipo de tapa"  opts={tapa}  field="tapa"  />
      <OptGroup label="Contenido QR"  opts={qr}    field="qr"    />
      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <Btn v="ghost" onClick={onClose} style={{ flex: 1 }}>Cancelar</Btn>
        <Btn onClick={() => onConfirm(sel)} disabled={!allDone} style={{ flex: 1 }}>Agregar al carrito →</Btn>
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════
   SHOP
═══════════════════════════════════════════════════════ */
function ShopPage({ products, loading, cart, setCart, coupons, showToast }) {
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customFor, setCustomFor] = useState(null);

  const finalPrice = (p) => Math.round(p.price * (1 - (p.discount || 0) / 100));

  const addToCart = (product, customization = null) => {
    setCart(prev => {
      const key = product.id + JSON.stringify(customization);
      const ex  = prev.find(i => i._key === key);
      return ex
        ? prev.map(i => i._key === key ? { ...i, qty: i.qty + 1 } : i)
        : [...prev, { ...product, qty: 1, customization, _key: key }];
    });
    showToast(`${product.name} agregado al carrito 🛒`);
  };

  const handleAddClick = (p) => {
    const hasCustom = (p.hojas_opts?.length || p.tapa_opts?.length || p.qr_opts?.length) && p.custom;
    if (hasCustom) setCustomFor(p);
    else addToCart(p);
  };

  const updateQty = (key, qty) => {
    if (qty < 1) { setCart(prev => prev.filter(i => i._key !== key)); return; }
    setCart(prev => prev.map(i => i._key === key ? { ...i, qty } : i));
  };

  const cartTotal = cart.reduce((s, i) => s + i.qty, 0);
  const [cartOpen, setCartOpen] = useState(false);

  return (
    <div style={{ minHeight: "100vh" }}>
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "36px 28px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <Tag>Catálogo</Tag>
            <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 42, color: C.text, marginTop: 12 }}>Nuestra Tienda</h1>
          </div>
          <button onClick={() => setCartOpen(true)} style={{ background: C.card, border: `1px solid ${C.border}`, color: C.text, padding: "12px 22px", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 13, display: "flex", alignItems: "center", gap: 10 }}>
            🛒 Carrito {cartTotal > 0 && <Badge>{cartTotal}</Badge>}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "52px 28px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 80, color: C.muted }}><Spinner /><p style={{ marginTop: 16 }}>Cargando...</p></div>
        ) : products.length === 0 ? (
          <div style={{ textAlign: "center", padding: 80 }}><div style={{ fontSize: 52, marginBottom: 16 }}>📦</div><p style={{ color: C.muted }}>No hay productos disponibles.</p></div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(268px,1fr))", gap: 24 }}>
            {products.map((p, idx) => (
              <div key={p.id} className="hover-card fade-up" style={{ background: C.surface, border: `1px solid ${C.border}`, display: "flex", flexDirection: "column", animationDelay: `${idx * 0.08}s` }}>
                <div style={{ height: 210, position: "relative", overflow: "hidden", borderBottom: `1px solid ${C.border}`, background: C.card }}>
                  {p.img_url
                    ? <img src={p.img_url} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform .4s" }} onMouseOver={e => e.currentTarget.style.transform="scale(1.06)"} onMouseOut={e => e.currentTarget.style.transform="scale(1)"} />
                    : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 72, color: C.muted }}>📓</div>}
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top,#0a070360 0%,transparent 60%)", pointerEvents: "none" }} />
                  {p.discount > 0 && <div style={{ position: "absolute", top: 14, right: 14, background: C.danger, color: "#fff", padding: "4px 10px", fontSize: 11, fontWeight: 700 }}>−{p.discount}%</div>}
                </div>
                <div style={{ padding: 24, flex: 1, display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                    {p.custom ? <Tag>✓ Personalizable</Tag> : <Tag color={C.muted}>Sin personalización</Tag>}
                    {p.stock <= 15 && p.stock > 0 && <Tag color="#e67e22">¡Pocas unidades!</Tag>}
                  </div>
                  <h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, color: C.text, marginBottom: 10 }}>{p.name}</h3>
                  <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.65, flex: 1, marginBottom: 16 }}>{p.description}</p>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
                    <div>
                      {p.discount > 0 && <div style={{ fontSize: 12, color: C.muted, textDecoration: "line-through" }}>${p.price.toLocaleString("es-AR")}</div>}
                      <div style={{ fontSize: 26, fontWeight: 700, color: C.accent, fontFamily: "'Cormorant Garamond',serif" }}>${finalPrice(p).toLocaleString("es-AR")}</div>
                    </div>
                    <Btn onClick={() => handleAddClick(p)} disabled={p.stock === 0}>{p.stock === 0 ? "Sin stock" : p.custom ? "Personalizar →" : "+ Agregar"}</Btn>
                  </div>
                  <div style={{ marginTop: 10, fontSize: 11, color: C.muted }}>Stock: {p.stock} u.</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {customFor && (
        <CustomModal
          product={customFor}
          onClose={() => setCustomFor(null)}
          onConfirm={(customization) => { addToCart(customFor, customization); setCustomFor(null); }}
        />
      )}

      {cartOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300 }}>
          <div style={{ position: "absolute", inset: 0, background: "#00000080" }} onClick={() => setCartOpen(false)} />
          <div className="slide-right" style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 440, background: C.surface, borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "22px 24px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26, color: C.text }}>Tu carrito</h2>
              <button onClick={() => setCartOpen(false)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 20 }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
              {cart.length === 0 ? (
                <div style={{ textAlign: "center", paddingTop: 60 }}><div style={{ fontSize: 48, marginBottom: 16 }}>🛒</div><p style={{ color: C.muted }}>El carrito está vacío</p></div>
              ) : cart.map(item => (
                <div key={item._key} style={{ display: "flex", gap: 14, marginBottom: 16, padding: 16, background: C.card, border: `1px solid ${C.border}` }}>
                  <div style={{ width: 54, height: 54, flexShrink: 0, overflow: "hidden", background: C.surface }}>
                    {item.img_url ? <img src={item.img_url} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>📓</div>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: C.text, fontSize: 14, marginBottom: 2 }}>{item.name}</div>
                    {item.customization && (
                      <div style={{ fontSize: 11, color: C.muted, marginBottom: 4, lineHeight: 1.5 }}>
                        {item.customization.hojas && <span>📄 {item.customization.hojas} </span>}
                        {item.customization.tapa  && <span>📒 {item.customization.tapa} </span>}
                        {item.customization.qr    && <span>📱 QR: {item.customization.qr}</span>}
                      </div>
                    )}
                    <div style={{ color: C.accent, fontSize: 13 }}>${Math.round(item.price*(1-(item.discount||0)/100)).toLocaleString("es-AR")} c/u</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
                      <button onClick={() => updateQty(item._key, item.qty - 1)} style={{ background: C.border, border: "none", color: C.text, width: 26, height: 26, cursor: "pointer", fontSize: 16 }}>−</button>
                      <span style={{ color: C.text, fontWeight: 600 }}>{item.qty}</span>
                      <button onClick={() => updateQty(item._key, item.qty + 1)} style={{ background: C.border, border: "none", color: C.text, width: 26, height: 26, cursor: "pointer", fontSize: 16 }}>+</button>
                      <button onClick={() => setCart(c => c.filter(i => i._key !== item._key))} style={{ background: "none", border: "none", color: C.danger, cursor: "pointer", fontSize: 12, marginLeft: "auto" }}>Eliminar</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {cart.length > 0 && (
              <div style={{ padding: 20, borderTop: `1px solid ${C.border}` }}>
                <Btn onClick={() => { setCartOpen(false); setCheckoutOpen(true); }} style={{ width: "100%", padding: 14, fontSize: 14, textAlign: "center" }}>
                  Ir a comprar →
                </Btn>
              </div>
            )}
          </div>
        </div>
      )}

      {checkoutOpen && (
        <CheckoutModal
          cart={cart} coupons={coupons} showToast={showToast}
          onClose={() => setCheckoutOpen(false)}
          onSuccess={() => { setCart([]); setCheckoutOpen(false); }}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   QR VIEWER
═══════════════════════════════════════════════════════ */
function QRViewerPage({ initCode }) {
  const [input, setInput]     = useState(initCode || "");
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [showFull, setShowFull] = useState(false);

  const search = async () => {
    const code = input.toUpperCase().trim();
    if (!code) return;
    setLoading(true); setSearched(false);
    try {
      const rows  = await db.notebooks.get(code);
      const found = rows?.[0] || null;
      setResult(found); setSearched(true);
      if (found) setShowFull(true);
    } catch { setResult(null); setSearched(true); }
    setLoading(false);
  };

  useEffect(() => { if (initCode) search(); }, []);

  if (showFull && result) {
    return (
      <div className="fade-in" style={{ position: "fixed", inset: 0, zIndex: 200, overflowY: "auto", background: C.bg }}>
        <div style={{ position: "fixed", inset: 0, background: `radial-gradient(ellipse 80% 60% at 50% 30%,${C.accent}0a 0%,transparent 70%)`, pointerEvents: "none" }} />
        <div style={{ position: "sticky", top: 0, zIndex: 10, background: `${C.bg}e0`, backdropFilter: "blur(12px)", borderBottom: `1px solid ${C.border}`, padding: "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "'Cormorant Garamond',serif", color: C.accent, fontSize: 18, fontWeight: 700 }}>📓 NotaQ</span>
          <button onClick={() => setShowFull(false)} style={{ background: "none", border: `1px solid ${C.border}`, color: C.muted, padding: "7px 18px", cursor: "pointer", fontSize: 12, fontFamily: "'DM Sans',sans-serif" }}>← Volver</button>
        </div>
        <div style={{ minHeight: "calc(100vh - 57px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 28px" }}>
          {result.type === "mensaje" && (
            <div className="fade-up" style={{ maxWidth: 720, width: "100%", textAlign: "center" }}>
              <div style={{ width: 80, height: 1, background: `linear-gradient(to right,transparent,${C.accent},transparent)`, margin: "0 auto 52px" }} />
              <p style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "clamp(28px,5vw,52px)", fontStyle: "italic", color: C.text, lineHeight: 1.65 }}>"{result.content}"</p>
              <div style={{ width: 80, height: 1, background: `linear-gradient(to right,transparent,${C.accent},transparent)`, margin: "52px auto 0" }} />
            </div>
          )}
          {result.type === "versiculo" && (
            <div className="fade-up" style={{ maxWidth: 780, width: "100%", textAlign: "center" }}>
              <div style={{ fontSize: 64, marginBottom: 48 }}>✝️</div>
              <p style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "clamp(28px,5vw,52px)", fontStyle: "italic", color: C.text, lineHeight: 1.6, marginBottom: 32 }}>"{result.content.replace(/ — .*/,"")}"</p>
              {result.content.includes(" — ") && <p style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, color: C.accent }}>— {result.content.split(" — ")[1]}</p>}
            </div>
          )}
          {result.type === "video" && (
            <div className="fade-up" style={{ maxWidth: 900, width: "100%" }}>
              <div style={{ position: "relative", paddingBottom: "56.25%", background: "#000" }}>
                <iframe src={result.content} title="Video" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }} allowFullScreen />
              </div>
            </div>
          )}
          {result.type === "aleatorio" && (() => {
            const v = getDailyVerse();
            const dateStr = new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
            return (
              <div className="fade-up" style={{ maxWidth: 780, width: "100%", textAlign: "center" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 44, padding: "8px 22px", background: `${C.accent}10`, border: `1px solid ${C.accent}25` }}>
                  <span style={{ fontSize: 10, letterSpacing: 2.5, textTransform: "uppercase", color: C.accent, fontWeight: 700 }}>✝️ Versículo del día · {dateStr}</span>
                </div>
                <div style={{ width: 80, height: 1, background: `linear-gradient(to right,transparent,${C.accent},transparent)`, margin: "0 auto 52px" }} />
                <p style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "clamp(28px,5vw,52px)", fontStyle: "italic", color: C.text, lineHeight: 1.65, marginBottom: 32 }}>"{v.text}"</p>
                <p style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, color: C.accent }}>— {v.ref}</p>
              </div>
            );
          })()}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "64px 24px" }}>
      <div style={{ maxWidth: 520, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📱</div>
          <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 36, color: C.text, marginBottom: 10 }}>Ver mi mensaje</h2>
          <p style={{ color: C.muted, fontSize: 14 }}>Ingresá el código de la contratapa de tu anotador</p>
        </div>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 28 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <input value={input} onChange={e => { setInput(e.target.value); setSearched(false); }} onKeyDown={e => e.key === "Enter" && search()} placeholder="Ej: A123456789" style={{ ...inp, flex: 1, fontSize: 16, textTransform: "uppercase", letterSpacing: 1.5 }} />
            <Btn onClick={search} disabled={loading} style={{ padding: "13px 26px" }}>{loading ? <Spinner /> : "Ver →"}</Btn>
          </div>
        </div>
        {searched && !result && (
          <div className="fade-up" style={{ marginTop: 20, background: C.surface, border: `1px solid ${C.border}`, padding: 36, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            <p style={{ fontWeight: 700, color: C.text, fontSize: 16, marginBottom: 8 }}>Código no encontrado</p>
            <p style={{ color: C.muted, fontSize: 13 }}>Aún no tiene contenido. Hablá con nuestro equipo.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   ADMIN LOGIN — seguro con hash SHA-256
═══════════════════════════════════════════════════════ */
function AdminLogin({ setAdminRole }) {
  const [user, setUser]       = useState("");
  const [pwd, setPwd]         = useState("");
  const [show, setShow]       = useState(false);
  const [err, setErr]         = useState("");
  const [loading, setLoading] = useState(false);
  const pwdRef                = useRef(null);

  const tryLogin = async () => {
    if (!user.trim() || !pwd) return;
    setLoading(true); setErr("");
    try {
      const hash = await hashPwd(pwd);
      const rows = await db.adminUsers.check(user.trim(), hash);
      if (rows?.length > 0) setAdminRole(rows[0].role);
      else { setErr("Usuario o contraseña incorrectos."); setPwd(""); }
    } catch { setErr("Error de conexión."); }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 28 }}>
      <div style={{ maxWidth: 400, width: "100%" }} className="fade-up">
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>🔐</div>
          <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 38, color: C.text, marginBottom: 10 }}>Acceso Administrativo</h1>
          <p style={{ color: C.muted, fontSize: 14 }}>Ingresá tu usuario y contraseña</p>
        </div>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 32 }}>
          <Field label="Usuario">
            <input
              value={user}
              onChange={e => { setUser(e.target.value); setErr(""); }}
              onKeyDown={e => e.key === "Enter" && pwdRef.current?.focus()}
              placeholder="Tu nombre de usuario"
              autoComplete="username"
              style={inp}
            />
          </Field>
          <Field label="Contraseña">
            <div style={{ position: "relative" }}>
              <input
                ref={pwdRef}
                type={show ? "text" : "password"}
                value={pwd}
                onChange={e => { setPwd(e.target.value); setErr(""); }}
                onKeyDown={e => e.key === "Enter" && tryLogin()}
                placeholder="••••••••"
                autoComplete="current-password"
                style={{ ...inp, paddingRight: 44 }}
              />
              <button onClick={() => setShow(s => !s)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 16 }}>
                {show ? "🙈" : "👁️"}
              </button>
            </div>
          </Field>
          {err && <p style={{ color: C.danger, fontSize: 13, marginBottom: 14, marginTop: -8 }}>{err}</p>}
          <Btn onClick={tryLogin} disabled={loading || !user.trim() || !pwd} style={{ width: "100%", justifyContent: "center" }}>
            {loading ? <Spinner /> : "Ingresar →"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   STAFF PANEL
═══════════════════════════════════════════════════════ */
function StaffPanel({ showToast, navigate }) {
  const [code, setCode]     = useState("");
  const [entry, setEntry]   = useState(null);
  const [searched, setSearched] = useState(false);
  const [type, setType]     = useState("mensaje");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving]   = useState(false);

  const typeConfig = {
    mensaje:  { icon:"✉️", label:"Mensaje personalizado",      ph:"Ej: ¡Feliz cumpleaños! Que este año esté lleno de bendiciones..." },
    versiculo:{ icon:"✝️", label:"Versículo bíblico (fijo)",   ph:'"Todo lo puedo en Cristo que me fortalece." — Filipenses 4:13' },
    video:    { icon:"🎬", label:"URL embed de YouTube",        ph:"https://www.youtube.com/embed/XXXXXXXXXXX" },
    aleatorio:{ icon:"🎲", label:"Versículo del día", ph: null },
  };

  const doSearch = async () => {
    const c = code.toUpperCase().trim();
    if (!c) return;
    setLoading(true); setSearched(false);
    try {
      const rows  = await db.notebooks.get(c);
      const found = rows?.[0] || null;
      setEntry(found); setSearched(true);
      if (found) { setType(found.type); setContent(found.content || ""); }
      else { setType("mensaje"); setContent(""); }
    } catch { setEntry(null); setSearched(true); }
    setLoading(false);
  };

  const doSave = async () => {
    const c = code.toUpperCase().trim();
    if (!c) { showToast("Ingresá el código del anotador", "error"); return; }
    if (type !== "aleatorio" && !content.trim()) { showToast("Completá el contenido", "error"); return; }
    setSaving(true);
    try {
      await db.notebooks.save({ code: c, type, content: type === "aleatorio" ? "" : content });
      setEntry({ type, content: type === "aleatorio" ? "" : content });
      showToast(`✓ Guardado para ${c}`);
    } catch (e) { showToast("Error: " + e.message, "error"); }
    setSaving(false);
  };

  return (
    <div style={{ minHeight: "100vh", padding: "52px 28px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
          <div>
            <Tag color={C.accent}>Personal de Ventas</Tag>
            <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 36, color: C.text, marginTop: 14 }}>Carga de contenido QR</h1>
          </div>
          <Btn v="ghost" onClick={() => navigate("admin")} style={{ fontSize: 13 }}>← Salir</Btn>
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 24, marginBottom: 20 }}>
          <h3 style={{ color: C.text, fontWeight: 600, marginBottom: 16 }}><span style={{ color: C.accent, fontFamily: "'Cormorant Garamond',serif", fontSize: 20 }}>1.</span> Código del anotador</h3>
          <div style={{ display: "flex", gap: 10 }}>
            <input value={code} onChange={e => { setCode(e.target.value); setSearched(false); }} onKeyDown={e => e.key === "Enter" && doSearch()} placeholder="Ej: ANO-001" style={{ ...inp, flex: 1, fontSize: 16, textTransform: "uppercase", letterSpacing: 1 }} />
            <Btn onClick={doSearch} disabled={loading} style={{ padding: "11px 24px" }}>{loading ? <Spinner /> : "Buscar"}</Btn>
          </div>
          {searched && <div style={{ marginTop: 14, padding: "11px 16px", background: C.card, border: `1px solid ${entry ? C.success+"50" : C.border}`, color: entry ? C.success : C.muted, fontSize: 13 }}>{entry ? `✓ Encontrado. Tipo actual: "${entry.type}". Podés editarlo.` : "ℹ️ Sin contenido aún. Podés cargarlo ahora."}</div>}
        </div>

        {searched && (
          <div className="fade-up" style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 24, marginBottom: 20 }}>
            <h3 style={{ color: C.text, fontWeight: 600, marginBottom: 16 }}><span style={{ color: C.accent, fontFamily: "'Cormorant Garamond',serif", fontSize: 20 }}>2.</span> Tipo de contenido</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
              {Object.entries(typeConfig).map(([k, v]) => (
                <button key={k} onClick={() => { setType(k); setContent(""); }}
                  style={{ padding: "14px 8px", background: type===k?`${C.accent}18`:C.card, border:`1px solid ${type===k?C.accent:C.border}`, color:type===k?C.accent:C.muted, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontSize:12, fontWeight:type===k?600:400, transition:"all .2s" }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{v.icon}</div>
                  <div style={{ textTransform: "capitalize", lineHeight: 1.3 }}>{k}</div>
                </button>
              ))}
            </div>
            <Field label={typeConfig[type].label}>
              {type === "aleatorio" ? (
                <div style={{ background: C.card, border: `1px solid ${C.accent}40`, padding: "18px 20px" }}>
                  <p style={{ color: C.text, fontSize: 14, marginBottom: 8 }}>✨ El cliente verá un versículo diferente cada día automáticamente.</p>
                  <p style={{ color: C.muted, fontSize: 12 }}>No necesitás escribir nada.</p>
                </div>
              ) : (
                <textarea value={content} onChange={e => setContent(e.target.value)} rows={type==="video"?2:5} placeholder={typeConfig[type].ph} style={{ ...inp, resize:"vertical", minHeight:type==="video"?52:110 }} />
              )}
            </Field>
            <Btn onClick={doSave} disabled={saving||(type!=="aleatorio"&&!content.trim())} style={{ width:"100%", textAlign:"center", padding:14, fontSize:14 }}>
              {saving ? <><Spinner /> Guardando...</> : `💾 Guardar para ${code.toUpperCase()||"---"}`}
            </Btn>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   DIRECTOR PANEL
═══════════════════════════════════════════════════════ */
function DirectorPanel({ products, setProducts, coupons, setCoupons, showToast, navigate }) {
  const [tab, setTab]         = useState("products");
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId]   = useState(null);
  const emptyForm = { name:"", description:"", price:"", discount:0, stock:"", img_url:"", custom:true, hojas_opts:[], tapa_opts:[], qr_opts:[] };
  const [form, setForm]       = useState(emptyForm);
  const [cpForm, setCpForm]   = useState({ code:"", discount:10 });
  const [confirmDel, setConfirmDel] = useState(null);
  const [saving, setSaving]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleArr = (key, val) => setF(key, form[key].includes(val) ? form[key].filter(x=>x!==val) : [...form[key], val]);

  const openNew  = () => { setForm(emptyForm); setEditId(null); setShowModal(true); };
  const openEdit = (p) => { setForm({ ...p, price: String(p.price), stock: String(p.stock), hojas_opts: p.hojas_opts||[], tapa_opts: p.tapa_opts||[], qr_opts: p.qr_opts||[] }); setEditId(p.id); setShowModal(true); };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try { const url = await uploadImage(file); setF("img_url", url); showToast("✓ Imagen subida"); }
    catch (err) { showToast("Error subiendo imagen: " + err.message, "error"); }
    setUploading(false);
    e.target.value = "";
  };

  const doSave = async () => {
    if (!form.name||!form.price||!form.stock) { showToast("Completá nombre, precio y stock","error"); return; }
    setSaving(true);
    const payload = { name:form.name, description:form.description, price:Number(form.price), discount:Number(form.discount), stock:Number(form.stock), img_url:form.img_url, custom:form.custom, hojas_opts:form.hojas_opts, tapa_opts:form.tapa_opts, qr_opts:form.qr_opts };
    try {
      if (editId) {
        const [u] = await db.products.update(editId, payload);
        setProducts(prev => prev.map(p => p.id===editId ? u : p));
        showToast("Producto actualizado ✓");
      } else {
        const [c] = await db.products.insert(payload);
        setProducts(prev => [...prev, c]);
        showToast("Producto creado ✓");
      }
      setShowModal(false);
    } catch(e) { showToast("Error: "+e.message,"error"); }
    setSaving(false);
  };

  const doDelete = async (id) => {
    try { await db.products.remove(id); setProducts(prev=>prev.filter(p=>p.id!==id)); showToast("Eliminado"); }
    catch(e){ showToast("Error: "+e.message,"error"); }
    setConfirmDel(null);
  };

  const doAddCoupon = async () => {
    if (!cpForm.code) { showToast("Ingresá un código","error"); return; }
    if (coupons.find(c=>c.code.toLowerCase()===cpForm.code.toLowerCase())) { showToast("Ya existe","error"); return; }
    try {
      const [c] = await db.coupons.insert({ code:cpForm.code.toUpperCase(), discount:Number(cpForm.discount), active:true });
      setCoupons(prev=>[...prev,c]); setCpForm({code:"",discount:10}); showToast("Cupón creado ✓");
    } catch(e){ showToast("Error: "+e.message,"error"); }
  };

  const toggleCoupon = async (id, cur) => {
    try { const [u]=await db.coupons.update(id,{active:!cur}); setCoupons(prev=>prev.map(c=>c.id===id?u:c)); }
    catch(e){ showToast("Error: "+e.message,"error"); }
  };

  const delCoupon = async (id) => {
    try { await db.coupons.remove(id); setCoupons(prev=>prev.filter(c=>c.id!==id)); showToast("Cupón eliminado"); }
    catch(e){ showToast("Error: "+e.message,"error"); }
  };

  const ChkGroup = ({ label, opts, field }) => (
    <Field label={label}>
      <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
        {opts.map(o => {
          const on = form[field].includes(o);
          return <button key={o} onClick={()=>toggleArr(field,o)} style={{ padding:"9px 16px", background:on?`${C.accent}18`:C.card, border:`1px solid ${on?C.accent:C.border}`, color:on?C.accent:C.muted, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontSize:12, fontWeight:on?700:400, transition:"all .2s" }}>{o}</button>;
        })}
      </div>
    </Field>
  );

  return (
    <div style={{ minHeight:"100vh", padding:"52px 28px" }}>
      <div style={{ maxWidth:1060, margin:"0 auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:32 }}>
          <div>
            <Tag color={C.info}>Director / Gerente</Tag>
            <h1 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:36, color:C.text, marginTop:14 }}>Gestión de la Tienda</h1>
          </div>
          <Btn v="ghost" onClick={()=>navigate("admin")} style={{fontSize:13}}>← Salir</Btn>
        </div>

        <div style={{ display:"flex", borderBottom:`1px solid ${C.border}`, marginBottom:32 }}>
          {[["products","📦  Productos"],["coupons","🏷️  Cupones"]].map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)} style={{ background:"none", border:"none", padding:"13px 26px", cursor:"pointer", color:tab===id?C.accent:C.muted, fontWeight:tab===id?700:400, fontFamily:"'DM Sans',sans-serif", fontSize:13, borderBottom:`2px solid ${tab===id?C.accent:"transparent"}`, marginBottom:-1, transition:"all .2s" }}>{label}</button>
          ))}
        </div>

        {tab === "products" && (
          <div>
            <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:20 }}>
              <Btn onClick={openNew}>+ Nuevo producto</Btn>
            </div>
            {products.length===0 ? (
              <div style={{ textAlign:"center", padding:60, color:C.muted }}><div style={{fontSize:52,marginBottom:16}}>📦</div><p>No hay productos. Creá el primero.</p></div>
            ) : (
              <div style={{ display:"grid", gap:14 }}>
                {products.map(p=>(
                  <div key={p.id} className="hover-card" style={{ background:C.surface, border:`1px solid ${C.border}`, padding:"20px 24px", display:"flex", gap:20, alignItems:"center" }}>
                    <div style={{ width:64, height:64, flexShrink:0, overflow:"hidden", background:C.card, border:`1px solid ${C.border}` }}>
                      {p.img_url?<img src={p.img_url} alt={p.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28}}>📓</div>}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6, flexWrap:"wrap" }}>
                        <span style={{ fontWeight:700, color:C.text, fontSize:16 }}>{p.name}</span>
                        {p.discount>0&&<Tag color={C.danger}>−{p.discount}%</Tag>}
                        {p.custom?<Tag>Personalizable</Tag>:<Tag color={C.muted}>Sin QR</Tag>}
                        {p.stock<=10&&<Tag color="#e67e22">Stock bajo</Tag>}
                      </div>
                      <p style={{ fontSize:13, color:C.muted, marginBottom:6 }}>{p.description}</p>
                      <div style={{ display:"flex", gap:16, fontSize:12, color:C.muted, flexWrap:"wrap" }}>
                        <span style={{color:C.accent,fontWeight:700}}>${Number(p.price).toLocaleString("es-AR")}</span>
                        <span>Stock: {p.stock} u.</span>
                        {p.hojas_opts?.length>0&&<span>📄 {p.hojas_opts.join(", ")}</span>}
                        {p.tapa_opts?.length>0 &&<span>📒 {p.tapa_opts.join(", ")}</span>}
                        {p.qr_opts?.length>0   &&<span>📱 {p.qr_opts.join(", ")}</span>}
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:8, flexShrink:0 }}>
                      <Btn v="ghost" onClick={()=>openEdit(p)} style={{padding:"8px 16px",fontSize:12}}>Editar</Btn>
                      <Btn v="danger" onClick={()=>setConfirmDel(p.id)} style={{padding:"8px 14px",fontSize:12}}>✕</Btn>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "coupons" && (
          <div>
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, padding:24, marginBottom:24 }}>
              <h3 style={{ color:C.text, fontWeight:600, marginBottom:18, fontSize:16 }}>Crear nuevo cupón</h3>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 160px auto", gap:12, alignItems:"flex-end" }}>
                <Field label="Código"><input value={cpForm.code} onChange={e=>setCpForm(f=>({...f,code:e.target.value}))} placeholder="Ej: VERANO25" style={{...inp,textTransform:"uppercase",letterSpacing:1}}/></Field>
                <Field label="Descuento (%)"><input type="number" min={1} max={100} value={cpForm.discount} onChange={e=>setCpForm(f=>({...f,discount:e.target.value}))} style={inp}/></Field>
                <Btn onClick={doAddCoupon} style={{padding:"11px 20px",alignSelf:"flex-end",marginBottom:16}}>Crear</Btn>
              </div>
            </div>
            {coupons.length===0?<p style={{color:C.muted,textAlign:"center",padding:40}}>No hay cupones.</p>:(
              <div style={{display:"grid",gap:12}}>
                {coupons.map(c=>(
                  <div key={c.id} style={{ background:C.surface, border:`1px solid ${c.active?C.border:C.border+"60"}`, padding:"18px 24px", display:"flex", alignItems:"center", gap:20, opacity:c.active?1:0.55, transition:"opacity .2s" }}>
                    <div style={{ background:`${C.accent}12`, border:`1px dashed ${C.accent}70`, padding:"8px 20px", fontFamily:"'Cormorant Garamond',serif", fontSize:20, color:C.accent, letterSpacing:3, fontWeight:700 }}>{c.code}</div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,color:C.text,fontSize:16}}>{c.discount}% de descuento</div>
                      <div style={{fontSize:12,color:c.active?C.success:C.muted,marginTop:4}}>{c.active?"● Activo":"○ Inactivo"}</div>
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      <Btn v={c.active?"ghost":"success"} onClick={()=>toggleCoupon(c.id,c.active)} style={{padding:"8px 16px",fontSize:12}}>{c.active?"Desactivar":"Activar"}</Btn>
                      <Btn v="danger" onClick={()=>delCoupon(c.id)} style={{padding:"8px 14px",fontSize:12}}>✕</Btn>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <Modal title={editId?"Editar producto":"Nuevo producto"} onClose={()=>setShowModal(false)} width={580}>
          <Input label="Nombre del producto" value={form.name} onChange={e=>setF("name",e.target.value)} placeholder="Ej: Anotador Clásico"/>
          <Textarea label="Descripción" value={form.description} onChange={e=>setF("description",e.target.value)} placeholder="Describí el producto..."/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
            <Input label="Precio ($)"     type="number" value={form.price}    onChange={e=>setF("price",e.target.value)}    placeholder="1200"/>
            <Input label="Descuento (%)" type="number" value={form.discount}  onChange={e=>setF("discount",e.target.value)} />
            <Input label="Stock (u.)"    type="number" value={form.stock}     onChange={e=>setF("stock",e.target.value)}    placeholder="50"/>
          </div>
          <Divider/>

          <Field label="Imagen del producto">
            <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
              <div style={{width:90,height:90,background:C.card,border:`1px solid ${C.border}`,flexShrink:0,overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center"}}>
                {form.img_url?<img src={form.img_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} onError={e=>e.target.style.display="none"}/>:<span style={{fontSize:32,color:C.muted}}>📷</span>}
              </div>
              <div style={{flex:1}}>
                <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleUpload}/>
                <Btn v="ghost" onClick={()=>fileRef.current.click()} disabled={uploading} style={{width:"100%",padding:"10px 16px",fontSize:12,marginBottom:8}}>
                  {uploading?<><Spinner/> Subiendo...</>:"📤 Subir imagen desde mi dispositivo"}
                </Btn>
                <input value={form.img_url} onChange={e=>setF("img_url",e.target.value)} placeholder="O pegá una URL de imagen aquí" style={{...inp,fontSize:12,padding:"8px 12px"}}/>
              </div>
            </div>
          </Field>
          <Divider/>

          <Field label="¿El producto admite personalización?">
            <div style={{display:"flex",gap:10}}>
              {[true,false].map(v=>(
                <button key={String(v)} onClick={()=>setF("custom",v)} style={{ flex:1, padding:12, background:form.custom===v?`${C.accent}18`:C.card, border:`1px solid ${form.custom===v?C.accent:C.border}`, color:form.custom===v?C.accent:C.muted, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontSize:13, fontWeight:form.custom===v?700:400, transition:"all .2s" }}>
                  {v?"✓ Sí, con personalización":"✗ No, sin personalización"}
                </button>
              ))}
            </div>
          </Field>

          {form.custom && (
            <>
              <ChkGroup label="Tipos de hojas disponibles" opts={HOJAS_OPTS} field="hojas_opts"/>
              <ChkGroup label="Opciones de tapa"           opts={TAPA_OPTS}  field="tapa_opts"/>
              <ChkGroup label="Opciones de QR"             opts={QR_OPTS.map(o=>o)} field="qr_opts"/>
            </>
          )}

          <div style={{display:"flex",gap:10,marginTop:8}}>
            <Btn v="ghost" onClick={()=>setShowModal(false)} style={{flex:1}}>Cancelar</Btn>
            <Btn onClick={doSave} disabled={saving} style={{flex:1}}>
              {saving?<><Spinner/> Guardando...</>:editId?"Guardar cambios":"Crear producto"}
            </Btn>
          </div>
        </Modal>
      )}

      {confirmDel && (
        <Modal title="¿Eliminar producto?" onClose={()=>setConfirmDel(null)} width={360}>
          <p style={{color:C.muted,fontSize:14,marginBottom:24}}>Esta acción no se puede deshacer.</p>
          <div style={{display:"flex",gap:10}}>
            <Btn v="ghost" onClick={()=>setConfirmDel(null)} style={{flex:1}}>Cancelar</Btn>
            <Btn v="danger" onClick={()=>doDelete(confirmDel)} style={{flex:1}}>Sí, eliminar</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   ROOT APP
═══════════════════════════════════════════════════════ */
const getInitialPage = () => {
  const path = window.location.pathname;
  if (path === "/administracion" || path === "/administracion/") return "admin";
  return "home";
};

export default function App() {
  const [page, setPage]             = useState(getInitialPage);
  const [qrInit, setQrInit]         = useState("");
  const [adminRole, setAdminRole]   = useState(null);
  const [cart, setCart]             = useState([]);
  const [products, setProducts]     = useState([]);
  const [coupons, setCoupons]       = useState([]);
  const [loadingShop, setLoadingShop] = useState(false);
  const [toast, setToast]           = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    setLoadingShop(true);
    Promise.all([db.products.list(), db.coupons.list()])
      .then(([prods, coups]) => { setProducts(prods || []); setCoupons(coups || []); })
      .catch(e => showToast("Error cargando datos: " + e.message, "error"))
      .finally(() => setLoadingShop(false));
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === "/administracion" || path === "/administracion/") {
        setPage("admin");
      } else {
        setPage("home");
        setAdminRole(null);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = (p, params = {}) => {
    setPage(p);
    if (params.code) setQrInit(params.code);
    if (p !== "admin") setAdminRole(null);
    window.scrollTo(0, 0);
    const newPath = p === "admin" ? "/administracion" : "/";
    if (window.location.pathname !== newPath) {
      window.history.pushState({}, "", newPath);
    }
  };

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", background: C.bg, color: C.text, minHeight: "100vh" }}>
      <style>{css}</style>
      <Toast toast={toast} />
      <Navbar page={page} navigate={navigate} cartCount={cartCount} />
      {page === "home"  && <LandingPage navigate={navigate} />}
      {page === "shop"  && <ShopPage products={products} loading={loadingShop} cart={cart} setCart={setCart} coupons={coupons} showToast={showToast} />}
      {page === "qr"    && <QRViewerPage key={qrInit} initCode={qrInit} />}
      {page === "admin" && !adminRole               && <AdminLogin setAdminRole={setAdminRole} />}
      {page === "admin" && adminRole === "staff"    && <StaffPanel showToast={showToast} navigate={navigate} />}
      {page === "admin" && adminRole === "director" && <DirectorPanel products={products} setProducts={setProducts} coupons={coupons} setCoupons={setCoupons} showToast={showToast} navigate={navigate} />}
    </div>
  );
}
