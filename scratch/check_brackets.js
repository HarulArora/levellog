const fs = require('fs');
const content = fs.readFileSync('g:/Projects/Game Log APP/LevelLog/frontend/src/pages/Home.jsx', 'utf8');
let stack = [];
let lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    for (let j = 0; j < line.length; j++) {
        let char = line[j];
        if (char === '{' || char === '(' || char === '[') {
            stack.push({ char, line: i + 1, col: j + 1 });
        } else if (char === '}' || char === ')' || char === ']') {
            let last = stack.pop();
            if (!last) {
                console.log(`Unmatched ${char} at line ${i + 1}, col ${j + 1}`);
            } else {
                if ((char === '}' && last.char !== '{') ||
                    (char === ')' && last.char !== '(') ||
                    (char === ']' && last.char !== '[')) {
                    console.log(`Mismatched ${char} at line ${i + 1}, col ${j + 1} (last was ${last.char} at line ${last.line})`);
                }
            }
        }
    }
}
if (stack.length > 0) {
    stack.forEach(s => console.log(`Unclosed ${s.char} at line ${s.line}, col ${s.col}`));
} else {
    console.log('Brackets balanced!');
}
