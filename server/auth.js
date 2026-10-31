// Team accounts: sign up, log in, log out.
// Sessions live in memory, so everyone has to log in again after the server restarts.
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { addUser, findUser } from './db.js';

const scryptAsync = promisify(crypto.scrypt);
const KEY_LEN = 64;

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = await scryptAsync(password, salt, KEY_LEN);
  return `${salt}:${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password, storedPassword) {
  if (!password || !storedPassword || typeof storedPassword !== 'string') {
    return false;
  }
  const parts = storedPassword.split(':');
  if (parts.length !== 2) {
    return false;
  }
  const [salt, expectedHashHex] = parts;
  if (!salt || !expectedHashHex) {
    return false;
  }
  const expectedBuffer = Buffer.from(expectedHashHex, 'hex');
  const actualBuffer = await scryptAsync(password, salt, expectedBuffer.length);
  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

const COOKIE = 'codearena_session';
export const sessions = new Map(); // token -> { username, createdAt, expiresAt }
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

function pruneExpiredSessions(now = Date.now()) {
  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt && now > session.expiresAt) {
      sessions.delete(token);
    }
  }
}

export function getSessionUser(token, now = Date.now()) {
  if (!token || !sessions.has(token)) return null;
  const session = sessions.get(token);
  if (typeof session === 'string') {
    return session;
  }
  if (session.expiresAt && now > session.expiresAt) {
    sessions.delete(token);
    return null;
  }
  return session.username;
}

function startSession(res, username) {
  pruneExpiredSessions();
  const token = crypto.randomBytes(24).toString('hex');
  const now = Date.now();
  sessions.set(token, {
    username,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  });
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', maxAge: SESSION_TTL_MS });
}

// Puts the logged-in team (if any) on req.user.
export function currentUser(req, res, next) {
  const token = readCookie(req, COOKIE);
  const username = getSessionUser(token);
  req.user = username ? { username } : null;
  next();
}

export function requireLogin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please log in to submit' });
  next();
}

// Rate limiting: 5 failed attempts within 10 minutes per team name or IP
const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;

export const failedByUser = new Map(); // normalized username -> timestamp[]
export const failedByIp = new Map();   // ip -> timestamp[]

function pruneAttempts(attempts, now) {
  return attempts.filter((t) => now - t < WINDOW_MS);
}

function getRemainingLockoutSeconds(key, store, now) {
  if (!key) return 0;
  const attempts = pruneAttempts(store.get(key) || [], now);
  if (attempts.length === 0) {
    store.delete(key);
    return 0;
  }
  store.set(key, attempts);
  if (attempts.length >= MAX_FAILED_ATTEMPTS) {
    const oldestRelevant = attempts[attempts.length - MAX_FAILED_ATTEMPTS];
    const retryAfterMs = oldestRelevant + WINDOW_MS - now;
    return Math.max(1, Math.ceil(retryAfterMs / 1000));
  }
  return 0;
}

function recordFailedAttempt(key, store, now) {
  if (!key) return;
  const attempts = pruneAttempts(store.get(key) || [], now);
  attempts.push(now);
  store.set(key, attempts);
}

function resetFailedAttempts(key, store) {
  if (key) {
    store.delete(key);
  }
}

export function getClientIp(req) {
  const forwarded = req.headers && req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = typeof forwarded === 'string' ? forwarded.split(',')[0] : forwarded[0];
    if (first) return first.trim();
  }
  return req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress || '127.0.0.1';
}

export function loginRateLimiter(req, res, next) {
  const username = String(req.body?.username || '').trim().toLowerCase();
  const ip = getClientIp(req);
  const now = Date.now();

  const retryUser = username ? getRemainingLockoutSeconds(username, failedByUser, now) : 0;
  const retryIp = getRemainingLockoutSeconds(ip, failedByIp, now);
  const retryAfter = Math.max(retryUser, retryIp);

  if (retryAfter > 0) {
    const minutes = Math.max(1, Math.ceil(retryAfter / 60));
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({
      error: `Too many attempts, try again in ${minutes} minute${minutes === 1 ? '' : 's'}`,
      retryAfter,
    });
  }

  next();
}

export function _resetRateLimits() {
  failedByUser.clear();
  failedByIp.clear();
}

export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9\s]).{8,}$/;

export function authRoutes(app) {
  app.post('/api/auth/signup', async (req, res) => {
    const username = String(req.body.username || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!username || !password) {
      return res.status(400).json({ error: 'Team name and password are required' });
    }
    if (email && !EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }
    if (email && !PASSWORD_REGEX.test(password)) {
      return res.status(400).json({
        error:
          'Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character',
      });
    }
    if (findUser(username)) {
      return res.status(409).json({ error: 'That team name is taken' });
    }
    if (email && findUser(email)) {
      return res.status(409).json({ error: 'That email is already registered' });
    }
    const hashedPassword = await hashPassword(password);
    addUser({ username, email: email || undefined, password: hashedPassword });
    startSession(res, username);
    res.status(201).json({ username });
  });

  app.post('/api/auth/login', loginRateLimiter, async (req, res) => {
    const rawUsername = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    const user = findUser(rawUsername);
    const ip = getClientIp(req);
    const normUser = rawUsername.toLowerCase();
    const now = Date.now();

    if (!user) {
      if (normUser) recordFailedAttempt(normUser, failedByUser, now);
      recordFailedAttempt(ip, failedByIp, now);
      return res.status(401).json({ error: 'No team with that name' });
    }

    const matches = await verifyPassword(password, user.password);
    if (!matches) {
      if (normUser) recordFailedAttempt(normUser, failedByUser, now);
      recordFailedAttempt(ip, failedByIp, now);
      return res.status(401).json({ error: 'Wrong password' });
    }

    resetFailedAttempts(normUser, failedByUser);
    resetFailedAttempts(ip, failedByIp);

    startSession(res, user.username);
    res.json({ username: user.username });
  });

  app.post('/api/auth/logout', (req, res) => {
    const token = readCookie(req, COOKIE);
    if (token) {
      sessions.delete(token);
    }
    res.clearCookie(COOKIE);
    res.json({ ok: true });
  });

  app.get('/api/auth/me', (req, res) => {
    res.json(req.user);
  });
}
