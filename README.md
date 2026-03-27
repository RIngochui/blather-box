# BlatherBox

A Blather Round-style party game where players submit their own topics. Built with Node.js, Socket.io, and SQLite — no external database needed.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Create your environment file
cp .env.example .env

# 3. Start the server
npm start
```

Open **http://localhost:3000** in your browser. The database is created and seeded automatically on first run.

---

## Running a Game (Step by Step)

### 1. Start the host screen
Open **http://localhost:3000/host** on your TV or laptop. Click **Create Room** — a 4-letter room code will appear in the top bar (e.g. `KZBT`).

### 2. Players join on their phones
Each player opens **http://localhost:3000/join** on their phone, enters the room code and their name, then taps **Join Game**.

> **Same Wi-Fi:** Share your local IP instead of `localhost` — e.g. `http://192.168.1.x:3000/join`. Run `ipconfig getifaddr en0` on Mac to find your IP.
>
> **Different networks:** Use ngrok — see [Playing Across Different Networks](#playing-across-different-networks-ngrok) below.

### 3. Start the game
Once at least 2 players have joined (you'll see their names appear on the host screen), click **Start Game**.

### 4. Each round
- One player is assigned as the **Describer** — their phone shows the secret topic and their clues.
- All other players are **Guessers** — their phones show the category and a guess input.
- The Describer taps **Reveal Next Clue** on their phone to show each clue on the TV screen (clues go from vague → specific).
- Guessers type answers into their phone. First correct guess ends the round.
- If the 60-second timer runs out, the answer is revealed and no points are awarded.

### 5. Between rounds
The scoreboard appears on the TV. The host clicks **Next Round** to continue or **End Game** to see final standings.

---

## Playing Across Different Networks (ngrok)

ngrok creates a public URL that tunnels to your local server — anyone on any network can join.

### One-time setup

```bash
# Install ngrok
brew install ngrok
```

Sign up for a free account at **https://ngrok.com**, copy your authtoken from the dashboard, then run:

```bash
ngrok config add-authtoken <your-token-from-ngrok-dashboard>
```

### Every time you play

Open two terminals:

```bash
# Terminal 1 — start the game server
npm start

# Terminal 2 — open the tunnel
ngrok http 3000
```

ngrok will display a public URL like:

```
Forwarding  https://a1b2-203-0-113-1.ngrok-free.app -> http://localhost:3000
```

**Important:** Open the host screen using the ngrok URL — e.g. `https://a1b2-....ngrok-free.app/host` — not `localhost`. This ensures the join URL shown on the TV screen is the public address that remote players can actually reach.

Players join at `https://a1b2-....ngrok-free.app/join` from any network or device.

---

## Admin Dashboard

The admin dashboard lets you review, approve, and manage all submitted topics.

### Access
Go to **http://localhost:3000/admin** and enter the password:

```
blatheradmin
```

Change this in `.env` (`ADMIN_PASSWORD=yourpassword`) before sharing the app with others.

### What you can do

| Action | How |
|--------|-----|
| Approve a topic | Click ✓ on any pending row |
| Reject a topic | Click ✗ on any pending row |
| Edit a topic | Click **Edit** — inline form opens to change the topic name, category, or any clue |
| Delete a topic | Click **Del** (permanent) |
| Bulk approve/reject | Check multiple rows, then click **Approve All** or **Reject All** |
| Filter by status | Use the **All / Pending / Approved / Rejected** tabs at the top |

Only **approved** topics appear in the game. New submissions from `/submit` start as **pending**.

---

## Submitting Topics

Anyone can submit a topic at **http://localhost:3000/submit** — no login needed.

1. Enter an optional name, the topic word, and select a category.
2. Fill in the clue slots that appear (first 3 are required, last 2 are optional).
3. Clues must go from vague to specific and **must not contain the topic word**.
4. Submitted topics go into the database as **pending** until an admin approves them.

---

## Configuration

Edit `.env` to change defaults:

```env
ADMIN_PASSWORD=blatheradmin   # Password for /admin
PORT=3000                     # Port the server listens on
```

---

## Pages at a Glance

| URL | Who uses it | Description |
|-----|-------------|-------------|
| `/` | Everyone | Home screen with links |
| `/host` | Host (TV/laptop) | Create a room, run the game |
| `/join` | Players (phones) | Enter room code and name |
| `/play` | Players (phones) | Auto-redirect after joining |
| `/submit` | Anyone | Submit new topics |
| `/admin` | Moderator | Review and approve topics |

---

## Categories & Clue Structure

Each category has 5 ordered clue slots. The first 3 are required; the last 2 are optional and skipped if left blank.

| Category | Clue starters |
|----------|--------------|
| **Thing** | type of / found / used to / known for / might see |
| **Person** | role / known for / lived in / associated with / recognize by |
| **Place** | type of / found / known for / go there to / associated with |
| **Food/Drink** | type of / made with / eaten when / tastes / associated with |
| **Activity** | involves / done where / people do it to / requires / associated with |
| **Movie/Show** | genre / about / features / known for / recognize by |

---

## Tech Stack

- **Backend**: Node.js + Express + Socket.io
- **Database**: SQLite via better-sqlite3 (`blatherbox.db`, auto-created on first run, pre-seeded with 10 topics)
- **Frontend**: Vanilla HTML/CSS/JS — no build step, no framework
