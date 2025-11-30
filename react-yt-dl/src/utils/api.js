const BASE = import.meta.env.DEV ? "http://localhost:5000" : "http://127.0.0.1:5000";
export async function getHello() {
  const res = await fetch(`${BASE}/api/hello`);
  return res.json();
}

export async function createUser(user) {
  const res = await fetch(`${BASE}/api/user`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user)
  });
  return res.json();
}
