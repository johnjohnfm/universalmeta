# Quick Deployment Guide - Render.com

Follow these steps to deploy your UniversalMeta app to Render in ~5 minutes.

## Prerequisites

- GitHub account
- Render account (free at https://render.com)

## Step-by-Step Deployment

### 1. Push to GitHub

If you haven't already, push your code to GitHub:

```bash
# Initialize git if needed
git init

# Add all files
git add .

# Commit
git commit -m "Ready for deployment"

# Add your GitHub repo as remote
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# Push to GitHub
git push -u origin main
```

### 2. Connect to Render

1. Go to https://dashboard.render.com
2. Click **"New +"** button in top right
3. Select **"Blueprint"**
4. Click **"Connect a repository"**
5. Find and select your repository
6. Click **"Connect"**

Render will automatically detect your `render.yaml` file!

### 3. Configure Environment Variables

After connecting, Render will show you environment variables that need values:

**Required - Set these in Render Dashboard:**

1. **AUTH_ENABLED**: `true`
2. **AUTH_USERNAME**: `admin` (or your preferred username)
3. **AUTH_PASSWORD**: `YourVeryStrongPassword123!` (CHANGE THIS!)
4. **CORS_ORIGIN**: 
   - Initially use: `*` 
   - After deployment, update to: `https://your-app-name.onrender.com`

Click **"Apply"** or **"Create Blueprint"**

### 4. Wait for Deployment

- Render will build your Docker image (~3-5 minutes)
- Watch the logs in real-time
- When you see "Live", your app is deployed! 🎉

### 5. Test Your Deployment

1. Click the URL Render provides (e.g., `https://universalmeta-api.onrender.com`)
2. You should see the frontend
3. Try uploading a PDF to test

### 6. Update CORS (Important!)

Once deployed:

1. Go to your service in Render Dashboard
2. Click **"Environment"** tab
3. Update **CORS_ORIGIN** to your actual Render URL:
   ```
   https://universalmeta-api.onrender.com
   ```
   (replace with your actual URL)
4. Click **"Save Changes"**
5. Service will redeploy automatically

## What Happens During Deployment

1. ✅ Docker image built with all dependencies (Ghostscript, qpdf, ExifTool)
2. ✅ Health check configured at `/api/files`
3. ✅ Auto-deploy enabled (pushes to GitHub trigger redeployment)
4. ✅ Environment variables loaded
5. ✅ Rate limiting active (10 uploads/hour per IP)
6. ✅ Auto-cleanup running (files deleted after 1 hour)

## Free Tier Limits

Render's free tier includes:
- ✅ 750 hours/month (enough for one service 24/7)
- ⚠️ Service spins down after 15 min of inactivity
- ⚠️ First request after spin-down takes ~30 seconds

**Upgrade to Starter ($7/month)** for:
- Always-on service (no spin down)
- Faster deployment
- More resources

## Troubleshooting

### Build Failed?
- Check the build logs in Render Dashboard
- Verify your Dockerfile is correct
- Ensure all dependencies are in package.json

### 502 Bad Gateway?
- Service might be starting up (wait 30 seconds)
- Check service logs for errors
- Verify PORT is set to 3000

### Authentication Not Working?
- Verify AUTH_ENABLED=true in environment variables
- Check AUTH_USERNAME and AUTH_PASSWORD are set
- Try clearing browser cache

### Can't Upload Files?
- Check if you've hit rate limit (10 uploads/hour)
- Verify file is actually a PDF
- Check service logs for errors

## Need Help?

- Render Docs: https://render.com/docs
- Your app logs: Render Dashboard → Your Service → Logs
- GitHub Issues: Create an issue in your repository

## Alternative: Manual Deployment

If Blueprint doesn't work, try manual deployment:

1. Render Dashboard → **"New +"** → **"Web Service"**
2. Connect repository
3. Settings:
   - **Name**: universalmeta-api
   - **Environment**: Docker
   - **Build Command**: (leave empty)
   - **Start Command**: (leave empty)
   - **Plan**: Starter or Free
4. Add environment variables manually
5. Click **"Create Web Service"**

---

## Summary

```bash
# 1. Push to GitHub
git push origin main

# 2. Go to Render Dashboard
# 3. New + → Blueprint
# 4. Connect repository
# 5. Set environment variables:
#    - AUTH_ENABLED=true
#    - AUTH_USERNAME=admin
#    - AUTH_PASSWORD=strong-password
#    - CORS_ORIGIN=*
# 6. Click "Apply"
# 7. Wait for deployment
# 8. Update CORS_ORIGIN to your Render URL
# 9. Done! 🚀
```

Your app will be live at: `https://universalmeta-api.onrender.com`
