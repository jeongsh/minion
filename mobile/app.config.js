function assertProductionApiUrl() {
  if (process.env.MINION_APP_ENV !== "production") return;

  const rawUrl = process.env.EXPO_PUBLIC_API_URL;
  if (!rawUrl) {
    throw new Error("EXPO_PUBLIC_API_URL must be set for production builds.");
  }

  let apiUrl;
  try {
    apiUrl = new URL(rawUrl);
  } catch {
    throw new Error("EXPO_PUBLIC_API_URL must be a valid absolute URL for production builds.");
  }

  const hostname = apiUrl.hostname.toLowerCase();
  const octets = hostname.split(".").map(Number);
  const isPrivateIpv4 =
    octets.length === 4 &&
    octets.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255) &&
    (octets[0] === 10 ||
      octets[0] === 127 ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168));

  if (
    apiUrl.protocol !== "https:" ||
    hostname === "localhost" ||
    hostname.endsWith(".local") ||
    isPrivateIpv4
  ) {
    throw new Error("EXPO_PUBLIC_API_URL must use a public HTTPS origin for production builds.");
  }
}

module.exports = ({ config }) => {
  assertProductionApiUrl();

  return {
    ...config,
    android: {
      ...config.android,
      googleServicesFile:
        process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json",
    },
  };
};
