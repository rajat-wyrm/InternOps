import axios from 'axios'
import useAuthStore from '../store/auth'
const api = axios.create({
  baseURL: '/api',
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-Token',
  withCredentials: true
})
api.interceptors.request.use(cfg => {
  const token = useAuthStore.getState().accessToken
  if(token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})
api.interceptors.response.use(res => res, async err => {
  if(err.response?.status===401) {
    try {
      const { data } = await axios.post('/api/auth/refresh', {}, { withCredentials: true })
      useAuthStore.getState().setAuth(data.accessToken, useAuthStore.getState().user)
      err.config.headers.Authorization = `Bearer ${data.accessToken}`
      return axios(err.config)
    } catch { useAuthStore.getState().logout(); window.location.href='/login' }
  }
  return Promise.reject(err)
})
export default api
