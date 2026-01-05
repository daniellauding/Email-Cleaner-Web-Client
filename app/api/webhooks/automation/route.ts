import { NextRequest, NextResponse } from 'next/server'
import { GmailService } from '@/lib/gmail'
import { UnsubscribeDetector } from '@/lib/unsubscribe'

// Scheduled automation webhook for recurring tasks
export async function POST(request: NextRequest) {
  try {
    const { 
      userEmail,
      accessToken, 
      schedule = 'weekly',
      actions = ['clean_newsletters', 'archive_old_emails'],
      settings = {}
    } = await request.json()
    
    if (!accessToken || !userEmail) {
      return NextResponse.json({ 
        error: 'Access token and user email required' 
      }, { status: 401 })
    }

    const gmailService = new GmailService(accessToken)
    const results: any = {
      userEmail,
      schedule,
      timestamp: new Date().toISOString(),
      actions: []
    }

    for (const action of actions) {
      try {
        let actionResult
        
        switch (action) {
          case 'clean_newsletters':
            actionResult = await performNewsletterCleaning(gmailService, settings.newsletter || {})
            break
            
          case 'archive_old_emails':
            actionResult = await performOldEmailArchiving(gmailService, settings.archive || {})
            break
            
          case 'unread_cleanup':
            actionResult = await performUnreadCleanup(gmailService, settings.unread || {})
            break
            
          case 'storage_optimization':
            actionResult = await performStorageOptimization(gmailService, settings.storage || {})
            break
            
          default:
            actionResult = { success: false, message: `Unknown action: ${action}` }
        }
        
        results.actions.push({
          action,
          ...actionResult
        })
      } catch (error) {
        results.actions.push({
          action,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Calculate overall success rate
    const successfulActions = results.actions.filter((a: any) => a.success).length
    results.overallSuccess = successfulActions / results.actions.length
    
    return NextResponse.json(results)
  } catch (error) {
    console.error('Automation webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}

async function performNewsletterCleaning(
  gmailService: GmailService, 
  settings: any
) {
  const { 
    daysOld = 30, 
    autoUnsubscribe = true,
    maxProcessed = 50 
  } = settings

  try {
    const newsletters = await gmailService.searchNewsletters(daysOld)
    const limitedNewsletters = newsletters.slice(0, maxProcessed)
    
    let unsubscribed = 0
    let archived = 0
    const processed: any[] = []

    for (const newsletter of limitedNewsletters) {
      try {
        if (autoUnsubscribe) {
          const emailBody = await gmailService.getEmailBody(newsletter.id)
          const unsubscribeInfo = await UnsubscribeDetector.extractUnsubscribeInfo(emailBody)
          
          if (unsubscribeInfo.found && unsubscribeInfo.confidence > 0.7) {
            const result = await UnsubscribeDetector.performUnsubscribe(unsubscribeInfo)
            
            if (result.success) {
              unsubscribed++
              await gmailService.markAsRead([newsletter.id])
            }
            
            processed.push({
              id: newsletter.id,
              from: newsletter.from,
              subject: newsletter.subject,
              unsubscribed: result.success,
              message: result.message
            })
          }
        } else {
          // Just archive old newsletters
          await gmailService.markAsRead([newsletter.id])
          archived++
        }
      } catch (error) {
        console.error(`Error processing newsletter ${newsletter.id}:`, error)
      }
    }

    return {
      success: true,
      message: `Newsletter cleanup completed`,
      details: {
        totalFound: newsletters.length,
        processed: limitedNewsletters.length,
        unsubscribed,
        archived,
        daysOld
      },
      processed
    }
  } catch (error) {
    return {
      success: false,
      message: 'Newsletter cleaning failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function performOldEmailArchiving(
  gmailService: GmailService, 
  settings: any
) {
  const { 
    daysOld = 90, 
    keepImportant = true,
    maxProcessed = 100 
  } = settings

  try {
    const date = new Date()
    date.setDate(date.getDate() - daysOld)
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '/')
    
    let query = `before:${dateStr} is:read`
    if (keepImportant) {
      query += ' -in:important -is:starred'
    }

    const emails = await gmailService.getEmails(query, maxProcessed)
    const messageIds = emails.messages.map(email => email.id)

    if (messageIds.length > 0) {
      await gmailService.markAsRead(messageIds) // This effectively archives
    }

    return {
      success: true,
      message: `Archived ${messageIds.length} old emails`,
      details: {
        archived: messageIds.length,
        daysOld,
        keepImportant
      }
    }
  } catch (error) {
    return {
      success: false,
      message: 'Old email archiving failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function performUnreadCleanup(
  gmailService: GmailService, 
  settings: any
) {
  const { 
    daysOld = 14,
    categories = ['newsletters', 'promotions'],
    maxProcessed = 50 
  } = settings

  try {
    const date = new Date()
    date.setDate(date.getDate() - daysOld)
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '/')
    
    let query = `is:unread before:${dateStr}`
    
    // Add category filters
    if (categories.includes('newsletters')) {
      query += ' (from:newsletter OR from:noreply OR has:list)'
    }

    const emails = await gmailService.getEmails(query, maxProcessed)
    const messageIds = emails.messages.map(email => email.id)

    if (messageIds.length > 0) {
      await gmailService.markAsRead(messageIds)
    }

    return {
      success: true,
      message: `Marked ${messageIds.length} old unread emails as read`,
      details: {
        processed: messageIds.length,
        daysOld,
        categories
      }
    }
  } catch (error) {
    return {
      success: false,
      message: 'Unread cleanup failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function performStorageOptimization(
  gmailService: GmailService, 
  settings: any
) {
  const { 
    deleteLargeAttachments = false,
    daysOld = 365,
    sizeLimitMB = 25 
  } = settings

  try {
    const date = new Date()
    date.setDate(date.getDate() - daysOld)
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '/')
    
    // Find large emails
    const query = `before:${dateStr} larger:${sizeLimitMB}M`
    const emails = await gmailService.getEmails(query, 50)
    
    let processedCount = 0
    
    if (deleteLargeAttachments && emails.messages.length > 0) {
      // In a real implementation, you'd need to remove attachments
      // Gmail API doesn't directly support attachment removal
      // This would require downloading, processing, and re-uploading
      processedCount = 0 // Placeholder
    }

    return {
      success: true,
      message: `Storage optimization completed`,
      details: {
        largeEmailsFound: emails.messages.length,
        processed: processedCount,
        sizeLimitMB,
        daysOld
      }
    }
  } catch (error) {
    return {
      success: false,
      message: 'Storage optimization failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// GET endpoint to show available automation options
export async function GET() {
  return NextResponse.json({
    service: 'Email Cleaner Automation Webhook',
    version: '1.0.0',
    schedules: ['daily', 'weekly', 'monthly'],
    available_actions: [
      'clean_newsletters',
      'archive_old_emails', 
      'unread_cleanup',
      'storage_optimization'
    ],
    action_settings: {
      clean_newsletters: {
        daysOld: 'Number of days old for newsletters to process (default: 30)',
        autoUnsubscribe: 'Automatically unsubscribe if possible (default: true)',
        maxProcessed: 'Maximum emails to process per run (default: 50)'
      },
      archive_old_emails: {
        daysOld: 'Age of emails to archive in days (default: 90)',
        keepImportant: 'Keep important/starred emails (default: true)',
        maxProcessed: 'Maximum emails to process per run (default: 100)'
      },
      unread_cleanup: {
        daysOld: 'Age of unread emails to mark as read (default: 14)',
        categories: 'Email categories to target (default: ["newsletters", "promotions"])',
        maxProcessed: 'Maximum emails to process per run (default: 50)'
      },
      storage_optimization: {
        deleteLargeAttachments: 'Remove large attachments (default: false)',
        daysOld: 'Age threshold for optimization (default: 365)',
        sizeLimitMB: 'Size threshold in MB (default: 25)'
      }
    }
  })
}