-- Store user accounts and their roles.
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'submitter'
        CHECK (role IN ('reviewer', 'submitter')),
    display_picture TEXT
);

-- Add the picture column to databases created before this update.
ALTER TABLE users
ADD COLUMN IF NOT EXISTS display_picture TEXT;


-- Store projects and identify their owners.
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    owner_id INTEGER NOT NULL REFERENCES users(id)
);


-- Record which reviewers belong to each project.
CREATE TABLE IF NOT EXISTS project_members (
    project_id INTEGER NOT NULL
        REFERENCES projects(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    -- A user can belong to the same project only once.
    PRIMARY KEY (project_id, user_id)
);


-- Store code submitted for review.
CREATE TABLE IF NOT EXISTS submissions (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    submitter_id INTEGER NOT NULL REFERENCES users(id),
    title VARCHAR(200) NOT NULL,
    code TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'in_review',
                'approved',
                'changes_requested'
            )
        ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add the timestamp to databases created before this update.
ALTER TABLE submissions
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ
NOT NULL DEFAULT CURRENT_TIMESTAMP;


-- Store general comments and feedback on specific code lines.
CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    submission_id INTEGER NOT NULL REFERENCES submissions(id),
    author_id INTEGER NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    line_number INTEGER
);


-- Keep a history of submission status changes.
CREATE TABLE IF NOT EXISTS reviews (
    id SERIAL PRIMARY KEY,
    submission_id INTEGER NOT NULL REFERENCES submissions(id),
    reviewer_id INTEGER NOT NULL REFERENCES users(id),

    previous_status VARCHAR(30) NOT NULL
        CHECK (
            previous_status IN (
                'pending',
                'in_review',
                'approved',
                'changes_requested'
            )
        ),

    status VARCHAR(30) NOT NULL
        CHECK (
            status IN (
                'pending',
                'in_review',
                'approved',
                'changes_requested'
            )
        ),

    feedback TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- Store activity notifications for individual users.
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,
    submission_id INTEGER
        REFERENCES submissions(id) ON DELETE SET NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- Help retrieve a user's latest notifications.
CREATE INDEX IF NOT EXISTS notifications_user_created_idx
ON notifications (user_id, created_at DESC, id DESC);

-- Help retrieve a submission's review history.
CREATE INDEX IF NOT EXISTS reviews_submission_created_idx
ON reviews (submission_id, created_at);

-- Help retrieve comments belonging to a submission.
CREATE INDEX IF NOT EXISTS comments_submission_idx
ON comments (submission_id, id);