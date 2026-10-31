import { test, describe, beforeEach, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import {
  authRoutes,
  currentUser,
  sessions,
  SESSION_TTL_MS,
  getSessionUser,
  hashPassword,
  verifyPassword,
  _resetRateLimits,
} from './auth.js';
import { findUser } from './db.js';

let server;
let baseUrl;

function startServer() {
  const app = express();
  app.use(express.json());
  app.use(currentUser);
  authRoutes(app);

  return new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
}

describe('Auth rate limiting', () => {
  before(async () => {
    await startServer();
  });

  after(() => {
    server?.close();
  });

  beforeEach(() => {
    _resetRateLimits();
  });

  test('blocks after 5 failed logins for the same team name and returns 429 with Retry-After', async () => {
    const team = 'testteam_' + Date.now();

    // 5 failed logins from different IPs for the same team
    for (let i = 1; i <= 5; i++) {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': `192.168.1.${i}`,
        },
        body: JSON.stringify({ username: team, password: 'wrongpassword' }),
      });
      const data = await res.json();
      assert.equal(res.status, 401);
      assert.equal(data.error, 'No team with that name');
    }

    // 6th attempt should be blocked with 429
    const blockedRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '192.168.1.99',
      },
      body: JSON.stringify({ username: team, password: 'wrongpassword' }),
    });

    assert.equal(blockedRes.status, 429);
    const retryAfter = blockedRes.headers.get('retry-after');
    assert.ok(retryAfter, 'Expected Retry-After header');
    const retrySec = parseInt(retryAfter, 10);
    assert.ok(retrySec > 0 && retrySec <= 600);

    const body = await blockedRes.json();
    assert.match(body.error, /^Too many attempts, try again in \d+ minutes?$/);
  });

  test('blocks after 5 failed logins from the same IP and returns 429 with Retry-After', async () => {
    const attackerIp = '10.0.0.42';

    // 5 failed logins from same IP using different team names
    for (let i = 1; i <= 5; i++) {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': attackerIp,
        },
        body: JSON.stringify({ username: `different_team_${i}`, password: 'wrongpassword' }),
      });
      assert.equal(res.status, 401);
    }

    // 6th attempt from the same IP should be blocked even with yet another team name
    const blockedRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': attackerIp,
      },
      body: JSON.stringify({ username: 'another_team', password: 'wrongpassword' }),
    });

    assert.equal(blockedRes.status, 429);
    assert.ok(blockedRes.headers.get('retry-after'));
    const body = await blockedRes.json();
    assert.match(body.error, /^Too many attempts, try again in \d+ minutes?$/);
  });

  test('successful login resets the counter', async () => {
    const team = 'reset_team_' + Date.now();
    const password = 'correct_password';
    const ip = '10.0.0.99';

    // Sign up the team first
    const signupRes = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: team, password }),
    });
    assert.equal(signupRes.status, 201);

    // Fail 4 times
    for (let i = 0; i < 4; i++) {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': ip,
        },
        body: JSON.stringify({ username: team, password: 'bad_password' }),
      });
      const data = await res.json();
      assert.equal(res.status, 401);
      assert.equal(data.error, 'Wrong password');
    }

    // 5th attempt: successful login
    const successRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': ip,
      },
      body: JSON.stringify({ username: team, password }),
    });
    assert.equal(successRes.status, 200);
    const successData = await successRes.json();
    assert.equal(successData.username, team);

    // After success, counter was reset: another 4 failed logins should NOT block
    for (let i = 0; i < 4; i++) {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': ip,
        },
        body: JSON.stringify({ username: team, password: 'bad_password' }),
      });
      assert.equal(res.status, 401);
    }

    // Still not blocked on 4th fail after reset
    const attemptRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': ip,
      },
      body: JSON.stringify({ username: team, password }),
    });
    assert.equal(attemptRes.status, 200);
  });

  test('logging out deletes session on server so old cookie stops working', async () => {
    const team = 'logout_team_' + Date.now();
    const password = 'mypassword';

    // Sign up
    await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: team, password }),
    });

    // Login and get cookie
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: team, password }),
    });
    assert.equal(loginRes.status, 200);
    const cookieHeader = loginRes.headers.get('set-cookie');
    assert.ok(cookieHeader, 'Expected set-cookie header');
    const cookieVal = cookieHeader.split(';')[0]; // e.g. codearena_session=...

    // Verify session works before logout
    const meBefore = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: cookieVal },
    });
    const meBeforeData = await meBefore.json();
    assert.equal(meBeforeData?.username, team);

    // Logout
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: cookieVal },
    });
    assert.equal(logoutRes.status, 200);

    // Using the old cookie now must return null (not logged in)
    const meAfter = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: cookieVal },
    });
    const meAfterData = await meAfter.json();
    assert.equal(meAfterData, null);
  });

  test('sessions expire on the server after 24 hours', async () => {
    const team = 'expire_team_' + Date.now();
    const password = 'mypassword';

    // Sign up
    await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: team, password }),
    });

    // Login and get cookie
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: team, password }),
    });
    const cookieHeader = loginRes.headers.get('set-cookie');
    const cookieVal = cookieHeader.split(';')[0];
    const token = cookieVal.split('=')[1];

    // Session is active immediately
    assert.ok(sessions.has(token));
    assert.equal(getSessionUser(token, Date.now()), team);

    // Advance time by 24 hours + 1 millisecond
    const after24h = Date.now() + SESSION_TTL_MS + 1;

    // getSessionUser returns null and removes expired session
    assert.equal(getSessionUser(token, after24h), null);
    assert.equal(sessions.has(token), false);
  });

  test('hashes passwords with random salt using scrypt and never stores plain-text in db', async () => {
    const rawPassword = 'superSecretPassword42';
    const hash1 = await hashPassword(rawPassword);
    const hash2 = await hashPassword(rawPassword);

    // Format is <32-hex-salt>:<128-hex-derivedKey>
    assert.match(hash1, /^[0-9a-f]{32}:[0-9a-f]{128}$/i);
    assert.match(hash2, /^[0-9a-f]{32}:[0-9a-f]{128}$/i);

    // Due to random salt, two hashes of the same password are distinct
    assert.notEqual(hash1, hash2);

    // verifyPassword verifies correct password
    assert.equal(await verifyPassword(rawPassword, hash1), true);
    assert.equal(await verifyPassword('wrongPassword', hash1), false);
    assert.equal(await verifyPassword('', hash1), false);
    assert.equal(await verifyPassword(rawPassword, 'invalidHash'), false);
  });

  test('signing up stores salted hash in db.json and user can log in', async () => {
    const team = 'hashed_team_' + Date.now();
    const password = 'mySecretPassword99';

    const signupRes = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: team, password }),
    });
    assert.equal(signupRes.status, 201);

    // Verify stored user in db does not contain plain text password
    const userInDb = findUser(team);
    assert.ok(userInDb, 'User must exist in db');
    assert.notEqual(userInDb.password, password);
    assert.match(userInDb.password, /^[0-9a-f]{32}:[0-9a-f]{128}$/i);

    // Login with correct password succeeds
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: team, password }),
    });
    assert.equal(loginRes.status, 200);

    // Login with wrong password fails with 401
    const badLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: team, password: 'wrongPassword' }),
    });
    assert.equal(badLoginRes.status, 401);
  });
});
