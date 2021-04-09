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

/**
 * Searches the metadata index
 * @param {string} docID the episode id to find
 */
 const searchDescription = async (searchQ, options = defaultSearchOptions) => {
  try {
    const { body } = await client.search({
      index: METADATA_INDEX,
      size: options.size || defaultSearchOptions.size,
      body: {
        query: {
          bool: {
            should: [
              {[options["type"]]: { "podcast_desc": searchQ }},
              {[options["type"]]: { "podcast_name": searchQ }}
            ]
          }
        }
      }
    })

    console.log(body.hits.hits)
    return body.hits.hits

  } catch (e) {
    console.log(e)
    return null
  }
}

/**
 * Searches the metadata index
 * @param {string} docID the episode id to find
 */
 const searchSurroundingEpisodes = async (docID, index) => {
  // TODO: need to get all episodes (now only gets 10)
  try {
    const { body } = await client.search({
      index: TRANSCRIPTS_INDEX,
      body: {
        query: {
          bool: {
            must: [
              { match: { "id": docID }},
              { bool: {
                should: [
                  { match: { "index": index+1 }},
                  { match: { "index": index-1 }},
                ]}
              }
            ]
          }
        }
      }
    })
    // console.log(body.hits.hits)
    return body.hits.hits

  } catch (e) {
    console.log(e)
    return null
  }
}

const defaultSearchOptions = {
  type: "match",
  size: 10,
}

/**
 * Searches for podcasts
 * @param {string} transcript the text to search for
 */
const searchPodcast = async (transcript, options = defaultSearchOptions) => {
  if (options.size <= 0) options.size = 10
  
  try {
    const { body } = await client.search({
      index: TRANSCRIPTS_INDEX,
      size: options.size || defaultSearchOptions.size,
      body: {
        query: {
          [options["type"]]: { "transcript": transcript }
        }
      }
    })

    console.log(body.hits.hits.length)

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

const searchLonger = async (query, options = defaultSearchOptions) => {
  console.log(options)
  const result = await searchPodcast(query, options)
  if (result.error) return result
  const descNameResult = await searchDescription(query, options)
  if (descNameResult.error) return descNameResult

  const results = { descResults: [], results: [], error: false}

  // add the podcasts that match on title or description
  for (let i = 0; i < descNameResult.length; i++) {
    const hit = descNameResult[i]
    const src = hit._source
    results.descResults.push(src)
  }
  // TODO: check if any of the matches is fom the same episode of same podcast.
  // if segments are close, add them together and return the combined object

  // add the podcast sections that match on transcript
  for (let i = 0; i < result.body.hits.hits.length; i++) {
    const hit = result.body.hits.hits[i]
    //TODO: check if word in match is at the beginning or end of transcript
    const episode_id = hit._source.id
    const pod_data = await searchMetadata(episode_id)
    let text_index = hit._source.index
    
    // get the surrounding text sections
    const surrounding_texts = await searchSurroundingEpisodes(episode_id, text_index)
    new_text = combineTexts(surrounding_texts, hit._source)
    
    // Only save the matching episode
    const episode_data = pod_data.hits.hits[0]._source.episodes.filter(e => e.episode_filename_prefix === episode_id)[0]

    results.results.push({surrounding_texts, pod_data, transcript: new_text, episode_data})
  }

  return results
}

function combineTexts(surrounding_texts, hit) {
  let new_hit = hit
  let new_transcript = hit.transcript
  for (let i = 0; i < surrounding_texts.length; i++) {
    let text = surrounding_texts[i]._source
    if (text.index < hit.index) {
      new_transcript = text.transcript + new_transcript
      new_hit.startTime = text.startTime
    } else { // the current text is after the text that was originally retrieved
      new_transcript += text.transcript
      new_hit.endTime = text.endTime
    }
  }
  new_hit.transcript = new_transcript
  console.log(new_hit)
  return new_hit
}

module.exports = {
  // search,
  search: searchLonger
}