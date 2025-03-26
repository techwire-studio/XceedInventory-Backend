import jwt from 'jsonwebtoken';

const SECRET_KEY = process.env.JWT_SECRET;

export const authenticateAdmin = (req, res, next) => {
    const token = req.cookies?.token; // Get token from cookies

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
