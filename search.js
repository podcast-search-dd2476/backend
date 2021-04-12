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
 * Searches the metadata index for matches in name or description
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

/**
 * given a query, returns objects that match the query from  metadata index
 */
const searchDesc = async (query, options = defaultSearchOptions) => {
  console.log(options)
  const descNameResult = await searchDescription(query, options)
  if (descNameResult.error) return descNameResult

  const results = { results: [], error: false}

  // TODO: display this in FE?
  // add the podcasts that match on title or description
  for (let i = 0; i < descNameResult.length; i++) {
    const hit = descNameResult[i]
    const src = hit._source
    results.results.push(src)
  }

  return results
}

/**
 * given a query, returns objects that match the query from the transcripts index
 */
const search = async (query, options = defaultSearchOptions) => {
  let startTime = Date.now()
  console.log(options)
  const result = await searchPodcast(query, options)
  if (result.error) return result

  const results = { results: [], error: false}

  segs_to_combine = findSegmentsToCombine(result.body.hits.hits)
  let checked_episodes = []

  // add the podcast segments that match on transcript to the data structure to return
  for (let i = 0; i < result.body.hits.hits.length; i++) {
    const hit = result.body.hits.hits[i]._source
    const episode_id = hit.id
    let text_index = hit.index
    let combined_segments = null // data structure to hold the modified text segments 

    // handle the segments where other segments of same episode also matched on the query
    if (segs_to_combine[episode_id] && !checked_episodes.includes(episode_id)) {
      let segments = segs_to_combine[episode_id].filter(s => s.index != text_index).map(s => s.transcript)
      combined_segments = combineSegments(segments, hit)
      checked_episodes.push(episode_id)
    }

    // handle segments that were the only match in that episode for specified query
    else if (!checked_episodes.includes(episode_id)) {
      const surrounding_texts = await searchSurroundingSegments(episode_id, text_index)
      combined_segments = combineSegments(surrounding_texts, hit)
    }
    if ( combined_segments != null) {
      const pod_data = await searchMetadata(episode_id)
      // Only save the matching episode
      const episode_data = pod_data.hits.hits[0]._source.episodes.filter(e => e.episode_filename_prefix === episode_id)[0]

      results.results.push({pod_data: pod_data.hits.hits[0]._source, transcript: combined_segments, episode_data})
    }
  }

  let endTime = Date.now() - startTime
  return {
    results: groupByPodcast(results.results),
    took: endTime
  }
}

/**
 * Groups the matching episodes by podcast
 * @param {Array} results Array of episodes
 */
function groupByPodcast (results) {
  let all_podcasts = {}
  for (let i = 0; i < results.length; i++) {
    let episode = results[i]
    const pod_id = episode.pod_data.podcast_filename_prefix
    if (pod_id in all_podcasts) {
      let episodes = all_podcasts[pod_id]
      episodes.push(episode)
    } else {
      all_podcasts[pod_id] = [episode]
    }
  }
  return Object.values(all_podcasts)
}

/**
 * Combines the data from multiple segments into one datastructure
 * @param {Array} surrounding_segments Array of text segment objects that are from the same episode as hit
 * @param {Object} hit object of type transcript. Segment from specific episode
 * @return {Object} hit object containing an object containing:
 * array of all segments
 * id of the original match (if this is a combination of multiple segments that all have matched the query, this will be the index of the highest rank)
 * startTime: start time of first segment
 * endTime: end time of last segment
 */
function combineSegments(surrounding_segments, hit) {
  const new_hit = {}
  new_hit.original_match_index = hit.index
  new_hit.transcripts = [hit]
  for (let i = 0; i < surrounding_segments.length; i++) {
    const segment = surrounding_segments[i]._source
    if (segment.index < hit.index) {
      // insert text before the original text
      new_hit.transcripts.splice(0, 0, segment)
      new_hit.startTime = segment.startTime
    } else { // the current text is after the text that was originally retrieved
      new_hit.transcripts.push(segment)
      new_hit.endTime = segment.endTime
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
  // For debug purposes: to see if we have combinations
  console.log('segments to combine: ', segmentsToCombine)
  return segmentsToCombine
}

module.exports = {
  search,
  searchDesc
}