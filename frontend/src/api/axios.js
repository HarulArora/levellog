import axios from 'axios'

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL,  // ← is this here?
    withCredentials: true,
})

export default api