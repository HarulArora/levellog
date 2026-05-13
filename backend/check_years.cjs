const mongoose = require('mongoose');
const Ranking = require('./models/Ranking.js');

async function checkRankings() {
    try {
        await mongoose.connect('mongodb://localhost:27017/levellog');
        const rankings = await Ranking.find({ contentType: { $in: ['anime', 'manga'] } });
        
        console.log(`Checking ${rankings.length} rankings...`);
        const suspicious = rankings.filter(r => r.year > 2024 || r.year < 1950);
        
        console.log('Suspicious years found:', suspicious.length);
        suspicious.forEach(r => {
            console.log(`[${r.contentType}] ${r.title}: ${r.year} (${r.rankType})`);
        });

        // Check for long running shows showing current year
        const likelyWrong = rankings.filter(r => r.title.includes('One Piece') || r.title.includes('Naruto') || r.title.includes('Detective Conan'));
        likelyWrong.forEach(r => {
            console.log(`[Known Long-Running] ${r.title}: ${r.year} (${r.rankType})`);
        });

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkRankings();
