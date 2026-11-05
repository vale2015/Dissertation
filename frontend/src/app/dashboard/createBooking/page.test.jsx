import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, test, vi } from "vitest";
import CreateBookingPage from "./page";

const push = vi.hoisted(() => vi.fn());
const queryState = vi.hoisted(() => ({ date: "" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), useSearchParams: () => new URLSearchParams(queryState.date ? `date=${queryState.date}` : "") }));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); push.mockClear(); queryState.date = ""; });

function fillRequiredFields({ date = "2026-12-01", size = "3" } = {}) {
  fireEvent.change(screen.getByLabelText(/^Booking date/), { target: { value: date } });
  fireEvent.change(screen.getByLabelText(/^Booking time/), { target: { value: "12:00" } });
  fireEvent.change(screen.getByLabelText(/^Party size/), { target: { value: size } });
  fireEvent.change(screen.getByLabelText(/^Booking type/), { target: { value: "walk_in" } });
}

test("a booking can be sent with the four required fields and no customer name", async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ booking: { id: 1 } }) });
  vi.stubGlobal("fetch", fetchMock);
  render(<CreateBookingPage />);
  fillRequiredFields();
  fireEvent.submit(screen.getByRole("button", { name: "Save booking" }).closest("form"));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  const [url, request] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/backend/booking/add");
  expect(JSON.parse(request.body)).toMatchObject({
    booking_date: "2026-12-01", booking_time: "12:00", party_size: 3,
    booking_type: "walk_in", customer_name: "", notes: "",
  });
  expect(await screen.findByRole("status")).toHaveTextContent("Booking saved and daily demand totals updated");
});

test("an invalid party size never reaches the API", () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  render(<CreateBookingPage />);
  fillRequiredFields({ size: "0" });
  fireEvent.submit(screen.getByRole("button", { name: "Save booking" }).closest("form"));
  expect(screen.getByRole("alert")).toHaveTextContent("positive whole number");
  expect(fetchMock).not.toHaveBeenCalled();
});

test("cancel returns to the bookings overview", () => {
  render(<CreateBookingPage />);
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(push).toHaveBeenCalledWith("/dashboard/bookings");
});

test("a valid day from Bookings is prefilled, but an invalid date is ignored", () => {
  queryState.date = "2026-12-01";
  const first = render(<CreateBookingPage />);
  expect(screen.getByLabelText(/^Booking date/)).toHaveValue("2026-12-01");
  first.unmount();
  queryState.date = "2026-02-30";
  render(<CreateBookingPage />);
  expect(screen.getByLabelText(/^Booking date/)).toHaveValue("");
});
