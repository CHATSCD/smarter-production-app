# 🚀 Cloud Deployment Guide

Deploy Keith's Superstores Scheduling System to the cloud for FREE!

Your team can access it from **any device** (phones, tablets, computers) with real-time updates.

---

## 📋 Prerequisites

- GitHub account (free)
- Vercel account (free)
- Supabase account (free)

**Total cost: $0/month** ✅

---

## Step 1: Set Up Database (Supabase)

### 1.1 Create Supabase Project

1. Go to https://supabase.com/
2. Click **"Start your project"**
3. Sign up with GitHub
4. Click **"New project"**
5. Fill in:
   - **Name:** `keiths-scheduling`
   - **Database Password:** (choose strong password - save it!)
   - **Region:** Choose closest to you
   - **Pricing Plan:** Free
6. Click **"Create new project"**
7. Wait ~2 minutes for setup

### 1.2 Get Connection String

1. Go to **Project Settings** (gear icon bottom left)
2. Click **Database** in sidebar
3. Scroll to **Connection string**
4. Select **URI** mode
5. Copy the connection string
6. Replace `[YOUR-PASSWORD]` with your database password
7. **Save this** - you'll need it in Step 2!

Example:
```
postgresql://postgres:your_password@db.abc123xyz.supabase.co:5432/postgres
```

### 1.3 Run Database Migration

1. Install PostgreSQL client (if not installed):
   - **macOS:** `brew install postgresql`
   - **Windows:** Download from postgresql.org
   - **Linux:** `sudo apt install postgresql-client`

2. Run migration:
```bash
cd smarter-production-app
psql "YOUR_SUPABASE_CONNECTION_STRING_HERE" -f migrations/001_initial.sql
```

You should see: "✅ Database tables created"

This creates:
- All tables (users, shifts, waste_logs, etc.)
- Seed user accounts
- Initial settings

---

## Step 2: Deploy App (Vercel)

### 2.1 Push Code to GitHub

```bash
# Initialize git (if not already done)
git init
git add .
git commit -m "Initial commit"

# Create GitHub repo and push
gh repo create keiths-scheduling --public --push
# Or manually create repo on github.com and push
```

### 2.2 Deploy to Vercel

1. Go to https://vercel.com/
2. Click **"Sign Up"** → Sign up with GitHub
3. Click **"Add New..."** → **"Project"**
4. Import your GitHub repository `keiths-scheduling`
5. Configure project:
   - **Framework Preset:** Next.js (auto-detected)
   - Click **"Environment Variables"**
   - Add these variables:

```
DATABASE_URL = <paste your Supabase connection string>
JWT_SECRET = <paste random string - see below>
NODE_ENV = production
```

**Generate JWT_SECRET:**
```bash
# On Mac/Linux:
openssl rand -base64 32

# On Windows PowerShell:
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

6. Click **"Deploy"**
7. Wait ~2 minutes

---

## Step 3: Access Your App! 🎉

After deployment completes:

1. Vercel shows you a URL like: `keiths-scheduling.vercel.app`
2. Click the URL to open your app
3. You'll see the login page

### Default Login Accounts

**Admin Account:**
- Email: `admin@keiths.com`
- Password: `password123`

**Manager Account:**
- Email: `manager@keiths.com`
- Password: `password123`

**Employee Accounts:**
- Email: `john@keiths.com` / Password: `password123`
- Email: `jane@keiths.com` / Password: `password123`

⚠️ **Change these passwords immediately!**

---

## Step 4: Install as App (PWA)

Your team can install it like a native app:

### On iPhone/iPad:
1. Open Safari
2. Visit your Vercel URL
3. Tap **Share** button
4. Tap **"Add to Home Screen"**
5. Tap **"Add"**
6. Now it's on your home screen! 📱

### On Android:
1. Open Chrome
2. Visit your Vercel URL
3. Tap menu (3 dots)
4. Tap **"Install app"** or **"Add to Home Screen"**
5. Tap **"Install"**
6. Now it's on your home screen! 📱

### On Desktop (Chrome/Edge):
1. Visit your Vercel URL
2. Click the install icon in address bar
3. Click **"Install"**
4. Now it opens in its own window! 💻

---

## Step 5: Create Real Users

1. Login as admin
2. Go to **Team** tab
3. Click **"+ Add User"**
4. Create accounts for your employees
5. Give them their login credentials

---

## 🔧 Configuration

### Custom Domain (Optional)

Want `schedule.keiths.com` instead of `.vercel.app`?

1. Buy domain (Namecheap, GoDaddy, etc.)
2. In Vercel project → Settings → Domains
3. Add your domain
4. Update DNS records as shown

### Environment Variables

Update anytime in Vercel:
1. Project Settings → Environment Variables
2. Edit values
3. Redeploy

---

## 📊 How It Works

```
┌─────────────────────┐
│   Employee Phone    │
│   (iPhone/Android)  │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│   Your Vercel App   │
│  keiths-*.vercel.app│
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  Supabase Database  │
│   (PostgreSQL)      │
└─────────────────────┘
```

- **Vercel** = Hosts your web app (free)
- **Supabase** = Stores all data (free PostgreSQL)
- **Everyone** accesses same URL, sees same data

---

## 🎯 Features After Deployment

✅ Access from any device  
✅ Real-time updates (manager creates shift → employees see it instantly)  
✅ Works on iPhone, Android, desktop  
✅ Can be installed like a native app  
✅ Automatic backups (Supabase)  
✅ SSL/HTTPS security  
✅ No server maintenance  
✅ Scales automatically  

---

## 🔒 Security

- All data encrypted in transit (HTTPS)
- JWT token authentication
- Passwords hashed with bcrypt
- Row-level security in Supabase
- Environment variables stored securely

**To enhance security:**
1. Change all default passwords
2. Use strong JWT_SECRET
3. Enable 2FA on Vercel/Supabase accounts
4. Regularly update passwords

---

## 🐛 Troubleshooting

**Can't connect to database:**
- Check DATABASE_URL in Vercel env variables
- Ensure password is correct (no special chars in URL)
- Check Supabase project is running

**Login not working:**
- Clear browser cache
- Check JWT_SECRET is set
- Verify users exist in database

**Employees can't see shifts:**
- Check they're logged into correct account
- Verify shifts are created for correct store_id
- Check browser console for errors

**PWA won't install:**
- Must be HTTPS (Vercel handles this)
- Check manifest.json exists in /public
- Try different browser

---

## 📱 Share With Your Team

Send this message to employees:

```
🎉 Our new scheduling system is live!

Visit: [YOUR-VERCEL-URL]

For the best experience, install it as an app:
- iPhone: Open in Safari → Share → Add to Home Screen
- Android: Open in Chrome → Menu → Install app

Your login:
Email: [their-email]@keiths.com
Password: [temporary-password]

Please change your password after first login!
```

---

## 🆘 Need Help?

- **Vercel Docs:** https://vercel.com/docs
- **Supabase Docs:** https://supabase.com/docs
- **Next.js Docs:** https://nextjs.org/docs

---

## 🎊 You're Done!

Your scheduling system is now live in the cloud!

**Next Steps:**
1. Login and change admin password
2. Create employee accounts
3. Share login info with your team
4. Start creating shifts!

Enjoy your multi-device, real-time scheduling system! 🚀
