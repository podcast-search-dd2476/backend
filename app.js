const express = require('express')
const app = express()
const cors = require('cors')
const morgan = require('morgan')
const path = require('path')

const { FRONTEND_FILE_PATH } = require('./configuration');
const searcher = require('./search')

app.use(cors());
app.use(express.json())
app.use(morgan("common"))

app.get("/api/search", async (req, res) => {
    const { search, type, size } = req.query
    console.log(search)
    if (!search) return res.status(400).json({"error": "Missing search query"})
    
    let options = undefined
    if (type) options = { type }
    if (size) options["size"] = size
    
    return res.status(200).json(await searcher.search(search, options))
})

app.get("/api/searchDesc", async (req, res) => {
    const { search, type, size } = req.query
    console.log(search)
    if (!search) return res.status(400).json({"error": "Missing search query"})
    
    let options = undefined
    if (type) options = { type }
    if (size) options["size"] = size
    
    return res.status(200).json(await searcher.searchDesc(search, options))
})

// Serve frontend ("production")
FRONTEND_FILE_PATH !== undefined && app.use(express.static(FRONTEND_FILE_PATH))

const PORT = 5000
app.listen(PORT, () => console.log(`Listening on port ${PORT}!`))