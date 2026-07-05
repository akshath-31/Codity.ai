import { useState, useEffect } from 'react';
import api from '../lib/api';
import { supabase } from '../lib/supabase';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { RefreshCw, Server, Clock } from 'lucide-react';

interface Worker {
  id: string;
  name?: string;
  status: 'idle' | 'busy' | 'offline';
  last_heartbeat_at: string | null;
  current_job_id: string | null;
  organization_id: string;
  created_at: string;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

const workerStatusMap: Record<Worker['status'], { label: string; badgeStatus: any; dot: string }> = {
  idle:    { label: 'Idle',    badgeStatus: 'completed', dot: 'bg-status-success' },
  busy:    { label: 'Busy',    badgeStatus: 'running',   dot: 'bg-status-running' },
  offline: { label: 'Offline', badgeStatus: 'paused',    dot: 'bg-gray-400' },
};

export default function Workers() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0); // used to refresh "X ago" labels every 10s

  const fetchWorkers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/workers?limit=100');
      setWorkers(res.data.data);
    } catch (err) {
      console.error('Failed to fetch workers', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchWorkers(); }, []);

  // Refresh relative timestamps every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 10_000);
    return () => clearInterval(interval);
  }, []);

  // Supabase Realtime subscription (uses anon key + user session → RLS enforced)
  useEffect(() => {
    const channel = supabase
      .channel('workers-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'workers' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setWorkers(prev => [payload.new as Worker, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setWorkers(prev =>
              prev.map(w => w.id === payload.new.id ? { ...w, ...payload.new } : w)
            );
          } else if (payload.eventType === 'DELETE') {
            setWorkers(prev => prev.filter(w => w.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const counts = {
    idle: workers.filter(w => w.status === 'idle').length,
    busy: workers.filter(w => w.status === 'busy').length,
    offline: workers.filter(w => w.status === 'offline').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-black uppercase tracking-tight">Worker Nodes</h1>
        <Button onClick={fetchWorkers} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Idle',    count: counts.idle,    color: 'border-status-success bg-status-success/10' },
          { label: 'Busy',    count: counts.busy,    color: 'border-status-running bg-status-running/10' },
          { label: 'Offline', count: counts.offline, color: 'border-gray-400 bg-gray-100' },
        ].map(({ label, count, color }) => (
          <div key={label} className={`border-2 ${color} rounded-brutal p-4 text-center shadow-brutal-sm`}>
            <p className="text-3xl font-black">{count}</p>
            <p className="text-sm font-black uppercase">{label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="p-8 text-center font-bold text-gray-400">Loading workers...</div>
      ) : workers.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Server className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <p className="font-bold text-gray-500">No workers registered yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-brutal border-2 border-black shadow-brutal">
          <table className="w-full text-left border-collapse bg-white">
            <thead>
              <tr className="border-b-2 border-black bg-accent2/20">
                <th className="p-4 font-black uppercase text-sm">Worker ID</th>
                <th className="p-4 font-black uppercase text-sm">Status</th>
                <th className="p-4 font-black uppercase text-sm">Last Heartbeat</th>
                <th className="p-4 font-black uppercase text-sm">Current Job</th>
              </tr>
            </thead>
            <tbody>
              {workers.map((worker) => {
                const { label, badgeStatus, dot } = workerStatusMap[worker.status] ?? workerStatusMap.offline;
                return (
                  <tr key={worker.id} className="border-b border-black/20 hover:bg-black/5 transition-colors">
                    <td className="p-4 font-mono text-sm">
                      <span className="font-bold">{worker.name || `worker-${worker.id.substring(0, 8)}`}</span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block w-2 h-2 rounded-full ${dot}`} />
                        <Badge status={badgeStatus}>{label}</Badge>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1 text-sm font-bold text-gray-600">
                        <Clock className="h-3 w-3" />
                        {/* tick dependency forces re-render every 10s */}
                        {tick >= 0 && timeAgo(worker.last_heartbeat_at)}
                      </div>
                    </td>
                    <td className="p-4">
                      {worker.current_job_id ? (
                        <span className="font-mono text-xs bg-status-running/20 border border-status-running rounded px-2 py-1">
                          {worker.current_job_id.substring(0, 12)}...
                        </span>
                      ) : (
                        <span className="text-gray-400 font-bold">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
