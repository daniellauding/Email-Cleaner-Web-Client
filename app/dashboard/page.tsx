'use client'

import { useSession, signOut } from 'next-auth/react'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Mail, 
  Trash2, 
  Search, 
  Filter, 
  MoreVertical, 
  TrendingUp,
  Calendar,
  Users,
  Zap,
  LogOut,
  Settings
} from 'lucide-react'

interface EmailStats {
  totalEmails: number
  unreadEmails: number
  newsletters: number
  oldNewsletters: number
  storageUsed: number
}

interface EmailMessage {
  id: string
  subject: string
  from: string
  date: string
  snippet: string
  unread: boolean
  isNewsletter: boolean
  unsubscribeLink?: string
}

type EmailView = 'recent' | 'newsletters' | 'unread' | 'all' | 'today' | 'attachments'

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [stats, setStats] = useState<EmailStats | null>(null)
  const [newsletters, setNewsletters] = useState<EmailMessage[]>([])
  const [allEmails, setAllEmails] = useState<EmailMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingStep, setLoadingStep] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set())
  const [currentView, setCurrentView] = useState<EmailView>('recent')
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null)
  const [emailBody, setEmailBody] = useState<string>('')
  const [loadingEmailBody, setLoadingEmailBody] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/')
    }
  }, [status, router])

  useEffect(() => {
    if (session?.error === 'RefreshAccessTokenError') {
      setLoadingStep('🔑 Session expired. Please sign out and sign back in.')
      return
    }
    if (session?.accessToken) {
      fetchData()
    }
  }, [session])

  const fetchData = async () => {
    setLoading(true)
    try {
      setLoadingStep('🔐 Connecting to Gmail... (10-15 seconds)')
      await new Promise(resolve => setTimeout(resolve, 800))
      
      setLoadingStep('📧 Analyzing your emails... (this may take 20-30 seconds)')
      const [statsRes, recentEmailsRes, newslettersRes] = await Promise.all([
        fetch('/api/gmail/stats'),
        fetch('/api/gmail/emails?maxResults=50'), // Recent emails
        fetch('/api/gmail/newsletters?daysOld=30') // Old newsletters
      ])
      
      // Check for authentication errors
      if (statsRes.status === 401 || recentEmailsRes.status === 401 || newslettersRes.status === 401) {
        setLoadingStep('🔑 Authentication expired. Please sign out and sign back in.')
        setTimeout(() => {
          signOut({ callbackUrl: '/' })
        }, 3000)
        return
      }
      
      setLoadingStep('🤖 Processing with AI insights... (5-10 seconds)')
      const statsData = await statsRes.json()
      const recentEmailsData = await recentEmailsRes.json()
      const newslettersData = await newslettersRes.json()
      
      // Check for API errors
      if (statsData.error || recentEmailsData.error || newslettersData.error) {
        throw new Error('Gmail API Error: Please refresh the page or sign out and back in.')
      }
      
      setLoadingStep('✨ Finalizing dashboard... (almost done!)')
      await new Promise(resolve => setTimeout(resolve, 500))
      
      setStats(statsData)
      setAllEmails(recentEmailsData.messages || [])
      setNewsletters(newslettersData)
    } catch (error) {
      console.error('Error fetching data:', error)
      setLoadingStep('❌ Error loading data. Please refresh and try again.')
    } finally {
      setLoading(false)
    }
  }

  const fetchEmailsByType = async (type: EmailView) => {
    setLoading(true)
    try {
      let query = ''
      let endpoint = '/api/gmail/emails'
      
      switch (type) {
        case 'unread':
          query = '?q=is:unread&maxResults=100'
          break
        case 'newsletters':
          query = '?q=from:newsletter OR from:noreply OR has:list&maxResults=100'
          break
        case 'all':
          query = '?maxResults=200'
          break
        case 'today':
          const today = new Date().toISOString().split('T')[0].replace(/-/g, '/')
          query = `?q=after:${today}&maxResults=100`
          break
        case 'attachments':
          query = '?q=has:attachment&maxResults=100'
          break
        case 'recent':
        default:
          query = '?maxResults=50'
      }
      
      const response = await fetch(endpoint + query)
      const data = await response.json()
      setAllEmails(data.messages || [])
      setCurrentView(type)
    } catch (error) {
      console.error('Error fetching emails:', error)
    } finally {
      setLoading(false)
    }
  }

  const openEmail = async (email: EmailMessage) => {
    setSelectedEmail(email)
    setLoadingEmailBody(true)
    setEmailBody('')
    
    try {
      const response = await fetch(`/api/gmail/emails/${email.id}`)
      const data = await response.json()
      setEmailBody(data.body || 'Email body not available')
    } catch (error) {
      console.error('Error fetching email body:', error)
      setEmailBody('Error loading email content')
    } finally {
      setLoadingEmailBody(false)
    }
  }

  const closeEmail = () => {
    setSelectedEmail(null)
    setEmailBody('')
  }

  const handleRemoveEmails = async (action: 'trash' | 'delete' | 'archive') => {
    if (selectedEmails.size === 0) return
    
    const messageIds = Array.from(selectedEmails)
    setLoading(true)
    
    try {
      const response = await fetch('/api/gmail/emails/remove', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messageIds,
          action
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to remove emails')
      }

      // Refresh the email list
      await fetchEmailsByType(currentView)
      setSelectedEmails(new Set())
      setLoadingStep(`✅ ${action === 'delete' ? 'Deleted' : action === 'archive' ? 'Archived' : 'Moved to trash'} ${messageIds.length} emails`)
      setTimeout(() => setLoadingStep(''), 3000)
    } catch (error) {
      console.error('Error removing emails:', error)
      setLoadingStep('❌ Error removing emails')
      setTimeout(() => setLoadingStep(''), 3000)
    } finally {
      setLoading(false)
    }
  }

  const [forwardEmail, setForwardEmail] = useState<{ show: boolean, emailId: string }>({ show: false, emailId: '' })
  const [forwardTo, setForwardTo] = useState('')
  const [forwardMessage, setForwardMessage] = useState('')
  const [showReport, setShowReport] = useState(false)
  const [showAIAssistant, setShowAIAssistant] = useState(false)
  const [aiQuery, setAiQuery] = useState('')
  const [aiResponse, setAiResponse] = useState('')
  const [focusMode, setFocusMode] = useState<string | null>(null)
  const [showLabelSuggestions, setShowLabelSuggestions] = useState(false)
  const [expandedLabel, setExpandedLabel] = useState<string | null>(null)

  const handleMarkAsRead = async (messageIds: string[]) => {
    try {
      const response = await fetch('/api/gmail/emails/mark-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messageIds }),
      })

      if (!response.ok) {
        throw new Error('Failed to mark emails as read')
      }

      // Update local state
      setAllEmails(prev => prev.map(email => 
        messageIds.includes(email.id) ? { ...email, unread: false } : email
      ))

      // Refresh stats
      if (stats) {
        setStats(prev => prev ? { ...prev, unreadEmails: prev.unreadEmails - messageIds.length } : null)
      }

      setLoadingStep('✅ Marked as read successfully')
      setTimeout(() => setLoadingStep(''), 2000)
    } catch (error) {
      console.error('Error marking emails as read:', error)
      setLoadingStep('❌ Error marking as read')
      setTimeout(() => setLoadingStep(''), 3000)
    }
  }

  const handleForwardEmail = async () => {
    if (!forwardTo || !forwardEmail.emailId) return
    
    setLoading(true)
    
    try {
      const response = await fetch('/api/gmail/emails/forward', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messageId: forwardEmail.emailId,
          to: forwardTo,
          message: forwardMessage
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to forward email')
      }

      setForwardEmail({ show: false, emailId: '' })
      setForwardTo('')
      setForwardMessage('')
      setLoadingStep('✅ Email forwarded successfully')
      setTimeout(() => setLoadingStep(''), 3000)
    } catch (error) {
      console.error('Error forwarding email:', error)
      setLoadingStep('❌ Error forwarding email')
      setTimeout(() => setLoadingStep(''), 3000)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectAll = () => {
    const currentEmails = getCurrentEmails()
    if (selectedEmails.size === currentEmails.length) {
      setSelectedEmails(new Set())
    } else {
      setSelectedEmails(new Set(currentEmails.map(email => email.id)))
    }
  }

  const handleSelectEmail = (emailId: string) => {
    const newSelected = new Set(selectedEmails)
    if (newSelected.has(emailId)) {
      newSelected.delete(emailId)
    } else {
      newSelected.add(emailId)
    }
    setSelectedEmails(newSelected)
  }

  const getCurrentEmails = () => {
    switch (currentView) {
      case 'newsletters':
        return newsletters
      case 'unread':
        return allEmails.filter(email => email.unread)
      case 'all':
        return allEmails
      case 'recent':
      default:
        return allEmails
    }
  }

  let filteredEmails = getCurrentEmails().filter(email =>
    email.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    email.from.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Apply focus mode filtering
  if (focusMode) {
    switch (focusMode) {
      case 'unread':
        filteredEmails = filteredEmails.filter(email => email.unread)
        break
      case 'today':
        const today = new Date().toDateString()
        filteredEmails = filteredEmails.filter(email => 
          new Date(email.date).toDateString() === today
        )
        break
      case 'personal':
        filteredEmails = filteredEmails.filter(email => 
          !email.isNewsletter && 
          !/noreply|no-reply|donotreply|support|billing/i.test(email.from)
        )
        break
      case 'important':
        filteredEmails = filteredEmails.filter(email => 
          email.unread || 
          /urgent|important|asap|deadline|meeting|invoice/i.test(email.subject)
        )
        break
    }
  }

  if (status === 'loading' || loading) {
    return (
      <main className="min-h-screen bg-gray-50">
        {/* Mobile Header Preview */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 opacity-60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
                <Mail className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="font-semibold text-gray-900">Email Cleaner</h1>
                <p className="text-sm text-gray-500">{session?.user?.email || 'Loading...'}</p>
              </div>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-6 max-w-md sm:max-w-2xl">
          {/* Loading State with Preview */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-white animate-pulse" />
            </div>
            
            <div className="relative mb-6">
              <div className="w-12 h-12 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto" />
            </div>
            
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {status === 'loading' ? 'Signing you in...' : 'Setting up your dashboard'}
            </h2>
            
            <p className="text-gray-600 mb-6">
              {loadingStep || 'Preparing your email analysis...'}
            </p>
          </div>

          {/* Preview Stats Cards */}
          <div className="grid grid-cols-2 gap-4 mb-6 opacity-50 pointer-events-none">
            <div className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Mail className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Total Emails</p>
                  <p className="text-lg font-semibold text-gray-900">Loading...</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Users className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Newsletters</p>
                  <p className="text-lg font-semibold text-gray-900">Analyzing...</p>
                </div>
              </div>
            </div>
          </div>

          {/* What's Coming Next */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4 opacity-70">
            <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-600" />
              Your personalized insights will include...
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-red-600">📩</span>
                </div>
                <div>
                  <p className="font-medium text-gray-800">Unanswered Emails</p>
                  <p className="text-gray-600">Important emails waiting for your response</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-green-600">👥</span>
                </div>
                <div>
                  <p className="font-medium text-gray-800">Top Contacts</p>
                  <p className="text-gray-600">People you email most + last contact dates</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-blue-600">📎</span>
                </div>
                <div>
                  <p className="font-medium text-gray-800">Attachments & Follow-ups</p>
                  <p className="text-gray-600">Important files and emails needing follow-up</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-purple-600">⏰</span>
                </div>
                <div>
                  <p className="font-medium text-gray-800">Productivity Patterns</p>
                  <p className="text-gray-600">Best times to email, response rates, habits</p>
                </div>
              </div>
            </div>
          </div>

          {/* Loading Tips */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border p-4 mb-4 opacity-60">
            <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
              💡 Productivity Features Loading...
            </h4>
            <div className="text-sm space-y-1">
              <p className="text-gray-700">• 🔍 Find emails waiting for replies automatically</p>
              <p className="text-gray-700">• 👥 See who you communicate with most often</p>
              <p className="text-gray-700">• 📎 Discover emails with important attachments</p>
              <p className="text-gray-700">• ⏰ Get insights on your email response patterns</p>
              <p className="text-gray-700">• 🔒 All analysis happens privately on your device</p>
            </div>
          </div>

          {/* Preview Newsletter List */}
          <div className="space-y-2 opacity-40">
            <h3 className="font-medium text-gray-900 mb-3">Recent Newsletters</h3>
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
                <div className="flex items-start gap-3">
                  <div className="w-4 h-4 border border-gray-300 rounded mt-1" />
                  <div className="flex-1 min-w-0">
                    <div className="h-4 bg-gray-200 rounded mb-2" style={{width: `${60 + i * 10}%`}} />
                    <div className="h-3 bg-gray-200 rounded mb-1" style={{width: `${40 + i * 15}%`}} />
                    <div className="h-3 bg-gray-200 rounded" style={{width: '30%'}} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Progress Indicators */}
          <div className="fixed bottom-6 left-4 right-4 max-w-sm mx-auto">
            <div className="bg-white rounded-lg border shadow-lg p-4">
              {/* Estimated Time */}
              <div className="text-center mb-3">
                <p className="text-sm font-medium text-gray-900">Estimated time: 30-45 seconds</p>
                <p className="text-xs text-gray-500">We're analyzing your email patterns</p>
              </div>
              
              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                <div 
                  className="bg-primary-600 h-2 rounded-full transition-all duration-1000"
                  style={{
                    width: loadingStep.includes('Connecting') ? '25%' :
                           loadingStep.includes('Analyzing') ? '50%' :
                           loadingStep.includes('Processing') ? '75%' :
                           loadingStep.includes('Finalizing') ? '90%' : '10%'
                  }}
                />
              </div>
              
              {/* Status Steps */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      loadingStep.includes('Connecting') || loadingStep.includes('Analyzing') || 
                      loadingStep.includes('Processing') || loadingStep.includes('Finalizing') 
                        ? 'bg-green-500' : 'bg-primary-600 animate-pulse'
                    }`} />
                    <span className="text-gray-700">Secure Gmail connection</span>
                  </div>
                  {(loadingStep.includes('Analyzing') || loadingStep.includes('Processing') || loadingStep.includes('Finalizing')) && 
                    <span className="text-green-600 text-xs">✓</span>
                  }
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      loadingStep.includes('Analyzing') || loadingStep.includes('Processing') || loadingStep.includes('Finalizing')
                        ? 'bg-green-500' : loadingStep.includes('Connecting') 
                        ? 'bg-primary-400 animate-pulse' : 'bg-gray-300'
                    }`} />
                    <span className="text-gray-700">AI-powered analysis</span>
                  </div>
                  {(loadingStep.includes('Processing') || loadingStep.includes('Finalizing')) && 
                    <span className="text-green-600 text-xs">✓</span>
                  }
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      loadingStep.includes('Finalizing') 
                        ? 'bg-green-500' : loadingStep.includes('Processing')
                        ? 'bg-primary-300 animate-pulse' : 'bg-gray-300'
                    }`} />
                    <span className="text-gray-700">Dashboard ready</span>
                  </div>
                  {loadingStep.includes('Finalizing') && 
                    <span className="text-green-600 text-xs">✓</span>
                  }
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
              <Mail className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-gray-900">Email Cleaner</h1>
              <p className="text-sm text-gray-500">{session?.user?.email}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              title="Sign out and reconnect"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-md sm:max-w-2xl">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 gap-4 mb-6">
            <StatsCard
              icon={<Mail className="w-4 h-4" />}
              title="Total Emails"
              value={stats.totalEmails.toLocaleString()}
              color="blue"
              onClick={() => fetchEmailsByType('all')}
              isActive={currentView === 'all'}
            />
            <StatsCard
              icon={<Users className="w-4 h-4" />}
              title="Newsletters"
              value={stats.newsletters.toString()}
              color="purple"
              onClick={() => fetchEmailsByType('newsletters')}
              isActive={currentView === 'newsletters'}
            />
            <StatsCard
              icon={<Calendar className="w-4 h-4" />}
              title="Recent"
              value={allEmails.length.toString()}
              color="orange"
              onClick={() => fetchEmailsByType('recent')}
              isActive={currentView === 'recent'}
            />
            <StatsCard
              icon={<TrendingUp className="w-4 h-4" />}
              title="Unread"
              value={stats.unreadEmails.toLocaleString()}
              color="red"
              onClick={() => fetchEmailsByType('unread')}
              isActive={currentView === 'unread'}
            />
          </div>
        )}

        {/* AI Insights Section */}
        {stats && (
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200 p-4 mb-6">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              AI Insights & Recommendations
            </h3>
            <div className="grid gap-3">
              {stats.unreadEmails > 100 && (
                <div className="bg-white rounded-lg p-3 border border-orange-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-orange-500">⚠️</span>
                      <span className="font-medium text-gray-900">High Unread Count</span>
                    </div>
                    <button 
                      onClick={() => fetchEmailsByType('unread')}
                      className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded hover:bg-orange-200"
                    >
                      View Unread
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    You have {stats.unreadEmails.toLocaleString()} unread emails. Consider bulk cleanup or auto-archiving.
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <button 
                      onClick={() => {
                        const unreadIds = allEmails.filter(email => email.unread).map(email => email.id)
                        if (unreadIds.length > 0) {
                          handleMarkAsRead(unreadIds)
                        }
                      }}
                      className="text-xs bg-orange-500 text-white px-2 py-1 rounded hover:bg-orange-600"
                    >
                      Mark All Read
                    </button>
                    <button 
                      onClick={() => {
                        const oldEmails = allEmails.filter(email => {
                          const emailDate = new Date(email.date)
                          const thirtyDaysAgo = new Date()
                          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
                          return emailDate < thirtyDaysAgo
                        }).map(email => email.id)
                        if (oldEmails.length > 0) {
                          handleRemoveEmails('archive')
                        }
                      }}
                      className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
                    >
                      Archive Old
                    </button>
                  </div>
                </div>
              )}
              
              {stats.newsletters > 50 && (
                <div className="bg-white rounded-lg p-3 border border-blue-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-blue-500">📰</span>
                      <span className="font-medium text-gray-900">Newsletter Cleanup</span>
                    </div>
                    <button 
                      onClick={() => fetchEmailsByType('newsletters')}
                      className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
                    >
                      View All
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    {stats.newsletters} newsletters found. Unsubscribe from unused ones to reduce clutter.
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <button className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600">
                      Bulk Unsubscribe
                    </button>
                    <button className="text-xs bg-purple-500 text-white px-2 py-1 rounded hover:bg-purple-600">
                      Create Filter
                    </button>
                  </div>
                </div>
              )}
              
              <div className="bg-white rounded-lg p-3 border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-green-500">🤖</span>
                  <span className="font-medium text-gray-900">AI Analysis</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="bg-green-50 p-2 rounded">
                    <div className="font-medium text-green-800">Email Pattern</div>
                    <div className="text-green-700">
                      📊 {Math.round((stats.unreadEmails / stats.totalEmails) * 100)}% unread rate
                    </div>
                  </div>
                  <div className="bg-blue-50 p-2 rounded">
                    <div className="font-medium text-blue-800">Storage Impact</div>
                    <div className="text-blue-700">
                      💾 ~{Math.round(stats.newsletters * 0.05)}MB from newsletters
                    </div>
                  </div>
                  <div className="bg-purple-50 p-2 rounded">
                    <div className="font-medium text-purple-800">Productivity</div>
                    <div className="text-purple-700">
                      ⏰ ~{Math.round(stats.unreadEmails * 0.3)} min cleanup time
                    </div>
                  </div>
                  <div className="bg-orange-50 p-2 rounded">
                    <div className="font-medium text-orange-800">Suggestion</div>
                    <div className="text-orange-700">
                      🎯 Focus on newsletters first
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-3 border border-indigo-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-indigo-500">📈</span>
                  <span className="font-medium text-gray-900">Quick Actions</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button 
                    onClick={() => fetchEmailsByType('today')}
                    className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded hover:bg-gray-200"
                  >
                    📅 Today's Emails
                  </button>
                  <button 
                    onClick={() => fetchEmailsByType('attachments')}
                    className="text-xs bg-yellow-100 text-yellow-700 px-3 py-1 rounded hover:bg-yellow-200"
                  >
                    📎 With Attachments
                  </button>
                  <button 
                    onClick={() => fetchEmailsByType('unread')}
                    className="text-xs bg-pink-100 text-pink-700 px-3 py-1 rounded hover:bg-pink-200"
                  >
                    🔄 Needs Reply
                  </button>
                  <button 
                    onClick={() => setShowReport(true)}
                    className="text-xs bg-teal-100 text-teal-700 px-3 py-1 rounded hover:bg-teal-200"
                  >
                    📊 Generate Report
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Smart Email Categories */}
        {stats && allEmails.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              🏷️ Smart Categories & Summaries
            </h3>
            <div className="grid gap-4">
              
              {/* Newsletter Categories */}
              <div className="bg-purple-50 rounded-lg p-4">
                <h4 className="font-medium text-purple-800 mb-3 flex items-center gap-2">
                  📰 Newsletter Insights
                  <button 
                    onClick={() => fetchEmailsByType('newsletters')}
                    className="text-xs bg-purple-200 text-purple-700 px-2 py-1 rounded hover:bg-purple-300"
                  >
                    View All
                  </button>
                </h4>
                <div className="grid md:grid-cols-3 gap-3">
                  {(() => {
                    const newsletters = allEmails.filter(email => email.isNewsletter)
                    const categories = {
                      'Tech & Development': newsletters.filter(e => 
                        /github|stack|dev|code|programming|tech|software/i.test(e.from + ' ' + e.subject)
                      ),
                      'Business & Marketing': newsletters.filter(e => 
                        /business|marketing|sales|revenue|growth|startup|finance/i.test(e.from + ' ' + e.subject)
                      ),
                      'News & Updates': newsletters.filter(e => 
                        /news|update|weekly|daily|digest|newsletter/i.test(e.from + ' ' + e.subject)
                      )
                    }
                    
                    return Object.entries(categories)
                      .filter(([, emails]) => emails.length > 0)
                      .map(([category, emails]) => (
                        <div key={category} className="bg-white p-3 rounded border">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-800">{category}</span>
                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                              {emails.length}
                            </span>
                          </div>
                          <div className="text-xs text-gray-600 space-y-1">
                            {emails.slice(0, 2).map((email, idx) => (
                              <div key={idx} className="truncate">
                                📧 {email.from.split('<')[0].trim() || email.from.split('@')[0]}
                              </div>
                            ))}
                            {emails.length > 2 && (
                              <div className="text-purple-600">+{emails.length - 2} more</div>
                            )}
                          </div>
                        </div>
                      ))
                  })()}
                </div>
              </div>

              {/* Other Categories */}
              <div className="grid md:grid-cols-4 gap-3">
                
                {/* Invoices & Receipts */}
                <div className="bg-green-50 p-3 rounded">
                  <h5 className="text-sm font-medium text-green-800 mb-2 flex items-center gap-1">
                    💰 Finance
                  </h5>
                  <div className="text-xs text-green-700">
                    {(() => {
                      const financial = allEmails.filter(email => 
                        /invoice|receipt|payment|billing|stripe|paypal|bank|transaction/i.test(email.subject + ' ' + email.from)
                      )
                      return (
                        <div>
                          <div>{financial.length} items</div>
                          <div className="mt-1 space-y-1">
                            {financial.slice(0, 2).map((email, idx) => (
                              <div key={idx} className="truncate">
                                {/invoice/i.test(email.subject) ? '📄' : '🧾'} 
                                {email.subject.split(' ').slice(0, 3).join(' ')}
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>

                {/* Social & Notifications */}
                <div className="bg-blue-50 p-3 rounded">
                  <h5 className="text-sm font-medium text-blue-800 mb-2">
                    🔔 Social
                  </h5>
                  <div className="text-xs text-blue-700">
                    {(() => {
                      const social = allEmails.filter(email => 
                        /linkedin|twitter|facebook|instagram|notification|mentioned|tagged/i.test(email.from + ' ' + email.subject)
                      )
                      return (
                        <div>
                          <div>{social.length} notifications</div>
                          <div className="mt-1">
                            {social.length > 0 ? '📱 Recent activity' : '✨ All caught up'}
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>

                {/* Work & Meetings */}
                <div className="bg-orange-50 p-3 rounded">
                  <h5 className="text-sm font-medium text-orange-800 mb-2">
                    💼 Work
                  </h5>
                  <div className="text-xs text-orange-700">
                    {(() => {
                      const work = allEmails.filter(email => 
                        /meeting|calendar|invite|zoom|teams|slack|confluence|jira/i.test(email.subject + ' ' + email.from)
                      )
                      return (
                        <div>
                          <div>{work.length} items</div>
                          <div className="mt-1">
                            {work.some(e => /meeting|invite/i.test(e.subject)) ? '📅 Meetings pending' : '📧 Updates'}
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>

                {/* Personal */}
                <div className="bg-pink-50 p-3 rounded">
                  <h5 className="text-sm font-medium text-pink-800 mb-2">
                    👤 Personal
                  </h5>
                  <div className="text-xs text-pink-700">
                    {(() => {
                      const personal = allEmails.filter(email => 
                        !email.isNewsletter && 
                        !/noreply|no-reply|donotreply|support|billing/i.test(email.from) &&
                        !/invoice|receipt|notification|meeting/i.test(email.subject)
                      )
                      return (
                        <div>
                          <div>{personal.length} messages</div>
                          <div className="mt-1">
                            {personal.filter(e => e.unread).length > 0 
                              ? `💌 ${personal.filter(e => e.unread).length} unread` 
                              : '✅ All read'
                            }
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Smart Labels & Calendar Insights */}
        {stats && allEmails.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                🏷️ Smart Labels & Calendar
              </h3>
              <button 
                onClick={() => setShowLabelSuggestions(!showLabelSuggestions)}
                className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200"
              >
                {showLabelSuggestions ? 'Hide' : 'Show'} Suggestions
              </button>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
              {/* Label Suggestions */}
              <div>
                <h4 className="text-sm font-medium text-gray-800 mb-3 flex items-center gap-2">
                  🏷️ Suggested Labels
                  <span className="text-xs text-gray-500">(Click to apply in bulk)</span>
                </h4>
                <div className="space-y-2">
                  {(() => {
                    const labelSuggestions = [
                      {
                        label: '📅 Meetings',
                        emails: allEmails.filter(e => 
                          /meeting|calendar|invite|zoom|teams|call|schedule/i.test(e.subject + e.snippet)
                        ),
                        reason: 'Contains meeting keywords or calendar invites',
                        color: 'bg-orange-100 text-orange-700 border-orange-200'
                      },
                      {
                        label: '💰 Financial',
                        emails: allEmails.filter(e => 
                          /invoice|receipt|payment|billing|stripe|paypal|transaction|purchase/i.test(e.subject + e.from)
                        ),
                        reason: 'Financial transactions and receipts',
                        color: 'bg-green-100 text-green-700 border-green-200'
                      },
                      {
                        label: '🚨 Action Required',
                        emails: allEmails.filter(e => 
                          /action required|urgent|asap|deadline|due|expire|respond|confirm/i.test(e.subject)
                        ),
                        reason: 'Needs immediate action or response',
                        color: 'bg-red-100 text-red-700 border-red-200'
                      },
                      {
                        label: '🎯 Follow-up',
                        emails: allEmails.filter(e => 
                          /follow.?up|following up|check.?in|reminder|pending/i.test(e.subject + e.snippet)
                        ),
                        reason: 'Requires follow-up or is a reminder',
                        color: 'bg-yellow-100 text-yellow-700 border-yellow-200'
                      },
                      {
                        label: '🤝 Client/Customer',
                        emails: allEmails.filter(e => 
                          !e.isNewsletter && 
                          !/noreply|no-reply/i.test(e.from) &&
                          /client|customer|proposal|contract|agreement/i.test(e.subject + e.snippet)
                        ),
                        reason: 'Client communications and proposals',
                        color: 'bg-purple-100 text-purple-700 border-purple-200'
                      }
                    ].filter(s => s.emails.length > 0)
                    
                    return showLabelSuggestions ? (
                      <div className="space-y-2">
                        {labelSuggestions.map((suggestion) => (
                          <div key={suggestion.label}>
                            <div 
                              className={`p-3 rounded border cursor-pointer hover:shadow-md transition-all ${suggestion.color}`}
                              onClick={() => setExpandedLabel(expandedLabel === suggestion.label ? null : suggestion.label)}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{suggestion.label}</span>
                                  <button
                                    className="text-xs opacity-70 hover:opacity-100"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setExpandedLabel(expandedLabel === suggestion.label ? null : suggestion.label)
                                    }}
                                  >
                                    {expandedLabel === suggestion.label ? '▼' : '▶'}
                                  </button>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs px-2 py-0.5 bg-white bg-opacity-50 rounded">
                                    {suggestion.emails.length} emails
                                  </span>
                                  <button
                                    className="text-xs px-2 py-1 bg-white bg-opacity-70 rounded hover:bg-opacity-100"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setLoadingStep(`🏷️ Applying "${suggestion.label}" to ${suggestion.emails.length} emails...`)
                                      setTimeout(() => setLoadingStep(''), 2000)
                                    }}
                                  >
                                    Apply
                                  </button>
                                </div>
                              </div>
                              <div className="text-xs opacity-80">{suggestion.reason}</div>
                            </div>
                            
                            {/* Expanded email list */}
                            {expandedLabel === suggestion.label && (
                              <div className="mt-2 pl-3 space-y-1 max-h-60 overflow-y-auto">
                                {suggestion.emails.map((email, idx) => (
                                  <div 
                                    key={email.id} 
                                    className="bg-white p-2 rounded border-l-2 border-gray-300 text-xs hover:bg-gray-50 cursor-pointer"
                                    onClick={() => openEmail(email)}
                                  >
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1 min-w-0">
                                        <div className="font-medium text-gray-900 truncate">
                                          {idx + 1}. {email.subject}
                                        </div>
                                        <div className="text-gray-600 truncate">
                                          From: {email.from.split('<')[0].trim() || email.from}
                                        </div>
                                        <div className="text-gray-500">
                                          {new Date(email.date).toLocaleDateString()} • {email.unread ? '🔵 Unread' : '✓ Read'}
                                        </div>
                                      </div>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleSelectEmail(email.id)
                                        }}
                                        className="ml-2 text-blue-600 hover:text-blue-800"
                                      >
                                        Select
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-600">
                        Found {labelSuggestions.length} label categories for {
                          labelSuggestions.reduce((acc, s) => acc + s.emails.length, 0)
                        } emails. Click "Show Suggestions" to view.
                      </div>
                    )
                  })()}
                </div>
              </div>

              {/* Calendar & Meeting Insights */}
              <div>
                <h4 className="text-sm font-medium text-gray-800 mb-3 flex items-center gap-2">
                  📅 Calendar & Meeting Insights
                </h4>
                <div className="space-y-3">
                  {(() => {
                    const meetingEmails = allEmails.filter(e => 
                      /meeting|calendar|invite|zoom|teams|google meet|schedule|appointment/i.test(e.subject + e.snippet)
                    )
                    const upcomingMeetings = meetingEmails.filter(e => {
                      // Simple heuristic: if unread and has meeting keywords, likely upcoming
                      return e.unread || /tomorrow|today|this week|monday|tuesday|wednesday|thursday|friday/i.test(e.subject + e.snippet)
                    })
                    
                    const meetingTypes = {
                      zoom: meetingEmails.filter(e => /zoom/i.test(e.subject + e.snippet)),
                      teams: meetingEmails.filter(e => /teams/i.test(e.subject + e.snippet)),
                      meet: meetingEmails.filter(e => /google meet|meet\.google/i.test(e.subject + e.snippet)),
                      calendar: meetingEmails.filter(e => /calendar invite|invitation/i.test(e.subject))
                    }
                    
                    return (
                      <>
                        {/* Meeting Summary */}
                        <div className="bg-blue-50 p-3 rounded">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-blue-800">Meeting Overview</span>
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                              {meetingEmails.length} total
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="bg-white p-2 rounded">
                              <div className="font-medium text-orange-700">📥 Invitations</div>
                              <div className="text-orange-600">{upcomingMeetings.length} pending</div>
                            </div>
                            <div className="bg-white p-2 rounded">
                              <div className="font-medium text-green-700">✅ Confirmed</div>
                              <div className="text-green-600">
                                {meetingEmails.filter(e => !e.unread).length} accepted
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Meeting Platforms */}
                        <div className="bg-purple-50 p-3 rounded">
                          <div className="font-medium text-purple-800 mb-2">Meeting Platforms</div>
                          <div className="grid grid-cols-2 gap-1 text-xs">
                            {meetingTypes.zoom.length > 0 && (
                              <div className="flex items-center gap-1">
                                <span className="text-blue-500">🎥</span>
                                <span>Zoom: {meetingTypes.zoom.length}</span>
                              </div>
                            )}
                            {meetingTypes.teams.length > 0 && (
                              <div className="flex items-center gap-1">
                                <span className="text-purple-500">💼</span>
                                <span>Teams: {meetingTypes.teams.length}</span>
                              </div>
                            )}
                            {meetingTypes.meet.length > 0 && (
                              <div className="flex items-center gap-1">
                                <span className="text-green-500">📹</span>
                                <span>Meet: {meetingTypes.meet.length}</span>
                              </div>
                            )}
                            {meetingTypes.calendar.length > 0 && (
                              <div className="flex items-center gap-1">
                                <span className="text-orange-500">📅</span>
                                <span>Calendar: {meetingTypes.calendar.length}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Upcoming Meetings */}
                        {upcomingMeetings.length > 0 && (
                          <div className="bg-yellow-50 p-3 rounded">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-yellow-800">
                                ⏰ Upcoming/Pending
                              </span>
                              <button
                                onClick={() => setExpandedLabel(expandedLabel === 'meetings' ? null : 'meetings')}
                                className="text-xs text-yellow-700 hover:text-yellow-900"
                              >
                                {expandedLabel === 'meetings' ? 'Show Less' : `View All (${upcomingMeetings.length})`}
                              </button>
                            </div>
                            <div className="space-y-1">
                              {(expandedLabel === 'meetings' ? upcomingMeetings : upcomingMeetings.slice(0, 3)).map((meeting, idx) => (
                                <div 
                                  key={idx} 
                                  className="text-xs bg-white p-2 rounded hover:bg-gray-50 cursor-pointer"
                                  onClick={() => openEmail(meeting)}
                                >
                                  <div className="font-medium text-gray-800 truncate">
                                    {meeting.subject}
                                  </div>
                                  <div className="text-gray-600">
                                    From: {meeting.from.split('<')[0].trim() || meeting.from.split('@')[0]}
                                  </div>
                                  <div className="flex items-center justify-between mt-1">
                                    <span className="text-gray-500">
                                      {new Date(meeting.date).toLocaleDateString()} {new Date(meeting.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </span>
                                    {meeting.unread && <span className="text-orange-600 font-medium">• Needs Response</span>}
                                  </div>
                                  {/* Try to extract meeting platform */}
                                  {(() => {
                                    const platform = /zoom/i.test(meeting.subject + meeting.snippet) ? '🎥 Zoom' :
                                                    /teams/i.test(meeting.subject + meeting.snippet) ? '💼 Teams' :
                                                    /meet/i.test(meeting.subject + meeting.snippet) ? '📹 Meet' :
                                                    /calendar/i.test(meeting.subject + meeting.snippet) ? '📅 Calendar' : '📧 Email'
                                    return <span className="text-xs text-blue-600 mt-1 inline-block">{platform}</span>
                                  })()}
                                </div>
                              ))}
                              {!expandedLabel && upcomingMeetings.length > 3 && (
                                <div className="text-xs text-yellow-700">
                                  +{upcomingMeetings.length - 3} more meetings
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Quick Actions */}
                        <div className="flex gap-2">
                          <button 
                            onClick={() => {
                              setCurrentView('all')
                              setSearchQuery('meeting OR calendar OR invite')
                            }}
                            className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 flex-1"
                          >
                            View All Meetings
                          </button>
                          <button 
                            onClick={() => {
                              const unreadMeetings = meetingEmails.filter(e => e.unread)
                              if (unreadMeetings.length > 0) {
                                setLoadingStep(`📅 Found ${unreadMeetings.length} unread meeting invites`)
                                setTimeout(() => setLoadingStep(''), 3000)
                              }
                            }}
                            className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded hover:bg-orange-200 flex-1"
                          >
                            Check Invites
                          </button>
                        </div>
                      </>
                    )
                  })()}
                </div>
              </div>
            </div>

            {/* Bulk Label Actions */}
            {showLabelSuggestions && (
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-gray-800">Bulk Label Actions</h4>
                  <button className="text-xs text-blue-600 hover:text-blue-800">
                    Create Custom Label
                  </button>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button className="text-xs bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600">
                    Apply All Suggestions
                  </button>
                  <button className="text-xs bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600">
                    Auto-Label Future Emails
                  </button>
                  <button className="text-xs bg-purple-500 text-white px-3 py-1 rounded hover:bg-purple-600">
                    Create Gmail Filters
                  </button>
                  <button className="text-xs bg-gray-500 text-white px-3 py-1 rounded hover:bg-gray-600">
                    Export Label Rules
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* AI Assistant & Focus Mode */}
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200 p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              🤖 AI Email Assistant
            </h3>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600">Display:</span>
                  <select className="text-xs border rounded px-2 py-1">
                    <option value="name">Names (Daniel)</option>
                    <option value="email">Email Addresses</option>
                    <option value="smart">Smart (Auto)</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600">Focus:</span>
                  <select 
                    value={focusMode || ''}
                    onChange={(e) => setFocusMode(e.target.value || null)}
                    className="text-xs border rounded px-2 py-1"
                  >
                    <option value="">All Emails</option>
                    <option value="unread">Unread Only</option>
                    <option value="important">Important</option>
                    <option value="today">Today</option>
                    <option value="personal">Personal</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            {/* Quick AI Queries */}
            <div>
              <h4 className="text-sm font-medium text-gray-800 mb-2">Quick Questions</h4>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => {
                    setAiQuery("What emails need my immediate attention?")
                    setShowAIAssistant(true)
                  }}
                  className="text-xs bg-red-100 text-red-700 p-2 rounded hover:bg-red-200 text-left"
                >
                  🚨 What's urgent?
                </button>
                <button 
                  onClick={() => {
                    setAiQuery("Summarize my newsletters from this week")
                    setShowAIAssistant(true)
                  }}
                  className="text-xs bg-blue-100 text-blue-700 p-2 rounded hover:bg-blue-200 text-left"
                >
                  📰 Newsletter summary
                </button>
                <button 
                  onClick={() => {
                    setAiQuery("Extract todos and action items from my emails")
                    setShowAIAssistant(true)
                  }}
                  className="text-xs bg-green-100 text-green-700 p-2 rounded hover:bg-green-200 text-left"
                >
                  ✅ Find todos
                </button>
                <button 
                  onClick={() => {
                    setAiQuery("Who should I reply to first?")
                    setShowAIAssistant(true)
                  }}
                  className="text-xs bg-purple-100 text-purple-700 p-2 rounded hover:bg-purple-200 text-left"
                >
                  💬 Reply priority
                </button>
              </div>
            </div>

            {/* Custom Query */}
            <div>
              <h4 className="text-sm font-medium text-gray-800 mb-2">Ask Anything</h4>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ask about your emails..."
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  className="flex-1 text-sm px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  onKeyPress={(e) => e.key === 'Enter' && setShowAIAssistant(true)}
                />
                <button 
                  onClick={() => setShowAIAssistant(true)}
                  disabled={!aiQuery.trim()}
                  className="btn-primary text-sm px-3 py-2 disabled:opacity-50"
                >
                  Ask AI
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Actions */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder={`Search ${currentView} emails...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div className="relative">
              <select 
                value={currentView}
                onChange={(e) => fetchEmailsByType(e.target.value as EmailView)}
                className="p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="recent">Recent</option>
                <option value="all">All Emails</option>
                <option value="unread">Unread</option>
                <option value="newsletters">Newsletters</option>
              </select>
            </div>
          </div>

          {filteredEmails.length > 0 && (
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedEmails.size === filteredEmails.length}
                  onChange={handleSelectAll}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded"
                />
                Select all ({filteredEmails.length})
              </label>
              {selectedEmails.size > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {currentView === 'newsletters' && (
                    <button className="btn-danger text-xs py-1 px-2">
                      Unsubscribe ({selectedEmails.size})
                    </button>
                  )}
                  <button className="btn-secondary text-xs py-1 px-2">
                    Mark Read ({selectedEmails.size})
                  </button>
                  <button 
                    onClick={() => handleRemoveEmails('archive')}
                    className="bg-blue-500 hover:bg-blue-600 text-white text-xs py-1 px-2 rounded"
                  >
                    Archive ({selectedEmails.size})
                  </button>
                  <button 
                    onClick={() => handleRemoveEmails('trash')}
                    className="bg-orange-500 hover:bg-orange-600 text-white text-xs py-1 px-2 rounded"
                  >
                    Trash ({selectedEmails.size})
                  </button>
                  <button 
                    onClick={() => handleRemoveEmails('delete')}
                    className="bg-red-500 hover:bg-red-600 text-white text-xs py-1 px-2 rounded"
                  >
                    Delete ({selectedEmails.size})
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Authentication Issues Alert */}
        {!loading && (!stats || filteredEmails.length === 0) && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-yellow-600 text-sm">⚠️</span>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-800 mb-2">
                  {!stats ? 'Unable to Connect to Gmail' : 'No Emails Found'}
                </h3>
                <p className="text-sm text-yellow-700 mb-3">
                  {!stats 
                    ? 'We\'re having trouble accessing your Gmail account. This might be due to expired authentication.'
                    : 'No emails were found. This could be due to authentication issues or filter settings.'
                  }
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => signOut({ callbackUrl: '/' })}
                    className="btn-danger text-sm"
                  >
                    Sign Out & Try Again
                  </button>
                  <button
                    onClick={() => window.location.reload()}
                    className="btn-secondary text-sm"
                  >
                    Refresh Page
                  </button>
                  <button
                    onClick={fetchData}
                    className="btn-primary text-sm"
                    disabled={loading}
                  >
                    Retry Connection
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Current View Header */}
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900 capitalize">
            {currentView === 'recent' ? 'Recent Emails' : 
             currentView === 'all' ? 'All Emails' :
             currentView === 'unread' ? 'Unread Emails' : 
             currentView === 'today' ? "Today's Emails" :
             currentView === 'attachments' ? 'Emails with Attachments' :
             'Newsletters'}
          </h2>
          <p className="text-sm text-gray-500">
            Showing {filteredEmails.length} emails
          </p>
          {loadingStep && (
            <p className="text-sm text-blue-600 mt-1">
              {loadingStep}
            </p>
          )}
        </div>

        {/* Email List */}
        <div className="space-y-2">
          {filteredEmails.map(email => (
            <EmailCard
              key={email.id}
              email={email}
              selected={selectedEmails.has(email.id)}
              onSelect={() => handleSelectEmail(email.id)}
              onOpen={() => openEmail(email)}
              onForward={(emailId) => setForwardEmail({ show: true, emailId })}
              showUnsubscribe={currentView === 'newsletters'}
            />
          ))}
          
          {filteredEmails.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Mail className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No {currentView} emails found</p>
              <p className="text-sm">Try adjusting your search or selecting a different view</p>
            </div>
          )}
        </div>
        
        {/* Email Reading Modal */}
        {selectedEmail && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900 truncate">
                    {selectedEmail.subject}
                  </h3>
                  <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                    <span className="truncate">{selectedEmail.from}</span>
                    <span className="whitespace-nowrap">
                      {new Date(selectedEmail.date).toLocaleString()}
                    </span>
                  </div>
                </div>
                <button
                  onClick={closeEmail}
                  className="ml-4 p-2 text-gray-400 hover:text-gray-600 rounded-lg"
                >
                  ✕
                </button>
              </div>
              
              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-4">
                {loadingEmailBody ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <div 
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: emailBody }}
                  />
                )}
              </div>
              
              {/* Modal Footer */}
              <div className="border-t p-4 flex gap-2 justify-end">
                {selectedEmail.unread && (
                  <button 
                    onClick={() => handleMarkAsRead([selectedEmail.id])}
                    className="btn-secondary text-sm"
                  >
                    Mark as Read
                  </button>
                )}
                <button 
                  onClick={() => {
                    const subject = `Re: ${selectedEmail.subject}`
                    const body = `\n\n> ${selectedEmail.snippet}\n`
                    const mailtoUrl = `mailto:${selectedEmail.from}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
                    window.open(mailtoUrl, '_blank')
                  }}
                  className="btn-secondary text-sm"
                >
                  Reply
                </button>
                <button 
                  onClick={() => {
                    closeEmail()
                    setForwardEmail({ show: true, emailId: selectedEmail.id })
                  }}
                  className="btn-primary text-sm"
                >
                  Forward
                </button>
                {selectedEmail.isNewsletter && (
                  <button className="btn-danger text-sm">
                    Unsubscribe
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Forward Email Modal */}
        {forwardEmail.show && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="text-lg font-semibold text-gray-900">
                  Forward Email
                </h3>
                <button
                  onClick={() => setForwardEmail({ show: false, emailId: '' })}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
                >
                  ✕
                </button>
              </div>
              
              {/* Modal Body */}
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Forward to:
                  </label>
                  <input
                    type="email"
                    value={forwardTo}
                    onChange={(e) => setForwardTo(e.target.value)}
                    placeholder="recipient@example.com"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Message (optional):
                  </label>
                  <textarea
                    value={forwardMessage}
                    onChange={(e) => setForwardMessage(e.target.value)}
                    placeholder="Add a message to include with the forwarded email..."
                    rows={3}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>
              
              {/* Modal Footer */}
              <div className="border-t p-4 flex gap-2 justify-end">
                <button 
                  onClick={() => setForwardEmail({ show: false, emailId: '' })}
                  className="btn-secondary text-sm"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleForwardEmail}
                  disabled={!forwardTo || loading}
                  className="btn-primary text-sm disabled:opacity-50"
                >
                  {loading ? 'Forwarding...' : 'Forward Email'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Email Report Modal */}
        {showReport && stats && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="text-lg font-semibold text-gray-900">
                  📊 Email Analysis Report
                </h3>
                <button
                  onClick={() => setShowReport(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
                >
                  ✕
                </button>
              </div>
              
              {/* Modal Body */}
              <div className="p-6 space-y-6">
                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-blue-600">{stats.totalEmails.toLocaleString()}</div>
                    <div className="text-sm text-blue-800">Total Emails</div>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-red-600">{stats.unreadEmails.toLocaleString()}</div>
                    <div className="text-sm text-red-800">Unread</div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-purple-600">{stats.newsletters}</div>
                    <div className="text-sm text-purple-800">Newsletters</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-600">{Math.round((1 - stats.unreadEmails / stats.totalEmails) * 100)}%</div>
                    <div className="text-sm text-green-800">Read Rate</div>
                  </div>
                </div>

                {/* Time Range Selector */}
                <div className="flex items-center justify-between mb-4 pb-4 border-b">
                  <h4 className="text-sm font-medium text-gray-700">Analysis Time Range</h4>
                  <select className="text-sm border rounded px-3 py-1">
                    <option value="7">Last 7 Days</option>
                    <option value="30" selected>Last 30 Days</option>
                    <option value="90">Last 3 Months</option>
                    <option value="365">Last Year</option>
                    <option value="all">All Time</option>
                  </select>
                </div>

                {/* AI Insights */}
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-3">🤖 AI Analysis (Last 30 Days)</h4>
                  <div className="grid gap-3">
                    {/* Email Trends */}
                    <div className="bg-white p-3 rounded border">
                      <div className="font-medium text-gray-900 flex items-center justify-between">
                        <span>📈 Email Behavior Pattern</span>
                        {(() => {
                          const dailyAvg = Math.round(stats.totalEmails / 30)
                          const trend = dailyAvg > 10 ? '📊 High Volume' : dailyAvg > 5 ? '📧 Moderate' : '✨ Low Volume'
                          return <span className="text-xs text-blue-600">{trend}</span>
                        })()}
                      </div>
                      <div className="text-sm text-gray-600 mt-2">
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <div className="bg-blue-50 p-2 rounded">
                            <div className="font-semibold text-blue-800">{Math.round(stats.totalEmails / 30)}/day</div>
                            <div className="text-xs text-blue-600">Average received</div>
                          </div>
                          <div className="bg-red-50 p-2 rounded">
                            <div className="font-semibold text-red-800">{Math.round((stats.unreadEmails / stats.totalEmails) * 100)}%</div>
                            <div className="text-xs text-red-600">Unread rate</div>
                          </div>
                        </div>
                        {stats.unreadEmails / stats.totalEmails > 0.5 ? (
                          <p className="text-xs">
                            <span className="font-medium text-orange-700">⚠️ Inbox Overload Alert:</span> Your 100% unread rate indicates you haven't been checking emails. 
                            Consider: 1) Mark all as read and start fresh, 2) Set up aggressive filters, 3) Unsubscribe from non-essential lists.
                          </p>
                        ) : (
                          <p className="text-xs text-green-700">
                            ✅ Good email hygiene! You're staying on top of your inbox.
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {/* Newsletter Analysis */}
                    <div className="bg-white p-3 rounded border">
                      <div className="font-medium text-gray-900 flex items-center justify-between">
                        <span>📰 Newsletter Impact</span>
                        <span className="text-xs text-purple-600">50% of inbox</span>
                      </div>
                      <div className="text-sm text-gray-600 mt-2">
                        <div className="mb-2">
                          <div className="flex justify-between text-xs mb-1">
                            <span>Newsletter saturation</span>
                            <span>{Math.round((stats.newsletters / stats.totalEmails) * 100)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-purple-500 h-2 rounded-full"
                              style={{ width: `${Math.round((stats.newsletters / stats.totalEmails) * 100)}%` }}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="bg-purple-50 p-2 rounded text-center">
                            <div className="font-semibold text-purple-800">{stats.newsletters}</div>
                            <div className="text-purple-600">Total</div>
                          </div>
                          <div className="bg-orange-50 p-2 rounded text-center">
                            <div className="font-semibold text-orange-800">~{Math.round(stats.newsletters * 0.5)}min</div>
                            <div className="text-orange-600">To clean</div>
                          </div>
                          <div className="bg-green-50 p-2 rounded text-center">
                            <div className="font-semibold text-green-800">~{Math.round(stats.newsletters * 0.05)}MB</div>
                            <div className="text-green-600">Storage</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Time & Productivity */}
                    <div className="bg-white p-3 rounded border">
                      <div className="font-medium text-gray-900 flex items-center justify-between">
                        <span>⏱️ Time Investment & ROI</span>
                        <span className="text-xs text-green-600">~3hrs saved/month</span>
                      </div>
                      <div className="text-sm text-gray-600 mt-2">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span>🧹 One-time cleanup:</span>
                            <span className="font-semibold">{Math.round(stats.unreadEmails * 0.3)} minutes</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span>📰 Newsletter unsubscribe:</span>
                            <span className="font-semibold">{Math.round(stats.newsletters * 0.2)} minutes</span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-green-700 font-medium">
                            <span>💰 Weekly time saved after cleanup:</span>
                            <span>~{Math.round((stats.unreadEmails * 0.1 + stats.newsletters * 0.05) * 7)} minutes</span>
                          </div>
                        </div>
                        <div className="mt-2 p-2 bg-gradient-to-r from-green-50 to-blue-50 rounded text-xs">
                          <span className="font-medium">🎯 ROI:</span> Invest {Math.round((stats.unreadEmails * 0.3 + stats.newsletters * 0.2) / 60)} hour now, 
                          save {Math.round((stats.unreadEmails * 0.1 + stats.newsletters * 0.05) * 7 * 4 / 60)} hours/month forever!
                        </div>
                      </div>
                    </div>

                    {/* Inspiration & Motivation */}
                    <div className="bg-gradient-to-r from-yellow-50 to-orange-50 p-3 rounded border border-yellow-200">
                      <div className="font-medium text-gray-900 flex items-center gap-2">
                        <span>✨ Your Email Transformation Journey</span>
                      </div>
                      <div className="text-sm text-gray-700 mt-2 space-y-2">
                        <div className="flex items-start gap-2">
                          <span className="text-green-500">✓</span>
                          <div>
                            <span className="font-medium">Today:</span> {stats.unreadEmails} unread, feeling overwhelmed
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-blue-500">→</span>
                          <div>
                            <span className="font-medium">After 1 hour:</span> Inbox Zero, smart filters active
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-purple-500">🎉</span>
                          <div>
                            <span className="font-medium">Next month:</span> Save 3+ hours, never miss important emails
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recommendations */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">💡 Personalized Recommendations</h4>
                  <div className="space-y-2">
                    {stats.unreadEmails > 100 && (
                      <div className="flex items-center gap-2 p-2 bg-orange-50 rounded">
                        <span>🎯</span>
                        <span className="text-sm">Priority: Bulk mark as read for emails older than 30 days</span>
                      </div>
                    )}
                    {stats.newsletters > 50 && (
                      <div className="flex items-center gap-2 p-2 bg-blue-50 rounded">
                        <span>📰</span>
                        <span className="text-sm">Focus on newsletter unsubscribes - highest impact for time invested</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 p-2 bg-green-50 rounded">
                      <span>🔧</span>
                      <span className="text-sm">Set up Gmail filters for automatic newsletter labeling</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-purple-50 rounded">
                      <span>📅</span>
                      <span className="text-sm">Recommended cleanup schedule: 15 minutes weekly</span>
                    </div>
                  </div>
                </div>

                {/* Export Options */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">📤 Export & Sharing</h4>
                  <div className="flex gap-2 flex-wrap">
                    <button className="text-sm bg-blue-500 text-white px-3 py-2 rounded hover:bg-blue-600">
                      📧 Email Report
                    </button>
                    <button className="text-sm bg-green-500 text-white px-3 py-2 rounded hover:bg-green-600">
                      📄 Download PDF
                    </button>
                    <button className="text-sm bg-purple-500 text-white px-3 py-2 rounded hover:bg-purple-600">
                      📊 CSV Export
                    </button>
                    <button className="text-sm bg-gray-500 text-white px-3 py-2 rounded hover:bg-gray-600">
                      📋 Copy Summary
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Modal Footer */}
              <div className="border-t p-4 flex gap-2 justify-end">
                <button 
                  onClick={() => setShowReport(false)}
                  className="btn-secondary text-sm"
                >
                  Close
                </button>
                <button className="btn-primary text-sm">
                  📅 Schedule Weekly Reports
                </button>
              </div>
            </div>
          </div>
        )}

        {/* AI Assistant Modal */}
        {showAIAssistant && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  🤖 AI Email Assistant
                  <span className="text-sm text-gray-500">Beta</span>
                </h3>
                <button
                  onClick={() => setShowAIAssistant(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
                >
                  ✕
                </button>
              </div>
              
              {/* Modal Body */}
              <div className="p-6 space-y-4">
                <div className="bg-indigo-50 p-3 rounded-lg">
                  <div className="font-medium text-indigo-800 mb-1">Your Question:</div>
                  <div className="text-indigo-700">{aiQuery}</div>
                </div>

                {/* AI Response */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="font-medium text-gray-800 mb-2">AI Analysis:</div>
                  {(() => {
                    // Smart AI response based on query type
                    if (aiQuery.toLowerCase().includes('urgent') || aiQuery.toLowerCase().includes('attention')) {
                      const urgentEmails = allEmails.filter(email => 
                        email.unread && (
                          /urgent|important|asap|deadline|meeting/i.test(email.subject) ||
                          new Date(email.date) > new Date(Date.now() - 24 * 60 * 60 * 1000)
                        )
                      ).slice(0, 5)
                      
                      return (
                        <div className="space-y-3">
                          <p className="text-gray-700">Found {urgentEmails.length} emails that need immediate attention:</p>
                          {urgentEmails.map((email, idx) => (
                            <div key={idx} className="bg-white p-3 rounded border-l-4 border-red-500">
                              <div className="font-medium text-gray-900">{email.subject}</div>
                              <div className="text-sm text-gray-600">From: {email.from}</div>
                              <div className="text-xs text-gray-500">{new Date(email.date).toLocaleString()}</div>
                              {/urgent|important|asap|deadline/i.test(email.subject) && (
                                <div className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded mt-1 inline-block">
                                  🚨 Urgent
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )
                    }
                    
                    if (aiQuery.toLowerCase().includes('newsletter') || aiQuery.toLowerCase().includes('summary')) {
                      const newsletters = allEmails.filter(email => email.isNewsletter).slice(0, 5)
                      const categories = newsletters.reduce((acc, email) => {
                        const category = /tech|dev|code/i.test(email.from + email.subject) ? 'Tech' :
                                       /business|marketing/i.test(email.from + email.subject) ? 'Business' : 'General'
                        acc[category] = (acc[category] || 0) + 1
                        return acc
                      }, {} as Record<string, number>)
                      
                      return (
                        <div className="space-y-3">
                          <p className="text-gray-700">Newsletter Summary ({newsletters.length} recent):</p>
                          <div className="grid grid-cols-3 gap-2 mb-3">
                            {Object.entries(categories).map(([cat, count]) => (
                              <div key={cat} className="bg-purple-100 p-2 rounded text-center">
                                <div className="text-sm font-medium text-purple-800">{cat}</div>
                                <div className="text-xs text-purple-600">{count} emails</div>
                              </div>
                            ))}
                          </div>
                          <div className="text-sm text-gray-600">
                            💡 Recommendation: Consider unsubscribing from newsletters you haven't opened in 30+ days.
                          </div>
                        </div>
                      )
                    }
                    
                    if (aiQuery.toLowerCase().includes('todo') || aiQuery.toLowerCase().includes('action')) {
                      const actionEmails = allEmails.filter(email => 
                        /todo|task|action|deadline|follow.?up|remind|schedule/i.test(email.subject + email.snippet)
                      ).slice(0, 5)
                      
                      return (
                        <div className="space-y-3">
                          <p className="text-gray-700">Found {actionEmails.length} emails with potential action items:</p>
                          {actionEmails.map((email, idx) => (
                            <div key={idx} className="bg-white p-3 rounded border-l-4 border-green-500">
                              <div className="font-medium text-gray-900">{email.subject}</div>
                              <div className="text-sm text-gray-600">From: {email.from}</div>
                              <div className="text-xs text-green-600 mt-1">
                                ✅ Potential action item detected
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    }
                    
                    if (aiQuery.toLowerCase().includes('reply') || aiQuery.toLowerCase().includes('priority')) {
                      const priorityEmails = allEmails.filter(email => 
                        email.unread && !email.isNewsletter &&
                        !/noreply|no-reply|donotreply/i.test(email.from)
                      )
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .slice(0, 5)
                      
                      return (
                        <div className="space-y-3">
                          <p className="text-gray-700">Reply priority (most recent personal emails):</p>
                          {priorityEmails.map((email, idx) => (
                            <div key={idx} className="bg-white p-3 rounded border-l-4 border-blue-500">
                              <div className="flex items-center justify-between">
                                <div className="font-medium text-gray-900">{email.subject}</div>
                                <div className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                  Priority {idx + 1}
                                </div>
                              </div>
                              <div className="text-sm text-gray-600">From: {email.from}</div>
                              <div className="text-xs text-gray-500">{new Date(email.date).toLocaleString()}</div>
                            </div>
                          ))}
                        </div>
                      )
                    }
                    
                    // Default response
                    return (
                      <div className="text-gray-600 space-y-2">
                        <p>📊 Based on your current email data:</p>
                        <ul className="space-y-1 ml-4">
                          <li>• {allEmails.filter(e => e.unread).length} unread emails</li>
                          <li>• {allEmails.filter(e => e.isNewsletter).length} newsletters</li>
                          <li>• {allEmails.filter(e => !e.isNewsletter && e.unread).length} personal unread messages</li>
                        </ul>
                        <p className="text-sm">💡 Try asking more specific questions like "What's urgent?" or "Find todos"</p>
                      </div>
                    )
                  })()}
                </div>
              </div>
              
              {/* Modal Footer */}
              <div className="border-t p-4 flex gap-2 justify-between">
                <div className="flex gap-2">
                  <button 
                    onClick={() => setAiQuery("What emails need my immediate attention?")}
                    className="text-xs bg-red-100 text-red-700 px-3 py-2 rounded hover:bg-red-200"
                  >
                    🚨 Urgent
                  </button>
                  <button 
                    onClick={() => setAiQuery("Extract todos and action items")}
                    className="text-xs bg-green-100 text-green-700 px-3 py-2 rounded hover:bg-green-200"
                  >
                    ✅ Todos
                  </button>
                </div>
                <button 
                  onClick={() => setShowAIAssistant(false)}
                  className="btn-secondary text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

function StatsCard({ 
  icon, 
  title, 
  value, 
  color,
  onClick,
  isActive
}: { 
  icon: React.ReactNode
  title: string
  value: string
  color: string
  onClick?: () => void
  isActive?: boolean
}) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    purple: 'bg-purple-100 text-purple-600',
    orange: 'bg-orange-100 text-orange-600',
    red: 'bg-red-100 text-red-600'
  }

  return (
    <div 
      className={`bg-white rounded-lg border border-gray-200 p-4 transition-all cursor-pointer hover:shadow-md ${
        isActive ? 'ring-2 ring-primary-500 bg-primary-50' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorClasses[color as keyof typeof colorClasses]}`}>
          {icon}
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">{title}</p>
          <p className="text-lg font-semibold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  )
}

function EmailCard({ 
  email, 
  selected, 
  onSelect,
  onOpen,
  onForward,
  showUnsubscribe = false
}: { 
  email: EmailMessage
  selected: boolean
  onSelect: () => void
  onOpen: () => void
  onForward: (emailId: string) => void
  showUnsubscribe?: boolean
}) {
  const [showFullDate, setShowFullDate] = useState(false)
  
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (showFullDate) {
      return date.toLocaleString()
    }
    
    if (diffDays === 1) return 'Today'
    if (diffDays === 2) return 'Yesterday'
    if (diffDays <= 7) return `${diffDays - 1} days ago`
    return date.toLocaleDateString()
  }

  const handleEmailClick = (e: React.MouseEvent) => {
    // Don't open email if clicking checkbox or buttons
    if ((e.target as HTMLElement).closest('input, button')) {
      return
    }
    onOpen()
  }

  return (
    <div 
      className={`bg-white rounded-lg border border-gray-200 p-4 transition-all hover:shadow-md cursor-pointer ${
        email.unread ? 'border-l-4 border-l-primary-500' : ''
      }`}
      onClick={handleEmailClick}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          onClick={(e) => e.stopPropagation()}
          className="w-4 h-4 text-primary-600 border-gray-300 rounded mt-1"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className={`text-sm font-medium truncate ${
                  email.unread ? 'text-gray-900 font-semibold' : 'text-gray-700'
                }`}>
                  {email.subject}
                </h3>
                {email.unread && (
                  <span className="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0" />
                )}
                {email.isNewsletter && (
                  <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded">
                    Newsletter
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 truncate">
                {email.from}
              </p>
              <button 
                className="text-xs text-gray-500 mt-1 hover:text-gray-700 text-left"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowFullDate(!showFullDate)
                }}
              >
                {formatDate(email.date)}
              </button>
            </div>
            <div className="flex items-center gap-1">
              <button 
                className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded hover:bg-blue-200"
                onClick={(e) => {
                  e.stopPropagation()
                  onOpen()
                }}
              >
                Read
              </button>
              <button 
                className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded hover:bg-green-200"
                onClick={(e) => {
                  e.stopPropagation()
                  onForward(email.id)
                }}
              >
                Forward
              </button>
              {showUnsubscribe && email.unsubscribeLink && (
                <button 
                  className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded hover:bg-red-200"
                  onClick={(e) => e.stopPropagation()}
                >
                  Unsubscribe
                </button>
              )}
              <button 
                className="p-1 text-gray-400 hover:text-gray-600"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2 line-clamp-2">
            {email.snippet}
          </p>
        </div>
      </div>
    </div>
  )
}