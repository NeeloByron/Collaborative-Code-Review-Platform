export type UserRole = "reviewer" | "submitter"; 

// Represent a user in the system
export interface User {
    id: number;
    name: string;
    email: string;
    password_hash: string;
    role: UserRole;
    display_picture: string | null;
}

// Represent the information needed to register
export type RegisterUser = Pick<User, "name" | "email" | "role"> & {
    password: string;
};

// Represent the information needed to login 
export type LoginUser = Pick<User, "email"> & {
    password: string;
};  

// removes password_hash when returning user information 
export type PublicUser = Omit<User, "password_hash">;

// fields users are allowed to change in their own profile 
export type UpdateProfile = Partial<
    Pick<User, "name" | "email" | "display_picture">
>;

// sprint 3: Projects
// represent a project stored in the database
export interface Project {
    id: number;
    name: string;
    description: string | null;
    owner_id: number;
}

// describes the information needed to create a project
export interface CreateProject {
    name: string;
    description?: string;
}

// represent one user's membership in a project
export interface ProjectMember {
    project_id: number;
    user_id: number;
}

// describes the allowed stages of a code review
export type SubmissionStatus = | "pending" | "in_review" | "approved" | "changes_requested";

// represents a code submission stored in the database 
export interface Submission {
    id: number;
    project_id: number;
    submitter_id: number;
    title: string;
    code: string;
    status: SubmissionStatus;
}

// describes the information a user sends to create a submission
export interface CreateSubmission {
    project_id: number;
    title: string;
    code: string;
}

// represnts feedback saved against a code submission
export interface ReviewComment {
    id: number;
    submission_id: number;
    author_id:  number;
    content: string;
    line_number: number | number;
}

// describes the information required to create a comment
export interface CreateComment {
    content: string;
    line_number?: number | null;
}

// allows users to update comment text, its line number or both
export type UpdateComment = Partial<CreateComment>;