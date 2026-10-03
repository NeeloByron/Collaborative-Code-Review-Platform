# Code Collaborative Review

A REST API for a collaborative code review platform where users can submit code, review submissions, provide feedback, and manage review workflows.

## Run the project

Use Node.js 24 and PostgreSQL. Development work is on `workBranch`.

```bash
git clone --branch workBranch https://github.com/NeeloByron/Collaborative-Code-Review-Platform.git
cd Collaborative-Code-Review-Platform
npm ci --include=dev
```

Copy `.env.example` to `.env` and fill in your local PostgreSQL settings.
Generate a private JWT secret and save the output as `JWT_SECRET` in `.env`:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

For a **new database**, create `code_review_db` in PostgreSQL and run
`src/database/schema.sql` using pgAdmin's Query Tool (or psql).
For an **existing Sprint 1 database**, keep your tables and records: do not rerun the initial schema.

```bash
npm run dev
```

`npm run dev` and `npm start` first run the repeatable Sprint 2 migration, which adds
`users.display_picture` if it is missing. It preserves existing accounts.
Your database must exist and `.env` must contain its connection settings.
The default server URL is `http://localhost:5000`.

To run compiled JavaScript:

```bash
npm run build
npm start
```

To apply the database upgrade separately:

```bash
npm run db:migrate
```

## Project Structure

```text
Collaborative-Code-Review-Platform/
├── src/
│   ├── config/database.ts
│   ├── controllers/
│   │   ├── authController.ts
│   │   └── userController.ts
│   ├── database/
│   │   ├── schema.sql
│   │   └── migrations/002_user_profiles.sql
│   ├── middleware/
│   │   ├── authMiddleware.ts
│   │   ├── authorizationMiddleware.ts
│   │   ├── validationMiddleware.ts
│   │   └── errorHandler.ts
│   ├── routes/
│   │   ├── authRoutes.ts
│   │   └── userRoutes.ts
│   ├── service/userServices.ts
│   ├── types/application.types.ts
│   ├── app.ts
│   └── server.ts
├── scripts/migrate.cjs
├── tests/sprint2.test.cjs
├── Assets/
├── .env.example
├── package.json
├── package-lock.json
└── tsconfig.json
```

## Sprint 2 scope and permissions

| Feature | Endpoint / implementation |
|---|---|
| Create account | `POST /api/auth/register` |
| Login and receive a one-hour JWT | `POST /api/auth/login` |
| View own profile | `GET /api/users/:id` |
| Partially update own profile | `PATCH /api/users/:id` |
| Delete own account | `DELETE /api/users/:id` |
| Verify token and active account | `authenticate` middleware |
| Restrict actions by role | `authorizeRoles(...roles)` middleware |
| Prevent access to another account | `requireProfileOwner` middleware |

Both reviewers and submitters can manage their own profiles. No role can read,
edit, or delete another user's profile. Profile updates cannot change IDs, roles,
or passwords. Role-restricted review actions belong to later sprints; those routes
can use `authenticate` followed by `authorizeRoles("reviewer")`.

Registration permits either role as required by this course project. Passwords
must contain at least 8 characters and at most 72 UTF-8 bytes (bcrypt's limit).
Emails are trimmed but remain case-sensitive for compatibility with existing accounts.
JWTs are signed with HS256. Protected requests recheck the database account and its
current role, so a deleted account's old token stops working immediately.

## Sprint 2 - Authentication & User Management

### Register User

**Endpoint**

```http
POST /api/auth/register
```

Registers a new user as either a `submitter` or `reviewer`.

**Example Request**

```json
{
  "name": "Test User",
  "email": "test@example.com",
  "password": "password123",
  "role": "submitter"
}
```

**Result**

```text
201 Created
```

<p align="center">
  <img src="./Assets/registerUser.png" alt="POST Register User - 201 Created" width="900">
</p>

### Login User

**Endpoint**

```http
POST /api/auth/login
```

Logs in a registered user using their email and password. Returns a JWT token that expires after one hour.

**Example Request**

```json
{
  "email": "test@example.com",
  "password": "password123"
}
```

**Result**

```text
200 OK
```

The response contains a login token and the user's ID, name, email, and role. The password and password hash are not returned.

<p align="center">
  <img src="./Assets/login.png" alt="POST Login User - 200 OK" width="900">
</p>

### View User Profile

Retrieves the authenticated user's own profile. Users cannot access another user's profile.

**Endpoint**

```http
GET /api/users/:id
```

Replace `:id` with the user ID returned during login.

**Example Request**

```http
GET http://localhost:5000/api/users/1
Authorization: Bearer <your_login_token>
```

In Postman, select **Authorization → Bearer Token** and paste the token received during login. No request body is required.

**Successful Response — 200 OK**

```json
{
  "message": "Profile retrieved successfully",
  "user": {
    "id": 1,
    "name": "Test User",
    "email": "test@example.com",
    "role": "submitter",
    "display_picture": null
  }
}
```

**Error Responses**

| Status | Meaning |
|---|---|
| 400 Bad Request | Invalid user ID. |
| 401 Unauthorized | Missing, invalid, or expired token, or deleted account. |
| 403 Forbidden | Attempting to access another user's profile. |
| 404 Not Found | Profile disappeared after the authentication check. |

**Screenshot**

<p align="center">
  <img src="./Assets/getUserProfile.png" alt="GET User Profile - 200 OK" width="900">
</p>


### Update User Profile

```http
PATCH /api/users/1
Authorization: Bearer <your_login_token>
Content-Type: application/json
```

Replace `1` with your own user ID. Supply one or more of these fields:

```json
{
  "name": "Byron",
  "email": "byron@example.com",
  "display_picture": "https://example.com/avatar.png"
}
```

The picture is an HTTP(S) image URL, not a file upload. The API stores the URL;
it does not download or check the remote image. Use `"display_picture": null` to
remove it. Omitted fields keep their current values. A successful update returns
`200 OK`, `"Profile updated successfully"`, and the updated safe user details.
Use the new email for subsequent logins if you change it.

Invalid fields, empty updates, malformed email addresses, blank/overlong names,
and unsupported picture URLs return `400`. An email already in use returns `409`.
Attempts to change `role`, `password_hash`, `password` or `id` are rejected.

### Delete User Account

```http
DELETE /api/users/1
Authorization: Bearer <your_login_token>
```

No body is needed. A successful deletion returns:

```json
{
  "message": "Account deleted successfully"
}
```

Deletion is permanent. Use a disposable account when testing. Its old token will
return `401` on later protected requests. If the account owns a project or is
referenced by a submission or comment, the API returns `409` and preserves the
account and related work. No cascading deletion is performed.

## Tests

```bash
npm test
```

The suite compiles TypeScript and tests the actual Express endpoints, bcrypt and
JWT logic against an isolated PGlite PostgreSQL engine. Only the database transport
is adapted in the test process; SQL constraints are exercised. Tests never connect
to or modify your local PostgreSQL database. They do not verify your local database
credentials, native PostgreSQL server connection, or availability of picture URLs.

Coverage includes registration, both roles, login failures, token expiry/tampering,
profile ownership, partial updates, duplicate email conflicts, role-change attempts,
picture removal, deletion restrictions, old tokens after deletion, and a repeatable
migration that preserves an existing account. Role middleware is also tested with a
reviewer-only policy without adding an unnecessary public test endpoint.

For a manual check in Postman:

1. Register a disposable account and log in.
2. Set Authorization to Bearer Token and use the returned token.
3. GET your own `/api/users/:id`; expect `200` and no password hash.
4. PATCH your name and picture URL; GET again to confirm they were saved.
5. Try another user's ID; expect `403`. Remove the token; expect `401`.
6. DELETE the disposable account; expect `200` if it has no linked work.
7. Reuse its old token; expect `401`.

Save screenshots with token values hidden. The existing screenshots document earlier
registration, login and profile retrieval; update and deletion screenshots should be
added after running those requests locally.
