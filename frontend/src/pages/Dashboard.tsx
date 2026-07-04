import { useEffect, useState } from 'react'
import api from '../lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Layers, Server, CheckCircle2, AlertTriangle, Clock } from 'lucide-react'

interface DashboardStats {
  total_queues: number
  workers_online: number
  workers_offline: number
  jobs_completed_today: number
  jobs_dead_letter: number
  recent_jobs: Array<{
    id: string
    job_type: string
    status: string
    queue_name?: string
    created_at: string
  }>
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data } = await api.get('/dashboard/stats')
        setStats(data)
      } catch (err: any) {
        setError(err.message || 'Failed to load dashboard data')
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-2xl font-black uppercase animate-pulse">Loading Diagnostics...</div>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="bg-status-failed text-white p-6 border-4 border-black shadow-brutal inline-block">
        <h2 className="text-2xl font-black uppercase mb-2 flex items-center gap-2">
          <AlertTriangle className="w-8 h-8" /> System Error
        </h2>
        <p className="font-bold">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-12 pb-12">
      <header>
        <h1 className="text-4xl font-black uppercase border-b-4 border-black pb-4 inline-block">
          System Overview
        </h1>
      </header>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-primary text-white hover:-translate-y-1 transition-transform">
          <CardHeader className="border-b-2 border-black pb-4">
            <CardTitle className="text-lg flex justify-between items-center">
              Active Queues <Layers className="w-6 h-6 opacity-80" />
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-6xl font-black">{stats.total_queues}</div>
          </CardContent>
        </Card>

        <Card className="bg-accent2 text-white hover:-translate-y-1 transition-transform">
          <CardHeader className="border-b-2 border-black pb-4">
            <CardTitle className="text-lg flex justify-between items-center">
              Workers Online <Server className="w-6 h-6 opacity-80" />
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 flex justify-between items-end">
            <div className="text-6xl font-black">{stats.workers_online}</div>
            <div className="font-bold text-black bg-white px-2 py-1 border-2 border-black text-sm">
              {stats.workers_offline} OFFLINE
            </div>
          </CardContent>
        </Card>

        <Card className="bg-accent3 text-black hover:-translate-y-1 transition-transform">
          <CardHeader className="border-b-2 border-black pb-4">
            <CardTitle className="text-lg flex justify-between items-center">
              Completed Today <CheckCircle2 className="w-6 h-6 opacity-80" />
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-6xl font-black">{stats.jobs_completed_today}</div>
          </CardContent>
        </Card>

        <Card className="bg-status-failed text-white hover:-translate-y-1 transition-transform">
          <CardHeader className="border-b-2 border-black pb-4">
            <CardTitle className="text-lg flex justify-between items-center">
              Dead Letter Jobs <AlertTriangle className="w-6 h-6 opacity-80" />
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-6xl font-black">{stats.jobs_dead_letter}</div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity Table */}
      <section className="space-y-6">
        <h2 className="text-2xl font-black uppercase flex items-center gap-3">
          <Clock className="w-6 h-6" /> Recent Job Activity
        </h2>
        
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black text-white uppercase text-sm tracking-widest">
                  <th className="p-4 font-bold border-b-2 border-black">Job ID</th>
                  <th className="p-4 font-bold border-b-2 border-black">Type</th>
                  <th className="p-4 font-bold border-b-2 border-black">Queue</th>
                  <th className="p-4 font-bold border-b-2 border-black">Status</th>
                  <th className="p-4 font-bold border-b-2 border-black">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-black">
                {stats.recent_jobs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center font-bold text-gray-500 uppercase">
                      No recent activity found.
                    </td>
                  </tr>
                ) : (
                  stats.recent_jobs.map((job) => (
                    <tr key={job.id} className="hover:bg-black/5 transition-colors">
                      <td className="p-4 font-mono text-sm font-bold">{job.id.substring(0, 8)}...</td>
                      <td className="p-4 font-bold uppercase">{job.job_type}</td>
                      <td className="p-4 font-medium">{job.queue_name || 'N/A'}</td>
                      <td className="p-4">
                        <Badge status={job.status as any}>{job.status.replace('_', ' ')}</Badge>
                      </td>
                      <td className="p-4 font-medium text-sm text-gray-600">
                        {new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </div>
  )
}
