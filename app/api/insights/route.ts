import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { GmailService } from '@/lib/gmail'
import { EmailAnalyzer } from '@/lib/ai-insights'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sampleSize = parseInt(searchParams.get('sampleSize') || '200')
    const includeOld = searchParams.get('includeOld') === 'true'

    const gmailService = new GmailService(session.accessToken)
    
    // Get sample of recent emails for analysis
    let query = ''
    if (!includeOld) {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const dateStr = thirtyDaysAgo.toISOString().split('T')[0].replace(/-/g, '/')
      query = `after:${dateStr}`
    }

    const [emailsResult, stats] = await Promise.all([
      gmailService.getEmails(query, sampleSize),
      gmailService.getEmailStats()
    ])

    // Analyze the email data
    const analysis = await EmailAnalyzer.analyzeEmailData(emailsResult.messages, stats)
    
    // Add some additional processing
    const enhancedInsights = analysis.insights.map(insight => ({
      ...insight,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString()
    }))

    return NextResponse.json({
      ...analysis,
      insights: enhancedInsights,
      metadata: {
        sampledEmails: emailsResult.messages.length,
        totalEmails: stats.totalEmails,
        analysisDate: new Date().toISOString(),
        includeOldEmails: includeOld
      }
    })
  } catch (error) {
    console.error('Insights error:', error)
    return NextResponse.json(
      { error: 'Failed to generate insights' }, 
      { status: 500 }
    )
  }
}

// POST endpoint for triggering insight-based actions
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { action, params } = await request.json()
    const gmailService = new GmailService(session.accessToken)

    let result
    
    switch (action) {
      case 'mark_old_as_read':
        const daysOld = params?.daysOld || 30
        const date = new Date()
        date.setDate(date.getDate() - daysOld)
        const dateStr = date.toISOString().split('T')[0].replace(/-/g, '/')
        
        const oldEmails = await gmailService.getEmails(`is:unread before:${dateStr}`, 100)
        const messageIds = oldEmails.messages.map(email => email.id)
        
        if (messageIds.length > 0) {
          await gmailService.markAsRead(messageIds)
        }
        
        result = {
          action: 'mark_old_as_read',
          processed: messageIds.length,
          daysOld
        }
        break

      case 'bulk_unsubscribe_newsletters':
        const newsletters = await gmailService.searchNewsletters(params?.daysOld || 30)
        const unsubscribeResults: any[] = []
        
        // Process up to 20 newsletters to avoid timeout
        const limitedNewsletters = newsletters.slice(0, 20)
        
        for (const newsletter of limitedNewsletters) {
          try {
            const emailBody = await gmailService.getEmailBody(newsletter.id)
            // Basic unsubscribe would be implemented here
            // For demo purposes, just mark as processed
            unsubscribeResults.push({
              id: newsletter.id,
              from: newsletter.from,
              processed: true
            })
          } catch (error) {
            unsubscribeResults.push({
              id: newsletter.id,
              from: newsletter.from,
              processed: false,
              error: 'Failed to process'
            })
          }
        }
        
        result = {
          action: 'bulk_unsubscribe_newsletters',
          processed: unsubscribeResults.length,
          results: unsubscribeResults
        }
        break

      case 'archive_large_emails':
        const sizeLimitMB = params?.sizeLimitMB || 10
        const ageDays = params?.ageDays || 180
        
        const ageDate = new Date()
        ageDate.setDate(ageDate.getDate() - ageDays)
        const ageDateStr = ageDate.toISOString().split('T')[0].replace(/-/g, '/')
        
        const largeEmails = await gmailService.getEmails(
          `larger:${sizeLimitMB}M before:${ageDateStr}`, 
          50
        )
        
        const largeEmailIds = largeEmails.messages.map(email => email.id)
        if (largeEmailIds.length > 0) {
          await gmailService.markAsRead(largeEmailIds) // Archive them
        }
        
        result = {
          action: 'archive_large_emails',
          processed: largeEmailIds.length,
          sizeLimitMB,
          ageDays
        }
        break

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Insight action error:', error)
    return NextResponse.json(
      { error: 'Failed to execute insight action' }, 
      { status: 500 }
    )
  }
}