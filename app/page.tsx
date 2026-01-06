'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Mail, Trash2, Shield, Zap, BarChart3 } from 'lucide-react'

export default function HomePage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/dashboard')
    }
  }, [status, router])

  const handleSignIn = () => {
    router.push('/auth/signin')
  }

  if (status === 'loading') {
    return (
      <main className="flex-1 bg-gradient-to-br from-primary-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="flex-1 bg-gradient-to-br from-primary-50 to-blue-50">
      <div className="container mx-auto px-4 py-8 max-w-md sm:max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
            Email Cleaner
          </h1>
          <p className="text-gray-600 text-sm sm:text-base">
            Clean your inbox, unsubscribe from newsletters, and get AI insights
          </p>
        </div>

        {/* Features */}
        <div className="grid gap-4 mb-8">
          <FeatureCard
            icon={<Trash2 className="w-5 h-5" />}
            title="Smart Unsubscribe"
            description="Automatically find and unsubscribe from unwanted newsletters"
          />
          <FeatureCard
            icon={<Shield className="w-5 h-5" />}
            title="Privacy First"
            description="Your data stays secure - no selling or sharing"
          />
          <FeatureCard
            icon={<Zap className="w-5 h-5" />}
            title="AI Insights"
            description="Get smart recommendations about your email habits"
          />
          <FeatureCard
            icon={<BarChart3 className="w-5 h-5" />}
            title="Analytics"
            description="Track your progress and see how much you've cleaned"
          />
        </div>

        {/* CTA */}
        <div className="space-y-4">
          <button 
            onClick={handleSignIn}
            className="w-full bg-primary-600 hover:bg-primary-700 text-white py-3 px-6 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <Mail className="w-5 h-5" />
            Connect with Google
          </button>
          <p className="text-xs text-gray-500 text-center">
            Free forever • No credit card required • Works with Gmail & more
          </p>
        </div>
      </div>
    </main>
  )
}

function FeatureCard({
  icon,
  title,
  description
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="bg-white rounded-lg p-4 border shadow-sm">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center text-primary-600 flex-shrink-0">
          {icon}
        </div>
        <div>
          <h3 className="font-medium text-gray-900 mb-1">{title}</h3>
          <p className="text-sm text-gray-600">{description}</p>
        </div>
      </div>
    </div>
  )
}