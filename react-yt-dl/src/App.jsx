import { useEffect, useState } from 'react'
import './App.css'

import { createUser, getHello } from './utils/api';

function App() {

  const [message, setMessage] = useState('');
  const [user, setUser] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await getHello();
        setMessage(data.msg);
      } catch (err) {
        console.error("Error fetching:", err);
      }
    }

    fetchData();
  }, []);

  async function submitHandler() {
    if (user) {
      setUser(null);
      return;
    }

    const data = {
      name: "Ravi",
      job: "Teacher",
      salary: 10000.50,
      tax: 500.67
    };

    const res = await createUser(data);
    setUser(res);
  }

  return (
    <div>
      <p>
        {message}
      </p>
      <button onClick={submitHandler}>{!user ? 'Create' : 'Delete'} user</button>
      <div>
        name: {user?.name}<br />
        job: {user?.job}<br />
        salary: {user?.salary}<br />
        tax: {user?.tax}
      </div>
    </div>
  );
}

export default App
