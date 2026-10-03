const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { randomBytes } = require('node:crypto');

// Real PostgreSQL engine in memory: no access to the developer's local database.
const db = new PGlite();
process.env.JWT_SECRET = randomBytes(32).toString('hex');
let server, base, first, second;
const migration = readFileSync(join(__dirname, '../src/database/migrations/002_user_profiles.sql'), 'utf8');

before(async () => {
    // Start from the original schema and prove the migration preserves existing users.
    const schema = readFileSync(join(__dirname, '../src/database/schema.sql'), 'utf8')
        .replace(/^.*display_picture TEXT.*\n/m, '');
    await db.exec(schema);
    const hash = await bcrypt.hash('password123', 10);
    await db.query('INSERT INTO users (name,email,password_hash,role) VALUES ($1,$2,$3,$4)',
        ['Existing User', 'existing@example.com', hash, 'submitter']);
    await db.exec(migration);
    await db.exec(migration);

    // Adapt only the database transport; run the actual SQL, Express app and JWT/bcrypt code.
    const databasePath = require.resolve('../dist/config/database');
    require.cache[databasePath] = {
        id: databasePath, filename: databasePath, loaded: true,
        exports: { query: (sql, params) => db.query(sql, params) }
    };
    const app = require('../dist/app').default;
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    await db.close();
});

async function request(method, path, body, token, raw = false) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch(base + path, {
        method, headers, body: body === undefined ? undefined : raw ? body : JSON.stringify(body)
    });
    return { status: response.status, body: await response.json() };
}
async function account(email, role = 'submitter') {
    const registered = await request('POST', '/api/auth/register', {
        name: 'Test User', email, password: 'password123', role
    });
    assert.equal(registered.status, 201);
    assert.equal(registered.body.user.password_hash, undefined);
    const login = await request('POST', '/api/auth/login', { email, password: 'password123' });
    assert.equal(login.status, 200);
    assert.equal(login.body.user.password_hash, undefined);
    return { ...login.body.user, token: login.body.token };
}

test('migration is repeatable and preserves an existing account', async () => {
    const response = await request('POST', '/api/auth/login', {
        email: 'existing@example.com', password: 'password123'
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.user.display_picture, null);
});

test('registration and login work for both roles with hashed passwords and expiring tokens', async () => {
    first = await account('first@example.com');
    second = await account('second@example.com', 'reviewer');
    const saved = (await db.query('SELECT password_hash FROM users WHERE id=$1', [first.id])).rows[0];
    assert.notEqual(saved.password_hash, 'password123');
    assert.ok(await bcrypt.compare('password123', saved.password_hash));
    const payload = jwt.verify(first.token, process.env.JWT_SECRET);
    assert.equal(payload.exp - payload.iat, 3600);
    assert.equal(payload.id, first.id);
});

test('registration rejects duplicate email, invalid data and malformed JSON', async () => {
    const valid = { name: 'User', email: 'first@example.com', password: 'password123', role: 'submitter' };
    assert.equal((await request('POST', '/api/auth/register', valid)).status, 409);
    for (const body of [null, [], {}, { ...valid, name: 123 }, { ...valid, name: ' ' },
        { ...valid, email: 'bad' }, { ...valid, password: 'tiny' },
        { ...valid, password: 'a'.repeat(73) }, { ...valid, role: 'admin' }]) {
        assert.equal((await request('POST', '/api/auth/register', body)).status, 400);
    }
    assert.equal((await request('POST', '/api/auth/register', '{bad', null, true)).status, 400);
    assert.equal((await request('POST', '/api/auth/register')).status, 400);
});

test('wrong password and missing account give the same login response', async () => {
    const wrong = await request('POST', '/api/auth/login', { email: first.email, password: 'incorrect' });
    const missing = await request('POST', '/api/auth/login', { email: 'nobody@example.com', password: 'incorrect' });
    assert.equal(wrong.status, 401);
    assert.deepEqual(wrong, missing);
    assert.equal((await request('POST', '/api/auth/login', { email: 42, password: [] })).status, 400);
});

test('protected profile returns safe fields for both account roles', async () => {
    for (const user of [first, second]) {
        const response = await request('GET', `/api/users/${user.id}`, undefined, user.token);
        assert.equal(response.status, 200);
        assert.equal(response.body.user.id, user.id);
        assert.deepEqual(Object.keys(response.body.user).sort(), ['display_picture', 'email', 'id', 'name', 'role']);
    }
});

test('missing, forged, expired, wrong-algorithm and malformed-payload tokens are rejected', async () => {
    const sign = (payload, options = {}) => jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h', ...options });
    const tokens = [undefined, 'abc123',
        jwt.sign({ id: first.id, role: first.role }, 'wrong-secret', { expiresIn: '1h' }),
        sign({ id: first.id, role: first.role }, { expiresIn: -1 }),
        sign({ id: first.id, role: first.role }, { algorithm: 'HS384' }),
        sign({ id: '2', role: first.role }), sign({ id: first.id, role: 'admin' }),
        jwt.sign({ id: first.id, role: first.role }, process.env.JWT_SECRET)];
    for (const token of tokens) {
        assert.equal((await request('GET', `/api/users/${first.id}`, undefined, token)).status, 401);
    }
});

test('invalid IDs fail clearly and cross-account read/update/delete are forbidden', async () => {
    for (const id of ['abc', '0', '-1', '1.5', '2147483648']) {
        assert.equal((await request('GET', `/api/users/${id}`, undefined, first.token)).status, 400);
    }
    for (const method of ['GET', 'PATCH', 'DELETE']) {
        assert.equal((await request(method, `/api/users/${second.id}`,
            method === 'PATCH' ? { name: 'Intruder' } : undefined, first.token)).status, 403);
    }
});

test('PATCH updates name/email/picture, keeps omitted fields and can remove the picture', async () => {
    const path = `/api/users/${first.id}`;
    let response = await request('PATCH', path, {
        name: '  Byron  ', email: 'updated@example.com', display_picture: 'https://example.com/avatar.png'
    }, first.token);
    assert.equal(response.status, 200);
    assert.equal(response.body.user.name, 'Byron');
    assert.equal(response.body.user.display_picture, 'https://example.com/avatar.png');
    response = await request('PATCH', path, { display_picture: null }, first.token);
    assert.equal(response.body.user.display_picture, null);
    assert.equal(response.body.user.name, 'Byron');
    assert.equal(response.body.user.email, 'updated@example.com');
    assert.equal((await request('POST', '/api/auth/login', { email: first.email, password: 'password123' })).status, 401);
    assert.equal((await request('POST', '/api/auth/login', { email: 'updated@example.com', password: 'password123' })).status, 200);
});

test('PATCH rejects duplicate emails, empty data, invalid pictures and protected fields', async () => {
    const path = `/api/users/${first.id}`;
    assert.equal((await request('PATCH', path, { email: second.email }, first.token)).status, 409);
    for (const body of [{}, null, [], { role: 'reviewer' }, { password_hash: 'fake' }, { id: second.id },
        { name: ' ' }, { name: 'a'.repeat(101) }, { email: 'bad' }, { display_picture: 'javascript:alert(1)' },
        { display_picture: 'https://user:pass@example.com/a.png' }, { display_picture: 42 }]) {
        assert.equal((await request('PATCH', path, body, first.token)).status, 400);
    }
    const profile = await request('GET', path, undefined, first.token);
    assert.equal(profile.body.user.role, 'submitter');
    assert.equal(profile.body.user.email, 'updated@example.com');
});

test('role middleware rejects submitters on reviewer-only actions and permits reviewers', () => {
    const { authorizeRoles } = require('../dist/middleware/authorizationMiddleware');
    const reviewerOnly = authorizeRoles('reviewer');
    for (const [user, expected] of [[undefined, 401], [{ id: 1, role: 'submitter' }, 403], [{ id: 2, role: 'reviewer' }, undefined]]) {
        let called = false;
        reviewerOnly({ user }, {}, error => {
            called = true;
            assert.equal(error?.statusCode, expected);
        });
        assert.ok(called);
    }
});

test('authentication uses the current database role rather than an outdated token role', async () => {
    await db.query("UPDATE users SET role='reviewer' WHERE id=$1", [first.id]);
    const { authenticate } = require('../dist/middleware/authMiddleware');
    const req = { headers: { authorization: `Bearer ${first.token}` } };
    await new Promise((resolve, reject) => authenticate(req, {}, error => error ? reject(error) : resolve()));
    assert.equal(req.user.role, 'reviewer');
});

test('deleting an account linked to project work returns 409 without removing anything', async () => {
    await db.query('INSERT INTO projects (name,owner_id) VALUES ($1,$2)', ['Keep this project', second.id]);
    assert.equal((await request('DELETE', `/api/users/${second.id}`, undefined, second.token)).status, 409);
    assert.equal((await request('GET', `/api/users/${second.id}`, undefined, second.token)).status, 200);
    assert.equal((await db.query('SELECT * FROM projects')).rows.length, 1);
});

test('deletion removes an unlinked account and immediately invalidates its old token', async () => {
    const path = `/api/users/${first.id}`;
    assert.equal((await request('DELETE', path, undefined, first.token)).status, 200);
    assert.equal((await db.query('SELECT id FROM users WHERE id=$1', [first.id])).rows.length, 0);
    assert.equal((await request('GET', path, undefined, first.token)).status, 401);
    assert.equal((await request('PATCH', path, { name: 'Return' }, first.token)).status, 401);
    assert.equal((await request('POST', '/api/auth/login', { email: 'updated@example.com', password: 'password123' })).status, 401);
});
