import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { GmailService } from '@/lib/gmail'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    if (!id) {
      return NextResponse.json({ error: 'Email ID required' }, { status: 400 })
    }

    const gmailService = new GmailService(session.accessToken)
    const emailBody = await gmailService.getEmailBody(id)
    
    return NextResponse.json({ 
      id,
      body: emailBody 
    })
  } catch (error) {
    console.error('Get email body error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch email body' }, 
      { status: 500 }
    )
  }
}