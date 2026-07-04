import axios from 'axios'
import { supabase } from './supabase'

const api = axios.create({
  baseURL: 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Inject JWT into requests
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession()
  
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`
  }
  
  return config
}, (error) => {
  return Promise.reject(error)
})

export default api
