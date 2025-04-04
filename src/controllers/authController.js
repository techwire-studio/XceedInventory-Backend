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
            secure: process.env.NODE_ENV === "production",
            sameSite: "None",
            maxAge: 2 * 60 * 60 * 1000
        });

        res.json({ message: "Login successful", role: admin.superAdmin ? "Super Admin" : "Admin" });
    } catch (error) {
        res.status(500).json({ error: "Authentication failed", details: error.message });
    }
};

export const adminLogout = (req, res) => {
    res.clearCookie("token", {
        httpOnly: true,
        sameSite: "None",
        secure: process.env.NODE_ENV === "production"
    });
    res.json({ message: "Logout successful" });
};
