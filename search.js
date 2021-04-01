const { Client } = require('@elastic/elasticsearch')
const { TRANSCRIPTS_INDEX, METADATA_INDEX, ELASTIC_URL } = require('./configuration')
const client = new Client({ node: ELASTIC_URL })

/**
 * Searches the metadata index
 * @param {string} docID the episode id to find
 */
const searchMetadata = async docID => {
  try {
    const { body } = await client.search({
      index: METADATA_INDEX,
      body: {
        query: {
          match: { "episodes.episode_filename_prefix": docID }
        }
      }
    })

    return body

  } catch (e) {
    console.log(e)
    return null
  }
}

const defaultSearchOptions = {
  type: "match"
}

/**
 * Searches for podcasts
 * @param {string} transcript the text to search for
 */
const searchPodcast = async (transcript, options = defaultSearchOptions) => {
  try {
    const { body } = await client.search({
      index: TRANSCRIPTS_INDEX,
      body: {
        query: {
          [options["type"]]: { "transcript": transcript }
        }
      }
    })

    return { body, error: false }

  } catch (e) {
    console.log(e)
    return { body: e, error: true }
  }
}

const search = async (query, options = defaultSearchOptions) => {
  console.log(options)
  const result = await searchPodcast(query, options)
  if (result.error) return result

  const results = { results: [], error: false}
  
  for (let i = 0; i < result.body.hits.hits.length; i++) {
    const hit = result.body.hits.hits[i]
    const episode_id = hit._source.id
    const pod_data = await searchMetadata(episode_id)
    
    // Only save the matching episode
    const episode_data = pod_data.hits.hits[0]._source.episodes.filter(e => e.episode_filename_prefix === episode_id)[0]

    results.results.push({pod_data, transcript: hit, episode_data})
  }

  return results
}

module.exports = {
  search,
}