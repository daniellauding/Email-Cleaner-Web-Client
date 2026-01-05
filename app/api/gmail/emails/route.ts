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

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const maxResults = parseInt(searchParams.get('maxResults') || '50')
    const pageToken = searchParams.get('pageToken') || undefined

    const gmailService = new GmailService(session.accessToken)
    const emails = await gmailService.getEmails(query, maxResults, pageToken)
    
    return NextResponse.json(emails)
  } catch (error) {
    console.error('Gmail emails error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch emails' }, 
      { status: 500 }
    )
  }
}