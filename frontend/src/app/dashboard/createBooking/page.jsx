"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AddNewBooking from "@/components/dashboard/addNewBooking";
import { API_BASE } from "@/lib/api";


// Checks if the selected booking date is a Monday.
function isMonday(dateString) {
  if (!dateString) return false;

  const selectedDate = new Date(`${dateString}T00:00:00`);
  return selectedDate.getDay() === 1;
}

function validBookingDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return "";
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? value : "";
}

// Page used to create a new restaurant booking.
function CreateBookingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Store all booking form values.
  const [formData, setFormData] = useState(() => ({
    booking_date: validBookingDate(searchParams.get("date")),
    booking_time: "",
    party_size: "",
    booking_type: "",
    customer_name: "",
    notes: "",
  }));

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

  // Return the user to the bookings overview when cancelling.
  const handleCancel = () => {
    router.push("/dashboard/bookings");
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
      !formData.booking_type
    ) {
      setErrorMessage("Please complete all required fields.");
      return;
    }

    if (!Number.isInteger(Number(formData.party_size)) || Number(formData.party_size) <= 0) {
      setErrorMessage("Party size must be a positive whole number.");
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

      setSuccessMessage("Booking saved and daily demand totals updated.");

      // Reset the form after a successful booking.
      setFormData({
        booking_date: "",
        booking_time: "",
        party_size: "",
        booking_type: "",
        customer_name: "",
        notes: "",
      });
    } catch (error) {
      setErrorMessage(error.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return <AddNewBooking
        formData={formData}
        loading={loading}
        successMessage={successMessage}
        errorMessage={errorMessage}
        onChange={handleChange}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />;
}

export default function CreateBookingPage() {
  return <Suspense fallback={<p className="dashboard-text">Loading booking form...</p>}><CreateBookingContent /></Suspense>;
}
