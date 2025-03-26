import bcrypt from 'bcrypt';
import prisma from '../config/db.js';

const seedAdmin = async () => {
    const username = process.env.USER_NAME;
    const password = process.env.PASSWORD;
    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.admin.create({
        data: { username, password: hashedPassword }
    });

    console.log("Admin user created successfully.");
    process.exit(0);
};

seedAdmin().catch((error) => {
    console.error("Error seeding admin:", error);
    process.exit(1);
});
