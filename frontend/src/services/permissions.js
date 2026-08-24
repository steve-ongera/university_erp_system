// src/services/permissions.js
//
// Optional layer on top of the static config in config/rbac.js. The app
// works correctly right now using only rbac.js (synchronous, no network
// dependency for routing/nav to render correctly). This hook additionally
// fetches the server's view of the same permissions and warns in the
// console if they've drifted apart — useful once ROLE_PAGE_PERMISSIONS
// in services.py becomes something admins can edit via the UI instead of
// a hardcoded dict, at which point you'd swap rbac.js's static lists for
// this hook's `pages` value directly.
import { useEffect, useState } from "react";
import { authApi } from "./api";
import { pagesForRole } from "../config/rbac";

export function usePermissions(user) {
  const [serverPages, setServerPages] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    authApi.permissions()
      .then(({ data }) => {
        setServerPages(data.pages || []);
        const clientKeys = pagesForRole(user.user_type).map((p) => p.key).sort();
        const serverKeys = [...(data.pages || [])].sort();
        if (JSON.stringify(clientKeys) !== JSON.stringify(serverKeys)) {
          console.warn(
            "[rbac] Frontend config/rbac.js and backend ROLE_PAGE_PERMISSIONS have drifted for role",
            user.user_type, { clientKeys, serverKeys }
          );
        }
      })
      .catch(() => setServerPages(null)) // fine — rbac.js static config still governs the UI
      .finally(() => setLoading(false));
  }, [user]);

  return { serverPages, loading };
}