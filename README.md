# UniversalMeta - PDF Metadata Editor

A secure, full-stack web application for comprehensive PDF metadata editing and security operations. Built with Node.js/Express backend and vanilla JavaScript frontend.

## Features

- **PDF Upload & Processing**: Upload PDFs with automatic sanitization via Ghostscript
- **Metadata Editing**: Edit Basic, EXIF, and XMP metadata fields
- **Security Operations**: 
  - PDF sanitization (remove hidden objects)
  - Permission locking with qpdf
  - SHA-256 document hashing
  - Metadata writing with ExifTool
- **Rate Limiting**: Protection against abuse (10 uploads/hour, 100 requests/15min per IP)
- **Auto-cleanup**: Files automatically deleted after 1 hour
- **Authentication**: Optional HTTP Basic Auth for production

## Quick Start

### Prerequisites

- Node.js 18 or higher
- Docker (for deployment) or local installation of:
  - Ghostscript
  - qpdf
  - ExifTool

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd universalmeta-main
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Edit `.env` with your configuration (see Environment Variables below)

5. Start the server:
```bash
npm start
```

6. Open browser to `http://localhost:3000`

## Environment Variables

Create a `.env` file based on `.env.example`:

### Server Configuration
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment mode: development/production (default: development)

### Authentication (Optional)
- `AUTH_ENABLED` - Enable/disable authentication (true/false)
- `AUTH_USERNAME` - Username for Basic Auth (default: admin)
- `AUTH_PASSWORD` - Password for Basic Auth (default: changeme)

⚠️ **Important**: Set strong credentials in production!

### CORS Configuration
- `CORS_ORIGIN` - Allowed origin for CORS (default: *)
  - Example: `https://yourdomain.com`
  - Use `*` for development only

### Rate Limiting
- `RATE_LIMIT_WINDOW_MS` - General rate limit window in ms (default: 900000 / 15 min)
- `RATE_LIMIT_MAX_REQUESTS` - Max requests per window (default: 100)
- `UPLOAD_RATE_LIMIT_WINDOW_MS` - Upload rate limit window in ms (default: 3600000 / 1 hour)
- `UPLOAD_RATE_LIMIT_MAX_REQUESTS` - Max uploads per window (default: 10)

### File Management
- `MAX_FILE_AGE_MS` - Maximum file age before auto-deletion (default: 3600000 / 1 hour)
- `CLEANUP_INTERVAL_MS` - Cleanup check interval (default: 600000 / 10 min)
- `MAX_CONCURRENT_UPLOADS` - Max simultaneous uploads (default: 5)

## Deployment

### Google Cloud Run (Recommended)

1. Build the Docker image:
```bash
docker build -t universalmeta .
```

2. Tag for Google Cloud:
```bash
docker tag universalmeta gcr.io/YOUR_PROJECT_ID/universalmeta
```

3. Push to Google Container Registry:
```bash
docker push gcr.io/YOUR_PROJECT_ID/universalmeta
```

4. Deploy to Cloud Run:
```bash
gcloud run deploy universalmeta \
  --image gcr.io/YOUR_PROJECT_ID/universalmeta \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="AUTH_ENABLED=true,AUTH_USERNAME=admin,AUTH_PASSWORD=YOUR_SECURE_PASSWORD,CORS_ORIGIN=https://yourdomain.com,NODE_ENV=production"
```

5. Set memory and CPU (optional):
```bash
--memory 1Gi --cpu 1
```

### Docker (Local/Self-Hosted)

1. Build and run:
```bash
docker build -t universalmeta .
docker run -p 3000:3000 --env-file .env universalmeta
```

2. Or use docker-compose (create docker-compose.yml):
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env
    volumes:
      - ./uploads:/usr/src/app/uploads
```

Then run:
```bash
docker-compose up
```

### Render.com

The included `render.yaml` configures deployment:
- Connects to GitHub repository
- Auto-deploys on push
- Uses Docker for deployment
- Health check at `/api/files`

Just connect your repository to Render and it will auto-deploy.

## Security Features

### Implemented

✅ **Rate Limiting**
- 100 requests per 15 minutes (general API)
- 10 uploads per hour per IP
- Configurable via environment variables

✅ **HTTP Security Headers** (via Helmet.js)
- XSS Protection
- Content Type Options
- Frame Options
- HSTS (HTTPS-only)

✅ **File Security**
- PDF sanitization with Ghostscript
- MIME type and extension validation
- 25MB file size limit
- Path traversal prevention

✅ **Authentication**
- Optional HTTP Basic Auth
- Configurable credentials
- Applied to API routes only

✅ **Auto-cleanup**
- Files deleted after 1 hour by default
- Periodic cleanup every 10 minutes
- Cleanup on errors

✅ **Error Handling**
- Global error handler
- File cleanup on failures
- Secure error messages in production

### Best Practices for Production

1. **Enable Authentication**:
```env
AUTH_ENABLED=true
AUTH_USERNAME=your-username
AUTH_PASSWORD=very-strong-password-here
```

2. **Restrict CORS**:
```env
CORS_ORIGIN=https://yourdomain.com
```

3. **Set NODE_ENV**:
```env
NODE_ENV=production
```

4. **Adjust Rate Limits** based on your needs:
```env
UPLOAD_RATE_LIMIT_MAX_REQUESTS=5  # More restrictive
RATE_LIMIT_MAX_REQUESTS=50        # More restrictive
```

## API Documentation

### Upload PDF
```http
POST /api/upload
Content-Type: multipart/form-data

Body: file (PDF)
Response: { id, name, size, path, metadata, ... }
```

### Get All Files
```http
GET /api/files
Response: [{ id, name, size, ... }]
```

### Save Metadata
```http
POST /api/metadata/:fileId
Content-Type: application/json

Body: { metadata: { basic: {...}, exif: {...}, xmp: {...} } }
Response: { id, name, metadata, ... }
```

### Finalize Document
```http
POST /api/finalize/:fileId
Response: { id, name, documentHash, status }
```

Writes metadata, encrypts PDF, locks permissions, generates hash.

### Download PDF
```http
GET /api/download/:fileId
Response: PDF file download
```

### Generate Hash
```http
POST /api/hash/:fileId
Content-Type: application/json

Body: { algorithm: "sha256", scope: "full" }
Response: { hash, name }
```

## File Structure

```
universalmeta-main/
├── server.js              # Main server file
├── package.json           # Dependencies
├── Dockerfile             # Docker configuration
├── render.yaml            # Render.com deployment config
├── .env.example           # Environment template
├── .gitignore            # Git ignore rules
├── README.md             # This file
├── uploads/              # Temporary file storage (auto-created)
│   └── .gitkeep
├── api/
│   └── index.js          # Vercel serverless wrapper
└── frontend/
    └── universalmeta002.html  # Frontend application
```

## Development

### Running Locally

```bash
# Install dependencies
npm install

# Start development server
npm start

# Server runs at http://localhost:3000
```

### Testing

1. **Upload a PDF**: Use the drag-and-drop interface
2. **Edit Metadata**: Click the edit button on uploaded file
3. **Finalize**: Go to Finalize tab and click "Finalize"
4. **Download**: Click download button to get processed PDF

### Debugging

Enable detailed logging by setting:
```env
NODE_ENV=development
```

Check console output for:
- Upload confirmations
- Cleanup operations
- Error messages

## Troubleshooting

### Common Issues

**Upload fails with "Only PDF files allowed"**
- Ensure file is actually a PDF
- Check MIME type is `application/pdf`

**"Failed to sanitize PDF with Ghostscript"**
- Ensure Ghostscript is installed: `gs --version`
- Check Docker image includes Ghostscript

**"Too many uploads from this IP"**
- Rate limit reached (10/hour by default)
- Wait or adjust `UPLOAD_RATE_LIMIT_MAX_REQUESTS`

**Authentication not working**
- Verify `AUTH_ENABLED=true` in .env
- Check credentials match `AUTH_USERNAME` and `AUTH_PASSWORD`
- Clear browser cache if credentials changed

**Files not auto-deleting**
- Check `MAX_FILE_AGE_MS` and `CLEANUP_INTERVAL_MS` settings
- Verify cleanup interval is running (check console logs)

## Performance Considerations

### For 800+ Users

Current configuration supports ~800 concurrent users with:
- Rate limiting: 10 uploads/hour per IP
- File auto-deletion: 1 hour
- In-memory storage (no database needed)
- Cloud Run auto-scaling

### Optimization Tips

1. **Increase rate limits** if needed:
```env
UPLOAD_RATE_LIMIT_MAX_REQUESTS=20
RATE_LIMIT_MAX_REQUESTS=200
```

2. **Reduce file age** for faster cleanup:
```env
MAX_FILE_AGE_MS=1800000  # 30 minutes
```

3. **Increase Cloud Run instances**:
```bash
--min-instances 1 --max-instances 10
```

## Security Considerations

### Current Limitations

- **In-memory storage**: Files lost on restart (acceptable for ephemeral processing)
- **No user isolation**: All users share same file pool (enable AUTH for production)
- **Basic authentication**: Consider JWT for multi-user scenarios

### Future Enhancements

For production with multiple users, consider:
1. JWT-based authentication
2. User-specific file isolation
3. PostgreSQL for file metadata persistence
4. Cloud storage (S3/GCS) for file storage
5. Virus scanning integration (ClamAV)

## License

[Specify your license here]

## Support

For issues or questions, please open an issue on GitHub or contact support.

## Credits

Built with:
- Express.js
- Multer (file uploads)
- Ghostscript (PDF sanitization)
- qpdf (PDF encryption)
- ExifTool (metadata writing)
- Helmet (security headers)
- express-rate-limit (rate limiting)
