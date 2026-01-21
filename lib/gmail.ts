import { gmail_v1, google } from 'googleapis'

export interface EmailMessage {
  id: string
  threadId: string
  subject: string
  from: string
  to: string
  date: string
  snippet: string
  unread: boolean
  labels: string[]
  size: number
  isNewsletter?: boolean
  unsubscribeLink?: string
  listUnsubscribe?: string
}

export interface EmailStats {
  totalEmails: number
  unreadEmails: number
  newsletters: number
  oldNewsletters: number
  storageUsed: number
}

export class GmailService {
  private gmail: gmail_v1.Gmail

  constructor(accessToken: string) {
    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: accessToken })
    
    this.gmail = google.gmail({ version: 'v1', auth })
  }

  async getProfile() {
    try {
      const response = await this.gmail.users.getProfile({
        userId: 'me'
      })
      return response.data
    } catch (error) {
      console.error('Error fetching Gmail profile:', error)
      throw error
    }
  }

  async getEmails(query: string = '', maxResults: number = 50, pageToken?: string): Promise<{
    messages: EmailMessage[]
    nextPageToken?: string
    resultSizeEstimate: number
  }> {
    try {
      // First get the message IDs
      const listResponse = await this.gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults,
        pageToken
      })

      const messageIds = listResponse.data.messages || []
      const messages: EmailMessage[] = []

      // Batch get message details
      for (const messageRef of messageIds) {
        if (!messageRef.id) continue
        
        try {
          const messageResponse = await this.gmail.users.messages.get({
            userId: 'me',
            id: messageRef.id,
            format: 'metadata',
            metadataHeaders: ['Subject', 'From', 'To', 'Date', 'List-Unsubscribe', 'Unsubscribe']
          })

          const message = messageResponse.data
          if (!message.payload?.headers) continue

          const headers = message.payload.headers
          const subject = headers.find(h => h.name?.toLowerCase() === 'subject')?.value || ''
          const from = headers.find(h => h.name?.toLowerCase() === 'from')?.value || ''
          const to = headers.find(h => h.name?.toLowerCase() === 'to')?.value || ''
          const date = headers.find(h => h.name?.toLowerCase() === 'date')?.value || ''
          const listUnsubscribe = headers.find(h => h.name?.toLowerCase() === 'list-unsubscribe')?.value ?? undefined
          const unsubscribe = headers.find(h => h.name?.toLowerCase() === 'unsubscribe')?.value ?? undefined

          const isNewsletter = this.detectNewsletter(subject, from, listUnsubscribe, unsubscribe)
          
          messages.push({
            id: message.id!,
            threadId: message.threadId!,
            subject,
            from,
            to,
            date,
            snippet: message.snippet || '',
            unread: message.labelIds?.includes('UNREAD') || false,
            labels: message.labelIds || [],
            size: message.sizeEstimate || 0,
            isNewsletter,
            unsubscribeLink: unsubscribe,
            listUnsubscribe
          })
        } catch (error) {
          console.error(`Error fetching message ${messageRef.id}:`, error)
        }
      }

      return {
        messages,
        nextPageToken: listResponse.data.nextPageToken ?? undefined,
        resultSizeEstimate: listResponse.data.resultSizeEstimate || 0
      }
    } catch (error) {
      console.error('Error fetching emails:', error)
      throw error
    }
  }

  async searchNewsletters(daysOld: number = 30): Promise<EmailMessage[]> {
    const date = new Date()
    date.setDate(date.getDate() - daysOld)
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '/')
    
    // Search for emails with newsletter indicators
    const query = `has:nouserlabels before:${dateStr} (from:newsletter OR from:noreply OR from:no-reply OR subject:unsubscribe OR has:list)`
    
    const result = await this.getEmails(query, 100)
    return result.messages.filter(msg => msg.isNewsletter)
  }

  async getEmailStats(): Promise<EmailStats> {
    try {
      const [allEmails, unreadEmails, newsletters] = await Promise.all([
        this.getEmails('', 1),
        this.getEmails('is:unread', 1),
        this.getEmails('from:newsletter OR from:noreply OR has:list', 100)
      ])

      const oldNewsletters = await this.searchNewsletters(30)

      return {
        totalEmails: allEmails.resultSizeEstimate,
        unreadEmails: unreadEmails.resultSizeEstimate,
        newsletters: newsletters.messages.filter(msg => msg.isNewsletter).length,
        oldNewsletters: oldNewsletters.length,
        storageUsed: 0 // We'd need to calculate this
      }
    } catch (error) {
      console.error('Error getting email stats:', error)
      throw error
    }
  }

  async markAsRead(messageIds: string[]): Promise<void> {
    try {
      await this.gmail.users.messages.batchModify({
        userId: 'me',
        requestBody: {
          ids: messageIds,
          removeLabelIds: ['UNREAD']
        }
      })
    } catch (error) {
      console.error('Error marking emails as read:', error)
      throw error
    }
  }

  async deleteEmails(messageIds: string[]): Promise<void> {
    try {
      for (const messageId of messageIds) {
        await this.gmail.users.messages.delete({
          userId: 'me',
          id: messageId
        })
      }
    } catch (error) {
      console.error('Error deleting emails:', error)
      throw error
    }
  }

  async trashEmails(messageIds: string[]): Promise<void> {
    try {
      await this.gmail.users.messages.batchModify({
        userId: 'me',
        requestBody: {
          ids: messageIds,
          addLabelIds: ['TRASH']
        }
      })
    } catch (error) {
      console.error('Error moving emails to trash:', error)
      throw error
    }
  }

  async archiveEmails(messageIds: string[]): Promise<void> {
    try {
      await this.gmail.users.messages.batchModify({
        userId: 'me',
        requestBody: {
          ids: messageIds,
          removeLabelIds: ['INBOX']
        }
      })
    } catch (error) {
      console.error('Error archiving emails:', error)
      throw error
    }
  }

  async forwardEmail(messageId: string, to: string, message?: string): Promise<void> {
    try {
      // Get the original message
      const originalResponse = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full'
      })

      const original = originalResponse.data
      const originalHeaders = original.payload?.headers || []
      const originalSubject = originalHeaders.find(h => h.name?.toLowerCase() === 'subject')?.value || ''
      const originalFrom = originalHeaders.find(h => h.name?.toLowerCase() === 'from')?.value || ''
      const originalDate = originalHeaders.find(h => h.name?.toLowerCase() === 'date')?.value || ''
      
      // Create forward message
      const subject = `Fwd: ${originalSubject}`
      const forwardedMessage = `
${message || ''}

---------- Forwarded message ---------
From: ${originalFrom}
Date: ${originalDate}
Subject: ${originalSubject}

${await this.getEmailBody(messageId)}
      `.trim()

      // Create the email
      const email = [
        `To: ${to}`,
        `Subject: ${subject}`,
        'Content-Type: text/plain; charset=utf-8',
        '',
        forwardedMessage
      ].join('\r\n')

      const encodedEmail = Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

      await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedEmail
        }
      })
    } catch (error) {
      console.error('Error forwarding email:', error)
      throw error
    }
  }

  async getEmailBody(messageId: string): Promise<string> {
    try {
      const response = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full'
      })

      const message = response.data
      const payload = message.payload
      
      if (!payload) return ''

      // Handle different email structures
      let body = ''
      
      if (payload.body?.data) {
        body = Buffer.from(payload.body.data, 'base64').toString()
      } else if (payload.parts) {
        for (const part of payload.parts) {
          if (part.mimeType === 'text/html' || part.mimeType === 'text/plain') {
            if (part.body?.data) {
              body += Buffer.from(part.body.data, 'base64').toString()
            }
          }
        }
      }

      return body
    } catch (error) {
      console.error('Error getting email body:', error)
      throw error
    }
  }

  private detectNewsletter(subject: string, from: string, listUnsubscribe?: string, unsubscribe?: string): boolean {
    const newsletterIndicators = [
      'newsletter',
      'noreply',
      'no-reply',
      'donotreply',
      'marketing',
      'promo',
      'unsubscribe',
      'digest',
      'weekly',
      'monthly',
      'updates'
    ]

    const text = `${subject} ${from}`.toLowerCase()
    const hasIndicators = newsletterIndicators.some(indicator => text.includes(indicator))
    const hasUnsubscribeHeader = !!(listUnsubscribe || unsubscribe)
    
    return hasIndicators || hasUnsubscribeHeader
  }
}