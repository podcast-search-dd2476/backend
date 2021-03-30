const fs = require('fs');

const dirpath = process.argv[2]
const outputdir = process.argv[3]
let dir = fs.readdirSync(dirpath);

for (let i = 0; i < dir.length; i++) {
    const filename = dir[i].split(".json")[0]
    console.log(filename)
    let file = JSON.parse(fs.readFileSync(dirpath + dir[i]))

    // const filename = "7zzZJGsL8fwDOrduUkX91D"
    // let file = JSON.parse(fs.readFileSync("./7zzZJGsL8fwDOrduUkX91D.json"))
    
    let transformed = {
        id: filename,
        data: []
    }

    file.results.forEach((alternative, i) => {
        const toPush = alternative.alternatives[0]
        toPush.index = i
        transformed.data.push(toPush)
    })

    // fs.writeFileSync("output.json", JSON.stringify(transformed, null, 4))
    fs.writeFileSync(`${outputdir}/${filename}.json`, JSON.stringify(transformed, null, 4))
}
