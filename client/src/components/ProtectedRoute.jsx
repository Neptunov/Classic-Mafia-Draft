import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';

export default function ProtectedRoute() {
  const { isAuthenticated } = useAuth();

  // If the user is not authenticated, redirect them to the login page
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If authenticated, render the nested child routes via <Outlet />
  return <Outlet />;
}