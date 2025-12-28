const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

const ADMIN_PASSWORD = "my_secret_admin_password"; 

// Подключение к Neon (Postgres)
// DATABASE_URL берется из переменных окружения Render
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(cors());
app.use(express.json());

// 1. GET /list
app.get('/list', async (req, res) => {
  const roomId = req.query.room_id;
  const lastId = req.query.last_id || 0;
  
  if (!roomId) return res.status(400).send("room_id required");

  try {
    const { rows } = await pool.query(
      "SELECT id, event_id, room_id, actor_id, nonce, data FROM events WHERE room_id = $1 AND id > $2 ORDER BY id ASC LIMIT 100", 
      [roomId, lastId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

// 2. POST /push
app.post('/push', async (req, res) => {
  const d = req.body;
  try {
    // INSERT ... ON CONFLICT DO NOTHING - это аналог INSERT OR IGNORE для Postgres
    await pool.query(
      "INSERT INTO events (event_id, room_id, actor_id, nonce, data) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (event_id) DO NOTHING",
      [d.event_id, d.room_id, d.actor_id, d.nonce, d.data]
    );
    res.json({ status: "ok" });
  } catch (err) {
    console.error(err);
    res.status(400).send(err.message);
  }
});

// 3. POST /manage
app.post('/manage', async (req, res) => {
  const d = req.body;
  if (d.password !== ADMIN_PASSWORD) return res.status(401).send("Unauthorized");

  try {
    if (d.command === "wipe_all") {
      await pool.query("DELETE FROM events");
      res.json({ status: "all_cleared" });
    } else if (d.command === "wipe_room") {
      await pool.query("DELETE FROM events WHERE room_id = $1", [d.room_id]);
      res.json({ status: "room_cleared" });
    } else {
      res.status(400).send("Unknown command");
    }
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
