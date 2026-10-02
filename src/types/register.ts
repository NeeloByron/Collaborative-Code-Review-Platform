export type UserRole = "reviewer" | "submitter"; 

// Represent a user in the system
export interface User {
    id: number;
    name: string;
    email: string;
    password_hash: string;
    role: UserRole;
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