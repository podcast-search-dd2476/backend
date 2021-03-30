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

const indexTranscripts = transformed_dir => {
    console.log("Indexing transcripts...")

    const dir = fs.readdirSync(transformed_dir)

    dir.forEach(async f => {
        const file = JSON.parse(fs.readFileSync(transformed_dir + f))

        file.data.forEach(async x => {
            x._id = file._id
            await client.index({
                index: TRANSCRIPTS_INDEX,
                body: x
            })
        })

    })

    console.log("Done.")
}

indexTranscripts("./transformed/")

module.exports = {
    indexMetadata,
    indexTranscripts
}