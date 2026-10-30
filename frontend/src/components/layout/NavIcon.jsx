const ICONS = {
  dashboard: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5M9 21v-7h6v7" /></>,
  bookings: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 10h18m-13 4h3m-3 3h6" /></>,
  forecast: <><path d="M3 20V5m0 15h18M6 16l5-5 4 3 5-7" /><path d="M17 7h3v3" /></>,
  staffForecast: <><circle cx="12" cy="7" r="3" /><path d="M6 20v-3a6 6 0 0 1 12 0v3M4 9l-2 2m18-2 2 2M4 15l-2-1m18 1 2-1" /></>,
  staff: <><circle cx="8" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M2 20v-2a6 6 0 0 1 12 0v2H2Zm13-8a5 5 0 0 1 7 4.5V20h-5" /></>,
  reports: <><path d="M5 21V4a1 1 0 0 1 1-1h9l4 4v14H5Z" /><path d="M14 3v5h5M8 17v-4m4 4V9m4 8v-6" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="m10 2-.5 2.2-2 .8L5.5 4 4 5.5 5 7.5l-.8 2L2 10v4l2.2.5.8 2L4 18.5 5.5 20l2-1 2 .8L10 22h4l.5-2.2 2-.8 2 1 1.5-1.5-1-2 .8-2L22 14v-4l-2.2-.5-.8-2 1-2L18.5 4l-2 1-2-.8L14 2h-4Z" /></>,
};

export default function NavIcon({ name }) {
  return <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[name]}</svg>;
}
