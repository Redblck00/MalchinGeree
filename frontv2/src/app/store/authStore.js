import { create } from 'zustand'
import api from '@/lib/api'

const useAuthStore = create((set) => ({
  user:            null,
  token:           null,
  isAuthenticated: false,
  authLoading:     false,
  authError:       null,

  // Хуудас refresh хийхэд localStorage-с state сэргээх
  restoreAuth: () => {
    if (typeof window === 'undefined') return
    const token   = localStorage.getItem('token')
    const userStr = localStorage.getItem('user')
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr)
        set({ token, user, isAuthenticated: true })
      } catch (_) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
      }
    }
  },

  // Бүртгэл
  // Backend: POST /api/auth/register
  // Body: { first_name, last_name, phone, email, password }
  // Хариу: { message, phone }
  register: async ({ last_name,first_name, phone, email, password }) => {
    set({ authLoading: true, authError: null })
    try {
      const res = await api.post('/auth/register', {
        last_name,
        first_name,     
        phone,
        email,
        password,
      })
      return res.data
    } catch (err) {
      set({ authError: err.response?.data?.message || 'Бүртгэлд алдаа гарлаа' })
      throw err
    } finally {
      set({ authLoading: false })
    }
  },

  // OTP баталгаажуулах
  // Backend: POST /api/auth/verify-otp
  // Body: { phone, code }
  // Хариу: { user, token }
  verifyOtp: async (phone, code) => {
    set({ authLoading: true, authError: null })
    try {
      const res = await api.post('/auth/verify-otp', { phone, code })
      const { user, token } = res.data

      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))
      document.cookie = `token=${token}; path=/; max-age=604800`

      set({ user, token, isAuthenticated: true })
      return res.data
    } catch (err) {
      set({ authError: err.response?.data?.message || 'OTP буруу байна' })
      throw err
    } finally {
      set({ authLoading: false })
    }
  },

  // OTP дахин илгээх
  // Backend: POST /api/auth/resend-otp
  // Body: { phone }
  resendOtp: async (phone) => {
    try {
      const res = await api.post('/auth/resend-otp', { phone })
      return res.data
    } catch (err) {
      throw err
    }
  },

  // Нэвтрэх
  // Backend: POST /api/auth/login
  // Body: { phone, password }
  // Хариу: { user, token }
  login: async (phone, password) => {
    set({ authLoading: true, authError: null })
    try {
      const res = await api.post('/auth/login', { phone, password })
      const { user, token } = res.data

      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))
      document.cookie = `token=${token}; path=/; max-age=604800`

      set({ user, token, isAuthenticated: true })
      return res.data
    } catch (err) {
      set({ authError: err.response?.data?.message || 'Нэвтрэхэд алдаа гарлаа' })
      throw err
    } finally {
      set({ authLoading: false })
    }
  },

  // Гарах
  logout: () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    document.cookie = 'token=; path=/; max-age=0'
    set({ user: null, token: null, isAuthenticated: false, authError: null })
  },

  // Профайл шинэчлэх
  // Backend: PATCH /api/users/profile
  // Body: { first_name, last_name, email, address }
  updateProfile: async (userData) => {
    set({ authLoading: true, authError: null })
    try {
      const res = await api.patch('/users/profile', userData)
      const updatedUser = res.data.data
      localStorage.setItem('user', JSON.stringify(updatedUser))
      set({ user: updatedUser })
      return res.data
    } catch (err) {
      set({ authError: err.response?.data?.message || 'Шинэчлэхэд алдаа гарлаа' })
      throw err
    } finally {
      set({ authLoading: false })
    }
  },

  // Алдааг цэвэрлэх
  clearError: () => set({ authError: null }),

  // User state-ийг гараар тохируулах (зураг upload болсны дараа гэх мэт)
  // localStorage-г ч мөн адил шинэчилнэ
  setUser: (user) => {
    if (typeof window !== 'undefined' && user) {
      localStorage.setItem('user', JSON.stringify(user))
    }
    set({ user })
  },
}))
export default useAuthStore;