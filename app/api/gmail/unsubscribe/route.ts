import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { GmailService } from '@/lib/gmail'
import { UnsubscribeDetector } from '@/lib/unsubscribe'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { messageIds } = await request.json()
    
    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return NextResponse.json({ error: 'Invalid message IDs' }, { status: 400 })
    }

    const gmailService = new GmailService(session.accessToken)
    const results: any[] = []

    for (const messageId of messageIds) {
      try {
        // Get full email content
        const emailBody = await gmailService.getEmailBody(messageId)
        
        // Extract unsubscribe information
        const unsubscribeInfo = await UnsubscribeDetector.extractUnsubscribeInfo(emailBody)
        
        if (unsubscribeInfo.found) {
          // Attempt to unsubscribe
          const unsubscribeResult = await UnsubscribeDetector.performUnsubscribe(unsubscribeInfo)
          
          results.push({
            messageId,
            success: unsubscribeResult.success,
            message: unsubscribeResult.message,
            unsubscribeInfo
          })

          // If successful, mark email as read and archive/delete
          if (unsubscribeResult.success) {
            await gmailService.markAsRead([messageId])
          }
        } else {
          results.push({
            messageId,
            success: false,
            message: 'No unsubscribe method found',
            unsubscribeInfo
          })
        }
      } catch (error) {
        console.error(`Error processing message ${messageId}:`, error)
        results.push({
          messageId,
          success: false,
          message: 'Error processing email',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    
    return NextResponse.json({
      processed: messageIds.length,
      successful: successCount,
      results
    })
  } catch (error) {
    console.error('Unsubscribe error:', error)
    return NextResponse.json(
      { error: 'Failed to process unsubscribe requests' }, 
      { status: 500 }
    )
  }
}