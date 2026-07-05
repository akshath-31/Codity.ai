import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import JobsExplorer from './pages/JobsExplorer'
import JobDetail from './pages/JobDetail'
import Queues from './pages/Queues'
import Workers from './pages/Workers'
import Batches from './pages/Batches'


function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Route */}
          <Route path="/login" element={<Login />} />

          {/* Protected Routes inside Layout */}
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="jobs" element={<JobsExplorer />} />
            <Route path="jobs/:id" element={<JobDetail />} />
            <Route path="queues" element={<Queues />} />
            <Route path="workers" element={<Workers />} />
            <Route path="batches" element={<Batches />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App
