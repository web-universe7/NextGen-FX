# Gaurav Career Academy — Video Course Website

A working website with:
- Real user **registration & login** (passwords hashed with bcrypt, sessions via secure cookie/JWT)
- A **dashboard** listing recorded course videos
- A **paywall**: videos stay locked until the user pays
- **Razorpay** checkout for your ₹499 course (you plug in your own keys)
- The original custom video player (play/pause, seek, speed, fullscreen, skip 10s) now protected — only paid users can stream the actual video file

---

## 1. Run it locally first (recommended)

You need [Node.js](https://nodejs.org) 18+ installed.

```bash
cd gaurav-career-academy
npm install
cp .env.example .env
```

Open `.env` and fill in:
- `JWT_SECRET` — any long random string (this signs login sessions)
- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` — from your Razorpay dashboard (use **Test Mode** keys first)

Then start it:

```bash
npm start
```

Visit `http://localhost:3000`. Register an account, and you'll see the dashboard with the course locked behind ₹499.

---

## 2. Add your recorded videos

1. Put your `.mp4` files inside the `/videos` folder (e.g. `videos/algebra-shortcuts.mp4`).
2. Put a thumbnail/poster image inside `/videos/posters` (e.g. `videos/posters/algebra-shortcuts.jpg`).
3. Open `data/videos.json` and list each video:

```json
[
  {
    "id": "algebra-shortcuts",
    "title": "SSC CGL 2026: Complete Algebra Shortcuts Class",
    "description": "Learn important algebra shortcuts...",
    "filename": "algebra-shortcuts.mp4",
    "poster": "/posters/algebra-shortcuts.jpg"
  },
  {
    "id": "geometry-class-2",
    "title": "Geometry Class 2",
    "description": "...",
    "filename": "geometry-class-2.mp4",
    "poster": "/posters/geometry-class-2.jpg"
  }
]
```

Add as many entries as you want — the dashboard and paywall update automatically. Videos are never served directly as static files; they only stream through `/media/:filename`, which checks that the visitor is logged in **and** has paid before sending any video data.

> **Large videos:** for a real course, uploading big `.mp4` files directly to a small web host isn't ideal (slow uploads, storage limits, high bandwidth cost). Once this is live and working, consider moving video hosting to a service built for video — Bunny.net Stream, Cloudflare Stream, AWS S3 + CloudFront, or even unlisted YouTube — and just pointing `filename`/the media route at that instead. The registration/login/paywall logic in this project doesn't need to change either way.

---

## 3. Set up Razorpay

1. Create an account at [razorpay.com](https://razorpay.com) and complete KYC (required before you can accept live payments).
2. In the Razorpay Dashboard, go to **Settings → API Keys** and generate a key pair.
   - Use the **Test Mode** keys first to confirm everything works end-to-end (Razorpay gives test card numbers for this).
   - Switch to **Live Mode** keys only once you're ready to accept real payments.
3. You'll get a `Key Id` (starts with `rzp_test_` or `rzp_live_`) and a `Key Secret`. You'll add both as environment variables (never put them in your code or commit them to git).

The course price is set to **₹499** in `server.js`:
```js
const COURSE_PRICE_PAISE = 49900; // ₹499.00
```
Change this single number if you ever want a different price (amount is in paise, so ₹499 = 49900).

**How the payment flow works:**
1. Logged-in user clicks "Pay ₹499 & Unlock" on the dashboard.
2. The server creates a Razorpay order (`/api/payment/create-order`).
3. The Razorpay Checkout popup opens for the user to pay by card/UPI/netbanking.
4. After payment, Razorpay sends back a signed response, which the server verifies (`/api/payment/verify`) using your Key Secret — this is what actually unlocks the account. This step happens on the server, so it can't be faked by editing the browser.

---

## 4. Deploy to Render

1. Push this project to a GitHub repository (or use Render's manual deploy / "Upload" option).
2. On [Render](https://dashboard.render.com), click **New → Web Service** and connect your repo.
3. Configure:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment:** Node
4. Under **Environment → Environment Variables**, add:
   - `JWT_SECRET` = a long random string
   - `RAZORPAY_KEY_ID` = your Razorpay key id
   - `RAZORPAY_KEY_SECRET` = your Razorpay key secret
   - `NODE_ENV` = `production`
   
   (Do **not** upload your `.env` file — Render's environment variables panel is the correct place for secrets.)
5. Deploy. Render will give you a live URL like `https://gaurav-career-academy.onrender.com`.

### Important: persistent storage on Render

This project stores registered users in `data/db.json` and expects course videos in `/videos`. Render's free/standard web services use an **ephemeral filesystem** — anything written after deploy (like new user registrations) can be lost when the service restarts or redeploys.

For a real, reliable production setup, do one of these:
- Add a **Render Disk** (Render Dashboard → your service → Disks) mounted at, e.g., `/opt/render/project/data`, and point `DB_FILE`/`videos` there so data survives restarts. This is the quickest fix.
- Or migrate user storage to a proper database (Render offers managed **PostgreSQL** — a natural next step once you have real users). Ask me and I can wire that in.

Videos should ideally live outside the web server entirely (see the note in step 2) once you're serving real students.

---

## 5. Project structure

```
server.js              Express server — auth, video streaming, Razorpay
package.json
.env.example            Copy to .env for local dev
data/
  db.json               User accounts (auto-created)
  videos.json            List of your course videos
videos/
  *.mp4                  Your recorded video files (add these)
  posters/*.jpg          Thumbnails
public/
  index.html             Landing/sales page
  register.html          Sign up
  login.html              Log in
  dashboard.html          Video list + "Pay ₹499" button
  watch.html               Protected video player page
  css/style.css
  js/auth.js               Shared login/session helpers
  js/player.js              Video player controls
```

---

## 6. Security notes

- Passwords are hashed with bcrypt — never stored in plain text.
- Sessions use an httpOnly cookie holding a signed JWT, so it can't be read or forged from JavaScript in the browser.
- Payment verification happens **server-side** using Razorpay's signature check — a user cannot unlock the course just by calling the "success" page directly.
- Always set a strong, unique `JWT_SECRET` in production — never use the default.
- Render provides HTTPS automatically on your `*.onrender.com` domain, which Razorpay requires for live payments.
