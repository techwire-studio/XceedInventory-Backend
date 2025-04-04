import jwt from 'jsonwebtoken';

const SECRET_KEY = process.env.JWT_SECRET;

// Middleware for both Admin & Super Admin
export const authenticateAdmin = (req, res, next) => {
    const token = req.cookies?.token;

    if (!token) {
        return res.status(403).json({ error: "Access denied. No token provided." });
    }

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.admin = decoded;
        next();
    } catch (error) {
        res.status(401).json({ error: "Invalid token" });
    }
};

// Middleware for Super Admin Only
export const authenticateSuperAdmin = (req, res, next) => {
    if (!req.admin || !req.admin.superAdmin) {
        return res.status(403).json({ error: "Access denied. Super Admin rights required." });
    }
    next();
};
