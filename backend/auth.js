/* auth.js — minimal password hashing + demo-account definitions for the
   role-based login (HR/site manager · contractor · worker).

   Passwords are hashed with scrypt (Node's built-in crypto, no extra deps) and
   stored as "salt$hash" hex. These are DEMO accounts; the plaintext defaults
   live here only so the login screen can advertise them. Never reuse these for
   anything real. */
const crypto = require('crypto');

function hashPassword(plain, salt) {
  const s = salt || crypto.randomBytes(16).toString('hex');
  const h = crypto.scryptSync(String(plain), s, 64).toString('hex');
  return s + '$' + h;
}

function verifyPassword(plain, stored) {
  if (!stored || stored.indexOf('$') === -1) return false;
  const [s, h] = stored.split('$');
  const cand = crypto.scryptSync(String(plain), s, 64).toString('hex');
  const a = Buffer.from(h, 'hex');
  const b = Buffer.from(cand, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* The three demo roles. linkedType tells the frontend which home to lock the
   session into; linkedId is resolved at seed time from the live data (a real
   worker for the labourer, a real contractor firm for the vendor) so the home
   shows genuine data. `admin` sees the full application. */
const DEMO_ACCOUNTS = [
  { username: 'hr',         password: 'hr@daikin',         role: 'admin',
    name: 'Priya Menon',    title: 'Site HR Manager',      linkedType: 'admin',
    email: 'hr@karyavaani.demo' },
  { username: 'worker',     password: 'worker@daikin',     role: 'employee',
    name: '',               title: 'Worker / Labourer',    linkedType: 'employee',
    email: 'worker@karyavaani.demo' },
  { username: 'contractor', password: 'contractor@daikin', role: 'contractor',
    name: '',               title: 'Agency',  linkedType: 'contractor',
    email: 'contractor@karyavaani.demo' },
  { username: 'operator',   password: 'operator@daikin',   role: 'operator',
    name: 'Sri Balaji Travels', title: 'Transport Operator', linkedType: 'operator',
    email: 'operator@karyavaani.demo' }
];

/* Fleet operators running the worker buses. Route index i → OPERATORS[i % 4]
   (the frontend uses the identical rule), so each route has one operator and an
   operator owns a fixed set of routes. */
const TRANSPORT_OPERATORS = ['Sri Balaji Travels', 'Kaveri Fleet Services', 'APSRTC Contract Fleet', 'Sricity Logistics'];

module.exports = { hashPassword, verifyPassword, DEMO_ACCOUNTS, TRANSPORT_OPERATORS };
