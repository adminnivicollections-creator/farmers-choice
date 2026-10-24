/**
 * Is there working internet? Asks Google's connectivity endpoint (the one
 * Android itself uses), not our API: a sleeping free-tier server is not "no
 * internet", and map tiles come from Google anyway.
 */
export async function hasInternet(timeoutMs = 5000): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch('https://clients3.google.com/generate_204', { signal: controller.signal });
    return res.status === 204;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
