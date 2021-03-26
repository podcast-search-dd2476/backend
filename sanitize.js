/* This file takes transcripts, sanitizes them, and outputs the sanitized files.
 * The sanitation removes "words" arrays from the json file, reducing the file size dramatically.
 * This means we don't know the specific timestamp for each word. We save the timestamp for every subtranscript though.
 * 
 * The sanitation takes several minutes.
 * 
 * Written by Axel Elmarsson
 * 
 * Arguments:
 * 1. root path of transcripts
 *      - Unzip the three zipped transcript folders and place them in a common folder.
 *      - This argument consists of that path (INCLUDING "/" at the end)
 * 2. output folder
 *      - path to output folder, INCLUDING "/" at the end.
 * 
 * Example:
 *      node sanitize.js /media/axel/StorageLinux/podcasts/podcasts-transcripts/ /media/axel/StorageLinux/podcasts/sanitized/
 */

const fs = require('fs');

const sanitize = filepath => {
    const f = JSON.parse(fs.readFileSync(filepath));
    f.results.forEach((result, i) => {
        result.alternatives.forEach((alt, j) => {
            if (alt.words) {
                alt["startTime"] = alt.words[0].startTime
                alt["endTime"] = alt.words[alt.words.length - 1].endTime
                delete alt.words
    
            } else {
                delete result[i]
            }
        })
    })

    return f
}

const path = process.argv[2]
const outputdir = process.argv[3]

let level0 = fs.readdirSync(path)

for (let i = 0; i < level0.length; i++) {
    let level1 = fs.readdirSync(path + level0[i] + "/")
    for (let j = 0; j < level1.length; j++) {
        let level2 = fs.readdirSync(path + level0[i] + "/" + level1[j] + "/")
        for (let k = 0; k < level2.length; k++) {
            let level3 = fs.readdirSync(path + level0[i] + "/" + level1[j] + "/" + level2[k])

            let fpath = path + level0[i] + "/" + level1[j] + "/" + level2[k] + "/"

            console.log(`${level0[i]}/${level1[j]}/${level2[k]}`)

            level3.forEach(file => {
                if (file.match(/\.json/)) {

                    const sanitized = sanitize(fpath + file)
                    let writepath = `${outputdir}${file}`
                    
                    fs.writeFileSync(writepath, JSON.stringify(sanitized, null, 4))
                }
            })
        }
    }
}
