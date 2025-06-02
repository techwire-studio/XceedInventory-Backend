import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
const CLIENT_COOKIE_NAME = 'client_token';

export const authenticateClient = (req, res, next) => {
    const token = req.cookies?.[CLIENT_COOKIE_NAME];

    if (!token) {
        return res.status(401).json({ error: "Access denied. No token provided. Please log in." });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role !== 'client') {
            console.warn('Token with incorrect role presented as client token:', decoded);
            return res.status(403).json({ error: "Forbidden. Invalid token role." });
        }

        req.client = {
            id: decoded.id,
            email: decoded.email,
            role: decoded.role
        };
        next();
    } catch (error) {
        console.error("Client authentication error:", error.message);
        if (error.name === 'TokenExpiredError') {
            res.clearCookie(CLIENT_COOKIE_NAME, {
                httpOnly: true,
                secure: true,
                sameSite: 'None',
                path: '/',
            });
            return res.status(401).json({ error: "Token expired. Please log in again." });
        }
        res.clearCookie(CLIENT_COOKIE_NAME, {
            httpOnly: true,
            secure: true,
            sameSite: 'None',
            path: '/',
        });
        return res.status(401).json({ error: "Invalid token. Please log in." });
    }
};