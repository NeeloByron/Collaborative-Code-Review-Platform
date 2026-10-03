"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_1 = require("../controllers/authController");
const router = (0, express_1.Router)();
// POST /api/auth/register
router.post("/register", authController_1.registerUser);
// POST /api/auth/login
router.post("/login", authController_1.loginUser);
exports.default = router;
