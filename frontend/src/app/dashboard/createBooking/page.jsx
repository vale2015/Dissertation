"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/sidebar";
import Topbar from "@/components/layout/topbar";
import AddNewBooking from "@/components/dashboard/addNewBooking";
import { API_BASE } from "@/lib/api";


// Checks if the selected booking date is a Monday.
function isMonday(dateString) {
  if (!dateString) return false;

  const selectedDate = new Date(dateString);
  return selectedDate.getDay() === 1;
}


// Page used to create a new restaurant booking.
export default function CreateBookingPage() {
  const router = useRouter();

  // Store all booking form values.
  const [formData, setFormData] = useState({
    booking_date: "",
    booking_time: "",
    party_size: "",
    booking_type: "advance",
    customer_name: "",
    notes: "",
  });

  // Store form status messages and loading state.
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Update the form field that the user is editing.
  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previousFormData) => ({
      ...previousFormData,
      [name]: value,
    }));

    setErrorMessage("");
    setSuccessMessage("");
  };

  // Return the user to the dashboard when cancelling.
  const handleCancel = () => {
    router.push("/dashboard");
  };

  // Validate the form and send the booking to the backend.
  const handleSubmit = async (event) => {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    // Prevent bookings on Monday because the restaurant is closed.
    if (isMonday(formData.booking_date)) {
      setErrorMessage(
        "Bookings cannot be added on Monday because the restaurant is closed."
      );
      return;
    }

    // Check that all required fields are completed.
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

      // Send the new booking data to the Flask backend.
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

      setSuccessMessage(
        "Booking added successfully and synced to forecast data."
      );

      // Reset the form after a successful booking.
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
    <Suspense
      fallback={
        <p className="dashboard-text">Loading booking form...</p>
      }
    >
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
    </Suspense>
  );
}