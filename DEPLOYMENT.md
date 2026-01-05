# Deployment Guide

## 🚀 Netlify Deployment

### Method 1: GitHub Integration (Recommended)

1. **Push to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/daniellauding/Email-Cleaner-Web-Client.git
   git push -u origin main
   ```

2. **Connect to Netlify:**
   - Go to [netlify.com](https://netlify.com) and sign up/login
   - Click "New site from Git"
   - Connect your GitHub account
   - Select your `Email-Cleaner-Web-Client` repository
   - Build settings:
     - Build command: `npm run build`
     - Publish directory: `.next`
   - Click "Deploy site"

3. **Environment Variables:**
   In Netlify dashboard > Site settings > Environment variables, add:
   ```
   NEXTAUTH_URL=https://your-site-name.netlify.app
   NEXTAUTH_SECRET=your-random-secret-here
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   OPENAI_API_KEY=your-openai-key (optional)
   HUGGINGFACE_API_KEY=your-hf-key (optional)
   ```

4. **Update Google OAuth:**
   - Go to Google Cloud Console > Credentials
   - Edit your OAuth client
   - Add authorized redirect URI: `https://your-site-name.netlify.app/api/auth/callback/google`

### Method 2: Netlify CLI

```bash
npm install -g netlify-cli
netlify login
netlify init
netlify deploy --prod
```

## 🌐 Alternative Hosting Options

### Vercel (Next.js Optimized)
```bash
npm install -g vercel
vercel --prod
```

### Railway
```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

### Self-Hosting with PM2
```bash
npm run build
npm install -g pm2
pm2 start npm --name "email-cleaner" -- start
pm2 save
pm2 startup
```

## 🤖 AI Integration Options

### Option 1: OpenAI (Paid, Most Powerful)
- Sign up at [openai.com](https://openai.com)
- Get API key from dashboard
- Add to environment: `OPENAI_API_KEY=sk-...`
- **Cost:** ~$0.001-0.002 per insight generation

### Option 2: Hugging Face (Free Tier)
- Sign up at [huggingface.co](https://huggingface.co)
- Get free API key from settings
- Add to environment: `HUGGINGFACE_API_KEY=hf_...`
- **Cost:** Free tier: 30,000 requests/month

### Option 3: Local AI (Completely Free)
- No setup required
- Uses rule-based analysis
- Works offline
- Perfect for privacy-focused users

### Option 4: Anthropic Claude
- Sign up at [console.anthropic.com](https://console.anthropic.com)
- Get API key
- Add to environment: `ANTHROPIC_API_KEY=sk-ant-...`

## 📱 Mobile Optimization

The app is already mobile-first, but for best mobile experience:

1. **Add to Home Screen** - Users can install as PWA
2. **Offline Support** - Basic functionality works offline
3. **Touch Gestures** - Optimized for mobile interaction

## 🔧 Production Considerations

### Security
- Use HTTPS in production
- Set secure NEXTAUTH_SECRET
- Regularly rotate API keys
- Monitor API usage

### Performance
- Enable Next.js caching
- Use CDN for static assets
- Monitor Core Web Vitals
- Optimize images

### Monitoring
```bash
# Add to package.json scripts
"analyze": "ANALYZE=true next build"

# Install bundle analyzer
npm install --save-dev @next/bundle-analyzer
```

## 📊 Analytics & Monitoring

### Add Google Analytics
```javascript
// In app/layout.tsx
import { GoogleAnalytics } from '@next/third-parties/google'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <GoogleAnalytics gaId="G-XXXXXXXXXX" />
      </body>
    </html>
  )
}
```

### Error Monitoring with Sentry
```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

## 🔄 CI/CD Pipeline

### GitHub Actions (Optional)
Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to Netlify
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - uses: netlify/actions/cli@master
        with:
          args: deploy --prod
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
```

## 🐛 Troubleshooting Deployment

### Common Issues

**Build fails on Netlify:**
- Check Node.js version (use 18+)
- Verify all environment variables are set
- Check for missing dependencies

**OAuth redirect errors:**
- Verify NEXTAUTH_URL matches your deployed URL
- Check Google OAuth redirect URIs
- Ensure HTTPS in production

**Gmail API errors:**
- Verify Gmail API is enabled
- Check API quotas in Google Cloud Console
- Ensure OAuth scopes are correct

**AI provider errors:**
- Check API key validity
- Verify rate limits
- Test with Local AI provider first

### Debug Commands
```bash
# Check build locally
npm run build

# Test production build
npm run start

# Check environment variables
netlify env:list

# View build logs
netlify logs
```

## 🎯 Post-Deployment Checklist

- [ ] Test OAuth flow on production URL
- [ ] Verify Gmail API integration works
- [ ] Test unsubscribe functionality
- [ ] Check AI insights generation
- [ ] Test mobile responsiveness
- [ ] Verify n8n webhook endpoints
- [ ] Monitor error rates
- [ ] Set up backup strategy
- [ ] Configure domain (if custom)
- [ ] Set up SSL certificate
- [ ] Test PWA installation
- [ ] Verify privacy policy compliance

## 📈 Scaling Considerations

### Database
- Consider upgrading from SQLite to PostgreSQL
- Use connection pooling
- Implement caching strategy

### API Limits
- Monitor Gmail API quotas
- Implement request queuing
- Add retry logic with exponential backoff

### User Growth
- Implement user analytics
- Set up error tracking
- Plan for increased server costs

Ready to deploy! 🚀