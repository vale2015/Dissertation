import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, test, vi } from "vitest";
import AddNewBooking from "./addNewBooking";

afterEach(cleanup);

test("the form reflects required booking fields and optional guest details", () => {
  render(<AddNewBooking />);
  for (const name of ["Booking date", "Booking time", "Party size", "Booking type"]) {
    expect(screen.getByLabelText(new RegExp(`^${name}`))).toBeRequired();
  }
  expect(screen.getByLabelText("Customer name Optional")).not.toBeRequired();
  expect(screen.getByLabelText("Notes Optional")).not.toBeRequired();
  expect(screen.getByLabelText("Customer name Optional")).toHaveAttribute("maxLength", "100");
  expect(screen.getByLabelText("Notes Optional")).toHaveAttribute("maxLength", "500");
  expect(screen.getByRole("option", { name: "Select a type" })).toHaveValue("");
});

test("Monday is explained and saving is disabled", () => {
  render(<AddNewBooking formData={{ booking_date: "2026-11-30", booking_time: "12:00", party_size: "2", booking_type: "advance", customer_name: "", notes: "" }} />);
  expect(screen.getByLabelText(/^Booking date/)).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByText(/closed on Mondays/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Save booking" })).toBeDisabled();
});

test("feedback has a live region and cancel stays available while saving", () => {
  const onCancel = vi.fn();
  render(<AddNewBooking loading successMessage="Booking saved" onCancel={onCancel} />);
  expect(screen.getByRole("status")).toHaveTextContent("Booking saved");
  expect(screen.getByRole("button", { name: "Saving booking…" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
});
