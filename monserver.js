// ======================================================
// Étape 4 - Temps réel avec WebSocket (Socket.io)
// Cette partie permet :
// - la communication temps réel client ↔ serveur
// - la gestion des likes sans rechargement de page
// - le partage de posts en direct
// - le suivi des utilisateurs connectés
// ======================================================
const { MongoClient, ObjectId } = require("mongodb");
const fs = require("fs");
const path = require("path");
const https = require("https");
const express = require("express");
const crypto = require("crypto");
const { Server } = require("socket.io");

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
// MongoDB
// ======================================================

const MONGO_URL = "mongodb://localhost:27017";
const DB_NAME = "db-CERI";

let postsCollection;

async function initMongo() {
  const client = new MongoClient(MONGO_URL);
  await client.connect();

  const db = client.db(DB_NAME);
  postsCollection = db.collection("CERISoNet");

  console.log("✅ MongoDB connecté (posts)");
}

initMongo().catch((err) => {
  console.error("❌ Erreur init Mongo :", err);
  process.exit(1);
});

// ======================================================
// Express
// ======================================================

const app = express();
app.use(express.json());

// ======================================================
// Session store MongoDB
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
// Initialisation du serveur WebSocket avec Socket.io
// Le serveur HTTPS est réutilisé pour permettre
// une communication sécurisée (wss)
// IMPORTANT : on garde la même session pour Express ET Socket.io
const sessionMiddleware = session({
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
});

app.use(sessionMiddleware);

// ======================================================
// Helpers
// ======================================================

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ ok: false, message: "Non authentifié." });
  }
  next();
}

function extractHashtags(text) {
  if (!text) return [];
  const matches = text.match(/#[\p{L}\p{N}_-]+/gu) || [];
  return [...new Set(matches.map((h) => h.trim()))];
}

function formatDateFR(d = new Date()) {
  return d.toLocaleDateString("fr-FR");
}

function formatHourFR(d = new Date()) {
  return d.toLocaleTimeString("fr-FR");
}

async function getUserById(id) {
  const result = await pgPool.query(
    "SELECT id, pseudo, mail, avatar, nom, prenom, statut_connexion FROM fredouil.compte WHERE id = $1 LIMIT 1",
    [id]
  );
  return result.rows[0] || null;
}

async function enrichComment(comment) {
  const user = await getUserById(comment.commentedBy);
  return {
    ...comment,
    pseudo: user?.pseudo || "Inconnu",
  };
}

async function enrichPost(post) {
  const owner = await getUserById(post.createdBy);

  const enriched = {
    ...post,
    pseudo: owner?.pseudo || "Inconnu",
    avatar: owner?.avatar || null,
  };

  if (!Array.isArray(enriched.hashtags)) {
    enriched.hashtags = [];
  }

  if (!Array.isArray(enriched.comments)) {
    enriched.comments = [];
  }

  enriched.comments = await Promise.all(
    enriched.comments.map((c) => enrichComment(c))
  );

  if (enriched.shared && ObjectId.isValid(enriched.shared)) {
    const original = await postsCollection.findOne({
      _id: new ObjectId(enriched.shared),
    });

    if (original) {
      const originalOwner = await getUserById(original.createdBy);
      enriched.sharedPost = {
        ...original,
        pseudo: originalOwner?.pseudo || "Inconnu",
      };
    } else {
      enriched.sharedPost = null;
    }
  } else {
    enriched.sharedPost = null;
  }

  return enriched;
}

async function getPostsForUser(userId, options = {}) {
  const {
    sort = "newest",
    owner = "all",
    hashtag = "",
    limit = 10,
    skip = 0,
  } = options;

  const query = {};

  if (owner === "me") {
    query.createdBy = userId;
  } else if (owner === "others") {
    query.createdBy = { $ne: userId };
  }

  if (hashtag && hashtag.trim() !== "") {
    const cleanHashtag = hashtag.trim().startsWith("#")
      ? hashtag.trim()
      : `#${hashtag.trim()}`;

    query.hashtags = cleanHashtag;
  }

  let sortObj = { _id: -1 };

  if (sort === "oldest") {
    sortObj = { _id: 1 };
  } else if (sort === "likes") {
    sortObj = { likes: -1, _id: -1 };
  }

  const posts = await postsCollection
    .find(query)
    .sort(sortObj)
    .skip(skip)
    .limit(limit)
    .toArray();

  return Promise.all(posts.map((p) => enrichPost(p)));
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
        message: "Champs manquants.",
      });
    }

    const sql =
      "SELECT id, mail, pseudo, motpasse FROM fredouil.compte WHERE mail = $1 LIMIT 1";

    const result = await pgPool.query(sql, [mail]);

    if (result.rows.length === 0) {
      return res.status(401).json({
        ok: false,
        message: "Identifiants invalides.",
      });
    }

    const user = result.rows[0];
    const sha1 = crypto.createHash("sha1").update(password).digest("hex");

    if (user.motpasse !== sha1) {
      return res.status(401).json({
        ok: false,
        message: "Identifiants invalides.",
      });
    }

    await pgPool.query(
      "UPDATE fredouil.compte SET statut_connexion = 1 WHERE id = $1",
      [user.id]
    );

    req.session.user = {
      id: user.id,
      mail: user.mail,
      pseudo: user.pseudo,
    };

    return res.json({
      ok: true,
      user: req.session.user,
    });
  } catch (err) {
    console.error("Erreur /api/login :", err);
    return res.status(500).json({
      ok: false,
      message: "Erreur serveur.",
    });
  }
});

// ======================================================
// API ME
// ======================================================

app.get("/api/me", requireAuth, (req, res) => {
  return res.json({
    ok: true,
    user: req.session.user,
  });
});

// ======================================================
// API POSTS
// ======================================================

app.get("/api/posts", requireAuth, async (req, res) => {
  try {
    const sort = req.query.sort || "newest";
    const owner = req.query.owner || "all";
    const hashtag = req.query.hashtag || "";
    const limit = Math.min(parseInt(req.query.limit || "10", 10), 100);
    const skip = Math.max(parseInt(req.query.skip || "0", 10), 0);

    const posts = await getPostsForUser(req.session.user.id, {
      sort,
      owner,
      hashtag,
      limit,
      skip,
    });

    res.json({ ok: true, posts });
  } catch (err) {
    console.error("Erreur GET /api/posts :", err);
    res.status(500).json({ ok: false, message: "Erreur chargement posts" });
  }
});

app.post("/api/posts", requireAuth, async (req, res) => {
  try {
    const { body } = req.body || {};

    if (!body || body.trim() === "") {
      return res.status(400).json({ ok: false, message: "Message vide" });
    }

    const now = new Date();

    const newPost = {
      date: formatDateFR(now),
      hour: formatHourFR(now),
      body: body.trim(),
      createdBy: req.session.user.id,
      image: null,
      likes: 0,
      likedBy: [],
      hashtags: extractHashtags(body),
      comments: [],
      shared: null,
    };

    await postsCollection.insertOne(newPost);

    res.json({ ok: true, message: "Post publié" });
  } catch (err) {
    console.error("Erreur POST /api/posts :", err);
    res.status(500).json({ ok: false, message: "Erreur publication" });
  }
});

app.post("/api/posts/:id/comments", requireAuth, async (req, res) => {
  try {
    const postId = req.params.id;
    const { text } = req.body || {};

    if (!postId || !ObjectId.isValid(postId)) {
      return res.status(400).json({ ok: false, message: "postId invalide" });
    }

    if (!text || text.trim() === "") {
      return res.status(400).json({ ok: false, message: "Commentaire vide" });
    }

    const now = new Date();

    const comment = {
      text: text.trim(),
      commentedBy: req.session.user.id,
      date: formatDateFR(now),
      hour: formatHourFR(now),
    };

    const result = await postsCollection.updateOne(
      { _id: new ObjectId(postId) },
      { $push: { comments: comment } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ ok: false, message: "Post introuvable" });
    }

    res.json({ ok: true, message: "Commentaire posté" });
  } catch (err) {
    console.error("Erreur POST /api/posts/:id/comments :", err);
    res.status(500).json({ ok: false, message: "Erreur commentaire" });
  }
});

// ======================================================
// API LOGOUT
// ======================================================

app.post("/api/logout", async (req, res) => {
  try {
    if (req.session.user) {
      await pgPool.query(
        "UPDATE fredouil.compte SET statut_connexion = 0 WHERE id = $1",
        [req.session.user.id]
      );
    }

    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ ok: false, message: "Erreur logout" });
      }

      res.clearCookie("cerisonet.sid");
      return res.json({ ok: true });
    });
  } catch (err) {
    console.error("Erreur /api/logout :", err);
    return res.status(500).json({ ok: false, message: "Erreur logout" });
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

app.get(/^\/(?!api|etape1|socket\.io).*/, (req, res) => {
  res.sendFile(path.join(angularDistPath, "index.html"));
});

// ======================================================
// HTTPS + Socket.io
// ======================================================

const server = https.createServer(httpsOptions, app);

const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true,
  },
});

io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

// Gestion des internautes connectés
// Map userId -> { userId, pseudo, socketsCount }
const onlineUsers = new Map();

function getOnlineUsersList() {
  return Array.from(onlineUsers.values())
    .map((u) => ({
      userId: u.userId,
      pseudo: u.pseudo,
      socketsCount: u.socketsCount,
    }))
    .sort((a, b) => a.pseudo.localeCompare(b.pseudo));
}

function emitOnlineUsers() {
  io.emit("online-users", getOnlineUsersList());
}

function addOnlineUser(user) {
  const existing = onlineUsers.get(user.id);

  if (existing) {
    existing.socketsCount += 1;
  } else {
    onlineUsers.set(user.id, {
      userId: user.id,
      pseudo: user.pseudo,
      socketsCount: 1,
    });

    io.emit("notification", {
      type: "info",
      message: `${user.pseudo} vient de se connecter`,
    });
  }

  emitOnlineUsers();
}

function removeOnlineUser(user) {
  const existing = onlineUsers.get(user.id);
  if (!existing) return;

  existing.socketsCount -= 1;

  if (existing.socketsCount <= 0) {
    onlineUsers.delete(user.id);

    io.emit("notification", {
      type: "info",
      message: `${user.pseudo} vient de se déconnecter`,
    });
  }

  emitOnlineUsers();
}

io.on("connection", (socket) => {
  console.log("🔌 Client WebSocket connecté :", socket.id);

  const session = socket.request.session;

  if (!session || !session.user) {
    console.log("⛔ Socket non authentifiée :", socket.id);
    socket.emit("ws-error", { message: "Non authentifié." });
    socket.disconnect();
    return;
  }

  const user = session.user;
  socket.data.user = user;

  console.log("✅ Socket authentifiée :", user.pseudo);

  addOnlineUser(user);

  socket.emit("notification", {
    type: "success",
    message: `WebSocket connectée pour ${user.pseudo}`,
  });

  // ----------------------------------------------------
  // LIKE temps réel
  // Un seul like par utilisateur
  // ----------------------------------------------------
  socket.on("like-post", async (data) => {
    try {
      const postId = data?.postId;

      console.log("LIKE reçu :", data);

      if (!postId || !ObjectId.isValid(postId)) {
        socket.emit("ws-error", { message: "postId invalide." });
        return;
      }

      const result = await postsCollection.updateOne(
        {
          _id: new ObjectId(postId),
          likedBy: { $ne: user.id },
        },
        {
          $addToSet: { likedBy: user.id },
          $inc: { likes: 1 },
        }
      );

      if (result.matchedCount === 0) {
        const alreadyLiked = await postsCollection.findOne({
          _id: new ObjectId(postId),
        });

        if (!alreadyLiked) {
          socket.emit("ws-error", { message: "Post introuvable." });
        } else {
          socket.emit("notification", {
            type: "info",
            message: "Tu as déjà liké ce post",
          });
        }
        return;
      }

      const updatedPost = await postsCollection.findOne({
        _id: new ObjectId(postId),
      });

      console.log("LIKE diffusé :", {
        postId,
        likes: updatedPost.likes,
      });

      io.emit("post-liked", {
        postId,
        likes: updatedPost.likes,
        likedBy: {
          id: user.id,
          pseudo: user.pseudo,
        },
      });

      socket.emit("notification", {
        type: "success",
        message: "Like ajouté",
      });
    } catch (err) {
      console.error("Erreur WebSocket like-post :", err);
      socket.emit("ws-error", { message: "Erreur serveur WebSocket." });
    }
  });

  // ----------------------------------------------------
  // PARTAGE temps réel
  // ----------------------------------------------------
  socket.on("share-post", async (data) => {
    try {
      const postId = data?.postId;
      const body = (data?.body || "").trim();

      if (!postId || !ObjectId.isValid(postId)) {
        socket.emit("ws-error", { message: "postId invalide." });
        return;
      }

      const originalPost = await postsCollection.findOne({
        _id: new ObjectId(postId),
      });

      if (!originalPost) {
        socket.emit("ws-error", { message: "Post introuvable." });
        return;
      }

      const now = new Date();

      const sharedPost = {
        date: formatDateFR(now),
        hour: formatHourFR(now),
        body: body || "Je partage ce post.",
        createdBy: user.id,
        image: null,
        likes: 0,
        likedBy: [],
        hashtags: extractHashtags(body),
        comments: [],
        shared: new ObjectId(postId),
      };

      const insertResult = await postsCollection.insertOne(sharedPost);
      const createdPost = await postsCollection.findOne({
        _id: insertResult.insertedId,
      });

      const enriched = await enrichPost(createdPost);

      io.emit("post-shared", {
        post: enriched,
        sharedBy: {
          id: user.id,
          pseudo: user.pseudo,
        },
      });

      io.emit("notification", {
        type: "info",
        message: `${user.pseudo} a partagé un post`,
      });

      socket.emit("notification", {
        type: "success",
        message: "Partage réussi",
      });
    } catch (err) {
      console.error("Erreur WebSocket share-post :", err);
      socket.emit("ws-error", { message: "Erreur partage WebSocket." });
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ Client WebSocket déconnecté :", socket.id);

    if (socket.data?.user) {
      removeOnlineUser(socket.data.user);
    }
  });
});

// ======================================================
// Start server
// ======================================================

server.listen(PORT, () => {
  console.log(`✅ Serveur CERISoNet HTTPS : https://pedago.univ-avignon.fr:${PORT}/`);
});