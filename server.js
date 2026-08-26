require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Razorpay = require('razorpay');

const app = express();

const PORT = process.env.PORT || 3000;

const JWT_SECRET =
  process.env.JWT_SECRET || 'dev_only_secret_change_me';

const COURSE_PRICE_PAISE = 49900;
const COURSE_PRICE_LABEL = '₹499';

const DB_FILE = path.join(__dirname, 'data', 'db.json');
const VIDEOS_FILE = path.join(__dirname, 'data', 'videos.json');
const VIDEOS_DIR = path.join(__dirname, 'videos');


// ============================================================
// ENVIRONMENT
// ============================================================

console.log('----------------------------------------');
console.log('Gaurav Career Academy');
console.log('----------------------------------------');

console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('Port:', PORT);

if (!process.env.JWT_SECRET) {
  console.warn(
    'WARNING: JWT_SECRET is not set.'
  );
}

if (!process.env.RAZORPAY_KEY_ID) {
  console.warn(
    'WARNING: RAZORPAY_KEY_ID is not set.'
  );
}

if (!process.env.RAZORPAY_KEY_SECRET) {
  console.warn(
    'WARNING: RAZORPAY_KEY_SECRET is not set.'
  );
}


// ============================================================
// DATABASE
// ============================================================

function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    fs.mkdirSync(
      path.dirname(DB_FILE),
      { recursive: true }
    );

    fs.writeFileSync(
      DB_FILE,
      JSON.stringify(
        { users: [] },
        null,
        2
      )
    );
  }

  return JSON.parse(
    fs.readFileSync(
      DB_FILE,
      'utf8'
    )
  );
}


function writeDB(data) {
  fs.writeFileSync(
    DB_FILE,
    JSON.stringify(
      data,
      null,
      2
    )
  );
}


function readVideos() {
  if (!fs.existsSync(VIDEOS_FILE)) {
    return [];
  }

  return JSON.parse(
    fs.readFileSync(
      VIDEOS_FILE,
      'utf8'
    )
  );
}


// ============================================================
// RAZORPAY
// ============================================================

let razorpay = null;

if (
  process.env.RAZORPAY_KEY_ID &&
  process.env.RAZORPAY_KEY_SECRET
) {
  razorpay = new Razorpay({
    key_id:
      process.env.RAZORPAY_KEY_ID,

    key_secret:
      process.env.RAZORPAY_KEY_SECRET
  });

  console.log('Razorpay: CONFIGURED');

  if (
    process.env.RAZORPAY_KEY_ID.startsWith(
      'rzp_test_'
    )
  ) {
    console.log('Razorpay mode: TEST');
  } else {
    console.log('Razorpay mode: LIVE');
  }
} else {
  console.log('Razorpay: NOT CONFIGURED');
}


// ============================================================
// MIDDLEWARE
// ============================================================

app.use(express.json());

app.use(cookieParser());

app.use(
  express.static(
    path.join(
      __dirname,
      'public'
    )
  )
);

app.use(
  '/posters',
  express.static(
    path.join(
      VIDEOS_DIR,
      'posters'
    )
  )
);


// ============================================================
// AUTH
// ============================================================

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email
    },
    JWT_SECRET,
    {
      expiresIn: '30d'
    }
  );
}


function setAuthCookie(res, token) {

  /*
   * For localhost HTTP testing:
   * secure must be false.
   *
   * For production HTTPS:
   * secure becomes true.
   */

  const isProduction =
    process.env.NODE_ENV === 'production';

  res.cookie(
    'token',
    token,
    {
      httpOnly: true,

      sameSite: 'lax',

      secure: isProduction,

      maxAge:
        30 *
        24 *
        60 *
        60 *
        1000
    }
  );
}


function auth(req, res, next) {

  const token =
    req.cookies.token;

  if (!token) {
    return res.status(401).json({
      error:
        'Please log in to continue.'
    });
  }

  try {

    req.user =
      jwt.verify(
        token,
        JWT_SECRET
      );

    next();

  } catch (error) {

    console.error(
      'JWT error:',
      error.message
    );

    return res.status(401).json({
      error:
        'Your session has expired. Please log in again.'
    });
  }
}


function requireSubscription(
  req,
  res,
  next
) {

  const db =
    readDB();

  const user =
    db.users.find(
      u =>
        u.id ===
        req.user.id
    );

  if (!user) {
    return res.status(401).json({
      error:
        'Account not found.'
    });
  }

  if (!user.subscribed) {
    return res.status(402).json({
      error:
        'This course requires an active subscription.'
    });
  }

  next();
}


// ============================================================
// REGISTER
// ============================================================

app.post(
  '/api/register',
  async (req, res) => {

    try {

      const {
        name,
        email,
        password
      } = req.body || {};

      if (
        !name ||
        !email ||
        !password
      ) {
        return res.status(400).json({
          error:
            'Name, email and password are all required.'
        });
      }

      if (
        !/^\S+@\S+\.\S+$/.test(
          email
        )
      ) {
        return res.status(400).json({
          error:
            'Please enter a valid email address.'
        });
      }

      if (
        password.length < 6
      ) {
        return res.status(400).json({
          error:
            'Password must be at least 6 characters.'
        });
      }

      const db =
        readDB();

      const normalizedEmail =
        email
          .trim()
          .toLowerCase();

      if (
        db.users.find(
          u =>
            u.email ===
            normalizedEmail
        )
      ) {
        return res.status(400).json({
          error:
            'An account with this email already exists. Please log in instead.'
        });
      }

      const passwordHash =
        await bcrypt.hash(
          password,
          10
        );

      const user = {
        id:
          crypto.randomUUID(),

        name:
          name.trim(),

        email:
          normalizedEmail,

        password:
          passwordHash,

        subscribed:
          false,

        createdAt:
          new Date().toISOString()
      };

      db.users.push(user);

      writeDB(db);

      setAuthCookie(
        res,
        signToken(user)
      );

      res.json({
        ok: true,

        user: {
          name:
            user.name,

          email:
            user.email,

          subscribed:
            user.subscribed
        }
      });

    } catch (error) {

      console.error(
        'REGISTER ERROR:',
        error
      );

      res.status(500).json({
        error:
          'Something went wrong while creating your account.'
      });
    }
  }
);


// ============================================================
// LOGIN
// ============================================================

app.post(
  '/api/login',
  async (req, res) => {

    try {

      const {
        email,
        password
      } = req.body || {};

      if (
        !email ||
        !password
      ) {
        return res.status(400).json({
          error:
            'Email and password are required.'
        });
      }

      const db =
        readDB();

      const normalizedEmail =
        email
          .trim()
          .toLowerCase();

      const user =
        db.users.find(
          u =>
            u.email ===
            normalizedEmail
        );

      if (!user) {
        return res.status(400).json({
          error:
            'Invalid email or password.'
        });
      }

      const match =
        await bcrypt.compare(
          password,
          user.password
        );

      if (!match) {
        return res.status(400).json({
          error:
            'Invalid email or password.'
        });
      }

      setAuthCookie(
        res,
        signToken(user)
      );

      res.json({
        ok: true,

        user: {
          name:
            user.name,

          email:
            user.email,

          subscribed:
            user.subscribed
        }
      });

    } catch (error) {

      console.error(
        'LOGIN ERROR:',
        error
      );

      res.status(500).json({
        error:
          'Something went wrong while logging you in.'
      });
    }
  }
);


// ============================================================
// LOGOUT
// ============================================================

app.post(
  '/api/logout',
  (req, res) => {

    res.clearCookie(
      'token'
    );

    res.json({
      ok: true
    });
  }
);


// ============================================================
// CURRENT USER
// ============================================================

app.get(
  '/api/me',
  auth,
  (req, res) => {

    const db =
      readDB();

    const user =
      db.users.find(
        u =>
          u.id ===
          req.user.id
      );

    if (!user) {
      return res.status(401).json({
        error:
          'Account not found.'
      });
    }

    res.json({
      name:
        user.name,

      email:
        user.email,

      subscribed:
        !!user.subscribed
    });
  }
);


// ============================================================
// VIDEOS
// ============================================================

app.get(
  '/api/videos',
  auth,
  (req, res) => {

    const db =
      readDB();

    const user =
      db.users.find(
        u =>
          u.id ===
          req.user.id
      );

    if (!user) {
      return res.status(401).json({
        error:
          'Account not found.'
      });
    }

    const videos =
      readVideos();

    res.json(
      videos.map(
        v => ({
          id:
            v.id,

          title:
            v.title,

          description:
            v.description,

          poster:
            v.poster,

          locked:
            !user.subscribed
        })
      )
    );
  }
);


// ============================================================
// SINGLE VIDEO
// ============================================================

app.get(
  '/api/videos/:id',
  auth,
  requireSubscription,
  (req, res) => {

    const video =
      readVideos().find(
        v =>
          v.id ===
          req.params.id
      );

    if (!video) {
      return res.status(404).json({
        error:
          'Video not found.'
      });
    }

    res.json(video);
  }
);


// ============================================================
// VIDEO STREAM
// ============================================================

app.get(
  '/media/:filename',
  auth,
  requireSubscription,
  (req, res) => {

    const video =
      readVideos().find(
        v =>
          v.filename ===
          req.params.filename
      );

    if (!video) {
      return res
        .status(404)
        .send(
          'Video not found.'
        );
    }

    const filePath =
      path.join(
        VIDEOS_DIR,
        req.params.filename
      );

    if (
      !fs.existsSync(
        filePath
      )
    ) {
      return res
        .status(404)
        .send(
          'This video file has not been uploaded to the server yet.'
        );
    }

    const stat =
      fs.statSync(
        filePath
      );

    const range =
      req.headers.range;

    if (!range) {

      res.writeHead(
        200,
        {
          'Content-Length':
            stat.size,

          'Content-Type':
            'video/mp4'
        }
      );

      fs.createReadStream(
        filePath
      ).pipe(res);

      return;
    }

    const [
      startStr,
      endStr
    ] =
      range
        .replace(
          /bytes=/,
          ''
        )
        .split('-');

    const start =
      parseInt(
        startStr,
        10
      );

    const end =
      endStr
        ? parseInt(
            endStr,
            10
          )
        : stat.size - 1;

    const chunkSize =
      end -
      start +
      1;

    res.writeHead(
      206,
      {
        'Content-Range':
          `bytes ${start}-${end}/${stat.size}`,

        'Accept-Ranges':
          'bytes',

        'Content-Length':
          chunkSize,

        'Content-Type':
          'video/mp4'
      }
    );

    fs.createReadStream(
      filePath,
      {
        start,
        end
      }
    ).pipe(res);
  }
);


// ============================================================
// RAZORPAY CONFIG
// ============================================================

app.get(
  '/api/payment/config',
  auth,
  (req, res) => {

    res.json({

      configured:
        !!razorpay,

      amount:
        COURSE_PRICE_PAISE,

      priceLabel:
        COURSE_PRICE_LABEL,

      keyId:
        process.env.RAZORPAY_KEY_ID ||
        null
    });
  }
);


// ============================================================
// RAZORPAY CREATE ORDER
// ============================================================

app.post(
  '/api/payment/create-order',
  auth,
  async (req, res) => {

    console.log(
      '----------------------------------------'
    );

    console.log(
      'CREATE ORDER REQUEST'
    );

    console.log(
      'User:',
      req.user
    );

    if (!razorpay) {

      console.error(
        'Razorpay client is NOT configured.'
      );

      return res.status(500).json({
        error:
          'Razorpay is not configured. Check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env.'
      });
    }

    try {

      /*
       * IMPORTANT FIX
       *
       * Do NOT use:
       *
       * receipt_${req.user.id}_${Date.now()}
       *
       * because req.user.id is a UUID.
       *
       * Use a short receipt.
       */

      const receipt =
        `rcpt_${Date.now()}`;

      console.log(
        'Receipt:',
        receipt
      );

      console.log(
        'Amount:',
        COURSE_PRICE_PAISE
      );

      console.log(
        'Currency: INR'
      );

      const order =
        await razorpay.orders.create({

          amount:
            COURSE_PRICE_PAISE,

          currency:
            'INR',

          receipt:
            receipt,

          notes: {

            userId:
              req.user.id,

            email:
              req.user.email
          }
        });

      console.log(
        'RAZORPAY ORDER CREATED:',
        order.id
      );

      console.log(
        '----------------------------------------'
      );

      return res.json({

        orderId:
          order.id,

        amount:
          order.amount,

        currency:
          order.currency,

        keyId:
          process.env.RAZORPAY_KEY_ID
      });

    } catch (error) {

      console.error(
        '========================================'
      );

      console.error(
        'RAZORPAY CREATE ORDER ERROR'
      );

      console.error(
        error
      );

      console.error(
        '========================================'
      );

      const razorpayDescription =
        error?.error?.description ||
        error?.description ||
        error?.message ||
        'Unknown Razorpay error';

      return res.status(500).json({

        error:
          'Razorpay could not create the order.',

        details:
          razorpayDescription
      });
    }
  }
);


// ============================================================
// RAZORPAY PAYMENT VERIFY
// ============================================================

app.post(
  '/api/payment/verify',
  auth,
  (req, res) => {

    try {

      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
      } = req.body || {};

      if (
        !razorpay_order_id ||
        !razorpay_payment_id ||
        !razorpay_signature
      ) {
        return res.status(400).json({
          error:
            'Missing payment details.'
        });
      }

      if (
        !process.env.RAZORPAY_KEY_SECRET
      ) {
        return res.status(500).json({
          error:
            'Razorpay secret is not configured.'
        });
      }

      const expectedSignature =
        crypto
          .createHmac(
            'sha256',
            process.env.RAZORPAY_KEY_SECRET
          )
          .update(
            `${razorpay_order_id}|${razorpay_payment_id}`
          )
          .digest('hex');

      if (
        expectedSignature !==
        razorpay_signature
      ) {

        console.error(
          'PAYMENT SIGNATURE MISMATCH'
        );

        return res.status(400).json({
          error:
            'Payment verification failed.'
        });
      }

      const db =
        readDB();

      const user =
        db.users.find(
          u =>
            u.id ===
            req.user.id
        );

      if (!user) {
        return res.status(401).json({
          error:
            'Account not found.'
        });
      }

      user.subscribed =
        true;

      user.subscribedAt =
        new Date().toISOString();

      user.lastPaymentId =
        razorpay_payment_id;

      user.lastOrderId =
        razorpay_order_id;

      writeDB(db);

      console.log(
        'PAYMENT VERIFIED SUCCESSFULLY'
      );

      console.log(
        'User:',
        user.email
      );

      console.log(
        'Payment:',
        razorpay_payment_id
      );

      res.json({
        ok: true
      });

    } catch (error) {

      console.error(
        'PAYMENT VERIFY ERROR:',
        error
      );

      res.status(500).json({
        error:
          'Could not verify the payment.'
      });
    }
  }
);


// ============================================================
// HOME
// ============================================================

app.get(
  '/',
  (req, res) => {

    res.sendFile(
      path.join(
        __dirname,
        'public',
        'index.html'
      )
    );
  }
);


// ============================================================
// 404
// ============================================================

app.get(
  '*',
  (req, res) => {

    res.status(404).sendFile(
      path.join(
        __dirname,
        'public',
        '404.html'
      )
    );
  }
);


// ============================================================
// START SERVER
// ============================================================

app.listen(
  PORT,
  () => {

    console.log(
      '----------------------------------------'
    );

    console.log(
      `Server running: http://localhost:${PORT}`
    );

    console.log(
      `Payment price: ${COURSE_PRICE_LABEL}`
    );

    console.log(
      `Razorpay configured: ${!!razorpay}`
    );

    console.log(
      '----------------------------------------'
    );
  }
);