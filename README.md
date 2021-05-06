# podcast-search backend
Backend for our project in DD2476 Search Engines and Information Retrieval.

# Environment variables
Set the environment variables by creating a `.env` file in the root of this folder. `configuration.js` loads the environment variables.

| Name               | Default value         | Description                                                                                  |
| ------------------ | --------------------- | -------------------------------------------------------------------------------------------- | 
| METADATA_INDEX     | metadata_index        | The name of the metadata index in elastic                                                    |
| TRANSCRIPTS_INDEX  | transcripts_index     | The name of the transcripts index in elastic                                                 |
| ELASTIC_URL        | http://localhost:9200 | URL to elasticsearch instance                                                                |
| FRONTEND_FILE_PATH | -                     | Path to the `dist` folder containing the built Vue app. Used when deploying the application  |
| PORT               | -                     | Port to serve the backend at                                                                 |

In the `.env` file, set the variables you wish to change like this:

```
FRONTEND_FILE_PATH=/home/axel/frontend/dist
ELASTIC_URL=http://192.168.1.114:9200
```

# How to run
1. Install [node.js](https://nodejs.org/en/) and [Elasticsearch](https://github.com/elastic/elasticsearch)
2. Clone this repo
3. Run `npm install`
4. Run `npm start`, the backend will be served at port 5000 (if nothing else is specified)

When developing and you want to make use of "hot reloading", run `npm run dev` instead of step 4.

The frontend will be served at `/`, if built and `FRONTEND_FILE_PATH` is set up.
# API
###  GET /api/search
Searches the podcast transcripts
Returns JSON data
| Query parameter | Description | Type | Default |
| ----------------|-------------|------|---------|
|search           | The search query | string | - |
| type            | Type of query    | match, match_phrase, match_all, etc. | match |
| size            | How many results | number   | 10 |

#### Example
`curl http://localhost:5000/api/search?search=hello%20there&size=100&type=match`

###  GET /api/searchDesc
Searches for podcast names and descriptions
Returns JSON data
| Query parameter | Description | Type | Default |
| ----------------|-------------|------|---------|
|search           | The search query | string | - |
| type            | Type of query    | match, match_phrase, match_all, etc. | match |
| size            | How many results | number   | 10 |

#### Example
`curl http://localhost:5000/api/searchDesc?search=Joe%20Rogan&size=100&type=match`
