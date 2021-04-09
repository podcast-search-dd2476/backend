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
 * @param {string} searchQ the text to search the podcast metadata fields
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

    return body.hits.hits

  } catch (e) {
    console.log(e)
    return null
  }
}

/**
 * Searches the metadata index
 * @param {string} docID the episode id to find
 * @param {number} index the index of the current segment
 */
 const searchSurroundingSegments = async (docID, index) => {
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

/**
 * given a query, returns objects that match the query (from both the transcripts and metadata indexes)
 */
const searchLonger = async (query, options = defaultSearchOptions) => {
  console.log(options)
  const result = await searchPodcast(query, options)
  if (result.error) return result
  const descNameResult = await searchDescription(query, options)
  if (descNameResult.error) return descNameResult

  const results = { descResults: [], results: [], error: false}

  // TODO: display this in FE?
  // add the podcasts that match on title or description
  for (let i = 0; i < descNameResult.length; i++) {
    const hit = descNameResult[i]
    const src = hit._source
    results.descResults.push(src)
  }

  segs_to_combine = findSegmentsToCombine(result.body.hits.hits)
  let checked_episodes = []

  // add the podcast sections that match on transcript
  for (let i = 0; i < result.body.hits.hits.length; i++) {
    const hit = result.body.hits.hits[i]
    const episode_id = hit._source.id
    let text_index = hit._source.index
    let modified_text = null // data structure to hold the modified text segments 
    let surrounding_texts // data structure to hold the segments that are in the proxmity of matching segments

    // handle the segments where other segments of same episode also matched on the query
    if (segs_to_combine[episode_id] && !checked_episodes.includes(episode_id)) {
      let segments = segs_to_combine[episode_id].filter(s => s.index != text_index).map(s => s.transcript)
      modified_text = combineTexts(segments, hit._source)
      checked_episodes.push(episode_id)
    }

    // handle segments that were the only match in that episode for specified query
    else if (!checked_episodes.includes(episode_id)) {
      surrounding_texts = await searchSurroundingSegments(episode_id, text_index)
      modified_text = combineTexts(surrounding_texts, hit._source)
    }
    if ( modified_text != null) {
      const pod_data = await searchMetadata(episode_id)
      // Only save the matching episode
      const episode_data = pod_data.hits.hits[0]._source.episodes.filter(e => e.episode_filename_prefix === episode_id)[0]

      results.results.push({surrounding_texts, pod_data, transcript: modified_text, episode_data})
    }
  }

  return results
}

/**
 * Combines the texts from multiple segments into one datastructure
 * @param {Array} surrounding_texts Array of text segment objects that are from the same episode as hit
 * @param {Object} hit object of type transcript. Segment from specific episode
 */
function combineTexts(surrounding_texts, hit) {
  const new_hit = {}
  new_hit.original_match = hit
  new_hit.transcripts = [hit]
  for (let i = 0; i < surrounding_texts.length; i++) {
    const text = surrounding_texts[i]._source
    if (text.index < hit.index) {
      // insert text before the original text
      new_hit.transcripts.unshift(text)
      new_hit.startTime = text.startTime
    } else { // the current text is after the text that was originally retrieved
      new_hit.transcripts.push(text)
      new_hit.endTime = text.endTime
    }
  }
  return new_hit
}

/**
 * Function to find all segments returned from the search that are from the same episode of a podcast
 * @param {Array} results Array of text segment objects that have been returned from search in the transcripts index
 */
function findSegmentsToCombine(results) {
  let allEpisodes = {} // all episodes and index of segments
  for (let i = 0; i < results.length; i++) {
    let currText = results[i]._source
    let episode_id = currText.id
    let seg_index = currText.index
    if (episode_id in allEpisodes) {
      let existingSegments = allEpisodes[episode_id]
      existingSegments.push({index: seg_index, transcript: results[i]})
    } else {
      allEpisodes[episode_id] = [{index: seg_index, transcript: results[i]}]
    }
  }

  let segmentsToCombine = {} // all episodes that have more than one segment returned by search
  for (const [ep_id, ep_value] of Object.entries(allEpisodes)) {
    if (ep_value.length > 1) {
      ep_value.sort((a, b) => a.index - b.index)
      seg_ids = []
      for (let i = 0; i < ep_value.length; i++) {
        seg_ids.push(ep_value[i])
      }
      segmentsToCombine[ep_id] = seg_ids
    }
  }
  console.log('segments to combine: ', segmentsToCombine)
  return segmentsToCombine
}

module.exports = {
  // search,
  search: searchLonger
}