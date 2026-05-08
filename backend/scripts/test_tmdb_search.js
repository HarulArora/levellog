import apiClient from '../utils/apiClient.js';
import dotenv from 'dotenv';
dotenv.config();

async function testSearch() {
    try {
        const res = await apiClient.get('https://api.tmdb.org/3/search/tv', {
            params: {
                api_key: process.env.TMDB_API_KEY,
                query: 'Dark'
            }
        });
        console.log('Search results for "Dark":');
        res.data.results.slice(0, 5).forEach(r => {
            console.log(`- ${r.name} (ID: ${r.id}) | First Air: ${r.first_air_date}`);
        });
    } catch (err) {
        console.error(err.message);
    }
}

testSearch();
