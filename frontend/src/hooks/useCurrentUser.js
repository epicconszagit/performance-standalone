import { useState, useEffect } from "react";
import { apiClient } from "@/api/client";
import { Employee } from "@/api/entities";

export function useCurrentUser() {
  const [user, setUser] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const me = await apiClient.get("/auth/me");
        if (!mounted) return;
        setUser(me);
        try {
          let emps = await Employee.filter({ user_id: me.id });
          if ((!emps || emps.length === 0) && me.email) {
            emps = await Employee.filter({ email: me.email });
          }
          if (mounted && emps && emps.length > 0) {
            const emp = emps[0];
            setEmployee(emp);
            if (!emp.user_id && me.id) {
              try {
                await Employee.update(emp.id, { user_id: me.id });
                if (mounted) setEmployee({ ...emp, user_id: me.id });
              } catch (e) { }
            }
          }
        } catch (e) {
          // employee lookup failed
        }
      } catch (e) {
        // not logged in
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const role = employee?.role || (user?.role === "admin" ? "Administrator" : "Staff Member");
  const performer = {
    id: employee?.id || user?.id || "",
    name: employee?.full_name || user?.full_name || user?.email || "User",
  };

  return { user, employee, role, loading, performer };
}
