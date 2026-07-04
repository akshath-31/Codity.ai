import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { supabase } from '../lib/supabase';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Search, ChevronLeft, ChevronRight, Filter, RefreshCw } from 'lucide-react';

interface Job {
  id: string;
  job_type: string;
  status: string;
  priority: number;
  attempt_count: number;
  created_at: string;
  queues?: {
    name: string;
  };
}

interface Queue {
  id: string;
  name: string;
}

export default function JobsExplorer() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [queues, setQueues] = useState<Queue[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Pagination & Filters
  const [page, setPage] = useState(1);
  const limit = 20;
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [queueFilter, setQueueFilter] = useState('');

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const offset = (page - 1) * limit;
      let url = `/jobs?limit=${limit}&offset=${offset}`;
      if (statusFilter) url += `&status=${statusFilter}`;
      if (typeFilter) url += `&job_type=${typeFilter}`;
      if (queueFilter) url += `&queue_id=${queueFilter}`;

      const res = await api.get(url);
      setJobs(res.data.data);
      setTotal(res.data.meta.total);
    } catch (err) {
      console.error('Failed to fetch jobs', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchQueues = async () => {
    try {
      const res = await api.get('/queues');
      setQueues(res.data.data);
    } catch (err) {
      console.error('Failed to fetch queues', err);
    }
  };

  useEffect(() => {
    fetchQueues();
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [page, statusFilter, typeFilter, queueFilter]);

  // Supabase Realtime Subscription
  useEffect(() => {
    const channel = supabase
      .channel('jobs-explorer-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'jobs' },
        (payload) => {
          const updatedJob = payload.new as Job;
          // Only update if it's currently visible in our list
          setJobs((currentJobs) =>
            currentJobs.map((job) =>
              job.id === updatedJob.id ? { ...job, status: updatedJob.status, attempt_count: updatedJob.attempt_count } : job
            )
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'jobs' },
        (payload) => {
           // We might not want to instantly insert on page 1 without refetching,
           // but we can show a toast or auto-refresh if on page 1 and no filters.
           if (page === 1 && !statusFilter && !typeFilter && !queueFilter) {
             fetchJobs();
           }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [page, statusFilter, typeFilter, queueFilter]);


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-black uppercase tracking-tight">Job Explorer</h1>
        <Button onClick={fetchJobs} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <span className="font-bold">Filters:</span>
            </div>
            
            <select 
              className="border-2 border-black rounded-brutal px-3 py-2 bg-white font-bold outline-none focus:ring-2 focus:ring-primary"
              value={statusFilter} 
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Statuses</option>
              <option value="queued">Queued</option>
              <option value="claimed">Claimed</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="dead_letter">Dead Letter</option>
            </select>

            <select 
              className="border-2 border-black rounded-brutal px-3 py-2 bg-white font-bold outline-none focus:ring-2 focus:ring-primary"
              value={typeFilter} 
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Types</option>
              <option value="immediate">Immediate</option>
              <option value="delayed">Delayed</option>
              <option value="scheduled">Scheduled</option>
              <option value="batch">Batch</option>
            </select>

            <select 
              className="border-2 border-black rounded-brutal px-3 py-2 bg-white font-bold outline-none focus:ring-2 focus:ring-primary"
              value={queueFilter} 
              onChange={(e) => { setQueueFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Queues</option>
              {queues.map(q => (
                <option key={q.id} value={q.id}>{q.name}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-black bg-accent2/20">
                <th className="p-4 font-black uppercase text-sm">ID</th>
                <th className="p-4 font-black uppercase text-sm">Type</th>
                <th className="p-4 font-black uppercase text-sm">Queue</th>
                <th className="p-4 font-black uppercase text-sm">Status</th>
                <th className="p-4 font-black uppercase text-sm">Priority</th>
                <th className="p-4 font-black uppercase text-sm">Attempts</th>
                <th className="p-4 font-black uppercase text-sm">Created</th>
              </tr>
            </thead>
            <tbody>
              {loading && jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center font-bold">Loading...</td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center font-bold">No jobs found.</td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr 
                    key={job.id} 
                    className="border-b border-black/20 hover:bg-black/5 cursor-pointer transition-colors"
                    onClick={() => navigate(`/jobs/${job.id}`)}
                  >
                    <td className="p-4 font-mono text-sm">{job.id.substring(0, 8)}...</td>
                    <td className="p-4 font-bold">{job.job_type}</td>
                    <td className="p-4">{job.queues?.name || '-'}</td>
                    <td className="p-4">
                      <Badge status={job.status as any}>{job.status.replace('_', ' ')}</Badge>
                    </td>
                    <td className="p-4">{job.priority}</td>
                    <td className="p-4">{job.attempt_count}</td>
                    <td className="p-4">{new Date(job.created_at).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        <div className="border-t-2 border-black p-4 flex items-center justify-between bg-white/50 rounded-b-brutal">
          <span className="font-bold text-sm">
            Showing {jobs.length > 0 ? (page - 1) * limit + 1 : 0} to {Math.min(page * limit, total)} of {total}
          </span>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              disabled={page === 1} 
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Prev
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              disabled={page * limit >= total} 
              onClick={() => setPage(p => p + 1)}
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
