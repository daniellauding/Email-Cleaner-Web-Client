import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { GmailService } from '@/lib/gmail'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const gmailService = new GmailService(session.accessToken)
    const stats = await gmailService.getEmailStats()
    
    return NextResponse.json(stats)
  } catch (error) {
    console.error('Gmail stats error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch email stats' }, 
      { status: 500 }
    )
  }
}