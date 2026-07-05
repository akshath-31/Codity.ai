import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { supabase } from '../lib/supabase';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { ArrowLeft, RotateCcw, FileText } from 'lucide-react';

interface JobExecution {
  id: string;
  worker_id: string | null;
  attempt_number: number;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
}

interface JobLog {
  id: string;
  job_execution_id: string;
  log_level: string;
  message: string;
  created_at: string;
}

interface JobDetail {
  id: string;
  queue_id: string;
  job_type: string;
  status: string;
  payload: any;
  priority: number;
  max_attempts: number;
  attempt_count: number;
  scheduled_for: string;
  created_at: string;
  updated_at: string;
  queues: { name: string };
  job_executions: JobExecution[];
  job_logs: JobLog[];
}

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryLoading, setRetryLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchJob = async () => {
    try {
      const res = await api.get(`/jobs/${id}`);
      setJob(res.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load job');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJob();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`job-detail-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'jobs', filter: `id=eq.${id}` },
        (payload) => {
          setJob(prev => prev ? { ...prev, ...payload.new } : null);
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'job_executions', filter: `job_id=eq.${id}` },
        () => {
           fetchJob(); // Refetch to get new execution + logs safely
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'job_executions', filter: `job_id=eq.${id}` },
        () => {
           fetchJob();
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'job_logs', filter: `job_id=eq.${id}` },
        () => {
           fetchJob();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const handleRetry = async () => {
    setRetryLoading(true);
    try {
      await api.post(`/jobs/${id}/retry`);
      fetchJob();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to retry job');
    } finally {
      setRetryLoading(false);
    }
  };

  if (loading) return <div className="p-8 font-bold">Loading...</div>;
  if (error) return <div className="p-8 font-bold text-status-failed bg-red-100 border-2 border-status-failed rounded-brutal">{error}</div>;
  if (!job) return <div className="p-8 font-bold">Job not found.</div>;

  const canRetry = job.status === 'failed' || job.status === 'dead_letter';

  const getLogLevelColor = (level: string) => {
    if (level === 'error') return 'text-status-failed';
    if (level === 'warn') return 'text-amber-500';
    return 'text-gray-500';
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/jobs')}>
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-3xl font-black uppercase tracking-tight truncate flex-1">
          Job <span className="text-primary">{job.id.substring(0,8)}</span>
        </h1>
        {canRetry && (
          <Button onClick={handleRetry} disabled={retryLoading} className="gap-2 bg-accent3 text-black hover:bg-accent3/90">
            <RotateCcw className="h-4 w-4" /> RETRY JOB
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Job Metadata</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-bold text-gray-500 uppercase">Queue</p>
                  <p className="font-bold text-lg">{job.queues.name}</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-500 uppercase">Status</p>
                  <div className="mt-1">
                    <Badge status={job.status as any}>{job.status.replace('_', ' ')}</Badge>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-500 uppercase">Type</p>
                  <p className="font-bold">{job.job_type}</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-500 uppercase">Priority</p>
                  <p className="font-bold">{job.priority}</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-500 uppercase">Attempts</p>
                  <p className="font-bold">{job.attempt_count} / {job.max_attempts}</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-500 uppercase">Created</p>
                  <p className="font-bold">{new Date(job.created_at).toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Payload</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-black/5 p-4 rounded-brutal border-2 border-black overflow-x-auto text-sm font-mono font-medium">
                {JSON.stringify(job.payload, null, 2)}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Execution History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {job.job_executions.length === 0 ? (
                <p className="font-bold text-gray-500">No executions yet.</p>
              ) : (
                job.job_executions.map((exec) => (
                  <div key={exec.id} className="border-2 border-black rounded-brutal p-4 bg-white shadow-brutal-sm">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-lg">Attempt {exec.attempt_number}</span>
                        <Badge status={exec.status as any}>{exec.status}</Badge>
                      </div>
                      <span className="text-xs font-bold text-gray-500 font-mono">
                        {exec.worker_id ? `Worker: ${exec.worker_id.substring(0,8)}` : 'Unassigned'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm font-bold text-gray-600 mb-2">
                      {exec.started_at && <span>Started: {new Date(exec.started_at).toLocaleTimeString()}</span>}
                      {exec.finished_at && <span>Finished: {new Date(exec.finished_at).toLocaleTimeString()}</span>}
                    </div>
                    {exec.error_message && (
                      <div className="mt-2 p-3 bg-red-100 border-2 border-status-failed text-status-failed rounded-brutal font-mono text-sm break-words">
                        {exec.error_message}
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="h-[600px] flex flex-col">
            <CardHeader className="border-b-2 border-black pb-4">
              <CardTitle>Job Logs</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-sm">
              {job.job_logs.length === 0 ? (
                <p className="font-bold text-gray-500 font-sans">No logs generated.</p>
              ) : (
                job.job_logs.map(log => (
                  <div key={log.id} className="break-words border-b border-black/10 pb-2 last:border-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-bold uppercase text-xs ${getLogLevelColor(log.log_level)}`}>
                        [{log.log_level}]
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(log.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="font-medium text-black/80">{log.message}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
