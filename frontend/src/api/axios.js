// axios.js
// This creates a configured Axios instance
// Think of it as a pre-configured phone line to your backend
// Instead of typing the full URL every time, 
// you just use this instance and it adds the base URL automatically

import axios from 'axios'

const api = axios.create({
    // baseURL → every request automatically starts with this
    // So instead of 'http://localhost:5000/api/games'
    // you just write '/games'
    baseURL: 'http://localhost:5000/api',

    // Send cookies with every request (needed for auth later)
    withCredentials: true,
})

export default api