const fs = require("fs")
const { Client } = require('@elastic/elasticsearch')
const { TRANSCRIPTS_INDEX, METADATA_INDEX, ELASTIC_URL } = require('./configuration')
const client = new Client({ node: ELASTIC_URL })

/**
 * Indexes the metadata file.
 * 
 * Before using this function, the metadata.tsv file needs to be converted
 * to JSON. Use the metadata.js script for that.
 * 
 * @param {string} metadata_file file to index
 */
const indexMetadata = metadata_file => {
    console.log("Indexing metadata file...")
    const mf = JSON.parse(fs.readFileSync(metadata_file))

    Object.values(mf).forEach(async o => {
        await client.index({
            index: METADATA_INDEX,
            body: o
        })
    })

    console.log("Done.")
}

/**
 * Indexes one file.
 * @param {string} filepath path to file
 */
const indexFile = filepath => {
    
    const promises = []
    
    const file = JSON.parse(fs.readFileSync(filepath))

    file.data.forEach(x => {
        promises.push(new Promise((resolve, reject) => {
            
            x.id = file.id
            
            client.index({
                index: TRANSCRIPTS_INDEX,
                body: x
            })
            .then(resolve)
            .catch(reject)
        }))
    })

    return Promise.all(promises)
}

/**
 * Indexes all file in a directory
 * @param {string} transformed_dir the directory to index
 */
const indexTranscripts = async transformed_dir => {
    console.log("Indexing transcripts...")

    const dir = fs.readdirSync(transformed_dir)

    for (let i = 0; i < dir.length; i++) {
        console.log(i)
        try {
            await indexFile(transformed_dir + dir[i])
        } catch (e) {
            console.log(e)
        }
    }

    console.log("Done.")
}

module.exports = {
    indexMetadata,
    indexTranscripts
}