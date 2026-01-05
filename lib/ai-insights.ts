import { EmailMessage, EmailStats } from './gmail'

export interface EmailInsight {
  type: 'recommendation' | 'warning' | 'info' | 'success'
  title: string
  description: string
  action?: {
    label: string
    endpoint: string
    params?: any
  }
  priority: 'high' | 'medium' | 'low'
  category: 'cleanup' | 'organization' | 'security' | 'productivity'
}

export interface EmailAnalysis {
  insights: EmailInsight[]
  stats: {
    topSenders: { email: string; count: number; unreadCount: number }[]
    emailsByDayOfWeek: { [key: string]: number }
    emailsByTimeOfDay: { [hour: number]: number }
    unsubscribeOpportunities: number
    storageImpact: {
      largeEmails: number
      oldEmails: number
      duplicates: number
    }
  }
  score: {
    cleanliness: number // 0-100
    organization: number // 0-100
    productivity: number // 0-100
  }
}

export class EmailAnalyzer {
  
  static async analyzeEmailData(emails: EmailMessage[], stats: EmailStats): Promise<EmailAnalysis> {
    const insights: EmailInsight[] = []
    
    // Analyze email patterns
    const patterns = this.analyzePatterns(emails)
    const senderAnalysis = this.analyzeSenders(emails)
    const timeAnalysis = this.analyzeTimePatterns(emails)
    
    // Generate insights based on analysis
    insights.push(...this.generateCleanupInsights(emails, stats))
    insights.push(...this.generateOrganizationInsights(senderAnalysis, patterns))
    insights.push(...this.generateProductivityInsights(timeAnalysis, stats))
    insights.push(...this.generateSecurityInsights(emails, senderAnalysis))
    
    // Calculate scores
    const scores = this.calculateScores(emails, stats, patterns)
    
    // Sort insights by priority and relevance
    insights.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      return priorityOrder[b.priority] - priorityOrder[a.priority]
    })

    return {
      insights: insights.slice(0, 10), // Top 10 most relevant insights
      stats: {
        topSenders: senderAnalysis.topSenders,
        emailsByDayOfWeek: timeAnalysis.dayOfWeek,
        emailsByTimeOfDay: timeAnalysis.timeOfDay,
        unsubscribeOpportunities: patterns.unsubscribeOpportunities,
        storageImpact: patterns.storageImpact
      },
      score: scores
    }
  }

  private static analyzePatterns(emails: EmailMessage[]) {
    const newsletters = emails.filter(email => email.isNewsletter)
    const unreadNewsletters = newsletters.filter(email => email.unread)
    const oldEmails = emails.filter(email => {
      const emailDate = new Date(email.date)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      return emailDate < thirtyDaysAgo
    })

    const largeEmails = emails.filter(email => email.size > 5000000) // >5MB
    
    // Detect potential duplicates (same subject from same sender)
    const emailKeys = emails.map(email => `${email.from.toLowerCase()}:${email.subject.toLowerCase()}`)
    const duplicates = emailKeys.length - new Set(emailKeys).size

    return {
      newsletters: newsletters.length,
      unreadNewsletters: unreadNewsletters.length,
      oldEmails: oldEmails.length,
      unsubscribeOpportunities: newsletters.filter(email => 
        email.unsubscribeLink || email.listUnsubscribe
      ).length,
      storageImpact: {
        largeEmails: largeEmails.length,
        oldEmails: oldEmails.length,
        duplicates
      }
    }
  }

  private static analyzeSenders(emails: EmailMessage[]) {
    const senderCounts: { [email: string]: { total: number; unread: number } } = {}
    
    emails.forEach(email => {
      const sender = email.from.toLowerCase()
      if (!senderCounts[sender]) {
        senderCounts[sender] = { total: 0, unread: 0 }
      }
      senderCounts[sender].total++
      if (email.unread) {
        senderCounts[sender].unread++
      }
    })

    const topSenders = Object.entries(senderCounts)
      .map(([email, counts]) => ({
        email,
        count: counts.total,
        unreadCount: counts.unread
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    return { topSenders, senderCounts }
  }

  private static analyzeTimePatterns(emails: EmailMessage[]) {
    const dayOfWeek: { [key: string]: number } = {
      'Monday': 0, 'Tuesday': 0, 'Wednesday': 0, 'Thursday': 0,
      'Friday': 0, 'Saturday': 0, 'Sunday': 0
    }
    
    const timeOfDay: { [hour: number]: number } = {}
    
    for (let i = 0; i < 24; i++) {
      timeOfDay[i] = 0
    }

    emails.forEach(email => {
      const date = new Date(email.date)
      const day = date.toLocaleDateString('en-US', { weekday: 'long' })
      const hour = date.getHours()
      
      dayOfWeek[day]++
      timeOfDay[hour]++
    })

    return { dayOfWeek, timeOfDay }
  }

  private static generateCleanupInsights(emails: EmailMessage[], stats: EmailStats): EmailInsight[] {
    const insights: EmailInsight[] = []
    const patterns = this.analyzePatterns(emails)

    // High unread count
    if (stats.unreadEmails > 1000) {
      insights.push({
        type: 'warning',
        title: 'High Unread Email Count',
        description: `You have ${stats.unreadEmails.toLocaleString()} unread emails. Consider bulk actions to clean up.`,
        action: {
          label: 'Mark Old Emails as Read',
          endpoint: '/api/gmail/bulk-action',
          params: { action: 'mark_read', daysOld: 30 }
        },
        priority: 'high',
        category: 'cleanup'
      })
    }

    // Many old newsletters
    if (patterns.unreadNewsletters > 50) {
      insights.push({
        type: 'recommendation',
        title: 'Unread Newsletter Cleanup',
        description: `You have ${patterns.unreadNewsletters} unread newsletters. Time for a cleanup?`,
        action: {
          label: 'Bulk Unsubscribe',
          endpoint: '/api/gmail/unsubscribe',
          params: { type: 'old_newsletters' }
        },
        priority: 'high',
        category: 'cleanup'
      })
    }

    // Storage optimization
    if (patterns.storageImpact.largeEmails > 20) {
      insights.push({
        type: 'info',
        title: 'Storage Optimization Available',
        description: `${patterns.storageImpact.largeEmails} large emails found. Consider archiving or deleting old large emails.`,
        action: {
          label: 'Find Large Emails',
          endpoint: '/api/gmail/emails',
          params: { q: 'larger:10M older_than:6m' }
        },
        priority: 'medium',
        category: 'cleanup'
      })
    }

    return insights
  }

  private static generateOrganizationInsights(senderAnalysis: any, patterns: any): EmailInsight[] {
    const insights: EmailInsight[] = []
    
    // Top sender opportunities
    const topSender = senderAnalysis.topSenders[0]
    if (topSender && topSender.count > 50 && topSender.unreadCount > 20) {
      insights.push({
        type: 'recommendation',
        title: 'Frequent Sender Cleanup',
        description: `${topSender.email} has sent you ${topSender.count} emails with ${topSender.unreadCount} unread. Consider creating a filter or unsubscribing.`,
        action: {
          label: 'Review Sender',
          endpoint: '/api/gmail/emails',
          params: { q: `from:${topSender.email}` }
        },
        priority: 'medium',
        category: 'organization'
      })
    }

    // Duplicate detection
    if (patterns.storageImpact.duplicates > 10) {
      insights.push({
        type: 'info',
        title: 'Duplicate Emails Detected',
        description: `Found approximately ${patterns.storageImpact.duplicates} potential duplicate emails.`,
        priority: 'low',
        category: 'organization'
      })
    }

    return insights
  }

  private static generateProductivityInsights(timeAnalysis: any, stats: EmailStats): EmailInsight[] {
    const insights: EmailInsight[] = []
    
    // Peak email times
    const peakHour = Object.entries(timeAnalysis.timeOfDay)
      .reduce((a: any, b: any) => timeAnalysis.timeOfDay[a[0]] > timeAnalysis.timeOfDay[b[0]] ? a : b)
    
    if (peakHour[1] as number > 0) {
      const hour = parseInt(peakHour[0] as string)
      const timeStr = hour === 0 ? '12 AM' : hour <= 12 ? `${hour} AM` : `${hour - 12} PM`
      
      insights.push({
        type: 'info',
        title: 'Email Peak Time Identified',
        description: `Most of your emails arrive around ${timeStr}. Consider checking email at this time for efficiency.`,
        priority: 'low',
        category: 'productivity'
      })
    }

    // Unread ratio warning
    const unreadRatio = stats.unreadEmails / stats.totalEmails
    if (unreadRatio > 0.3) {
      insights.push({
        type: 'warning',
        title: 'High Unread Ratio',
        description: `${(unreadRatio * 100).toFixed(1)}% of your emails are unread. This might be affecting your productivity.`,
        priority: 'medium',
        category: 'productivity'
      })
    }

    return insights
  }

  private static generateSecurityInsights(emails: EmailMessage[], senderAnalysis: any): EmailInsight[] {
    const insights: EmailInsight[] = []
    
    // Suspicious sender patterns
    const suspiciousSenders = emails.filter(email => {
      const from = email.from.toLowerCase()
      const subject = email.subject.toLowerCase()
      
      // Look for potential phishing indicators
      const phishingKeywords = [
        'urgent', 'verify account', 'suspended', 'click here', 
        'limited time', 'act now', 'confirm identity'
      ]
      
      const hasSuspiciousKeywords = phishingKeywords.some(keyword => 
        subject.includes(keyword) || from.includes(keyword)
      )
      
      const hasWeirdDomain = from.includes('.tk') || from.includes('.ml') || 
                            from.match(/[0-9]{5,}/) // Many numbers in email
      
      return hasSuspiciousKeywords || hasWeirdDomain
    })

    if (suspiciousSenders.length > 5) {
      insights.push({
        type: 'warning',
        title: 'Potential Security Concerns',
        description: `Found ${suspiciousSenders.length} emails that might be suspicious. Review them carefully.`,
        priority: 'high',
        category: 'security'
      })
    }

    return insights
  }

  private static calculateScores(emails: EmailMessage[], stats: EmailStats, patterns: any) {
    // Cleanliness score (based on unread ratio, old emails, etc.)
    const unreadRatio = stats.unreadEmails / Math.max(stats.totalEmails, 1)
    const oldEmailRatio = patterns.oldEmails / Math.max(emails.length, 1)
    const cleanliness = Math.max(0, 100 - (unreadRatio * 50) - (oldEmailRatio * 30))

    // Organization score (based on newsletter management, duplicates)
    const newsletterRatio = patterns.unreadNewsletters / Math.max(patterns.newsletters, 1)
    const duplicateRatio = patterns.storageImpact.duplicates / Math.max(emails.length, 1)
    const organization = Math.max(0, 100 - (newsletterRatio * 40) - (duplicateRatio * 20))

    // Productivity score (based on total volume management)
    const volumeScore = Math.min(100, Math.max(0, 100 - (stats.unreadEmails / 100)))
    const productivity = volumeScore

    return {
      cleanliness: Math.round(cleanliness),
      organization: Math.round(organization),
      productivity: Math.round(productivity)
    }
  }

  // Simple sentiment analysis for email subjects
  static analyzeSentiment(text: string): 'positive' | 'neutral' | 'negative' | 'urgent' {
    const positiveWords = ['thanks', 'great', 'awesome', 'congratulations', 'welcome', 'success']
    const negativeWords = ['urgent', 'problem', 'issue', 'error', 'failed', 'suspended', 'expired']
    const urgentWords = ['urgent', 'immediate', 'asap', 'deadline', 'expire', 'final notice']
    
    const lowerText = text.toLowerCase()
    
    if (urgentWords.some(word => lowerText.includes(word))) {
      return 'urgent'
    }
    
    const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length
    const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length
    
    if (negativeCount > positiveCount) return 'negative'
    if (positiveCount > negativeCount) return 'positive'
    
    return 'neutral'
  }
}