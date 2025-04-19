import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../config/db.js';

const SECRET_KEY = process.env.JWT_SECRET;

export const adminLogin = async (req, res) => {
    const { username, password } = req.body;

    try {
        const admin = await prisma.admin.findUnique({ where: { username } });
        if (!admin) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const passwordMatch = await bcrypt.compare(password, admin.password);
        if (!passwordMatch) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const token = jwt.sign(
            { id: admin.id, username: admin.username, superAdmin: admin.superAdmin },
            SECRET_KEY,
            { expiresIn: "2h" }
        );

        res.cookie("token", token, {
            httpOnly: true,
            secure: true,
            sameSite: "None",
            maxAge: 2 * 60 * 60 * 1000
        });

        res.json({
            message: "Login successful",
            username: admin.username,
            role: admin.superAdmin ? "Super Admin" : "Admin"
        });
    } catch (error) {
        res.status(500).json({ error: "Authentication failed", details: error.message });
    }
};

export const adminLogout = (req, res) => {
    res.clearCookie("token", {
        httpOnly: true,
        secure: true,
        sameSite: "None",
        path: '/'
    });
    res.json({ message: "Logout successful" });
};

export const verifyToken = (req, res) => {
    const token = req.cookies?.token;
    console.log(token)
    let username;
    let role;
    console.log("Token:", token);
    if (!token) {
        return res.status(403).json({ error: "Access denied. No token provided." });
    }
    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: "Invalid token" });
        }
        username = decoded.username;
        console.log("Decoded Token:", decoded);
        role = decoded.superAdmin ? "Super Admin" : "Admin";
    })
    res.json({ username, role, message: "Token is valid" });
}