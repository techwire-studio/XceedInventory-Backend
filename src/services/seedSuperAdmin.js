import bcrypt from 'bcrypt';
import prisma from '../config/db.js';

const seedSuperAdmin = async () => {
    const username = process.env.USER_NAME;
    const password = process.env.PASSWORD;
    const email = process.env.EMAIL;

    if (!username || !password || !email) {
        console.error("Username, password, and email must be provided in environment variables.");
        process.exit(1);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const existingSuperAdmin = await prisma.admin.findFirst({
        where: {
            username,
            superAdmin: true
        }
    });

    if (existingSuperAdmin) {
        console.log("Super Admin already exists with this username.");
        process.exit(1);
    }

    await prisma.admin.create({
        data: {
            username,
            email,
            password: hashedPassword,
            superAdmin: true
        }
    });

    console.log("Super Admin created successfully.");
    process.exit(0);
};

seedSuperAdmin().catch((error) => {
    console.error("Error seeding Super Admin:", error);
    process.exit(1);
});
