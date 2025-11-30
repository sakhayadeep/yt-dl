const BASE = "http://127.0.0.1:5000";

export async function shutdownBackend() {
  const res = await fetch(`${BASE}/shutdown`, {
    method: "POST"
  });
  return res.ok;
}