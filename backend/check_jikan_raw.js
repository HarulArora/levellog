import axios from 'axios';

async function checkJikan() {
    const ids = [57791]; // Bleach TYBW Part 3
    for (const id of ids) {
        try {
            console.log(`Fetching MAL ID ${id}...`);
            const res = await axios.get(`https://api.jikan.moe/v4/anime/${id}`);
            const item = res.data.data;
            console.log(`Title: ${item.title}`);
            console.log(`Year: ${item.year}`);
            console.log(`Aired Prop From Year: ${item.aired?.prop?.from?.year}`);
            console.log(`Aired String: ${item.aired?.string}`);
            console.log('--- Full Aired Object ---');
            console.log(JSON.stringify(item.aired, null, 2));
        } catch (err) {
            console.error(err.message);
        }
    }
}

checkJikan();
