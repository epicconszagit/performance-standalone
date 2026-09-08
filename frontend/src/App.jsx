import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import { Navigate } from 'react-router-dom';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Home from './pages/Home';
import Tasks from './pages/Tasks';
import Meetings from './pages/Meetings';
import Announcements from './pages/Announcements';
import Performance from './pages/Performance';
import DirectorDashboard from './pages/DirectorDashboard';
import NotificationsPage from './pages/Notifications';
import Settings from './pages/Settings';
import Reports from './pages/Reports';
import MeetingMinutes from './pages/MeetingMinutes';
import PendingApproval from './pages/PendingApproval';
import Profile from './pages/Profile';
// Add page imports here

const AuthenticatedApp = () => {
  const { isLoadingAuth, authError, navigateToLogin, isAuthenticated, user } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError?.type === 'auth_required') {
    navigateToLogin();
    return null;
  }

  if (isAuthenticated && user?.status === 'pending') {
    return <PendingApproval />;
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/departments" element={<Navigate to="/settings?tab=departments" replace />} />
          <Route path="/employees" element={<Navigate to="/settings?tab=staff" replace />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/meetings" element={<Meetings />} />
          <Route path="/announcements" element={<Announcements />} />
          <Route path="/performance" element={<Performance />} />
          <Route path="/director" element={<DirectorDashboard />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/audit" element={<Navigate to="/settings?tab=audit" replace />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/minutes" element={<MeetingMinutes />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App