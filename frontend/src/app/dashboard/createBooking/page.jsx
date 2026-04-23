"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/sidebar";
import Topbar from "@/components/layout/topbar";
import AddNewBooking from "@/components/dashboard/addNewBooking";

const API_BASE = "http://127.0.0.1:5000/api";

function isMonday(dateString) {
  if (!dateString) return false;
  const selectedDate = new Date(dateString);
  return selectedDate.getDay() === 1;
}

export default function CreateBookingPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    booking_date: "",
    booking_time: "",
    party_size: "",
    booking_type: "advance",
    customer_name: "",
    notes: "",
  });

  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    setErrorMessage("");
    setSuccessMessage("");
  };

  const handleCancel = () => {
    router.push("/dashboard");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    if (isMonday(formData.booking_date)) {
      setErrorMessage(
        "Bookings cannot be added on Monday because the restaurant is closed."
      );
      return;
    }

    if (
      !formData.booking_date ||
      !formData.booking_time ||
      !formData.party_size ||
      !formData.customer_name
    ) {
      setErrorMessage("Please complete all required fields.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${API_BASE}/booking/add`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          booking_date: formData.booking_date,
          booking_time: formData.booking_time,
          party_size: Number(formData.party_size),
          booking_type: formData.booking_type,
          customer_name: formData.customer_name,
          notes: formData.notes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Failed to add booking.");
      }

      setSuccessMessage("Booking added successfully and synced to forecast data.");

      setFormData({
        booking_date: "",
        booking_time: "",
        party_size: "",
        booking_type: "advance",
        customer_name: "",
        notes: "",
      });
    } catch (error) {
      setErrorMessage(error.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-app">
      <Topbar />

      <div className="dashboard-shell">
        <Sidebar />

        <div className="dashboard-main-area">
          <main className="dashboard-page">
            <div className="dashboard-container">
              <AddNewBooking
                formData={formData}
                loading={loading}
                successMessage={successMessage}
                errorMessage={errorMessage}
                onChange={handleChange}
                onSubmit={handleSubmit}
                onCancel={handleCancel}
              />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}