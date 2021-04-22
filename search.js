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
              { [options["type"]]: { "podcast_desc": searchQ } },
              { [options["type"]]: { "podcast_name": searchQ } }
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
 * Searches the surrounding segments 
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
              { match: { "id": docID } },
              {
                bool: {
                  should: [
                    { match: { "index": index + 1 } },
                    { match: { "index": index - 1 } },
                  ]
                }
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


/**
 * Searches for spec indices in podcast episode with id docID
 * @param {string} docID the episode id to find
 * @param {Array} indices the indices to get
 */
const searchFromIndices = async (docID, indices) => {
  // TODO: Make some to get variable number of indices
  should_query = []
  indices.forEach(element => should_query.push({ match: { "index": element } }))
  try {
    const { body } = await client.search({
      index: TRANSCRIPTS_INDEX,
      body: {
        query: {
          bool: {
            must: [
              { match: { "id": docID } },
              {
                bool: {
                  should: should_query
                }
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

  const results = { results: [], error: false }

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
 * Given a query, returns objects that match the query from the transcripts index
 */
const search = async (query, options = defaultSearchOptions) => {
  let startTime = Date.now()
  console.log(options)
  const result = await searchPodcast(query, options)
  if (result.error) return result

  const results = { results: [], error: false }

  segs_to_combine = findSegmentsToCombine(result.body.hits.hits)

  segs_expanded = await expandSegmentNeighbours(segs_to_combine)

  seqs_to_combine = segs_expanded

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

      // Populate the hit with text from before and after.
      await findSurroundingSegs(episode_id, text_index, hit)

      // TODO: check if this is necessary
      combined_segments = combineSegments({}, hit)
    }
    if (combined_segments != null) {
      const pod_data = await searchMetadata(episode_id)
      // Only save the matching episode
      const episode_data = pod_data.hits.hits[0]._source.episodes.filter(e => e.episode_filename_prefix === episode_id)[0]

      results.results.push({ pod_data: pod_data.hits.hits[0]._source, transcript: combined_segments, episode_data })
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
function groupByPodcast(results) {
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
      existingSegments.push({ index: seg_index, transcript: results[i] })
    } else {
      allEpisodes[episode_id] = [{ index: seg_index, transcript: results[i] }]
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

/**
 * Function to find which episode segments that are closer than -- 1 min -- to each other or consecutive, 
 * add them and the episodes between them together.  
 * @param {Object} results Object consisting of arrays of text segment objects that belong to the same episode of a podcast.
 */
const expandSegmentNeighbours = async (results = defaultSearchOptions) => {
  max_diff_time = 60
  // Iterate through all the podcast episodes
  for (const [ep_id, segment_list] of Object.entries(results)) {
    // Sort the list so that we go through the indices in the right order
    segment_list.sort((a, b) => (a.index > b.index) ? 1 : -1)

    new_segment_list = [segment_list[0]]

    for (i = 1; i < segment_list.length; i++) {
      index1 = new_segment_list[new_segment_list.length - 1]['transcript']['_source']['index']
      index2 = segment_list[i]['transcript']['_source']['index']

      // For merging, the index will be the later of the two
      startTime1 = new_segment_list[new_segment_list.length - 1]['transcript']['_source']['startTime']

      content1 = new_segment_list[new_segment_list.length - 1]['transcript']['_source']['transcript']
      content2 = segment_list[i]['transcript']['_source']['transcript']

      if (index1 + 1 == index2) {
        new_content = content1 + content2

        new_segment = segment_list[i]

        new_segment['transcript']['_source']['transcript'] = new_content
        new_segment['transcript']['_source']['startTime'] = startTime1

        new_segment_list[new_segment_list.length - 1] = new_segment

      } else {
        // If they are not direct neighbours, check the time distance between them
        indices_to_get = []
        endTime1 = parseFloat(new_segment_list[new_segment_list.length - 1]['transcript']['_source']['endTime'].split("s")[0])
        startTime2 = parseFloat(segment_list[i]['transcript']['_source']['startTime'].split("s")[0])

        if (startTime2 - endTime1 < max_diff_time) {
          // Get all indices between them
          for (j = index1 + 1; j < index2; j++) {
            indices_to_get.push(j)
          }

          // TODO: hämtar endast 10 st!
          const segs_between = await searchFromIndices(ep_id, indices_to_get)

          let new_contents = [content1]

          if (segs_between !== null) {
            segs_between.sort((a, b) => (a.index > b.index) ? 1 : -1)
            segs_between.forEach(seg => new_contents.push(seg['_source']['transcript']))
          }

          new_contents.push(content2)

          new_segment = segment_list[i]

          new_segment['transcript']['_source']['transcript'] = new_contents.join(' ')
          new_segment['transcript']['_source']['startTime'] = startTime1

          new_segment_list[new_segment_list.length - 1] = new_segment

        } else {
          // Just add them as a new separate segment in the new_segments_list
          new_segment_list.push(segment_list[i])
        }
      }
    }
    results[ep_id] = new_segment_list
  }
  return results
}



const findSurroundingSegs = async (episode_id, text_index, hit) => {
  max_diff_time = 60


  // Get two segments before and after
  const indices_to_get = [text_index - 2, text_index - 1, text_index + 1, text_index + 2]
  const surrounding_segs = await searchFromIndices(episode_id, indices_to_get)

  // Sort the answers
  surrounding_segs.sort((a, b) => (a['_source']['index'] > b['_source']['index']) ? 1 : -1)


  startTime = parseFloat(hit['startTime'].split("s")[0])
  endTime = parseFloat(hit['endTime'].split("s")[0])

  // Check how close they are, if they are less than 1 min from each other, concat them
  startContent = []
  endContent = []
  startTimes = []
  endTimes = []

  for (i = 0; i < surrounding_segs.length; i++) {
    seg_endTime = surrounding_segs[i]['_source']['endTime']
    if (seg_endTime !== undefined) {
      diff = startTime - parseFloat(seg_endTime.split("s")[0])
      if (diff < max_diff_time && 0 < diff) {
        startContent.push(surrounding_segs[i]['_source']['transcript'])
        startTimes.push(surrounding_segs[i]['_source']['startTime'])
      } else if (parseFloat(surrounding_segs[i]['_source']['startTime'].split("s")[0]) - endTime < max_diff_time) {
        endContent.push(surrounding_segs[i]['_source']['transcript'])
        endTimes.push(surrounding_segs[i]['_source']['endTime'])
      }
    }
  }

  startTimes.push(hit['startTime'])
  endTimes.unshift(hit['endTime'])

  newContent = startContent.join(" ") + hit['transcript'] + endContent.join(" ")

  hit['startTime'] = startTimes[0]
  hit['endTime'] = endTimes[endTimes.length - 1]
  hit['transcript'] = newContent

  return hit
}

module.exports = {
  search,
  searchDesc
}
