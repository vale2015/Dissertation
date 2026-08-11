export const formatMoney=(value,currency="GBP")=>value==null?"Unavailable":new Intl.NumberFormat("en-GB",{style:"currency",currency}).format(value);
export const formatPercent=value=>value==null?"Unavailable":`${Number(value).toFixed(1)}%`;
export const formatDate=value=>value?new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(`${value}T00:00:00Z`)):"Unavailable";
export const formatWeather=weather=>weather?.available?(weather.condition||"Available"):"Unavailable";
export const formatRoles=roles=>roles?.length?roles.map(role=>`${role.role} (${role.required_staff})`).join(", "):"None";
