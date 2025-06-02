// src/routes/clientAuthRoutes.js
import express from 'express';
import {
    signupClient,
    loginClient,
    logoutClient,
    verifyClientToken
} from '../controllers/clientAuthController.js';

const router = express.Router();

// @route   POST api/client/auth/signup
// @desc    Register a new client
// @access  Public
router.post("/signup", signupClient);

// @route   POST api/client/auth/login
// @desc    Authenticate client & get token
// @access  Public
router.post("/login", loginClient);

// @route   POST api/client/auth/logout
// @desc    Logout client (clear cookie)
// @access  Public (or protected if you only want logged-in users to "logout")
router.post("/logout", logoutClient);

// @route   GET api/client/auth/verify-token
// @desc    Verify if client token is valid
// @access  Public (as it checks cookie and returns auth state)
router.get("/verify-token", verifyClientToken);

export default router;