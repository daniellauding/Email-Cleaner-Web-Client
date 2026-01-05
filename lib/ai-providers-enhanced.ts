// Enhanced AI provider system with Google Gemini + HuggingFace + Local fallbacks
import { GoogleGenerativeAI } from '@google/generative-ai'

export interface AIProvider {
  name: string
  generateInsights(emailData: any): Promise<string>
  summarizeEmails(emails: any[]): Promise<string>
  categorizeEmail(email: any): Promise<string>
  isAvailable(): boolean
}

// Tier 1: Google Gemini (FREE - Best for email analysis)
export class GeminiProvider implements AIProvider {
  name = 'Google Gemini'
  private genAI: GoogleGenerativeAI | null = null
  private model: any = null

  constructor(apiKey?: string) {
    if (apiKey) {
      try {
        this.genAI = new GoogleGenerativeAI(apiKey)
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
      } catch (error) {
        console.warn('Gemini initialization failed:', error)
      }
    }
  }

  isAvailable(): boolean {
    return this.model !== null
  }

  async generateInsights(emailData: any): Promise<string> {
    if (!this.isAvailable()) throw new Error('Gemini not available')

    const prompt = `
    Analyze this email account data and provide 3 actionable insights for inbox management:
    
    Email Stats:
    - Total emails: ${emailData.stats?.totalEmails || 0}
    - Unread emails: ${emailData.stats?.unreadEmails || 0}  
    - Newsletters: ${emailData.stats?.newsletters || 0}
    
    Patterns:
    - Old emails: ${emailData.patterns?.oldEmails || 0}
    - Large emails: ${emailData.patterns?.largeEmails || 0}
    - Duplicates: ${emailData.patterns?.duplicates || 0}
    
    Provide exactly 3 short, actionable recommendations (max 50 words each) with emojis:
    `

    try {
      const result = await this.model.generateContent(prompt)
      const response = await result.response
      return response.text() || 'Unable to generate insights'
    } catch (error) {
      console.error('Gemini API error:', error)
      throw error
    }
  }

  async summarizeEmails(emails: any[]): Promise<string> {
    if (!this.isAvailable()) throw new Error('Gemini not available')

    const emailSample = emails.slice(0, 10).map(email => 
      `From: ${email.from}, Subject: ${email.subject}`
    ).join('\n')

    const prompt = `
    Summarize these recent emails into key categories and patterns:
    
    ${emailSample}
    
    Provide a brief summary of the main email types and any notable patterns (max 100 words):
    `

    try {
      const result = await this.model.generateContent(prompt)
      const response = await result.response
      return response.text() || 'Unable to summarize emails'
    } catch (error) {
      console.error('Gemini summarization error:', error)
      throw error
    }
  }

  async categorizeEmail(email: any): Promise<string> {
    if (!this.isAvailable()) throw new Error('Gemini not available')

    const prompt = `
    Categorize this email into exactly one category:
    
    Subject: ${email.subject}
    From: ${email.from}
    Snippet: ${email.snippet}
    
    Categories: newsletter, promotional, personal, work, social, transactional, spam, other
    
    Respond with just the category name:
    `

    try {
      const result = await this.model.generateContent(prompt)
      const response = await result.response
      return response.text().toLowerCase().trim() || 'other'
    } catch (error) {
      console.error('Gemini categorization error:', error)
      throw error
    }
  }
}

// Tier 2: Hugging Face (FREE Backup)
export class HuggingFaceProvider implements AIProvider {
  name = 'HuggingFace'
  private apiKey: string

  constructor(apiKey?: string) {
    this.apiKey = apiKey || ''
  }

  isAvailable(): boolean {
    return this.apiKey.length > 0
  }

  async generateInsights(emailData: any): Promise<string> {
    if (!this.isAvailable()) throw new Error('HuggingFace not available')

    try {
      const response = await fetch(
        'https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: `Email analysis: ${emailData.stats?.totalEmails} total, ${emailData.stats?.unreadEmails} unread, ${emailData.stats?.newsletters} newsletters. Give 3 cleanup tips:`,
            parameters: { 
              max_new_tokens: 150,
              temperature: 0.3,
              return_full_text: false
            }
          })
        }
      )

      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error)
      }

      return data[0]?.generated_text || this.getFallbackInsights(emailData)
    } catch (error) {
      console.error('HuggingFace API error:', error)
      throw error
    }
  }

  async summarizeEmails(emails: any[]): Promise<string> {
    const categories = this.categorizeEmailsLocally(emails)
    return `Found ${emails.length} emails: ${Object.entries(categories)
      .filter(([_, count]) => count > 0)
      .map(([cat, count]) => `${count} ${cat}`)
      .join(', ')}`
  }

  async categorizeEmail(email: any): Promise<string> {
    if (!this.isAvailable()) throw new Error('HuggingFace not available')

    try {
      const response = await fetch(
        'https://api-inference.huggingface.co/models/facebook/bart-large-mnli',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: `${email.subject} ${email.from}`,
            parameters: {
              candidate_labels: ['newsletter', 'promotional', 'personal', 'work', 'social', 'transactional']
            }
          })
        }
      )

      const data = await response.json()
      return data.labels?.[0] || 'other'
    } catch (error) {
      return this.categorizeEmailLocally(email)
    }
  }

  private getFallbackInsights(emailData: any): string {
    const insights = []
    
    if (emailData.stats?.unreadEmails > 100) {
      insights.push('📧 High unread count - consider bulk cleanup')
    }
    if (emailData.stats?.newsletters > 50) {
      insights.push('📰 Many newsletters - unsubscribe from unused ones')
    }
    if (emailData.patterns?.oldEmails > 200) {
      insights.push('🗂️ Archive old emails for better organization')
    }
    
    return insights.slice(0, 3).join('\n') || 'Your email management looks good!'
  }

  private categorizeEmailsLocally(emails: any[]) {
    const categories = { newsletter: 0, promotional: 0, work: 0, personal: 0, social: 0, other: 0 }
    emails.forEach(email => {
      const category = this.categorizeEmailLocally(email)
      categories[category as keyof typeof categories]++
    })
    return categories
  }

  private categorizeEmailLocally(email: any): string {
    const text = `${email.subject} ${email.from}`.toLowerCase()
    
    if (text.includes('newsletter') || text.includes('noreply')) return 'newsletter'
    if (text.includes('sale') || text.includes('offer')) return 'promotional'
    if (text.includes('meeting') || text.includes('slack')) return 'work'
    if (text.includes('facebook') || text.includes('twitter')) return 'social'
    
    return 'other'
  }
}

// Tier 3: Local AI (Always Available)
export class LocalAIProvider implements AIProvider {
  name = 'Local AI'

  isAvailable(): boolean {
    return true // Always available
  }

  async generateInsights(emailData: any): Promise<string> {
    const insights = []
    const stats = emailData.stats || {}
    const patterns = emailData.patterns || {}
    
    // Smart rule-based insights
    if (stats.unreadEmails > 1000) {
      insights.push('🚨 Critical: 1000+ unread emails detected - urgent cleanup needed')
    } else if (stats.unreadEmails > 500) {
      insights.push('⚠️ High unread count - consider automated cleanup rules')
    } else if (stats.unreadEmails > 100) {
      insights.push('📧 Moderate unread backlog - weekly cleanup recommended')
    }
    
    if (stats.newsletters > 100) {
      insights.push('📰 Newsletter overload detected - bulk unsubscribe recommended')
    } else if (stats.newsletters > 50) {
      insights.push('📰 Many newsletters found - review and unsubscribe from unused ones')
    }
    
    const unreadRatio = stats.unreadEmails / Math.max(stats.totalEmails, 1)
    if (unreadRatio > 0.7) {
      insights.push('📈 70%+ emails unread - significant productivity impact')
    } else if (unreadRatio > 0.5) {
      insights.push('📈 High unread ratio - consider better email habits')
    }
    
    if (patterns.largeEmails > 100) {
      insights.push('💾 Storage optimization available - 100+ large emails found')
    } else if (patterns.largeEmails > 50) {
      insights.push('💾 Consider archiving large emails to save space')
    }
    
    if (patterns.duplicates > 20) {
      insights.push('📋 Duplicate emails detected - cleanup opportunity available')
    }

    if (patterns.oldEmails > 1000) {
      insights.push('🗂️ 1000+ old emails - archive for better organization')
    }
    
    // If no issues, give positive feedback
    if (insights.length === 0) {
      insights.push('✅ Email management looks healthy!')
      insights.push('💡 Regular weekly cleanup keeps your inbox optimal')
      insights.push('🎯 Consider setting up automated rules for efficiency')
    }
    
    return insights.slice(0, 3).join('\n')
  }

  async summarizeEmails(emails: any[]): Promise<string> {
    const categories = {
      newsletter: 0, promotional: 0, work: 0, personal: 0, social: 0, transactional: 0, other: 0
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
    const text = `${subject} ${from} ${snippet}`
    
    // Newsletter detection
    if (from.includes('newsletter') || from.includes('noreply') || from.includes('no-reply') ||
        subject.includes('newsletter') || subject.includes('digest') || email.listUnsubscribe) {
      return 'newsletter'
    }
    
    // Promotional
    if (text.includes('sale') || text.includes('offer') || text.includes('discount') || 
        text.includes('promo') || text.includes('%') || text.includes('deal')) {
      return 'promotional'
    }
    
    // Work related
    if (from.includes('slack') || from.includes('jira') || from.includes('github') ||
        from.includes('confluence') || subject.includes('meeting') || 
        subject.includes('deadline') || subject.includes('project')) {
      return 'work'
    }
    
    // Social networks
    if (from.includes('facebook') || from.includes('twitter') || from.includes('linkedin') || 
        from.includes('instagram') || from.includes('youtube') || from.includes('tiktok')) {
      return 'social'
    }
    
    // Transactional
    if (subject.includes('receipt') || subject.includes('order') || subject.includes('payment') || 
        subject.includes('invoice') || subject.includes('confirmation') || subject.includes('shipping')) {
      return 'transactional'
    }
    
    // Personal (direct emails, not automated)
    if (!from.includes('noreply') && !from.includes('no-reply') && 
        !text.includes('unsubscribe') && text.length < 200) {
      return 'personal'
    }
    
    return 'other'
  }
}

// Smart AI Provider Factory with Fallback Chain
export class SmartAIProvider implements AIProvider {
  name = 'Smart AI (Multi-Provider)'
  private providers: AIProvider[] = []
  private currentProvider: AIProvider | null = null

  constructor(
    geminiApiKey?: string,
    huggingFaceApiKey?: string,
    includeLocal: boolean = true
  ) {
    // Build provider chain in priority order
    if (geminiApiKey) {
      this.providers.push(new GeminiProvider(geminiApiKey))
    }
    
    if (huggingFaceApiKey) {
      this.providers.push(new HuggingFaceProvider(huggingFaceApiKey))
    }
    
    if (includeLocal) {
      this.providers.push(new LocalAIProvider())
    }

    // Set initial provider
    this.currentProvider = this.getNextAvailableProvider()
  }

  isAvailable(): boolean {
    return this.providers.some(p => p.isAvailable())
  }

  private getNextAvailableProvider(skipCurrent: boolean = false): AIProvider | null {
    const startIndex = skipCurrent && this.currentProvider ? 
      this.providers.indexOf(this.currentProvider) + 1 : 0
    
    for (let i = startIndex; i < this.providers.length; i++) {
      if (this.providers[i].isAvailable()) {
        return this.providers[i]
      }
    }
    return null
  }

  async generateInsights(emailData: any): Promise<string> {
    return this.executeWithFallback('generateInsights', emailData)
  }

  async summarizeEmails(emails: any[]): Promise<string> {
    return this.executeWithFallback('summarizeEmails', emails)
  }

  async categorizeEmail(email: any): Promise<string> {
    return this.executeWithFallback('categorizeEmail', email)
  }

  private async executeWithFallback(method: string, ...args: any[]): Promise<string> {
    let lastError: Error | null = null
    
    // Try current provider first
    if (this.currentProvider) {
      try {
        const result = await (this.currentProvider as any)[method](...args)
        console.log(`✅ ${method} succeeded with ${this.currentProvider.name}`)
        return result
      } catch (error) {
        console.warn(`❌ ${this.currentProvider.name} failed for ${method}:`, error)
        lastError = error as Error
      }
    }

    // Fallback to other providers
    const fallbackProvider = this.getNextAvailableProvider(true)
    if (fallbackProvider) {
      try {
        this.currentProvider = fallbackProvider // Switch to working provider
        const result = await (fallbackProvider as any)[method](...args)
        console.log(`✅ ${method} succeeded with fallback ${fallbackProvider.name}`)
        return result
      } catch (error) {
        console.warn(`❌ Fallback ${fallbackProvider.name} failed for ${method}:`, error)
        lastError = error as Error
      }
    }

    // If all else fails, try Local AI as ultimate fallback
    const localProvider = this.providers.find(p => p.name === 'Local AI')
    if (localProvider && localProvider !== this.currentProvider) {
      try {
        this.currentProvider = localProvider
        const result = await (localProvider as any)[method](...args)
        console.log(`✅ ${method} succeeded with ultimate fallback Local AI`)
        return result
      } catch (error) {
        console.error(`❌ Even Local AI failed for ${method}:`, error)
      }
    }

    throw new Error(`All AI providers failed for ${method}: ${lastError?.message}`)
  }

  getStatus(): { provider: string; available: boolean }[] {
    return this.providers.map(p => ({
      provider: p.name,
      available: p.isAvailable()
    }))
  }
}

// Factory function for easy setup
export function createSmartAIProvider(): SmartAIProvider {
  return new SmartAIProvider(
    process.env.GOOGLE_GEMINI_API_KEY,
    process.env.HUGGINGFACE_API_KEY,
    true // Always include Local AI
  )
}