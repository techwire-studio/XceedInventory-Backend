import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
    }
});

export const sendAdminCredentials = async ({ to, username, password }) => {
    const mailOptions = {
        from: `"Xceed Team" <${process.env.GMAIL_USER}>`,
        to,
        subject: 'Your Admin Account Credentials',
        html: `
            <h3>Welcome to Xceed Admin Panel</h3>
            <p><strong>Username:</strong> ${username}</p>
            <p><strong>Password:</strong> ${password}</p>
            <p>Login using these credentials.</p>
        `
    };

    return transporter.sendMail(mailOptions);
};
