import prisma from '../config/db.js';
import { sendAdminCredentials } from '../utils/mailer.js';
import { nanoid } from 'nanoid';
import bcrypt from 'bcrypt';

export const createAdmin = async (req, res) => {
    try {
        const { email, name } = req.body;

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: 'Valid email is required' });
        }
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return res.status(400).json({ error: 'Name is required and must be a non-empty string' });
        }
        //check if username already exists and generate a new one if it does
        let username;
        let usernameExists = true;
        while (usernameExists) {
            username = `admin_${Math.floor(1000 + Math.random() * 9000)}`;
            const existingAdmin = await prisma.admin.findUnique({ where: { username } });
            if (!existingAdmin) {
                usernameExists = false;
            }
        }

        const password = nanoid(10);
        const hashedPassword = await bcrypt.hash(password, 10);

        const newAdmin = await prisma.admin.create({
            data: {
                username,
                password: hashedPassword,
                email,
                name,
                superAdmin: false
            }
        });
        await sendAdminCredentials({ to: email, username, password });
        const { password: _, ...adminData } = newAdmin;

        res.status(201).json({
            message: 'Admin created and credentials sent via email.',
            admin: adminData
        });
    } catch (err) {
        console.error("Error creating admin:", err);
        if (err.code === 'P2002') {
            const target = err.meta?.target;
            const field = target ? target.join(', ') : 'email or username';
             return res.status(409).json({ error: `Admin with this ${field} already exists.` });
        }
        res.status(500).json({ error: 'Failed to create admin', details: err.message });
    }
};

export const deleteAdmin = async (req, res) => {
    try {
        const idParam = req.params.id; 
        const requestingAdminId = req.admin?.id;
        if (!idParam) {
             return res.status(400).json({ error: 'Admin ID parameter is required.' });
        }
        const id = parseInt(idParam, 10);
        if (isNaN(id)) {
             return res.status(400).json({ error: 'Invalid Admin ID format. ID must be an integer.' });
        }
        if (requestingAdminId && id === requestingAdminId) {
             return res.status(403).json({ error: 'Super admins cannot delete their own account.' });
        }
        const adminToDelete = await prisma.admin.findUnique({
            where: { id: id }
        });
        if (!adminToDelete) {
            return res.status(404).json({ error: 'Admin not found.' });
        }
        await prisma.admin.delete({
            where: { id: id } 
        });
        res.status(200).json({ message: 'Admin deleted successfully.' });
    } catch (err) {
        console.error("Error deleting admin:", err);
        if (err.code === 'P2025') {
            return res.status(404).json({ error: 'Admin not found.' });
        }
        res.status(500).json({ error: 'Failed to delete admin', details: err.message });
    }
};

export const getAllAdmins = async (req, res) => {
    try {
        const admins = await prisma.admin.findMany({
            where: {
                superAdmin: false 
            },
            select: {
                id: true,
                username: true,
                email: true,
                name: true,
                createdAt: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        res.status(200).json(admins);

    } catch (err) {
        console.error("Error fetching admins:", err);
        res.status(500).json({ error: 'Failed to fetch admins', details: err.message });
    }
};