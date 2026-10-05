-- stores users and their roles
CREATE TABLE users (
   id SERIAL PRIMARY KEY,
   name VARCHAR(100) NOT NULL,
   email VARCHAR(255) UNIQUE NOT NULL,
   password_hash TEXT NOT NULL, -- stores the hashed password
   role VARCHAR(20) DEFAULT 'submitter'
        CHECK (role IN ('reviewer', 'submitter'))
);

-- stores projects and links each project to its owner
CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    owner_id INTEGER NOT NULL REFERENCES users(id) -- links back to user table
);

-- stores code submitted for review
CREATE TABLE submissions (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id), -- links back to projects table
    submitter_id INTEGER NOT NULL REFERENCES users(id), -- links back to users table
    title VARCHAR(200) NOT NULL,
    code TEXT NOT NULL,
    status VARCHAR(30) DEFAULT 'pending' 
           CHECK (status IN (
            'pending', 'in_review', 'approved', 'changes_requested'
           ))  
);

-- stores feedback on submissions 
CREATE TABLE comments (
    id SERIAL PRIMARY KEY,
    submission_id INTEGER NOT NULL REFERENCES submissions(id), -- links back to submissions table
    author_id INTEGER NOT NULL REFERENCES users(id), -- links back to users table
    content TEXT NOT NULL,
    line_number INTEGER -- NULL for general feedback, line number for inline feedback
);

-- Display picture
display_picture TEXT,

-- Store which users belong to each project
CREATE TABLE IF NOT EXISTS project_members (
    project_id INTEGER NOT NULL
      REFERENCES projects(id) ON DELETE CASCADE,

    user_id INTEGER NOT NULL
      REFERENCES users(id) ON DELETE CASCADE,

  -- Prevent adding the same user to the same project twice
    PRIMARY KEY (project_id, user_id)   
);

-- Keep a history of submission status changes
CREATE TABLE IF NOT EXISTS reviews (
    id SERIAL PRIMARY KEY,

    submission_id INTEGER NOT NULL
        REFERENCES submissions(id),

    reviewer_id INTEGER NOT NULL
        REFERENCES users(id),

    previous_status VARCHAR(30) NOT NULL
        CHECK (previous_status IN (
            'pending',
            'in_review',
            'approved',
            'changes_requested'
        )),

    status VARCHAR(30) NOT NULL
        CHECK (status IN (
            'pending',
            'in_review',
            'approved',
            'changes_requested'
        )),

    feedback TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Record when a submission was created
ALTER TABLE submissions
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ
NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Store notifications for individual users
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,

    user_id INTEGER NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    submission_id INTEGER
        REFERENCES submissions(id) ON DELETE SET NULL,

    message TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Help retrieve a user's latest notifications efficiently
CREATE INDEX IF NOT EXISTS notifications_user_created_idx
ON notifications (user_id, created_at DESC, id DESC);

-- Record when a submission was created
ALTER TABLE submissions
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ
NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,
    submission_id INTEGER
        REFERENCES submissions(id) ON DELETE SET NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXIST notifications user created idx
ON notifications (user_id, created_at DESC, id DESC);

CREATE IF NOT EXISTS reviews submission created idx
ON reviews(submission id, created at);

CREATE INDEX IF NOT EXISTS comments submission idx
ON comments(submission_id, id);