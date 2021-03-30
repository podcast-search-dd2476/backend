const fs = require("fs")
const { Client } = require('@elastic/elasticsearch')
const client = new Client({ node: 'http://localhost:9200' })


const METADATA_INDEX = "metadata_index"
const TRANSCRIPTS_INDEX = "transcripts_index"

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

const indexFile = filepath => {
    
    const promises = []
    
    const file = JSON.parse(fs.readFileSync(filepath))

    file.data.forEach(x => {
        promises.push(new Promise((resolve, reject) => {
            
            x._id = file.id
            
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

indexTranscripts("/media/axel/StorageLinux/podcasts-no-audio-13GB/transformed/")

module.exports = {
    indexMetadata,
    indexTranscripts
}