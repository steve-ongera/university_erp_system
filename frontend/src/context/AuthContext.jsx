import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { authApi } from "../services/api";

const AuthContext = createContext(null);

/**
 * Roles mirror portal_api.models.User.UserType exactly — keep these two
 * lists in sync any time a role is added on the backend.
 */
export const ROLES = {
  ADMIN: "admin",
  STUDENT: "student",
  LECTURER: "lecturer",
  STAFF: "staff",
  REGISTRAR: "registrar",
  DEAN: "dean",
  COD: "cod",
  HOSTEL_WARDEN: "hostel_warden",
  FINANCE: "finance",
  EXAM_OFFICE: "exam_office",
  LIBRARIAN: "librarian",
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(authApi.currentUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("mu_access_token");
    if (!token) {
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then(({ data }) => setUser(data))
      .catch(() => authApi.logout())
      .finally(() => setLoading(false));
  }, []);

  const loginWithSession = useCallback((session) => {
    authApi.storeSession(session);
    setUser(session.user);
  }, []);

  const logout = useCallback(() => authApi.logout(), []);

  const hasRole = useCallback((...roles) => user && roles.includes(user.user_type), [user]);

  return (
    <AuthContext.Provider value={{ user, loading, loginWithSession, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
