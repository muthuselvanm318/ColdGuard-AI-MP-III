export const formatDateTime = (timestamp) => {
  if (!timestamp) return "-";

  const normalized = timestamp.endsWith("Z")
    ? timestamp
    : `${timestamp}Z`;

  return new Date(normalized).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
};

export const formatTimeOnly = (timestamp) => {
  if (!timestamp) return "-";
  
  const normalized = timestamp.endsWith("Z")
    ? timestamp
    : `${timestamp}Z`;

  return new Date(normalized).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
};

export const formatDateOnly = (timestamp) => {
  if (!timestamp) return "-";
  
  const normalized = timestamp.endsWith("Z")
    ? timestamp
    : `${timestamp}Z`;

  return new Date(normalized).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
};
