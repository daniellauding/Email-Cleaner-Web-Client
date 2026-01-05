import { NextRequest, NextResponse } from 'next/server'
import { GmailService } from '@/lib/gmail'
import { UnsubscribeDetector } from '@/lib/unsubscribe'

// Webhook for n8n automation workflows
export async function POST(request: NextRequest) {
  try {
    const { action, accessToken, params } = await request.json()
    
    if (!accessToken) {
      return NextResponse.json({ error: 'Access token required' }, { status: 401 })
    }

    const gmailService = new GmailService(accessToken)
    
    switch (action) {
      case 'get_stats':
        return await handleGetStats(gmailService)
      
      case 'get_newsletters':
        return await handleGetNewsletters(gmailService, params)
      
      case 'bulk_unsubscribe':
        return await handleBulkUnsubscribe(gmailService, params)
      
      case 'categorize_emails':
        return await handleCategorizeEmails(gmailService, params)
      
      case 'clean_old_emails':
        return await handleCleanOldEmails(gmailService, params)
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}

async function handleGetStats(gmailService: GmailService) {
  const stats = await gmailService.getEmailStats()
  return NextResponse.json(stats)
}

async function handleGetNewsletters(gmailService: GmailService, params: any) {
  const daysOld = params?.daysOld || 30
  const newsletters = await gmailService.searchNewsletters(daysOld)
  
  // Group by domain for easier processing
  const grouped = UnsubscribeDetector.groupByDomain(newsletters)
  
  return NextResponse.json({
    newsletters,
    grouped,
    total: newsletters.length
  })
}

async function handleBulkUnsubscribe(gmailService: GmailService, params: any) {
  const { messageIds, daysOld = 30 } = params || {}
  
  let emailsToProcess = []
  
  if (messageIds && Array.isArray(messageIds)) {
    // Use provided message IDs
    emailsToProcess = messageIds
  } else {
    // Find old newsletters automatically
    const newsletters = await gmailService.searchNewsletters(daysOld)
    emailsToProcess = newsletters.map(email => email.id)
  }

  const results: any[] = []
  let successCount = 0

  for (const messageId of emailsToProcess.slice(0, 50)) { // Limit to prevent timeout
    try {
      const emailBody = await gmailService.getEmailBody(messageId)
      const unsubscribeInfo = await UnsubscribeDetector.extractUnsubscribeInfo(emailBody)
      
      if (unsubscribeInfo.found) {
        const unsubscribeResult = await UnsubscribeDetector.performUnsubscribe(unsubscribeInfo)
        
        if (unsubscribeResult.success) {
          await gmailService.markAsRead([messageId])
          successCount++
        }
        
        results.push({
          messageId,
          success: unsubscribeResult.success,
          message: unsubscribeResult.message
        })
      } else {
        results.push({
          messageId,
          success: false,
          message: 'No unsubscribe method found'
        })
      }
    } catch (error) {
      results.push({
        messageId,
        success: false,
        message: 'Processing error',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  return NextResponse.json({
    processed: emailsToProcess.length,
    successful: successCount,
    results
  })
}

async function handleCategorizeEmails(gmailService: GmailService, params: any) {
  const { query = '', maxResults = 100 } = params || {}
  
  const emails = await gmailService.getEmails(query, maxResults)
  const categories = UnsubscribeDetector.categorizeNewsletters(emails.messages)
  
  return NextResponse.json({
    categories,
    totals: {
      marketing: categories.marketing.length,
      news: categories.news.length,
      social: categories.social.length,
      transactional: categories.transactional.length,
      other: categories.other.length
    }
  })
}

async function handleCleanOldEmails(gmailService: GmailService, params: any) {
  const { daysOld = 90, action = 'archive' } = params || {}
  
  const date = new Date()
  date.setDate(date.getDate() - daysOld)
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '/')
  
  const query = `before:${dateStr} is:read -in:important`
  const emails = await gmailService.getEmails(query, 100)
  
  const messageIds = emails.messages.map(email => email.id)
  
  if (action === 'delete') {
    await gmailService.deleteEmails(messageIds)
  } else {
    // Archive by removing from inbox
    await gmailService.markAsRead(messageIds)
  }
  
  return NextResponse.json({
    action,
    processed: messageIds.length,
    daysOld,
    query
  })
}

// GET endpoint for n8n to test webhook connectivity
export async function GET() {
  return NextResponse.json({
    service: 'Email Cleaner n8n Webhook',
    version: '1.0.0',
    available_actions: [
      'get_stats',
      'get_newsletters', 
      'bulk_unsubscribe',
      'categorize_emails',
      'clean_old_emails'
    ],
    documentation: {
      get_stats: 'Get email account statistics',
      get_newsletters: 'Get newsletters older than specified days (params: { daysOld: 30 })',
      bulk_unsubscribe: 'Unsubscribe from multiple newsletters (params: { messageIds?: string[], daysOld?: 30 })',
      categorize_emails: 'Categorize emails by type (params: { query?: string, maxResults?: 100 })',
      clean_old_emails: 'Archive/delete old emails (params: { daysOld?: 90, action?: "archive"|"delete" })'
    }
  })
}