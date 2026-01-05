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
    const daysOld = parseInt(searchParams.get('daysOld') || '30')

    const gmailService = new GmailService(session.accessToken)
    const newsletters = await gmailService.searchNewsletters(daysOld)
    
    return NextResponse.json(newsletters)
  } catch (error) {
    console.error('Gmail newsletters error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch newsletters' }, 
      { status: 500 }
    )
  }
}