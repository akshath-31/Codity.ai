import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { AlertCircle } from 'lucide-react'

export default function Login() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Redirect if already logged in
  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      navigate('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Failed to sign in')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Background brutalist grid */}
      <div className="absolute inset-0 pointer-events-none opacity-5" 
           style={{ backgroundImage: 'linear-gradient(#000 2px, transparent 2px), linear-gradient(90deg, #000 2px, transparent 2px)', backgroundSize: '100px 100px' }} />
      
      <div className="z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-5xl font-black uppercase tracking-tighter bg-primary text-white inline-block px-4 py-2 border-4 border-black shadow-brutal -rotate-3">
            Codity
          </h1>
          <p className="mt-4 font-bold text-lg uppercase tracking-widest">Internal Control Panel</p>
        </div>

        <Card className="border-4 shadow-brutal hover:shadow-brutal-hover transition-shadow duration-300">
          <CardHeader className="bg-accent1 border-b-4 border-black text-white">
            <CardTitle className="text-3xl uppercase tracking-tight">System Login</CardTitle>
            <CardDescription className="text-white/90 font-medium">
              Enter your corporate credentials to access the scheduler.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-8">
            <form onSubmit={handleLogin} className="space-y-6">
              
              {error && (
                <div className="bg-status-failed text-white p-4 border-2 border-black shadow-brutal-sm flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <p className="font-bold text-sm">{error}</p>
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-sm font-black uppercase tracking-widest" htmlFor="email">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-12 px-4 border-2 border-black focus:outline-none focus:ring-4 focus:ring-primary/20 bg-white font-medium"
                  placeholder="admin@example.com"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-black uppercase tracking-widest" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 px-4 border-2 border-black focus:outline-none focus:ring-4 focus:ring-primary/20 bg-white font-medium"
                  placeholder="••••••••"
                />
              </div>

              <Button 
                type="submit" 
                size="lg" 
                className="w-full text-xl h-14 bg-accent3 hover:bg-black"
                disabled={loading}
              >
                {loading ? 'AUTHENTICATING...' : 'AUTHORIZE'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
