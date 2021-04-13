const express = require('express')
const app = express()
const cors = require('cors')
const morgan = require('morgan')

app.use(cors());
app.use(morgan("common"))

var request = require('request');

// Forwards to elastic and pipes
// https://stackoverflow.com/a/20539239
app.use("/", (req, res) => {
    
    const newUrl = "http://192.168.1.114:9200" + req.url
    req.pipe(request({ qs:req.query, uri: newUrl })).pipe(res);
})

const PORT = 14000
app.listen(PORT, () => console.log(`Listening on port ${PORT}!`))
