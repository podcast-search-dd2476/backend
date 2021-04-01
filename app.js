const express = require('express')
const app = express()
const cors = require('cors')
const morgan = require('morgan')
const fs = require('fs')
const path = require('path')
const bodyParser = require('body-parser')

const searcher = require('./search')

app.use(cors());
app.use(bodyParser.json())
app.use(morgan("common"))

app.get("/", async (req, res) => {
    const { search, type } = req.query
    console.log(search)
    if (!search) return res.status(400).json({"error": "Missing search query"})
    
    let options = undefined
    if (type) options = { type }

    return res.status(200).json(await searcher.search(search, options))
})

const PORT = 5000
app.listen(PORT, () => console.log(`Listening on port ${PORT}!`))