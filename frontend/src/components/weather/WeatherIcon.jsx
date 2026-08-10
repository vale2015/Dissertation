const SUPPORTED_ICONS = new Set([
  "clear-day",
  "clear-night",
  "partly-cloudy-day",
  "partly-cloudy-night",
  "cloudy",
  "fog",
  "drizzle",
  "rain",
  "heavy-rain",
  "snow",
  "heavy-snow",
  "thunderstorm",
  "unknown",
]);


function Sun({ partial = false }) {
  return (
    <g transform={partial ? "translate(-9 -9) scale(.78)" : undefined}>
      <circle cx="32" cy="32" r="11" fill="none" stroke="currentColor" strokeWidth="4" />
      {[0, 45, 90, 135].map((angle) => (
        <path
          key={angle}
          d="M32 7v8M32 49v8"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="4"
          transform={`rotate(${angle} 32 32)`}
        />
      ))}
    </g>
  );
}


function Moon({ partial = false }) {
  return (
    <path
      d="M44 46A21 21 0 0 1 28 10a19 19 0 1 0 16 36Z"
      fill="none"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="4"
      transform={partial ? "translate(-8 -8) scale(.8)" : undefined}
    />
  );
}


function Cloud() {
  return (
    <path
      d="M18 48h30a10 10 0 0 0 1-20 17 17 0 0 0-32-2 11 11 0 0 0 1 22Z"
      fill="white"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="4"
    />
  );
}


function Precipitation({ kind }) {
  if (kind === "snow" || kind === "heavy-snow") {
    const flakes = kind === "heavy-snow" ? [18, 32, 46] : [24, 40];
    return flakes.map((x) => (
      <g key={x} stroke="currentColor" strokeLinecap="round" strokeWidth="2.5">
        <path d={`M${x} 50v10M${x - 4} 55h8M${x - 3} 52l6 6M${x + 3} 52l-6 6`} />
      </g>
    ));
  }

  const drops = kind === "heavy-rain" ? [17, 28, 39, 50] : [23, 34, 45];
  const strokeWidth = kind === "drizzle" ? 2.5 : 4;
  return drops.map((x) => (
    <path
      key={x}
      d={`M${x} 51l-2 7`}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={strokeWidth}
    />
  ));
}


function IconContent({ icon }) {
  switch (icon) {
    case "clear-day":
      return <Sun />;
    case "clear-night":
      return <Moon />;
    case "partly-cloudy-day":
      return <><Sun partial /><Cloud /></>;
    case "partly-cloudy-night":
      return <><Moon partial /><Cloud /></>;
    case "cloudy":
      return <Cloud />;
    case "fog":
      return (
        <>
          <Cloud />
          <path d="M14 54h36M20 61h28" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
        </>
      );
    case "drizzle":
    case "rain":
    case "heavy-rain":
    case "snow":
    case "heavy-snow":
      return <><Cloud /><Precipitation kind={icon} /></>;
    case "thunderstorm":
      return (
        <>
          <Cloud />
          <path d="M35 47l-8 12h8l-4 9 13-15h-8l5-6Z" fill="currentColor" />
        </>
      );
    default:
      return (
        <>
          <circle cx="32" cy="32" r="24" fill="none" stroke="currentColor" strokeWidth="4" />
          <path d="M25 25a8 8 0 1 1 9 8v7M34 50h.01" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="5" />
        </>
      );
  }
}


export default function WeatherIcon({
  icon,
  size = 32,
  className = "",
  label = "Weather conditions",
  decorative = false,
}) {
  const safeIcon = SUPPORTED_ICONS.has(icon) ? icon : "unknown";
  const accessibilityProps = decorative
    ? { "aria-hidden": true }
    : { role: "img", "aria-label": label };

  return (
    <svg
      {...accessibilityProps}
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <IconContent icon={safeIcon} />
    </svg>
  );
}
