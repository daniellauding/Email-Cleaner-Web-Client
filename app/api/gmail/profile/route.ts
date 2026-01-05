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
    const profile = await gmailService.getProfile()
    
    return NextResponse.json(profile)
  } catch (error) {
    console.error('Gmail profile error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Gmail profile' }, 
      { status: 500 }
    )
  }
}