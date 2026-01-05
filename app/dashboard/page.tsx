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

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [stats, setStats] = useState<EmailStats | null>(null)
  const [newsletters, setNewsletters] = useState<EmailMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set())

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
      const [statsRes, newslettersRes] = await Promise.all([
        fetch('/api/gmail/stats'),
        fetch('/api/gmail/newsletters?daysOld=30')
      ])
      
      const statsData = await statsRes.json()
      const newslettersData = await newslettersRes.json()
      
      setStats(statsData)
      setNewsletters(newslettersData)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectAll = () => {
    if (selectedEmails.size === newsletters.length) {
      setSelectedEmails(new Set())
    } else {
      setSelectedEmails(new Set(newsletters.map(email => email.id)))
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

  const filteredNewsletters = newsletters.filter(email =>
    email.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    email.from.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (status === 'loading' || loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
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
            />
            <StatsCard
              icon={<Users className="w-4 h-4" />}
              title="Newsletters"
              value={stats.newsletters.toString()}
              color="purple"
            />
            <StatsCard
              icon={<Calendar className="w-4 h-4" />}
              title="Old Newsletters"
              value={stats.oldNewsletters.toString()}
              color="orange"
            />
            <StatsCard
              icon={<TrendingUp className="w-4 h-4" />}
              title="Unread"
              value={stats.unreadEmails.toLocaleString()}
              color="red"
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
                placeholder="Search newsletters..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <button className="p-2 text-gray-500 hover:text-gray-700">
              <Filter className="w-4 h-4" />
            </button>
          </div>

          {filteredNewsletters.length > 0 && (
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedEmails.size === filteredNewsletters.length}
                  onChange={handleSelectAll}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded"
                />
                Select all ({filteredNewsletters.length})
              </label>
              {selectedEmails.size > 0 && (
                <button className="btn-danger text-xs py-1 px-2">
                  Unsubscribe ({selectedEmails.size})
                </button>
              )}
            </div>
          )}
        </div>

        {/* Newsletters List */}
        <div className="space-y-2">
          {filteredNewsletters.map(email => (
            <NewsletterCard
              key={email.id}
              email={email}
              selected={selectedEmails.has(email.id)}
              onSelect={() => handleSelectEmail(email.id)}
            />
          ))}
          
          {filteredNewsletters.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Mail className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No newsletters found</p>
              <p className="text-sm">Try adjusting your search</p>
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
  color 
}: { 
  icon: React.ReactNode
  title: string
  value: string
  color: string
}) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    purple: 'bg-purple-100 text-purple-600',
    orange: 'bg-orange-100 text-orange-600',
    red: 'bg-red-100 text-red-600'
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
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

function NewsletterCard({ 
  email, 
  selected, 
  onSelect 
}: { 
  email: EmailMessage
  selected: boolean
  onSelect: () => void
}) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString()
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
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
              <h3 className="text-sm font-medium text-gray-900 truncate">
                {email.subject}
              </h3>
              <p className="text-sm text-gray-600 truncate">
                {email.from}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {formatDate(email.date)}
              </p>
            </div>
            <button className="p-1 text-gray-400 hover:text-gray-600">
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2 line-clamp-2">
            {email.snippet}
          </p>
        </div>
      </div>
    </div>
  )
}