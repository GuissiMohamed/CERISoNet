// ===== Import des modules nécessaires =====
const fs = require("fs");           // Gestion des fichiers (certificats HTTPS)
const path = require("path");       // Gestion des chemins de fichiers
const https = require("https");     // Création du serveur HTTPS
const express = require("express"); // Framework serveur NodeJS

// ===== Initialisation de l'application Express =====
const app = express();

// ===== Port attribué pour l'application =====
const PORT = 3164;

// ===== Chargement des certificats SSL =====
// HTTPS est obligatoire pour ce projet
const keyPath = path.join(__dirname, "certs", "key.pem");
const certPath = path.join(__dirname, "certs", "cert.pem");

// Vérification de la présence des fichiers SSL
if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
  console.error("Certificats SSL manquants.");
  process.exit(1);
}

// Options HTTPS
const httpsOptions = {
  key: fs.readFileSync(keyPath),
  cert: fs.readFileSync(certPath),
};

// ===== Route principale =====
// Renvoie la page HTML contenant le formulaire de connexion
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.htm"));
});

// ===== Route /login =====
// Récupère les données envoyées par le formulaire (méthode GET)
// et les affiche dans la console du serveur
app.get("/login", (req, res) => {
  console.log("===== Tentative de connexion =====");
  console.log("Email :", req.query.mail);
  console.log("Mot de passe :", req.query.password);
  console.log("=================================");

  // Réponse simple pour confirmer la réception
  res.send("Paramètres reçus par le serveur (voir console).");
});

// ===== Lancement du serveur HTTPS =====
https.createServer(httpsOptions, app).listen(PORT, () => {
  console.log(
    `Serveur CERISoNet lancé en HTTPS sur https://pedago.univ-avignon.fr:${PORT}/`
  );
});
