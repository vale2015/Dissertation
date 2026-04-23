"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/layout/sidebar";
import Topbar from "@/components/layout/topbar";

const API_BASE = "http://127.0.0.1:5000/api";

export default function StaffingRulesPage() {
  const [rules, setRules] = useState([]);
  const [staffRoles, setStaffRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchStaffingRulesData() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(`${API_BASE}/staffing-rules/`);

        if (!response.ok) {
          throw new Error("Failed to fetch staffing rules");
        }

        const data = await response.json();

        setRules(Array.isArray(data?.rules) ? data.rules : []);
        setStaffRoles(Array.isArray(data?.staff_roles) ? data.staff_roles : []);
      } catch (err) {
        setError(
          err.message || "Something went wrong while loading staffing rules."
        );
      } finally {
        setLoading(false);
      }
    }

    fetchStaffingRulesData();
  }, []);

  return (
    <div className="dashboard-app">
      <Topbar />

      <div className="dashboard-shell">
        <Sidebar />

        <div className="dashboard-main-area">
          <main className="dashboard-page">
            <div className="dashboard-container">
              <section className="dashboard-hero">
                <h1 className="dashboard-title">Staffing Rules by Department</h1>
                <p className="dashboard-text">
                  Reference guide for staffing allocation by demand level and
                  operational role configuration.
                </p>
              </section>

              <section className="dashboard-panel">
                <h2 className="dashboard-panel-title">
                  Staffing Rules by Department
                </h2>

                {loading ? (
                  <p className="dashboard-text">Loading staffing rules...</p>
                ) : error ? (
                  <p className="login-error">{error}</p>
                ) : (
                  <>
                    <div className="booking-table-wrapper">
                      <table className="booking-table staffing-rules-table">
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
                          {rules.length === 0 ? (
                            <tr>
                              <td colSpan="8" className="empty-state-cell">
                                No staffing rules found.
                              </td>
                            </tr>
                          ) : (
                            rules.map((rule) => (
                              <tr key={rule.id}>
                                <td>{rule.demand_level || "N/A"}</td>
                                <td>{rule.min_covers ?? "-"}</td>
                                <td>{rule.max_covers ?? "-"}</td>
                                <td className="staffing-total-cell">
                                  {Number(rule.total_staff || 0)}
                                </td>
                                <td>{Number(rule.floor_staff || 0)}</td>
                                <td>{Number(rule.kitchen_staff || 0)}</td>
                                <td>{Number(rule.bar_staff || 0)}</td>
                                <td>{Number(rule.supervisor_staff || 0)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    <p className="staffing-rules-note">
                      Staffing recommendations are automatically calculated based
                      on predicted covers and demand level. Department allocation
                      follows operational rules to ensure appropriate coverage
                      across Front of House, Kitchen, Bar, and supervision.
                    </p>

                    <div className="staff-divider" />

                    <h2 className="dashboard-panel-title">Operational Role Data</h2>

                    <div className="booking-table-wrapper">
                      <table className="booking-table staffing-rules-table">
                        <thead>
                          <tr>
                            <th>Role Name</th>
                            <th>Department</th>
                            <th>Hourly Rate</th>
                            <th>Standard Shift Hours</th>
                          </tr>
                        </thead>

                        <tbody>
                          {staffRoles.length === 0 ? (
                            <tr>
                              <td colSpan="4" className="empty-state-cell">
                                No staff role data found.
                              </td>
                            </tr>
                          ) : (
                            staffRoles.map((role) => (
                              <tr key={role.id}>
                                <td>{role.role_name || "-"}</td>
                                <td>{role.department || "-"}</td>
                                <td>£{Number(role.hourly_rate || 0).toFixed(2)}</td>
                                <td>
                                  {Number(role.standard_shift_hours || 0).toFixed(2)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </section>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}