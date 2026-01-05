import * as cheerio from 'cheerio'
import axios from 'axios'

export interface UnsubscribeInfo {
  found: boolean
  links: string[]
  method: 'link' | 'email' | 'header' | 'form'
  confidence: number
}

export class UnsubscribeDetector {
  
  static async extractUnsubscribeInfo(emailBody: string, headers?: { [key: string]: string }): Promise<UnsubscribeInfo> {
    const result: UnsubscribeInfo = {
      found: false,
      links: [],
      method: 'link',
      confidence: 0
    }

    // Check headers first (most reliable)
    const headerInfo = this.checkHeaders(headers)
    if (headerInfo.found) {
      return headerInfo
    }

    // Parse email HTML/text content
    const contentInfo = this.parseEmailContent(emailBody)
    if (contentInfo.found) {
      return contentInfo
    }

    return result
  }

  private static checkHeaders(headers?: { [key: string]: string }): UnsubscribeInfo {
    if (!headers) return { found: false, links: [], method: 'header', confidence: 0 }

    const listUnsubscribe = headers['list-unsubscribe'] || headers['List-Unsubscribe']
    
    if (listUnsubscribe) {
      const links = this.extractLinksFromHeader(listUnsubscribe)
      return {
        found: links.length > 0,
        links,
        method: 'header',
        confidence: 0.9
      }
    }

    return { found: false, links: [], method: 'header', confidence: 0 }
  }

  private static extractLinksFromHeader(headerValue: string): string[] {
    const links: string[] = []
    
    // Extract URLs from angle brackets
    const urlMatches = headerValue.match(/<([^>]+)>/g)
    if (urlMatches) {
      urlMatches.forEach(match => {
        const url = match.slice(1, -1) // Remove < and >
        if (url.startsWith('http')) {
          links.push(url)
        } else if (url.startsWith('mailto:')) {
          links.push(url)
        }
      })
    }
    
    return links
  }

  private static parseEmailContent(emailBody: string): UnsubscribeInfo {
    if (!emailBody) return { found: false, links: [], method: 'link', confidence: 0 }

    const $ = cheerio.load(emailBody)
    const links: string[] = []

    // Look for unsubscribe links with high confidence
    const unsubscribeSelectors = [
      'a[href*="unsubscribe"]',
      'a[href*="optout"]',
      'a[href*="opt-out"]',
      'a:contains("unsubscribe")',
      'a:contains("opt out")',
      'a:contains("remove me")',
      'a:contains("stop emails")',
      'a:contains("email preferences")',
      '[data-testid*="unsubscribe"]',
      '.unsubscribe a',
      '#unsubscribe a'
    ]

    unsubscribeSelectors.forEach(selector => {
      try {
        $(selector).each((_, element) => {
          const href = $(element).attr('href')
          const text = $(element).text().toLowerCase()
          
          if (href && this.isValidUnsubscribeLink(href, text)) {
            links.push(href)
          }
        })
      } catch (error) {
        console.warn(`Error parsing selector ${selector}:`, error)
      }
    })

    // Look for form-based unsubscribes
    const forms = $('form').filter((_, form) => {
      const formHtml = $(form).html()?.toLowerCase() || ''
      return formHtml.includes('unsubscribe') || formHtml.includes('opt out')
    })

    if (forms.length > 0) {
      forms.each((_, form) => {
        const action = $(form).attr('action')
        if (action) {
          links.push(action)
        }
      })
    }

    // Remove duplicates
    const uniqueLinks = [...new Set(links)]
    
    return {
      found: uniqueLinks.length > 0,
      links: uniqueLinks,
      method: forms.length > 0 ? 'form' : 'link',
      confidence: this.calculateConfidence(uniqueLinks, emailBody)
    }
  }

  private static isValidUnsubscribeLink(href: string, text: string): boolean {
    // Skip obviously bad links
    if (!href || href === '#' || href.startsWith('javascript:')) {
      return false
    }

    // Must be a valid URL
    if (!href.startsWith('http') && !href.startsWith('mailto:')) {
      return false
    }

    // Check for unsubscribe keywords
    const unsubscribeKeywords = [
      'unsubscribe',
      'optout',
      'opt-out',
      'remove',
      'stop',
      'email-preferences',
      'preferences'
    ]

    const linkText = href.toLowerCase() + ' ' + text
    return unsubscribeKeywords.some(keyword => linkText.includes(keyword))
  }

  private static calculateConfidence(links: string[], emailBody: string): number {
    if (links.length === 0) return 0

    let confidence = 0.5 // Base confidence

    // Higher confidence for multiple unsubscribe mentions
    const unsubscribeCount = (emailBody.toLowerCase().match(/unsubscribe/g) || []).length
    confidence += Math.min(unsubscribeCount * 0.1, 0.3)

    // Higher confidence for HTTPS links
    const httpsLinks = links.filter(link => link.startsWith('https:')).length
    confidence += (httpsLinks / links.length) * 0.2

    return Math.min(confidence, 1.0)
  }

  static async performUnsubscribe(unsubscribeInfo: UnsubscribeInfo): Promise<{ success: boolean; message: string }> {
    if (!unsubscribeInfo.found || unsubscribeInfo.links.length === 0) {
      return { success: false, message: 'No unsubscribe method found' }
    }

    const link = unsubscribeInfo.links[0] // Use first available link

    try {
      if (link.startsWith('mailto:')) {
        // Handle email-based unsubscribe
        return { 
          success: false, 
          message: 'Email-based unsubscribe requires manual action: ' + link 
        }
      }

      // Attempt HTTP unsubscribe
      const response = await axios.get(link, {
        timeout: 10000,
        validateStatus: () => true, // Accept any status code
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; EmailCleaner/1.0)'
        }
      })

      if (response.status >= 200 && response.status < 400) {
        return { success: true, message: 'Successfully unsubscribed' }
      } else {
        return { 
          success: false, 
          message: `Unsubscribe request returned status ${response.status}` 
        }
      }

    } catch (error) {
      console.error('Unsubscribe error:', error)
      return { 
        success: false, 
        message: 'Failed to process unsubscribe request' 
      }
    }
  }

  static groupByDomain(emails: { from: string; [key: string]: any }[]): { [domain: string]: any[] } {
    const grouped: { [domain: string]: any[] } = {}

    emails.forEach(email => {
      const domain = this.extractDomain(email.from)
      if (!grouped[domain]) {
        grouped[domain] = []
      }
      grouped[domain].push(email)
    })

    return grouped
  }

  private static extractDomain(fromAddress: string): string {
    const match = fromAddress.match(/@([^>]+)/)
    return match ? match[1].toLowerCase().trim() : 'unknown'
  }

  static categorizeNewsletters(emails: any[]): {
    marketing: any[]
    news: any[]
    social: any[]
    transactional: any[]
    other: any[]
  } {
    const categories = {
      marketing: [] as any[],
      news: [] as any[],
      social: [] as any[],
      transactional: [] as any[],
      other: [] as any[]
    }

    const marketingKeywords = ['sale', 'offer', 'discount', 'promo', 'deal', 'shop']
    const newsKeywords = ['newsletter', 'digest', 'weekly', 'daily', 'update', 'news']
    const socialKeywords = ['facebook', 'twitter', 'linkedin', 'instagram', 'notification']
    const transactionalKeywords = ['receipt', 'order', 'payment', 'invoice', 'confirmation']

    emails.forEach(email => {
      const text = `${email.subject} ${email.from}`.toLowerCase()
      
      if (marketingKeywords.some(keyword => text.includes(keyword))) {
        categories.marketing.push(email)
      } else if (newsKeywords.some(keyword => text.includes(keyword))) {
        categories.news.push(email)
      } else if (socialKeywords.some(keyword => text.includes(keyword))) {
        categories.social.push(email)
      } else if (transactionalKeywords.some(keyword => text.includes(keyword))) {
        categories.transactional.push(email)
      } else {
        categories.other.push(email)
      }
    })

    return categories
  }
}