# Email Cleaner - Mobile-First Gmail Management Tool

A supersimple, mobile-first email cleaning and management application that helps you unsubscribe from newsletters, clean your inbox, and get AI-powered insights about your email habits. Built with Next.js and designed to work with n8n automation workflows.

## Features

- 📱 **Mobile-First Design** - Optimized for mobile devices with responsive UI
- 🔐 **Google OAuth Integration** - Secure authentication with Gmail API access
- 📧 **Smart Newsletter Detection** - Automatically identifies newsletters and subscriptions
- 🚫 **One-Click Unsubscribe** - Bulk unsubscribe from unwanted newsletters
- 🤖 **AI-Powered Insights** - Get recommendations about your email habits (no paid APIs required)
- 🔍 **Advanced Search & Filters** - Find emails quickly with powerful search
- ⚡ **n8n Integration** - Webhook endpoints for automation workflows
- 🎯 **Privacy-First** - No data selling, works entirely with your own Google account

## Quick Start

### Prerequisites
- Node.js 18+ 
- A Google Cloud Project with Gmail API enabled
- Google OAuth credentials

### 1. Clone and Install

```bash
git clone <repository-url>
cd email-cleaner
npm install
```

### 2. Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Gmail API:
   - Go to "APIs & Services" > "Library"
   - Search for "Gmail API" and enable it
4. Create OAuth credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Web application"
   - Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
   - Download the credentials JSON

### 3. Environment Setup

Create `.env.local` file:

```bash
cp .env.local.example .env.local
```

Fill in your values:

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-random-secret-here

GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### 4. Run the Application

```bash
npm run dev
```

Visit `http://localhost:3000` and sign in with your Google account.

## API Endpoints

### Gmail Integration
- `GET /api/gmail/profile` - Get Gmail profile info
- `GET /api/gmail/emails` - Fetch emails with optional query
- `GET /api/gmail/newsletters` - Find newsletters older than X days
- `GET /api/gmail/stats` - Get email account statistics
- `POST /api/gmail/unsubscribe` - Unsubscribe from newsletters

### AI Insights
- `GET /api/insights` - Get AI-powered email insights and recommendations
- `POST /api/insights` - Execute insight-based actions (cleanup, archive, etc.)

### n8n Automation Webhooks

#### Basic Webhook
`POST /api/webhooks/n8n`

Available actions:
- `get_stats` - Get email statistics
- `get_newsletters` - Find newsletters
- `bulk_unsubscribe` - Mass unsubscribe
- `categorize_emails` - Categorize emails by type
- `clean_old_emails` - Archive/delete old emails

Example payload:
```json
{
  "action": "bulk_unsubscribe",
  "accessToken": "user-access-token",
  "params": {
    "daysOld": 30,
    "maxProcessed": 50
  }
}
```

#### Automation Webhook
`POST /api/webhooks/automation`

For scheduled recurring tasks:
```json
{
  "userEmail": "user@example.com",
  "accessToken": "user-access-token",
  "schedule": "weekly",
  "actions": ["clean_newsletters", "archive_old_emails"],
  "settings": {
    "newsletter": {
      "daysOld": 30,
      "autoUnsubscribe": true
    },
    "archive": {
      "daysOld": 90,
      "keepImportant": true
    }
  }
}
```

## n8n Integration Examples

### Weekly Newsletter Cleanup
1. Create a new workflow in n8n
2. Add a Schedule Trigger (weekly)
3. Add an HTTP Request node:
   - Method: POST
   - URL: `http://localhost:3000/api/webhooks/automation`
   - Body: Include user credentials and cleanup settings

### Email Statistics Dashboard
1. Use the `/api/webhooks/n8n` endpoint with `get_stats` action
2. Process the returned data in n8n
3. Send to your preferred dashboard or notification system

## Mobile Usage

The app is optimized for mobile devices:
- **Touch-friendly interface** - Large buttons and easy navigation
- **Swipe gestures** - (Can be implemented) Swipe to delete/archive
- **Progressive Web App** - Install on your home screen
- **Offline capabilities** - Basic functionality works offline

## Security & Privacy

- **No data collection** - We don't store your emails or personal data
- **Direct API access** - Your data goes directly from Gmail to your device
- **OAuth security** - Industry-standard authentication
- **Local processing** - AI insights generated locally, no external AI services

## Development

### Project Structure
```
├── app/                    # Next.js app router
│   ├── api/               # API routes
│   ├── auth/              # Authentication pages
│   ├── dashboard/         # Main dashboard
│   └── globals.css        # Global styles
├── components/            # React components
├── lib/                   # Utility libraries
│   ├── auth.ts           # NextAuth configuration
│   ├── gmail.ts          # Gmail API wrapper
│   ├── ai-insights.ts    # AI analysis engine
│   └── unsubscribe.ts    # Unsubscribe detection
└── types/                # TypeScript types
```

### Key Components
- **GmailService** - Gmail API integration
- **UnsubscribeDetector** - Finds unsubscribe links in emails
- **EmailAnalyzer** - Generates AI insights
- **Mobile-first UI** - Responsive design components

### Local Development
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

## Deployment

### Vercel (Recommended)
1. Push your code to GitHub
2. Connect to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy

### Self-hosting
1. Build the application: `npm run build`
2. Set up environment variables
3. Start: `npm start`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly on mobile devices
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

- Create an issue on GitHub
- Check the [troubleshooting guide](#troubleshooting)

## Troubleshooting

### Common Issues

**"Unauthorized" errors**
- Check your Google OAuth credentials
- Verify redirect URLs match exactly
- Ensure Gmail API is enabled

**No emails found**
- Check Gmail API quotas
- Verify OAuth scopes include Gmail access
- Test with a different Gmail account

**Mobile display issues**
- Clear browser cache
- Test in different mobile browsers
- Check viewport meta tag

### FAQ

**Q: Is my data safe?**
A: Yes, we don't store any of your email data. Everything works directly with your Gmail account.

**Q: Does this work with other email providers?**
A: Currently only Gmail is supported, but the architecture allows for adding other providers.

**Q: Can I run this on my own server?**
A: Absolutely! This is designed to be self-hosted and doesn't require any external paid services.

**Q: How much does it cost?**
A: The app is free. You only need a Google Cloud account (which has generous free quotas for Gmail API usage).