// ======================================================
// CERISoNet - Serveur NodeJS
// Étape 1 + Étape 2 validées proprement
// ======================================================

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

// ======================================================
// HTTPS
// ======================================================

const keyPath = path.join(__dirname, "certs", "key.pem");
const certPath = path.join(__dirname, "certs", "cert.pem");

if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
  console.error("❌ Certificats SSL manquants.");
  process.exit(1);
}

const httpsOptions = {
  key: fs.readFileSync(keyPath),
  cert: fs.readFileSync(certPath),
};

// ======================================================
// PostgreSQL
// ======================================================

const pgPool = new Pool({
  host: "localhost",
  port: 5432,
  database: "etd",
  user: "uapv2600477",
  // mot de passe via ~/.pgpass
});

// ======================================================
// MongoDB (store sessions)
// ======================================================

const MONGO_URL = "mongodb://localhost:27017/cerisonet_sessions";

// ======================================================
// Express
// ======================================================

const app = express();
app.use(express.json());

// ======================================================
// Session Middleware
// ======================================================

let mongoStore;

try {
  if (MongoStoreLib && typeof MongoStoreLib.create === "function") {
    mongoStore = MongoStoreLib.create({
      mongoUrl: MONGO_URL,
      collectionName: "sessions",
    });
  } else {
    const MongoStore = MongoStoreLib(session);
    mongoStore = new MongoStore({
      url: MONGO_URL,
      collection: "sessions",
    });
  }
} catch (e) {
  console.error("❌ Erreur connect-mongo :", e);
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
      secure: true,
      sameSite: "lax",
    },
    store: mongoStore,
  })
);

// ======================================================
// Middleware Auth
// ======================================================

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ ok: false, message: "Non authentifié." });
  }
  next();
}

// ======================================================
// Étape 1
// ======================================================

app.get("/etape1", (req, res) => {
  res.sendFile(path.join(__dirname, "index.htm"));
});

app.get("/etape1/login", (req, res) => {
  console.log("===== /etape1/login (GET) =====");
  console.log("mail     :", req.query.mail);
  console.log("password :", req.query.password);
  console.log("===============================");
  res.send("OK (Etape 1) — paramètres reçus côté serveur.");
});

// ======================================================
// API LOGIN
// ======================================================

app.post("/api/login", async (req, res) => {
  try {
    const { mail, password } = req.body || {};

    if (!mail || !password) {
      return res.status(400).json({
        ok: false,
        message: "Champs manquants."
      });
    }

    const sql =
      "SELECT id, mail, pseudo, motpasse FROM fredouil.compte WHERE mail = $1 LIMIT 1";

    const result = await pgPool.query(sql, [mail]);

    if (result.rows.length === 0) {
      return res.status(401).json({
        ok: false,
        message: "Identifiants invalides."
      });
    }

    const user = result.rows[0];
    const sha1 = crypto.createHash("sha1")
      .update(password)
      .digest("hex");

    if (user.motpasse !== sha1) {
      return res.status(401).json({
        ok: false,
        message: "Identifiants invalides."
      });
    }

    // ✅ Mise à jour statut_connexion = 1
    await pgPool.query(
      "UPDATE fredouil.compte SET statut_connexion = 1 WHERE id = $1",
      [user.id]
    );

    req.session.user = {
      id: user.id,
      mail: user.mail,
      pseudo: user.pseudo
    };

    return res.json({
      ok: true,
      user: req.session.user
    });

  } catch (err) {
    console.error("Erreur /api/login :", err);
    return res.status(500).json({
      ok: false,
      message: "Erreur serveur."
    });
  }
});

// ======================================================
// API ME
// ======================================================

app.get("/api/me", requireAuth, (req, res) => {
  return res.json({
    ok: true,
    user: req.session.user
  });
});

// ======================================================
// API LOGOUT
// ======================================================

app.post("/api/logout", async (req, res) => {
  try {

    if (req.session.user) {
      // ✅ Mise à jour statut_connexion = 0
      await pgPool.query(
        "UPDATE fredouil.compte SET statut_connexion = 0 WHERE id = $1",
        [req.session.user.id]
      );
    }

    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ ok: false });
      }

      res.clearCookie("cerisonet.sid");

      return res.json({ ok: true });
    });

  } catch (err) {
    console.error("Erreur logout :", err);
    return res.status(500).json({ ok: false });
  }
});

// ======================================================
// Angular Build
// ======================================================

const angularDistPath = path.join(
  __dirname,
  "client",
  "cerisonet",
  "dist",
  "cerisonet",
  "browser"
);

app.use(express.static(angularDistPath));

app.get(/^\/(?!api|etape1).*/, (req, res) => {
  res.sendFile(path.join(angularDistPath, "index.html"));
});

// ======================================================
// Lancer serveur HTTPS
// ======================================================

https.createServer(httpsOptions, app).listen(PORT, () => {
  console.log(`✅ Serveur CERISoNet HTTPS : https://pedago.univ-avignon.fr:${PORT}/`);
});