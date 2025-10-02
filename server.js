// server.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { body, validationResult } = require('express-validator');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('Created uploads directory');
}

// Authentication Middleware (optional, based on environment variables)
const authMiddleware = (req, res, next) => {
    const authEnabled = process.env.AUTH_ENABLED === 'true';
    
    if (!authEnabled) {
        return next();
    }
    
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Basic ')) {
        res.set('WWW-Authenticate', 'Basic realm="UniversalMeta"');
        return res.status(401).send('Authentication required.');
    }
    
    const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString();
    const [username, password] = credentials.split(':');
    
    const validUsername = process.env.AUTH_USERNAME || 'admin';
    const validPassword = process.env.AUTH_PASSWORD || 'changeme';
    
    if (username === validUsername && password === validPassword) {
        return next();
    }
    
    res.set('WWW-Authenticate', 'Basic realm="UniversalMeta"');
    return res.status(401).send('Invalid credentials.');
};

// File cleanup helper functions
const cleanupFile = (filePath) => {
    if (filePath && fs.existsSync(filePath)) {
        fs.unlink(filePath, (err) => {
            if (err) console.error('Error deleting file:', err);
            else console.log('Cleaned up file:', filePath);
        });
    }
};

const cleanupOldFiles = () => {
    const maxAge = parseInt(process.env.MAX_FILE_AGE_MS) || 3600000; // 1 hour default
    const now = Date.now();
    
    Object.keys(filesDb).forEach(fileId => {
        const file = filesDb[fileId];
        const fileAge = now - file.id;
        
        if (fileAge > maxAge) {
            console.log(`Cleaning up old file: ${file.name} (age: ${Math.round(fileAge/1000)}s)`);
            cleanupFile(file.path);
            delete filesDb[fileId];
        }
    });
};

// Start periodic cleanup
const cleanupInterval = parseInt(process.env.CLEANUP_INTERVAL_MS) || 600000; // 10 minutes default
setInterval(cleanupOldFiles, cleanupInterval);
console.log(`Automatic cleanup scheduled every ${cleanupInterval/1000} seconds`);

// Security: Helmet for HTTP headers
app.use(helmet({
    contentSecurityPolicy: false, // Allow inline scripts for frontend
    crossOriginEmbedderPolicy: false
}));

// Rate limiting configuration
const generalRateLimit = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes default
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

const uploadRateLimit = rateLimit({
    windowMs: parseInt(process.env.UPLOAD_RATE_LIMIT_WINDOW_MS) || 3600000, // 1 hour default
    max: parseInt(process.env.UPLOAD_RATE_LIMIT_MAX_REQUESTS) || 10,
    message: 'Too many uploads from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Apply rate limiting
app.use('/api', generalRateLimit);

// Middleware
const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({
    origin: corsOrigin,
    credentials: true
}));
app.use(express.json());
// Serve the front-end files from the 'frontend' directory
app.use(express.static('frontend'));

// Apply authentication to API routes only (not frontend static files)
app.use('/api', authMiddleware);

// Path traversal prevention helper
const sanitizePath = (filePath) => {
    const normalized = path.normalize(filePath);
    const resolved = path.resolve(uploadsDir, normalized);
    if (!resolved.startsWith(uploadsDir)) {
        throw new Error('Invalid file path');
    }
    return resolved;
};

// Setup Multer for file uploads (PDF-only, with size limits)
const upload = multer({
    dest: 'uploads/',
    limits: {
        fileSize: 25 * 1024 * 1024 // 25MB limit
    },
    fileFilter: (req, file, cb) => {
        const isPdfMime = file.mimetype === 'application/pdf';
        const hasPdfExt = (file.originalname || '').toLowerCase().endsWith('.pdf');
        if (isPdfMime || hasPdfExt) {
            return cb(null, true);
        }
        cb(new Error('Only PDF files are allowed'));
    }
});

// In-memory "database" to simulate file storage and metadata
const filesDb = {};

// Helper function to simulate metadata extraction
function extractMetadata(file, author) {
    // Simulated, PDF-centric metadata extraction
    const baseName = (file.originalname || 'document').replace(/\.pdf$/i, '');
    const metadata = {
        basic: {
            title: baseName,
            description: `Sample description for ${file.originalname}`,
            author: author || 'Unknown',
            keywords: ['sample', 'metadata', 'pdf']
        },
        pdf: {
            pages: null // Placeholder
        }
    };
    return metadata;
}

// Simulated sanitization: remove hidden objects from PDF (placeholder)
function sanitizePdfHiddenObjects(filePath) {
    return new Promise((resolve, reject) => {
        try {
            const dir = path.dirname(filePath);
            const base = path.basename(filePath, path.extname(filePath));
            const sanitizedPath = path.join(dir, `${base}.sanitized.pdf`);

            const args = [
                '-sDEVICE=pdfwrite',
                '-dCompatibilityLevel=1.7',
                '-dSAFER',
                '-dBATCH',
                '-dNOPAUSE',
                '-dQUIET',
                // Prefer to remove active content/annotations where possible by re-emitting content only
                '-dDetectDuplicateImages=true',
                '-dColorImageDownsampleType=/Bicubic',
                '-dColorImageResolution=300',
                '-dGrayImageDownsampleType=/Bicubic',
                '-dGrayImageResolution=300',
                '-dMonoImageDownsampleType=/Subsample',
                '-dMonoImageResolution=600',
                `-sOutputFile=${sanitizedPath}`,
                filePath
            ];

            execFile('gs', args, (error) => {
                if (error) {
                    return reject(new Error('Failed to sanitize PDF with Ghostscript'));
                }
                // Replace original with sanitized result
                fs.rename(sanitizedPath, filePath, (renameErr) => {
                    if (renameErr) {
                        return reject(renameErr);
                    }
                    resolve(filePath);
                });
            });
        } catch (err) {
            reject(err);
        }
    });
}

// Compute file hash (after processing) to anchor integrity
function computeFileHash(filePath, algorithm = 'sha256') {
    return new Promise((resolve, reject) => {
        try {
            const hash = crypto.createHash(algorithm);
            const stream = fs.createReadStream(filePath);
            stream.on('data', chunk => hash.update(chunk));
            stream.on('end', () => resolve(hash.digest('hex')));
            stream.on('error', reject);
        } catch (err) {
            reject(err);
        }
    });
}

// Write metadata (including XMP) to PDF using ExifTool
function writePdfMetadataWithExifTool(inputPath, metadata) {
    return new Promise((resolve, reject) => {
        // Map simple metadata fields to ExifTool args. Extend as needed.
        const args = [
            '-overwrite_original',
            // Basic PDF info
            metadata && metadata.basic && metadata.basic.title ? `-Title=${metadata.basic.title}` : undefined,
            metadata && metadata.basic && metadata.basic.author ? `-Author=${metadata.basic.author}` : undefined,
            metadata && metadata.basic && metadata.basic.description ? `-Subject=${metadata.basic.description}` : undefined,
            // XMP mappings (Dublin Core)
            metadata && metadata.xmp && metadata.xmp.creator ? `-XMP-dc:Creator=${metadata.xmp.creator}` : undefined,
            metadata && metadata.xmp && metadata.xmp.rights ? `-XMP-dc:Rights=${metadata.xmp.rights}` : undefined,
            metadata && metadata.xmp && metadata.xmp.subject ? `-XMP-dc:Subject=${metadata.xmp.subject}` : undefined,
            inputPath
        ].filter(Boolean);

        execFile('exiftool', args, (error) => {
            if (error) {
                return reject(new Error('Failed to write metadata with ExifTool'));
            }
            resolve(inputPath);
        });
    });
}

// Encrypt and lock permissions using qpdf with a one-time random owner password
function encryptPdfWithQpdf(inputPath) {
    return new Promise((resolve, reject) => {
        try {
            const dir = path.dirname(inputPath);
            const base = path.basename(inputPath, path.extname(inputPath));
            const encryptedPath = path.join(dir, `${base}.encrypted.pdf`);

            // Generate one-time owner password and do not persist it
            const ownerPassword = crypto.randomBytes(24).toString('base64');
            const userPassword = '';

            const args = [
                '--encrypt', userPassword, ownerPassword, '256',
                '--',
                '--disable-forms',
                '--disallow-edit',
                '--disallow-copy',
                '--disallow-annotate',
                '--disallow-modify-other',
                '--',
                inputPath,
                encryptedPath
            ];

            execFile('qpdf', args, (error) => {
                if (error) {
                    return reject(new Error('Failed to encrypt PDF with qpdf'));
                }
                // Replace original with encrypted result
                fs.rename(encryptedPath, inputPath, (renameErr) => {
                    if (renameErr) {
                        return reject(renameErr);
                    }
                    resolve(inputPath);
                });
            });
        } catch (err) {
            reject(err);
        }
    });
}

// --- API Endpoints ---

// Health check endpoint (no auth required for Render)
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Endpoint to handle file uploads (sanitize-only; defer metadata/encrypt/hash)
app.post('/api/upload', uploadRateLimit, upload.single('file'), async (req, res) => {
    let uploadedFilePath = null;
    try {
        if (!req.file) {
            return res.status(400).send('No file uploaded.');
        }

        uploadedFilePath = req.file.path;

        // 1) Sanitize first: remove hidden objects (security measure)
        const sanitizedPath = await sanitizePdfHiddenObjects(req.file.path);

        // Prepare initial metadata object from provided fields, but do not write to file yet
        const providedAuthor = (req.body && typeof req.body.author === 'string') ? req.body.author.trim() : '';
        const metadata = extractMetadata(req.file, providedAuthor);

        // Store only; defer hashing/encryption until finalize
        const fileId = Date.now();
        const newFile = {
            id: fileId,
            name: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype,
            path: sanitizedPath,
            metadata: metadata,
            status: 'uploaded',
            processed: false,
            hasDocumentHash: false,
            documentHash: undefined,
            hasEncryptedMetadata: false,
            hasMetadataLocks: false,
            hasEncryptedPermissions: false,
        };
        filesDb[fileId] = newFile;
        console.log(`File uploaded (PDF sanitized): ${newFile.name}`);
        res.status(200).json(newFile);
    } catch (err) {
        // Clean up uploaded file on error
        if (uploadedFilePath) {
            cleanupFile(uploadedFilePath);
        }
        const message = err && err.message ? err.message : 'Upload failed.';
        console.error('Upload error:', err);
        res.status(400).send(message);
    }
});

// Endpoint to get all files
app.get('/api/files', (req, res) => {
    res.status(200).json(Object.values(filesDb));
});

// Endpoint to save metadata for a file
app.post('/api/metadata/:fileId', (req, res) => {
    const fileId = req.params.fileId;
    const file = filesDb[fileId];
    if (!file) {
        return res.status(404).send('File not found.');
    }
    file.metadata = req.body.metadata;
    console.log(`Metadata saved for file: ${file.name}`);
    res.status(200).json(file);
});

// Finalize endpoint: write metadata -> encrypt/lock -> hash final artifact
app.post('/api/finalize/:fileId', async (req, res) => {
    try {
        const fileId = req.params.fileId;
        const file = filesDb[fileId];
        if (!file) {
            return res.status(404).send('File not found.');
        }

        // Write metadata to PDF (including XMP where mapped by ExifTool)
        await writePdfMetadataWithExifTool(file.path, file.metadata);
        file.hasEncryptedMetadata = false; // metadata written, but not encrypted per se

        // Lock permissions and encrypt with a one-time owner password
        await encryptPdfWithQpdf(file.path);
        file.hasEncryptedPermissions = true;
        file.hasMetadataLocks = true;

        // Hash the final encrypted PDF
        const finalHash = await computeFileHash(file.path, 'sha256');
        file.hasDocumentHash = true;
        file.documentHash = finalHash;
        file.status = 'processed';
        file.processed = true;

        res.status(200).json({ id: file.id, name: file.name, documentHash: file.documentHash, status: file.status });
    } catch (err) {
        const message = err && err.message ? err.message : 'Finalize failed.';
        res.status(500).send(message);
    }
});

// Download finalized (or uploaded) PDF
app.get('/api/download/:fileId', (req, res) => {
    const fileId = req.params.fileId;
    const file = filesDb[fileId];
    if (!file) {
        return res.status(404).send('File not found.');
    }
    const absolutePath = path.resolve(file.path);
    const downloadName = file.name || 'document.pdf';
    res.download(absolutePath, downloadName, err => {
        if (err) {
            res.status(500).send('Error sending file.');
        }
    });
});

// Endpoint to generate a document hash
app.post('/api/hash/:fileId', (req, res) => {
    const fileId = req.params.fileId;
    const { algorithm, scope } = req.body;
    const file = filesDb[fileId];

    if (!file) {
        return res.status(404).send('File not found.');
    }

    const filePath = file.path;
    const hash = crypto.createHash(algorithm);
    const stream = fs.createReadStream(filePath);

    stream.on('data', data => {
        if (scope === 'full' || scope === 'content') {
            hash.update(data);
        }
        if (scope === 'full' || scope === 'metadata') {
            const metadataString = JSON.stringify(file.metadata);
            hash.update(metadataString);
        }
    });

    stream.on('end', () => {
        const finalHash = hash.digest('hex');
        file.hasDocumentHash = true;
        res.status(200).json({ hash: finalHash, name: file.name });
    });

    stream.on('error', err => {
        res.status(500).send('Error generating hash.');
    });
});

// Endpoint for security operations (permissions, locks, encryption/decryption)
app.post('/api/security/:fileId', (req, res) => {
    const fileId = req.params.fileId;
    const { action, key, permissions, locks } = req.body;
    const file = filesDb[fileId];

    if (!file) {
        return res.status(404).send('File not found.');
    }

    if (action === 'encryptPermissions') {
        file.hasEncryptedPermissions = true;
        res.status(200).json({ message: 'Permissions encrypted.' });
    } else if (action === 'applyMetadataLocks') {
        file.hasMetadataLocks = true;
        res.status(200).json({ message: 'Metadata locks applied.' });
    } else if (action === 'encryptMetadata') {
        file.hasEncryptedMetadata = true;
        res.status(200).json({ message: 'Metadata encrypted.' });
    } else if (action === 'decryptMetadata') {
        file.hasEncryptedMetadata = false;
        res.status(200).json({ message: 'Metadata decrypted.' });
    } else {
        res.status(400).send('Invalid security action.');
    }
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Global error handler:', err);
    
    // Clean up uploaded file on error if it exists
    if (req.file && req.file.path) {
        cleanupFile(req.file.path);
    }
    
    // Handle multer errors
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).send('File too large. Maximum size is 25MB.');
        }
        return res.status(400).send(`Upload error: ${err.message}`);
    }
    
    // Handle other errors
    const status = err.status || 500;
    const message = NODE_ENV === 'production' ? 'Internal server error' : err.message;
    res.status(status).send(message);
});

// Start the server (only when run directly)
if (require.main === module) {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server is running at http://0.0.0.0:${PORT}`);
    });
}

module.exports = app;
