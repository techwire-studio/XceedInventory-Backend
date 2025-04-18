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

export const sendOrderNotificationToAdmins = async ({ recipients, orderId, customerName }) => {
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        console.warn("No admin recipients provided for order notification.");
        return;
    }

    const mailOptions = {
        from: `"Xceed Order System" <${process.env.GMAIL_USER}>`,
        bcc: recipients, // Use BCC to send to all admins without revealing addresses
        subject: `New Order Placed - ID: ${orderId}`,
        html: `
            <h3>A new enquiry has been received on Xceed.</h3>
            <p><strong>Order ID:</strong> ${orderId}</p>
            <p><strong>Placed By:</strong> ${customerName}</p>
            <p>Please log in to the admin panel to view the complete order details.</p>
        `
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`Order notification email sent successfully to ${recipients.length} admins. Message ID: ${info.messageId}`);
        return info;
    } catch (error) {
        console.error("Error sending order notification email to admins:", error);
    }
};
