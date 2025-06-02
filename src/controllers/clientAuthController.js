// src/controllers/clientAuthController.js
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../config/db.js';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_EXPIRES_IN = '2h'; // Client token expiry time
const COOKIE_EXPIRES_IN_MS = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
const CLIENT_COOKIE_NAME = 'client_token';

// --- Client Signup ---
export const signupClient = async (req, res) => {
    const { email, password, firstName, lastName, phoneNumber } = req.body;

    // 1. Validate input
    if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: "Invalid email format." });
    }
    // Add more password validation if needed (e.g., minimum length)
    if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters long." });
    }

    try {
        // 2. Check if email or phone number already exists
        const existingClientByEmail = await prisma.client.findUnique({ where: { email } });
        if (existingClientByEmail) {
            return res.status(409).json({ error: "Client with this email already exists." });
        }

        if (phoneNumber) {
            const existingClientByPhone = await prisma.client.findUnique({ where: { phoneNumber } });
            if (existingClientByPhone) {
                return res.status(409).json({ error: "Client with this phone number already exists." });
            }
        }

        // 3. Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // 4. Create client
        const newClient = await prisma.client.create({
            data: {
                email: email.toLowerCase(),
                password: hashedPassword,
                firstName,
                lastName,
                phoneNumber,
            },
        });

        // 5. Generate JWT
        const tokenPayload = {
            id: newClient.id,
            email: newClient.email,
            role: 'client', // Clearly identify the role
        };
        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: TOKEN_EXPIRES_IN });

        // 6. Set cookie
        res.cookie(CLIENT_COOKIE_NAME, token, {
            httpOnly: true,
            secure: true, // Use secure cookies in production
            sameSite: 'None', // Adjust for cross-site context if needed
            maxAge: COOKIE_EXPIRES_IN_MS,
            path: '/',
        });

        // 7. Return success response (excluding password)
        const { password: _, ...clientData } = newClient;
        res.status(201).json({
            message: "Client registered successfully.",
            client: clientData,
            // token: token // Optionally return token in body if not solely relying on cookies
        });

    } catch (error) {
        console.error("Client signup error:", error);
        if (error.code === 'P2002' && error.meta?.target) { // Prisma unique constraint violation
            const field = error.meta.target.join(', ');
            return res.status(409).json({ error: `Client with this ${field} already exists.` });
        }
        res.status(500).json({ error: "Failed to register client.", details: error.message });
    }
};

// --- Client Login ---
export const loginClient = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required." });
    }

    try {
        const client = await prisma.client.findUnique({ where: { email: email.toLowerCase() } });
        if (!client) {
            return res.status(401).json({ error: "Invalid credentials." });
        }

        const passwordMatch = await bcrypt.compare(password, client.password);
        if (!passwordMatch) {
            return res.status(401).json({ error: "Invalid credentials." });
        }

        const tokenPayload = {
            id: client.id,
            email: client.email,
            role: 'client',
        };
        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: TOKEN_EXPIRES_IN });

        res.cookie(CLIENT_COOKIE_NAME, token, {
            httpOnly: true,
            secure: true,
            sameSite: 'None',
            maxAge: COOKIE_EXPIRES_IN_MS,
            path: '/',
        });

        const { password: _, ...clientData } = client;
        res.status(200).json({
            message: "Login successful.",
            client: clientData,
            // token: token // Optionally return token
        });

    } catch (error) {
        console.error("Client login error:", error);
        res.status(500).json({ error: "Authentication failed.", details: error.message });
    }
};

// --- Client Logout ---
export const logoutClient = (req, res) => {
    res.clearCookie(CLIENT_COOKIE_NAME, {
        httpOnly: true,
        secure: true,
        sameSite: 'None',
        path: '/',
    });
    res.status(200).json({ message: "Logout successful." });
};

// --- Verify Client Token ---
export const verifyClientToken = (req, res) => {
    const token = req.cookies?.[CLIENT_COOKIE_NAME];

    if (!token) {
        // No token doesn't necessarily mean an error for this specific endpoint,
        // it just means user is not authenticated. Frontend can use this info.
        return res.status(200).json({ isAuthenticated: false, client: null });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        // Optionally fetch fresh client data if needed, or just use decoded payload
        // For simplicity, we'll use the decoded payload here.
        // Ensure the role is 'client' if you share JWT_SECRET with admin tokens
        if (decoded.role !== 'client') {
            return res.status(403).json({ isAuthenticated: false, error: "Invalid token type." });
        }
        const clientPayload = {
            id: decoded.id,
            email: decoded.email,
            role: decoded.role
            // Add other non-sensitive fields from token if you put them there
        };
        res.status(200).json({ isAuthenticated: true, client: clientPayload });
    } catch (error) {
        console.error("Client token verification error:", error.message);
        // If token is invalid (expired, tampered), clear the cookie
        res.clearCookie(CLIENT_COOKIE_NAME, {
            httpOnly: true,
            secure: true,
            sameSite: 'None',
            path: '/',
        });
        if (error.name === 'TokenExpiredError') {
            return res.status(200).json({ isAuthenticated: false, error: "Token expired.", client: null });
        }
        return res.status(200).json({ isAuthenticated: false, error: "Invalid token.", client: null });
    }
};