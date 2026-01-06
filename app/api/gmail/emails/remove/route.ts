import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { GmailService } from '@/lib/gmail'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { messageIds, action = 'trash' } = await request.json()
    
    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return NextResponse.json({ error: 'Message IDs required' }, { status: 400 })
    }

    const gmailService = new GmailService(session.accessToken)
    
    if (action === 'delete') {
      await gmailService.deleteEmails(messageIds)
    } else if (action === 'archive') {
      await gmailService.archiveEmails(messageIds)
    } else {
      // Default to trash
      await gmailService.trashEmails(messageIds)
    }
    
    return NextResponse.json({ 
      success: true,
      action,
      count: messageIds.length
    })
  } catch (error) {
    console.error('Remove emails error:', error)
    return NextResponse.json(
      { error: 'Failed to remove emails' }, 
      { status: 500 }
    )
  }
}