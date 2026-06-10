import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/axios'
import useAuthStore from '../store/auth'
export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const setAuth = useAuthStore(s => s.setAuth)
  const handle = async e => {
    e.preventDefault()
    try {
      const { data } = await api.post('/auth/login', { email, password })
      setAuth(data.accessToken, data.user)
      navigate('/')
    } catch(err) { setError(err.response?.data?.error||'Login failed') }
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <form onSubmit={handle} className="bg-white p-8 rounded shadow w-96">
        <h1 className="text-2xl font-bold mb-4">InternOps Login</h1>
        {error && <p className="text-red-500 mb-2">{error}</p>}
        <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full border p-2 mb-2 rounded" required />
        <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full border p-2 mb-4 rounded" required />
        <button className="w-full bg-blue-600 text-white p-2 rounded">Login</button>
      </form>
    </div>
  )
}
