const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

const ADMIN_PASSWORD = "my_secret_admin_password"; 

const db = new sqlite3.Database('./events.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT UNIQUE,
    room_id TEXT,
    actor_id TEXT,
    nonce TEXT,
    data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

app.use(cors());
app.use(express.json());

app.get('/list', (req, res) => {
  const roomId = req.query.room_id;
  const lastId = req.query.last_id || 0;
  if (!roomId) return res.status(400).send("room_id required");
  db.all("SELECT id, event_id, room_id, actor_id, nonce, data FROM events WHERE room_id = ? AND id > ? ORDER BY id ASC LIMIT 100", 
  [roomId, lastId], (err, rows) => {
    if (err) return res.status(500).send(err.message);
    res.json(rows);
  });
});

app.post('/push', (req, res) => {
  const d = req.body;
  db.run("INSERT OR IGNORE INTO events (event_id, room_id, actor_id, nonce, data) VALUES (?, ?, ?, ?, ?)",
  [d.event_id, d.room_id, d.actor_id, d.nonce, d.data], function(err) {
    if (err) return res.status(400).send(err.message);
    res.json({ status: "ok" });
  });
});

app.post('/manage', (req, res) => {
  const d = req.body;
  if (d.password !== ADMIN_PASSWORD) return res.status(401).send("Unauthorized");
  if (d.command === "wipe_all") {
    db.run("DELETE FROM events", (err) => res.json({ status: "all_cleared" }));
  } else if (d.command === "wipe_room") {
    db.run("DELETE FROM events WHERE room_id = ?", [d.room_id], (err) => res.json({ status: "room_cleared" }));
  } else {
    res.status(400).send("Unknown command");
  }
});

app.listen(port, () => console.log(`Server running on port ${port}`));