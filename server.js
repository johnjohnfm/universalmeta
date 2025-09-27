// server.js

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
// Serve the front-end files from the 'frontend' directory
app.use(express.static('frontend'));

// Setup Multer for file uploads
const upload = multer({ dest: 'uploads/' });

// In-memory "database" to simulate file storage and metadata
const filesDb = {};

// Helper function to simulate metadata extraction
function extractMetadata(file) {
    const fileExtension = file.originalname.split('.').pop().toLowerCase();
    const metadata = {
        basic: {
            title: file.originalname.split('.')[0],
            description: `Sample description for ${file.originalname}`,
            author: 'API Generator',
            keywords: ['sample', 'metadata', fileExtension]
        },
        exif: {}, // Placeholder
        xmp: {}   // Placeholder
    };
    if (['jpg', 'jpeg', 'png', 'gif'].includes(fileExtension)) {
        metadata.exif = {
            make: 'Simulated Canon',
            model: 'Simulated EOS 5D',
            latitude: '40.7128',
            longitude: '-74.0060'
        };
    }
    return metadata;
}

// --- API Endpoints ---

// Endpoint to handle file uploads
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }
    const fileId = Date.now();
    const newFile = {
        id: fileId,
        name: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        path: req.file.path,
        metadata: extractMetadata(req.file),
        status: 'processed',
        processed: true,
        hasDocumentHash: false,
        hasEncryptedMetadata: false,
        hasMetadataLocks: false,
        hasEncryptedPermissions: false,
    };
    filesDb[fileId] = newFile;
    console.log(`File uploaded: ${newFile.name}`);
    res.status(200).json(newFile);
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

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
