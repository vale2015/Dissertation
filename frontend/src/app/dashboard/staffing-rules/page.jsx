"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/dashboard/dashboardLayout";
import { API_BASE } from "@/lib/api";


// Display staffing rules and operational role data.
export default function StaffingRulesPage() {
  const [staffingRules, setStaffingRules] = useState([]);
  const [staffRoles, setStaffRoles] = useState([]);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");


  // Load staffing rules and role data from the Flask backend.
  useEffect(() => {
    let ignore = false;

    async function fetchStaffingRules() {
      setLoading(true);
      setErrorMessage("");

      try {
        const response = await fetch(
          `${API_BASE}/staffing-rules/`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const result = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(
            result?.message || "Failed to fetch staffing rules."
          );
        }

        if (!result?.success) {
          throw new Error(
            result?.message || "Failed to fetch staffing rules."
          );
        }

        if (ignore) return;

        setStaffingRules(result?.data?.staffing_rules || []);
        setStaffRoles(result?.data?.staff_roles || []);
      } catch (error) {
        console.error("Failed to fetch staffing rules:", error);

        if (!ignore) {
          setErrorMessage(
            error.message || "Failed to fetch staffing rules."
          );
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    fetchStaffingRules();

    return () => {
      ignore = true;
    };
  }, []);


  if (loading) {
    return (
      <DashboardLayout>
        <main className="dashboard-main">
          <h1>Staffing Rules by Department</h1>
          <p>Loading staffing rules...</p>
        </main>
      </DashboardLayout>
    );
  }


  return (
    <DashboardLayout>
      <main className="dashboard-main">
        <section className="staffing-rules-header">
          <h1>Staffing Rules by Department</h1>

          <p>
            Staff requirements are based on the restaurant&apos;s minimum and
            maximum seating capacity and the expected reservation-demand level.
          </p>
        </section>

        <section className="dashboard-panel staffing-rules-panel">
          <h2 className="dashboard-panel-title">
            Staffing Rules by Department
          </h2>

          {errorMessage ? (
            <p className="error-message" role="alert">
              {errorMessage}
            </p>
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
                    {staffingRules.length > 0 ? (
                      staffingRules.map((rule) => (
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
                      ))
                    ) : (
                      <tr>
                        <td colSpan="8">
                          No staffing-rule data found.
                        </td>
                      </tr>
                    )}
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
                          <td>
                            £{Number(role.hourly_rate).toFixed(2)}
                          </td>
                          <td>
                            {Number(role.standard_shift_hours).toFixed(2)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4">
                          No staff-role data found.
                        </td>
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