"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/dashboard/dashboardLayout";

const API_BASE = "http://127.0.0.1:5000/api";

export default function StaffingRulesPage() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [staffingRules, setStaffingRules] = useState([]);
  const [staffRoles, setStaffRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    if (!storedToken || !storedUser) {
      router.push("/login");
      return;
    }

    setUser(JSON.parse(storedUser));
  }, [router]);

  useEffect(() => {
    async function fetchStaffingRules() {
      try {
        const response = await fetch(`${API_BASE}/staffing-rules/`);

        if (!response.ok) {
          throw new Error("Failed to fetch staffing rules");
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.message || "Failed to fetch staffing rules");
        }

        setStaffingRules(result.data.staffing_rules || []);
        setStaffRoles(result.data.staff_roles || []);
      } catch (error) {
        console.error("Failed to fetch staffing rules:", error);
        setErrorMessage("Failed to fetch staffing rules");
      } finally {
        setLoading(false);
      }
    }

    fetchStaffingRules();
  }, []);

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <DashboardLayout user={user}>
        <main className="dashboard-main">
          <h1>Staffing Rules by Department</h1>
          <p>Loading staffing rules...</p>
        </main>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout user={user}>
      <main className="dashboard-main">
        <section className="staffing-rules-header">
          <h1>Staffing Rules by Department</h1>
          <p>
            Staff needed based on minimun and maximun restaurant seating capacity, staffing calculations are based on reservation level. 
          </p>
        </section>

        <section className="dashboard-panel staffing-rules-panel">
          <h2 className="dashboard-panel-title">
            Staffing Rules by Department
          </h2>

          {errorMessage ? (
            <p className="error-message">{errorMessage}</p>
          ) : (
            <>
              <div className="booking-table-wrapper">
                <table className="booking-table">
                  <thead>
                    <tr>
                      <th>Demand Level</th>
                      <th>Min Covers</th>
                      <th>Max Covers</th>
                      <th>Total Staff</th>
                      <th>Front of House</th>
                      <th>Kitchen</th>
                      <th>Bar</th>
                      <th>Supervisor</th>
                    </tr>
                  </thead>

                  <tbody>
                    {staffingRules.map((rule) => (
                      <tr key={rule.id}>
                        <td>{rule.demand_level}</td>
                        <td>{rule.min_covers}</td>
                        <td>{rule.max_covers}</td>
                        <td>{rule.total_staff}</td>
                        <td>{rule.front_of_house}</td>
                        <td>{rule.kitchen}</td>
                        <td>{rule.bar}</td>
                        <td>{rule.supervisor}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              

              <h2 className="dashboard-panel-title operational-role-title">
                Operational Role Data
              </h2>

              <div className="booking-table-wrapper">
                <table className="booking-table">
                  <thead>
                    <tr>
                      <th>Role Name</th>
                      <th>Department</th>
                      <th>Hourly Rate</th>
                      <th>Standard Shift Hours</th>
                    </tr>
                  </thead>

                  <tbody>
                    {staffRoles.length > 0 ? (
                      staffRoles.map((role) => (
                        <tr key={role.id}>
                          <td>{role.role_name}</td>
                          <td>{role.department}</td>
                          <td>£{Number(role.hourly_rate).toFixed(2)}</td>
                          <td>{Number(role.standard_shift_hours).toFixed(2)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4">No staff role data found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </main>
    </DashboardLayout>
  );
}