/* This file creates a JSON file from the metadata.tsv file.
 *
 * Written by Axel Elmarsson
 * 
 * Arguments:
 * 1. path to metadata.tsv file
 * 2. output file
 * 
 * Example:
 *      node metadata.js ./metadata.tsv ./metadata.json
 */

const fs = require('fs')

const input = process.argv[2]
const output = process.argv[3]

let metadata = fs.readFileSync(input)
metadata = metadata.toString().split("\r\n")

const result = {}

// From the metadata.tsv file.
// show_uri	show_name	show_description	publisher	language	rss_link	episode_uri	episode_name	episode_description	duration	show_filename_prefix	episode_filename_prefix

for (let i = 1; i < metadata.length; i++) {
    let line = metadata[i].split("\t")
    if (!result[line[0]]) {
        
        result[line[0]] = {
            podcast_name: line[1],
            podcast_desc: line[2],
            publisher: line[3],
            language: line[4],
            rss_link: line[5],
            podcast_filename_prefix: line[10],
            episodes: []
        }
    }

    result[line[0]].episodes.push({
        episode_uri: line[6],
        episode_name: line[7],
        episode_desc: line[8],
        duration: line[9],
        episode_filename_prefix: line[11]
    })
}

fs.writeFileSync(output, JSON.stringify(result, null, 4))