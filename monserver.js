// CERISoNet - Serveur NodeJS (Étape 1 + Étape 2.2 + Étape 2.3 + Angular build)
// - HTTPS sur le port 3164
// - Étape 1 accessible sur /etape1 et /etape1/login
// - API : /api/login, /api/me, /api/logout
// - Angular (build) servi sur / (SPA)

const fs = require("fs");
const path = require("path");
const https = require("https");
const express = require("express");
const crypto = require("crypto");

const session = require("express-session");
const ConnectMongo = require("connect-mongo");
const MongoStoreLib = ConnectMongo.default ? ConnectMongo.default : ConnectMongo;

const { Pool } = require("pg");

const PORT = 3164;

// ===== HTTPS certificates =====
const keyPath = path.join(__dirname, "certs", "key.pem");
const certPath = path.join(__dirname, "certs", "cert.pem");

if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
  console.error("❌ Certificats SSL manquants (certs/key.pem et certs/cert.pem).");
  process.exit(1);
}

const httpsOptions = {
  key: fs.readFileSync(keyPath),
  cert: fs.readFileSync(certPath),
};

// ===== PostgreSQL =====
const pgPool = new Pool({
  host: "localhost",
  port: 5432,
  database: "etd",
  user: "uapv2600477",
  // mdp via ~/.pgpass
});

// ===== MongoDB sessions =====
const MONGO_URL = "mongodb://localhost:27017/cerisonet_sessions";

// ===== Init Express =====
const app = express();
app.use(express.json());

// ===== Sessions (avant routes) =====
let mongoStore;
try {
  if (MongoStoreLib && typeof MongoStoreLib.create === "function") {
    mongoStore = MongoStoreLib.create({
      mongoUrl: MONGO_URL,
      collectionName: "sessions",
    });
  } else if (typeof MongoStoreLib === "function") {
    const MongoStore = MongoStoreLib(session);
    mongoStore = new MongoStore({
      url: MONGO_URL,
      collection: "sessions",
    });
  } else {
    throw new Error("Version de connect-mongo non reconnue");
  }
} catch (e) {
  console.error("❌ Erreur init connect-mongo :", e);
  process.exit(1);
}

app.use(
  session({
    name: "cerisonet.sid",
    secret: "cerisonet_secret_change_me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true, // HTTPS obligatoire
      sameSite: "lax",
    },
    store: mongoStore,
  })
);

// =======================================================
// ✅ ROUTES NON-ANGULAR (API + étape1) AVANT LE FALLBACK SPA
// =======================================================

// ===== Étape 1 (conservée) =====
app.get("/etape1", (req, res) => {
  res.sendFile(path.join(__dirname, "index.htm"));
});

app.get("/etape1/login", (req, res) => {
  console.log("===== /etape1/login (GET) =====");
  console.log("mail     :", req.query.mail);
  console.log("password :", req.query.password);
  console.log("===============================");
  res.send("OK (Etape 1) — paramètres reçus côté serveur. Regarde la console.");
});

// ===== API Login (PostgreSQL + SHA1) =====
app.post("/api/login", async (req, res) => {
  try {
    const { mail, password } = req.body || {};
    if (!mail || !password) {
      return res.status(400).json({ ok: false, message: "Champs manquants." });
    }

    const sql =
      "SELECT id, mail, pseudo, motpasse FROM fredouil.compte WHERE mail = $1 LIMIT 1";
    const result = await pgPool.query(sql, [mail]);

    if (result.rows.length === 0) {
      return res.status(401).json({ ok: false, message: "Identifiants invalides." });
    }

    const user = result.rows[0];
    const sha1 = crypto.createHash("sha1").update(password).digest("hex");

    if (user.motpasse !== sha1) {
      return res.status(401).json({ ok: false, message: "Identifiants invalides." });
    }

    req.session.user = { id: user.id, mail: user.mail, pseudo: user.pseudo };
    return res.json({ ok: true, user: req.session.user });
  } catch (err) {
    console.error("Erreur /api/login :", err);
    return res.status(500).json({ ok: false, message: "Erreur serveur." });
  }
});

// ===== API session =====
app.get("/api/me", (req, res) => {
  if (!req.session.user) return res.status(401).json({ ok: false });
  return res.json({ ok: true, user: req.session.user });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ ok: false });
    res.clearCookie("cerisonet.sid");
    return res.json({ ok: true });
  });
});

// =======================================================
// ✅ ANGULAR BUILD (STATIC + FALLBACK SPA) À LA FIN
// =======================================================

const angularDistPath = path.join(
  __dirname,
  "client",
  "cerisonet",
  "dist",
  "cerisonet",
  "browser"
);

// Servir les fichiers statiques Angular (JS/CSS/favicon)
app.use(express.static(angularDistPath));

// Fallback SPA : tout ce qui n'est PAS /api et PAS /etape1 renvoie index.html
app.get(/^\/(?!api|etape1).*/, (req, res) => {
  res.sendFile(path.join(angularDistPath, "index.html"));
});

// ===== Lancer HTTPS =====
https.createServer(httpsOptions, app).listen(PORT, () => {
  console.log(`✅ Serveur CERISoNet HTTPS : https://pedago.univ-avignon.fr:${PORT}/`);
});
function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ ok: false });
  next();
}
