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

    const { messageId, to, message } = await request.json()
    
    if (!messageId || !to) {
      return NextResponse.json({ error: 'Message ID and recipient required' }, { status: 400 })
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(to)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    const gmailService = new GmailService(session.accessToken)
    await gmailService.forwardEmail(messageId, to, message)
    
    return NextResponse.json({ 
      success: true,
      messageId,
      forwardedTo: to
    })
  } catch (error) {
    console.error('Forward email error:', error)
    return NextResponse.json(
      { error: 'Failed to forward email' }, 
      { status: 500 }
    )
  }
}