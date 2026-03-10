# 🏢 LeaveOS — Deployment Guide

## Deploy to Render (Free)

### Step 1 — Push to GitHub
1. Create a new repo at https://github.com/new
2. Run these commands in your project folder:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/leaveos.git
git push -u origin main
```

### Step 2 — Deploy on Render
1. Go to https://render.com and sign up (free)
2. Click **New → Web Service**
3. Connect your GitHub account and select your repo
4. Verify these settings:
   - **Runtime:** Python
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn app:app -c gunicorn.conf.py`
5. Under **Environment Variables**, add:
   - `GEMINI_API_KEY` → your Gemini API key
6. Click **Create Web Service**

Render will build and deploy in ~2 minutes.
You get a live URL like: https://leaveos.onrender.com

---

## Run Locally
```bash
pip install -r requirements.txt
python app.py
# Visit http://localhost:5000
```

## Default Login Credentials
| Role | Email | Password |
|------|-------|----------|
| Manager | sarah@company.com | manager123 |
| Manager | james@company.com | manager123 |
| Employee | alex@company.com | emp123 |

OTP codes print to the server console/logs during login.
On Render, check the Logs tab in your service dashboard.
