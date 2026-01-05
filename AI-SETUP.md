# 🤖 AI Setup Guide - 3-Tier Fallback System

## 🏆 **Recommended Setup: Gemini + HuggingFace + Local**

Your app now has a **smart 3-tier fallback system**:
- **Tier 1:** Google Gemini (FREE, powerful)
- **Tier 2:** Hugging Face (FREE backup) 
- **Tier 3:** Local AI (always works)

## 📋 **Where to Get API Keys**

### 🥇 **Tier 1: Google Gemini API (FREE - PRIORITY)**

**Get your FREE API key here:**
👉 **https://makersuite.google.com/app/apikey**

**Steps:**
1. Go to https://makersuite.google.com/app/apikey
2. Sign in with your Google account
3. Click "Create API key"
4. Copy the key (starts with `AIza...`)

**Limits:** 
- ✅ **FREE forever**
- ✅ 15 requests per minute
- ✅ 1,500 requests per day
- ✅ Perfect for email analysis

---

### 🥈 **Tier 2: Hugging Face API (FREE Backup)**

**Get your FREE API key here:**
👉 **https://huggingface.co/settings/tokens**

**Steps:**
1. Go to https://huggingface.co/settings/tokens
2. Sign up/login (free account)
3. Click "New token"
4. Choose "Read" access
5. Copy the token (starts with `hf_...`)

**Limits:**
- ✅ **FREE forever**
- ✅ 30,000 requests per month
- ✅ Good backup for when Gemini hits limits

---

### 🥉 **Tier 3: Local AI (Always Available)**
- ✅ No setup needed
- ✅ Works offline
- ✅ No API limits
- ✅ Privacy-focused
- Built into the app!

---

## 🔧 **How to Add API Keys**

### **Local Development:**
Add to your `.env.local` file:
```env
GOOGLE_GEMINI_API_KEY=AIza...your-gemini-key-here
HUGGINGFACE_API_KEY=hf_...your-hugging-face-key-here
```

### **Netlify Deployment:**
1. Go to your Netlify site dashboard
2. Go to **Site settings** → **Environment variables**
3. Add these variables:
   ```
   GOOGLE_GEMINI_API_KEY = AIza...your-gemini-key-here
   HUGGINGFACE_API_KEY = hf_...your-hugging-face-key-here
   ```
4. Redeploy your site

### **Other Hosting Platforms:**
- **Vercel:** Add in dashboard → Settings → Environment Variables
- **Railway:** Add in project → Variables tab
- **Heroku:** Add in Settings → Config Vars

---

## 🎯 **How the Fallback System Works**

```
User Request
    ↓
Try Gemini (FREE, fast, powerful)
    ↓ (if fails)
Try Hugging Face (FREE backup)
    ↓ (if fails)  
Use Local AI (always works)
    ↓
Return result to user
```

**Smart Features:**
- ✅ **Automatically switches** to working provider
- ✅ **Remembers failures** and skips broken providers
- ✅ **Never fails completely** - Local AI always works
- ✅ **Logs which provider worked** for debugging

---

## 🚀 **Testing Your Setup**

### **Check Provider Status:**
The app automatically shows which providers are working in the console:
```
✅ generateInsights succeeded with Google Gemini
✅ categorizeEmail succeeded with HuggingFace  
✅ summarizeEmails succeeded with Local AI
```

### **Test Commands:**
```bash
# Test locally
npm run dev

# Check logs in browser console
# Go to /dashboard and check email insights
```

---

## 💰 **Cost Breakdown**

| Provider | Cost | Limits | Best For |
|----------|------|--------|----------|
| **Google Gemini** | **FREE** | 1,500/day | Email analysis, insights |
| **Hugging Face** | **FREE** | 30k/month | Classification, backup |
| **Local AI** | **FREE** | Unlimited | Always available, privacy |
| OpenAI (optional) | ~$0.001/request | Pay-per-use | Advanced analysis |

**Result:** 📊 **99.9% of your usage will be FREE!**

---

## 🔍 **What Each AI Does**

### **Google Gemini (Tier 1):**
- 📧 **Email insights:** "You have too many newsletters, unsubscribe from these..."
- 🏷️ **Smart categorization:** newsletter, work, personal, promotional
- 📊 **Pattern analysis:** "Most emails arrive Tuesday mornings"
- 🎯 **Actionable recommendations:** Specific cleanup suggestions

### **Hugging Face (Tier 2):**
- 🏷️ **Email classification:** Basic categorization  
- 📈 **Sentiment analysis:** positive, negative, urgent
- 📊 **Pattern detection:** Email frequency analysis
- 🔄 **Text processing:** Summary generation

### **Local AI (Tier 3):**
- 🏷️ **Rule-based categorization:** Fast, reliable
- 📊 **Pattern analysis:** Unread ratios, old emails
- 💡 **Smart suggestions:** Based on email patterns
- 🔒 **Privacy-first:** No data leaves your server

---

## 🛠️ **Advanced Configuration**

### **Custom Provider Priority:**
```javascript
// In your .env.local, control provider order:
AI_PROVIDER_PRIORITY=gemini,huggingface,local
```

### **Disable Specific Providers:**
```javascript
// Skip Hugging Face if you don't want it:
HUGGINGFACE_API_KEY=disabled
```

### **Development vs Production:**
```javascript
// Use different keys for dev/prod
GOOGLE_GEMINI_API_KEY_DEV=your-dev-key
GOOGLE_GEMINI_API_KEY_PROD=your-prod-key  
```

---

## 🎉 **Quick Start Commands**

```bash
# 1. Get your API keys (takes 2 minutes):
# - https://makersuite.google.com/app/apikey
# - https://huggingface.co/settings/tokens

# 2. Add to .env.local:
echo "GOOGLE_GEMINI_API_KEY=your-key-here" >> .env.local
echo "HUGGINGFACE_API_KEY=your-key-here" >> .env.local

# 3. Install and run:
npm install
npm run dev

# 4. Test at localhost:3000/dashboard
```

**That's it! Your AI-powered email cleaner is ready! 🎯**

The app will automatically use the best available provider and fall back gracefully if anything fails. You get powerful AI analysis completely free! 🚀