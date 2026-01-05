// Multiple AI provider support - use what's available/free
export interface AIProvider {
  name: string
  generateInsights(emailData: any): Promise<string>
  summarizeEmails(emails: any[]): Promise<string>
  categorizeEmail(email: any): Promise<string>
}

export class OpenAIProvider implements AIProvider {
  name = 'OpenAI'
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async generateInsights(emailData: any): Promise<string> {
    if (!this.apiKey) throw new Error('OpenAI API key not provided')
    
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are an email management assistant. Analyze email patterns and provide actionable insights.'
            },
            {
              role: 'user',
              content: `Analyze this email data and provide 3 key insights: ${JSON.stringify(emailData)}`
            }
          ],
          max_tokens: 300,
          temperature: 0.3
        })
      })

      const data = await response.json()
      return data.choices[0]?.message?.content || 'Unable to generate insights'
    } catch (error) {
      console.error('OpenAI API error:', error)
      throw error
    }
  }

  async summarizeEmails(emails: any[]): Promise<string> {
    const emailSummaries = emails.slice(0, 10).map(email => 
      `From: ${email.from}, Subject: ${email.subject}, Snippet: ${email.snippet}`
    ).join('\n')

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Summarize these emails into key categories and identify actionable items.'
          },
          {
            role: 'user',
            content: emailSummaries
          }
        ],
        max_tokens: 200
      })
    })

    const data = await response.json()
    return data.choices[0]?.message?.content || 'Unable to summarize emails'
  }

  async categorizeEmail(email: any): Promise<string> {
    const emailText = `${email.subject} ${email.from} ${email.snippet}`
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Categorize this email into one of: newsletter, promotional, personal, work, social, transactional, spam. Respond with just the category.'
          },
          {
            role: 'user',
            content: emailText
          }
        ],
        max_tokens: 10
      })
    })

    const data = await response.json()
    return data.choices[0]?.message?.content?.toLowerCase() || 'other'
  }
}

// Free alternative using Hugging Face
export class HuggingFaceProvider implements AIProvider {
  name = 'HuggingFace'
  private apiKey: string

  constructor(apiKey?: string) {
    this.apiKey = apiKey || ''
  }

  async generateInsights(emailData: any): Promise<string> {
    // Use a free text generation model
    try {
      const response = await fetch(
        'https://api-inference.huggingface.co/models/facebook/blenderbot-400M-distill',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: `Analyze email patterns: ${emailData.stats?.totalEmails} total emails, ${emailData.stats?.unreadEmails} unread, ${emailData.stats?.newsletters} newsletters. Provide 3 actionable insights.`,
            parameters: { max_length: 150 }
          })
        }
      )

      const data = await response.json()
      return data[0]?.generated_text || 'Consider organizing your emails by priority and unsubscribing from unused newsletters.'
    } catch (error) {
      return this.getFallbackInsights(emailData)
    }
  }

  async summarizeEmails(emails: any[]): Promise<string> {
    const categories = ['newsletter', 'work', 'personal', 'promotional']
    const summary = categories.map(cat => {
      const count = emails.filter(e => e.category === cat).length
      return count > 0 ? `${count} ${cat} emails` : null
    }).filter(Boolean).join(', ')

    return `Found ${emails.length} emails: ${summary}`
  }

  async categorizeEmail(email: any): Promise<string> {
    // Simple rule-based categorization as fallback
    const subject = email.subject?.toLowerCase() || ''
    const from = email.from?.toLowerCase() || ''
    
    if (from.includes('noreply') || subject.includes('unsubscribe')) return 'newsletter'
    if (subject.includes('offer') || subject.includes('sale')) return 'promotional'
    if (from.includes('facebook') || from.includes('twitter')) return 'social'
    if (subject.includes('receipt') || subject.includes('order')) return 'transactional'
    
    return 'other'
  }

  private getFallbackInsights(emailData: any): string {
    const insights = []
    
    if (emailData.stats?.unreadEmails > 100) {
      insights.push('📧 High unread count detected - consider bulk actions')
    }
    if (emailData.stats?.newsletters > 50) {
      insights.push('📰 Many newsletters found - unsubscribe from unused ones')
    }
    if (emailData.patterns?.oldEmails > 200) {
      insights.push('🗂️ Archive old emails to improve organization')
    }
    
    return insights.slice(0, 3).join('\n') || 'Your email management looks good!'
  }
}

// Local processing provider (completely free)
export class LocalAIProvider implements AIProvider {
  name = 'Local'

  async generateInsights(emailData: any): Promise<string> {
    const insights = []
    const stats = emailData.stats || {}
    
    // Rule-based insights
    if (stats.unreadEmails > 1000) {
      insights.push('🚨 Critical: Over 1k unread emails - urgent cleanup needed')
    } else if (stats.unreadEmails > 500) {
      insights.push('⚠️ High unread count - consider automated cleanup')
    }
    
    if (stats.newsletters > 100) {
      insights.push('📰 Newsletter overload - bulk unsubscribe recommended')
    }
    
    const unreadRatio = stats.unreadEmails / Math.max(stats.totalEmails, 1)
    if (unreadRatio > 0.5) {
      insights.push('📈 Over 50% emails unread - productivity impact detected')
    }
    
    if (emailData.patterns?.duplicates > 20) {
      insights.push('📋 Duplicate emails found - cleanup opportunity')
    }
    
    if (emailData.patterns?.largeEmails > 50) {
      insights.push('💾 Storage optimization available - remove large emails')
    }
    
    return insights.slice(0, 3).join('\n') || '✅ Your email management looks healthy!'
  }

  async summarizeEmails(emails: any[]): Promise<string> {
    const categories = {
      newsletter: 0,
      promotional: 0,
      work: 0,
      personal: 0,
      social: 0,
      other: 0
    }
    
    emails.forEach(email => {
      const category = this.categorizeEmailSync(email)
      categories[category as keyof typeof categories]++
    })
    
    const summary = Object.entries(categories)
      .filter(([_, count]) => count > 0)
      .map(([category, count]) => `${count} ${category}`)
      .join(', ')
      
    return `Analyzed ${emails.length} emails: ${summary}`
  }

  async categorizeEmail(email: any): Promise<string> {
    return this.categorizeEmailSync(email)
  }

  private categorizeEmailSync(email: any): string {
    const subject = email.subject?.toLowerCase() || ''
    const from = email.from?.toLowerCase() || ''
    const snippet = email.snippet?.toLowerCase() || ''
    
    // Newsletter indicators
    if (from.includes('newsletter') || from.includes('noreply') || 
        subject.includes('newsletter') || email.listUnsubscribe) {
      return 'newsletter'
    }
    
    // Promotional
    if (subject.includes('sale') || subject.includes('offer') || 
        subject.includes('discount') || subject.includes('%')) {
      return 'promotional'
    }
    
    // Work related
    if (from.includes('slack') || from.includes('jira') || 
        subject.includes('meeting') || subject.includes('deadline')) {
      return 'work'
    }
    
    // Social
    if (from.includes('facebook') || from.includes('twitter') || 
        from.includes('linkedin') || from.includes('instagram')) {
      return 'social'
    }
    
    // Transactional
    if (subject.includes('receipt') || subject.includes('order') || 
        subject.includes('payment') || subject.includes('invoice')) {
      return 'transactional'
    }
    
    return 'other'
  }
}

// Factory function to create AI provider
export function createAIProvider(): AIProvider {
  // Check environment variables for available providers
  if (process.env.OPENAI_API_KEY) {
    return new OpenAIProvider(process.env.OPENAI_API_KEY)
  }
  
  if (process.env.HUGGINGFACE_API_KEY) {
    return new HuggingFaceProvider(process.env.HUGGINGFACE_API_KEY)
  }
  
  // Default to local processing (always free)
  return new LocalAIProvider()
}