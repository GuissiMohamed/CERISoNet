// Test PostgreSQL - CERISoNet (Étape 2.1)

const { Pool } = require("pg");

const pool = new Pool({
  host: "localhost",
  port: 5432,
  database: "etd",
  user: "uapv2600477",
  // Mot de passe géré via ~/.pgpass
});

async function test() {
  try {
    console.log("Connexion à PostgreSQL...");
    const result = await pool.query(
      "SELECT id, mail, pseudo FROM fredouil.compte LIMIT 5"
    );
    console.log("Résultat :", result.rows);
    process.exit(0);
  } catch (err) {
    console.error("Erreur PostgreSQL :", err.message);
    process.exit(1);
  }
}

test();
