const fs = require('fs');
const fetch = require('node-fetch')

const { Client } = require('@elastic/elasticsearch')
const client = new Client({ node: 'http://localhost:9200' })

const f = JSON.parse(fs.readFileSync('./test.json'));

const doPost = _ => {

    f.results.forEach(x => {
        x.alternatives.forEach(y => {
            if (Object.keys(y).length > 0) {
                fetch('http://localhost:9200/my-index-000002/_doc?pretty', {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(y)
                })
                .then(res => res.json())
                .then(console.log)
            }
        })
    })

}

// doPost()

const get = async () =>  {
    // promise API
    const result = await client.search({
        index: 'my-index-000002',
        body: {
          query: {
            match: { "words.word": '' }
          }
        }
    })
    .then(result => {
        // console.log(result)
        result.body.hits.hits.forEach(x => {
            console.log(x._source.transcript + "\n")

        })
        // console.log(result.body.hits.hits[2]._source)
        // console.log(result.body.hits.hits[0]._source.results.length)
    })
}


get()