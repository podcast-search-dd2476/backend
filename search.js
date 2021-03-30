const { Client } = require('@elastic/elasticsearch')
const client = new Client({ node: 'http://localhost:9200' })

const METADATA_INDEX = "metadata_index"
const TRANSCRIPTS_INDEX = "transcripts_index"

const searchMetadata = async docID => {
    const { body } = await client.search({
        index: METADATA_INDEX,
        body: {
          query: {
            match: { "episodes.episode_filename_prefix": docID }
          }
        }
    })
    console.log(body.hits.hits)
    console.log(body.hits.hits[0]._source.episodes)
    return body
}

// searchMetadata("7zyeQozJ0AznBJ2DXILUy8")

const searchPodcast = async transcript => {
    const { body } = await client.search({
        index: TRANSCRIPTS_INDEX,
        body: {
          query: {
            match: { "data.transcript": transcript }
          }
        }
    })

    console.log(body.hits.hits)
    return body
}

searchPodcast("no")