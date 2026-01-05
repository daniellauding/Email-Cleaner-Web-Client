import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { GmailService } from '@/lib/gmail'
import { createAIProvider } from '@/lib/ai-providers'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { action, emails, prompt } = await request.json()
    const aiProvider = createAIProvider()

    let result

    switch (action) {
      case 'generate_insights':
        result = await aiProvider.generateInsights({
          stats: {
            totalEmails: emails?.length || 0,
            unreadEmails: emails?.filter((e: any) => e.unread).length || 0,
            newsletters: emails?.filter((e: any) => e.isNewsletter).length || 0
          },
          patterns: {
            duplicates: 0, // Would need duplicate detection logic
            largeEmails: emails?.filter((e: any) => e.size > 5000000).length || 0,
            oldEmails: emails?.filter((e: any) => {
              const emailDate = new Date(e.date)
              const thirtyDaysAgo = new Date()
              thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
              return emailDate < thirtyDaysAgo
            }).length || 0
          }
        })
        break

      case 'summarize_emails':
        result = await aiProvider.summarizeEmails(emails || [])
        break

      case 'categorize_email':
        if (!emails || emails.length === 0) {
          return NextResponse.json({ error: 'No email provided for categorization' }, { status: 400 })
        }
        result = await aiProvider.categorizeEmail(emails[0])
        break

      case 'custom_prompt':
        if (!prompt) {
          return NextResponse.json({ error: 'No prompt provided' }, { status: 400 })
        }
        // For custom prompts, use the insights method with custom data
        result = await aiProvider.generateInsights({
          customPrompt: prompt,
          emails: emails || []
        })
        break

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    return NextResponse.json({
      provider: aiProvider.name,
      action,
      result,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('AI insights error:', error)
    return NextResponse.json(
      { error: 'Failed to generate AI insights', details: error instanceof Error ? error.message : 'Unknown error' }, 
      { status: 500 }
    )
  }
}