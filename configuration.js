require('dotenv').config();

module.exports = CONFIG = {
    METADATA_INDEX:  process.env.METADATA_INDEX || "metadata_index",
    TRANSCRIPTS_INDEX:  process.env.TRANSCRIPTS_INDEX || "transcripts_index",
    ELASTIC_URL: process.env.ELASTIC_URL || "http://localhost:9200",
}