import { createContext, useContext, useEffect, useState } from 'react'
import { api, getToken, setToken } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!getToken()) { setLoading(false); return }
    api('/api/auth/me').then(setUser).catch(() => setToken('')).finally(() => setLoading(false))
  }, [])
  const acceptAuth = data => { setToken(data.access_token); setUser(data.user) }
  const logout = () => { setToken(''); setUser(null) }
  return <AuthContext.Provider value={{ user, loading, acceptAuth, logout }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)

