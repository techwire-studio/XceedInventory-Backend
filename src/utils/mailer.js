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

export const sendCareerApplicationNotification = async ({
    recipients,
    applicantName,
    applicantEmail,
    areaOfInterest,
    resumeFile 
}) => {
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        console.warn("No admin recipients provided for career application notification.");
        return;
    }

    const attachments = [];
    if (resumeFile && resumeFile.buffer && resumeFile.originalname) {
        attachments.push({
            filename: resumeFile.originalname,
            content: resumeFile.buffer,       
            contentType: resumeFile.mimetype
        });
    } else {
        console.warn(`Resume file object was invalid or missing for applicant ${applicantEmail}. Email sent without attachment.`);
    }

    const mailOptions = {
        from: `"Xceed Careers" <${process.env.GMAIL_USER}>`,
        bcc: recipients,
        subject: `New Job Application Received - ${applicantName}`,
        html: `
            <h3>A new job application has been submitted via the website.</h3>
            <p><strong>Applicant Name:</strong> ${applicantName}</p>
            <p><strong>Applicant Email:</strong> ${applicantEmail}</p>
            <p><strong>Area of Interest:</strong> ${areaOfInterest}</p>
            <p><strong>Resume:</strong> See attached file.</p>
            <p>Please review the application.</p>
        `,
        attachments: attachments 
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`Career application notification email sent successfully to ${recipients.length} admins. Message ID: ${info.messageId}`);
        return info;
    } catch (error) {
        console.error("Error sending career application notification email:", error);
    }
};

export const sendContactInquiryNotification = async ({ recipients, fullName, companyName, email, phone, productCategory, message }) => {
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        console.warn("No admin recipients provided for contact inquiry notification.");
        return;
    }

    const mailOptions = {
        from: `"Xceed Website Contact" <${process.env.GMAIL_USER}>`,
        bcc: recipients,
        subject: `New Contact Inquiry from ${fullName}`,
        html: `
            <h3>A new inquiry has been submitted via the website contact form.</h3>
            <p><strong>Full Name:</strong> ${fullName}</p>
            ${companyName ? `<p><strong>Company Name:</strong> ${companyName}</p>` : ''}
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Phone Number:</strong> ${phone}</p>
            ${productCategory ? `<p><strong>Product Category:</strong> ${productCategory}</p>` : ''}
            <p><strong>Message:</strong></p>
            <p style="white-space: pre-wrap;">${message}</p>
            <p>Please follow up as needed.</p>
        `
    };

     try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`Contact inquiry notification email sent successfully to ${recipients.length} admins. Message ID: ${info.messageId}`);
        return info;
    } catch (error) {
        console.error("Error sending contact inquiry notification email:", error);
    }
};

// export const sendCareerApplicationNotification = async ({ recipients, applicantName, applicantEmail, areaOfInterest, resumeUrl }) => {
//     if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
//         console.warn("No admin recipients provided for career application notification.");
//         return;
//     }

//     const mailOptions = {
//         from: `"Xceed Careers" <${process.env.GMAIL_USER}>`,
//         bcc: recipients,
//         subject: `New Job Application Received - ${applicantName}`,
//         html: `
//             <h3>A new job application has been submitted via the website.</h3>
//             <p><strong>Applicant Name:</strong> ${applicantName}</p>
//             <p><strong>Applicant Email:</strong> ${applicantEmail}</p>
//             <p><strong>Area of Interest:</strong> ${areaOfInterest}</p>
//             <p><strong>Resume Link:</strong> <a href="${resumeUrl}" target="_blank">View Resume</a></p>
//             <p>Please review the application.</p>
//         `
//     };

//     try {
//         const info = await transporter.sendMail(mailOptions);
//         console.log(`Career application notification email sent successfully to ${recipients.length} admins. Message ID: ${info.messageId}`);
//         return info;
//     } catch (error) {
//         console.error("Error sending career application notification email:", error);
//     }
// };