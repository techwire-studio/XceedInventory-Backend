import prisma from '../config/db.js';
import { sendAdminCredentials } from '../utils/mailer.js';
import { nanoid } from 'nanoid';
import bcrypt from 'bcrypt';
export const createAdmin = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: 'Valid email is required' });
        }

        const username = `admin_${Math.floor(1000 + Math.random() * 9000)}`;
        const password = nanoid(10);
        const hashedPassword = await bcrypt.hash(password, 10);

        const newAdmin = await prisma.admin.create({
            data: {
                username,
                password: hashedPassword,
                email,
                superAdmin: false
            }
        });

        await sendAdminCredentials({ to: email, username, password });

        res.status(201).json({ message: 'Admin created and credentials sent via email.' });
    } catch (err) {
        console.error("Error creating admin:", err);
        res.status(500).json({ error: 'Failed to create admin', details: err.message });
    }
};
