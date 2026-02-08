const fs = require("fs");
const path = require("path");
const https = require("https");
const express = require("express");

const PORT = 3164;
const app = express();

// --------- HTTPS CERT/KEY ---------
// Si tu utilises d'autres chemins (certs fournis par pedago), change ici.
const keyPath = path.join(__dirname, "certs", "key.pem");
const certPath = path.join(__dirname, "certs", "cert.pem");

if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
  console.error("❌ Certificat HTTPS introuvable.");
  console.error("Attendu :", keyPath, "et", certPath);
  console.error("=> Génère un certificat (openssl) ou pointe vers les fichiers fournis par pedago.");
  process.exit(1);
}

const httpsOptions = {
  key: fs.readFileSync(keyPath),
  cert: fs.readFileSync(certPath),
};

// --------- ROUTES ---------
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.htm"));
});

// Etape 1 : formulaire GET -> /login, afficher les paramètres dans la console serveur
app.get("/login", (req, res) => {
  console.log("===== /login (GET) =====");
  console.log("mail     :", req.query.mail);
  console.log("password :", req.query.password);
  console.log("========================");

  res.status(200).send("OK (Etape 1) — paramètres reçus côté serveur. Regarde la console.");
});

// --------- START HTTPS SERVER ---------
https.createServer(httpsOptions, app).listen(PORT, () => {
  console.log(`✅ Serveur CERISoNet (HTTPS) lancé : https://pedago.univ-avignon.fr:${PORT}/`);
});
