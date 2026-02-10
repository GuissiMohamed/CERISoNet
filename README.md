# CERISoNet — Application Web Sécurisée

Projet réalisé dans le cadre du module **AMS**  
Université d’Avignon

---

## 🎯 Objectif du projet
Développer une application web sécurisée permettant l’authentification d’utilisateurs, en utilisant :

- NodeJS / Express
- HTTPS
- PostgreSQL
- Sessions serveur (MongoDB)
- Angular (SPA)

---

## 🏗️ Architecture générale

- **Serveur NodeJS** (HTTPS) — port **3164**
- **Client Angular** (SPA) buildé et servi par NodeJS
- **Base de données PostgreSQL**
- **Sessions stockées dans MongoDB**

👉 Une seule URL finale :

https://pedago.univ-avignon.fr:3164/


---

## 🔐 Sécurité
- Connexion **HTTPS**
- Mots de passe stockés en **SHA-1** dans la base de données
- Sessions sécurisées avec cookies (`secure`, `httpOnly`)
- Données sensibles non exposées côté client

---

## 🐘 Base de données

- **SGBD** : PostgreSQL
- **Base** : `etd`
- **Schéma** : `fredouil`
- **Table** : `compte`

Champs principaux :
- `id`
- `mail`
- `pseudo`
- `motpasse` (hash SHA-1)

---

## 🚀 Fonctionnalités

### Étape 1 — Serveur NodeJS HTTPS
- Serveur HTTPS fonctionnel
- Page HTML simple avec formulaire
- Réception et affichage des paramètres côté serveur

Routes :
- `/etape1`
- `/etape1/login`

---

### Étape 2 — Authentification & Sessions
- Connexion à PostgreSQL via NodeJS
- Route `POST /api/login`
- Vérification du mot de passe (SHA-1)
- Création de session utilisateur
- Routes :
  - `GET /api/me`
  - `POST /api/logout`

---

### Client Angular (SPA)
- Formulaire de connexion
- Mur utilisateur après login
- Bandeau de notifications
- Stockage de la dernière connexion via `localStorage`
- Protection des pages via session serveur

---

## 🧪 Tests

### Test login (curl)
```bash
curl -k -c cookies.txt -X POST https://pedago.univ-avignon.fr:3164/api/login \
 -H "Content-Type: application/json" \
 -d '{"mail":"chat@gmail.com","password":"test"}'

curl -k -b cookies.txt https://pedago.univ-avignon.fr:3164/api/me

⚙️ Lancement du projet
Backend
node monserver.js

Angular (développement uniquement)
npx ng serve

Angular (production)
npx ng build


Angular est ensuite servi automatiquement par NodeJS.