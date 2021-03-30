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

        await client.index({
            index: TRANSCRIPTS_INDEX,
            body: file
        })
    })

    console.log("Done.")
}

indexTranscripts("/media/axel/StorageLinux/podcasts-no-audio-13GB/transformed/")

module.exports = {
    indexMetadata,
    indexTranscripts
}