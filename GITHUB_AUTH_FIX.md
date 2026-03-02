# Fix GitHub Authentication Error

## The Problem
GitHub no longer accepts passwords for git operations. You need either:
1. **SSH keys** (recommended - easier long-term)
2. **Personal Access Token** (PAT)

## Solution 1: Use SSH (Recommended)

### Step 1: Check if you have SSH keys
```bash
ls -al ~/.ssh
```

If you see `id_rsa.pub` or `id_ed25519.pub`, you have keys. Skip to Step 3.

### Step 2: Create SSH keys (if needed)
```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
# Press Enter to accept default location
# Press Enter twice for no passphrase (or set one if you prefer)
```

### Step 3: Copy your public key
```bash
cat ~/.ssh/id_ed25519.pub
# Or if you have RSA:
cat ~/.ssh/id_rsa.pub
```

Copy the entire output (starts with `ssh-ed25519` or `ssh-rsa`)

### Step 4: Add key to GitHub
1. Go to https://github.com/settings/keys
2. Click **"New SSH key"**
3. Title: `MacBook Pro`
4. Paste your public key
5. Click **"Add SSH key"**

### Step 5: Change remote to SSH
```bash
cd /Users/aa/CascadeProjects/windsurf-project

# Remove HTTPS remote
git remote remove origin

# Add SSH remote
git remote add origin git@github.com:snaphomz/superagent.git

# Push code
git push -u origin main
```

---

## Solution 2: Use Personal Access Token (Faster)

### Step 1: Create PAT
1. Go to https://github.com/settings/tokens
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Note: `SuperAgent deployment`
4. Expiration: `90 days` (or longer)
5. Select scopes:
   - ✅ `repo` (all repo permissions)
6. Click **"Generate token"**
7. **COPY THE TOKEN** (you won't see it again!)

### Step 2: Push with token
```bash
cd /Users/aa/CascadeProjects/windsurf-project

# Push using token as password
git push -u origin main

# When prompted:
# Username: snaphomz
# Password: <paste your token here>
```

### Step 3: Save credentials (optional)
```bash
# macOS will offer to save in Keychain
# Click "Always Allow" when prompted
```

---

## Quick Fix (Use This Now)

**I recommend SSH (Solution 1)** because it's permanent and easier.

But if you want to push RIGHT NOW:
1. Use **Solution 2** (Personal Access Token)
2. Takes 2 minutes
3. Works immediately

---

## After Authentication Works

Once you can push, you'll see:
```
Enumerating objects: 45, done.
Counting objects: 100% (45/45), done.
Delta compression using up to 8 threads
Compressing objects: 100% (38/38), done.
Writing objects: 100% (45/45), 50.23 KiB | 5.02 MiB/s, done.
Total 45 (delta 5), reused 0 (delta 0), pack-reused 0
To github.com:snaphomz/superagent.git
 * [new branch]      main -> main
Branch 'main' set up to track remote branch 'main' from 'origin'.
```

Then you can proceed to deploy on Render!
