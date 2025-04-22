import multer from 'multer';
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'application/pdf' ||
        file.mimetype === 'application/msword' ||
        file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only PDF, DOC, and DOCX are allowed.'), false); // Reject file
    }
};

const uploadResume = multer({
    storage: storage,
    limits: {
        fileSize: 1024 * 1024 * 10 // 10 MB limit
    },
    fileFilter: fileFilter
});

export default uploadResume;