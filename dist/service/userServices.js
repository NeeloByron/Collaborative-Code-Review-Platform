"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUser = exports.findUserByEmail = void 0;
const database_1 = require("../config/database");
// find a user by their email 
const findUserByEmail = (email) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield (0, database_1.query)("SELECT * FROM users WHERE email = $1", [email]);
    return result.rows[0] || null;
});
exports.findUserByEmail = findUserByEmail;
// create a new user 
const createUser = (user, passwordHash) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield (0, database_1.query)(`INSERT INTO users (name, email, password_hash, role) 
         VALUES ($1, $2, $3, $4)
         RETURNING *`, [
        user.name,
        user.email,
        passwordHash,
        user.role
    ]);
    return result.rows[0];
});
exports.createUser = createUser;
