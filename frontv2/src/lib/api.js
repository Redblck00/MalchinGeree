'use client'
import axios from "axios";
const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api",
    timeout: 60000,
    headers: {
        "Content-Type": "application/json",
    },
})
// Хүсэлт илгээхийн өмнө token нэмэх
api.interceptors.request.use(
    (config) => {
        if(typeof window !=='undefined'){
            const token = localStorage.getItem("token")
            if(token){
                config.headers.Authorization = `Bearer ${token}`
            }
        }
        return config
    },
    error => Promise.reject(error)
)

// Хариу ирэхэд алдаа шалгах
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Token хүчингүй болсон → автоматаар гаргах
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        document.cookie = 'token=; path=/; max-age=0'
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)
export default api