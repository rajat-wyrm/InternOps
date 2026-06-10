import { create } from 'zustand'
const useAuthStore = create((set)=>({
  accessToken: localStorage.getItem('accessToken') || null,
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  setAuth: (token, user) => { localStorage.setItem('accessToken', token); localStorage.setItem('user', JSON.stringify(user)); set({ accessToken: token, user }); },
  logout: () => { localStorage.removeItem('accessToken'); localStorage.removeItem('user'); set({ accessToken: null, user: null }); }
}))
export default useAuthStore
