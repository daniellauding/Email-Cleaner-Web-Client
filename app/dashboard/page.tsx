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

type EmailView = 'recent' | 'newsletters' | 'unread' | 'all'

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

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/')
    }
  }, [status, router])

  useEffect(() => {
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
      
      setLoadingStep('🤖 Processing with AI insights... (5-10 seconds)')
      const statsData = await statsRes.json()
      const recentEmailsData = await recentEmailsRes.json()
      const newslettersData = await newslettersRes.json()
      
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

  const filteredEmails = getCurrentEmails().filter(email =>
    email.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    email.from.toLowerCase().includes(searchQuery.toLowerCase())
  )

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
          
          <button
            onClick={() => signOut()}
            className="p-2 text-gray-500 hover:text-gray-700"
          >
            <LogOut className="w-5 h-5" />
          </button>
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
                <div className="flex gap-2">
                  {currentView === 'newsletters' && (
                    <button className="btn-danger text-xs py-1 px-2">
                      Unsubscribe ({selectedEmails.size})
                    </button>
                  )}
                  <button className="btn-secondary text-xs py-1 px-2">
                    Mark Read ({selectedEmails.size})
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Current View Header */}
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900 capitalize">
            {currentView === 'recent' ? 'Recent Emails' : 
             currentView === 'all' ? 'All Emails' :
             currentView === 'unread' ? 'Unread Emails' : 'Newsletters'}
          </h2>
          <p className="text-sm text-gray-500">
            Showing {filteredEmails.length} emails
          </p>
        </div>

        {/* Email List */}
        <div className="space-y-2">
          {filteredEmails.map(email => (
            <EmailCard
              key={email.id}
              email={email}
              selected={selectedEmails.has(email.id)}
              onSelect={() => handleSelectEmail(email.id)}
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
  showUnsubscribe = false
}: { 
  email: EmailMessage
  selected: boolean
  onSelect: () => void
  showUnsubscribe?: boolean
}) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 1) return 'Today'
    if (diffDays === 2) return 'Yesterday'
    if (diffDays <= 7) return `${diffDays - 1} days ago`
    return date.toLocaleDateString()
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 transition-all hover:shadow-sm ${
      email.unread ? 'border-l-4 border-l-primary-500' : ''
    }`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
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
              <p className="text-xs text-gray-500 mt-1">
                {formatDate(email.date)}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {showUnsubscribe && email.unsubscribeLink && (
                <button className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded hover:bg-red-200">
                  Unsubscribe
                </button>
              )}
              <button className="p-1 text-gray-400 hover:text-gray-600">
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