import prisma from '../config/db.js';
import { bucket } from '../config/firebase.js';
import { sendCareerApplicationNotification, sendContactInquiryNotification } from '../utils/mailer.js';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';

const uploadFileToFirebase = async (file) => {
    if (!file || !file.buffer || !file.originalname || !file.mimetype) {
        throw new Error('Invalid file object provided for upload. Missing buffer, originalname, or mimetype.');
    }

    const uniqueFilename = `${uuidv4()}-${file.originalname}`;
    const destination = `resumes/${uniqueFilename}`;
    const fileUpload = bucket.file(destination);
    const stream = fileUpload.createWriteStream({
        metadata: {
            contentType: file.mimetype,
        },
        resumable: false,
    });

    return new Promise((resolve, reject) => {
        stream.on('error', (err) => {
            console.error('Firebase Upload Stream Error:', err);
            reject(new Error(`Failed to upload resume file: ${err.message}`));
        });

        stream.on('finish', async () => {
            try {

                await fileUpload.makePublic();
                const publicUrl = `https://storage.googleapis.com/${bucket.name}/${destination}`;
                console.log(`File uploaded successfully: ${publicUrl}`);
                resolve(publicUrl);
            } catch (err) {
                console.error('Firebase Make Public/Get URL Error:', err);
                reject(new Error(`Failed to process uploaded file after upload: ${err.message}`));
            }
        });

        // Start the upload by writing the buffer to the stream
        stream.end(file.buffer);
    });
};

export const handleCareerApplication = async (req, res) => {
    const { firstName, lastName, phoneNumber, email, areaOfInterest, referred } = req.body;
    const resumeFile = req.file;

    if (!firstName || !phoneNumber || !email || !areaOfInterest || referred === undefined) {
        return res.status(400).json({ error: 'Missing required fields (First Name, Phone, Email, Area of Interest, Referred status).' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Invalid email format.' });
    }
    if (!resumeFile) {
        return res.status(400).json({ error: 'Resume file is required.' });
    }

    const isReferred = referred === 'Yes' || referred === 'true' || referred === true;


    try {
        // console.log(`Uploading resume for ${email}...`);
        // const resumeUrl = await uploadFileToFirebase(resumeFile);
        // console.log(`Resume uploaded for ${email}, URL: ${resumeUrl}`);

        console.log(`Saving application data for ${email} to database...`);
        const newApplication = await prisma.careerApplication.create({
            data: {
                firstName: firstName.trim(),
                lastName: lastName ? lastName.trim() : null,
                phoneNumber: phoneNumber.trim(),
                email: email.trim().toLowerCase(),
                areaOfInterest: areaOfInterest.trim(),
                referred: isReferred,
                // resumeUrl: resumeUrl,
            }
        });
        console.log(`Application saved for ${email}, ID: ${newApplication.id}`);
        console.log(`Attempting to send notification email for application ID: ${newApplication.id}`);
        try {
            const adminsToNotify = await prisma.admin.findMany({
                select: { email: true }
            });
            const adminEmails = adminsToNotify.map(admin => admin.email);

            if (adminEmails.length > 0) {
                await sendCareerApplicationNotification({
                    recipients: adminEmails,
                    applicantName: `${newApplication.firstName} ${newApplication.lastName || ''}`.trim(),
                    applicantEmail: newApplication.email,
                    areaOfInterest: newApplication.areaOfInterest,
                    resumeFile: resumeFile,
                });
                console.log(`Notification email queued for ${adminEmails.length} admins for application ID: ${newApplication.id}`);
            } else {
                console.log("No admin emails found in database to notify.");
            }
        } catch (emailError) {
            console.error(`Failed to send career application notification email for application ID ${newApplication.id}:`, emailError);
        }

        res.status(201).json({ message: 'Application submitted successfully!', applicationId: newApplication.id });

    } catch (error) {
        console.error("Error handling career application:", error);
        if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
            return res.status(409).json({ error: `An application with this email address already exists.` });
        }
        if (error instanceof multer.MulterError) {
            return res.status(400).json({ error: `File upload error: ${error.message}` });
        }
        if (error.message.startsWith('Invalid file type')) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to submit application due to a server error.', details: error.message });
    }
};

export const handleContactInquiry = async (req, res) => {
    const { fullName, companyName, phoneNumber, email, productCategory, message } = req.body;

    if (!fullName || !phoneNumber || !email || !message) {
        return res.status(400).json({ error: 'Missing required fields (Full Name, Phone, Email, Message).' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Invalid email format.' });
    }

    try {
        console.log(`Saving contact inquiry for ${email} to database...`);
        const newInquiry = await prisma.contactInquiry.create({
            data: {
                fullName: fullName.trim(),
                companyName: companyName ? companyName.trim() : null,
                phoneNumber: phoneNumber.trim(),
                email: email.trim().toLowerCase(),
                productCategory: productCategory ? productCategory.trim() : null,
                message: message.trim(),
            }
        });
        console.log(`Contact inquiry saved for ${email}, ID: ${newInquiry.id}`);
        console.log(`Attempting to send notification email for inquiry ID: ${newInquiry.id}`);
        try {
            const adminsToNotify = await prisma.admin.findMany({
                select: { email: true }
            });
            const adminEmails = adminsToNotify.map(admin => admin.email);

            if (adminEmails.length > 0) {
                await sendContactInquiryNotification({
                    recipients: adminEmails,
                    fullName: newInquiry.fullName,
                    companyName: newInquiry.companyName,
                    email: newInquiry.email,
                    phone: newInquiry.phoneNumber,
                    productCategory: newInquiry.productCategory,
                    message: newInquiry.message,
                });
                console.log(`Notification email queued for ${adminEmails.length} admins for inquiry ID: ${newInquiry.id}`);
            } else {
                console.log("No admin emails found in database to notify.");
            }
        } catch (emailError) {
            console.error(`Failed to send contact inquiry notification email for inquiry ID ${newInquiry.id}:`, emailError);
        }
        res.status(201).json({ message: 'Inquiry submitted successfully!', inquiryId: newInquiry.id });

    } catch (error) {
        console.error("Error handling contact inquiry:", error);
        res.status(500).json({ error: 'Failed to submit inquiry due to a server error.', details: error.message });
    }
};