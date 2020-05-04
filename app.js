const express = require('express')
const app = express()
var mongo = require('mongodb');
const port = 3400
// import pw from './config'



const MongoClient = require('mongodb').MongoClient;
const uri = "mongodb+srv://Server:Crowdpleaser!@crowd-cluster-mvc86.gcp.mongodb.net/test?retryWrites=true&w=majority"
mongo.connect(uri,  { useNewUrlParser: true, useUnifiedTopology: true }, function(err, db) {
    if(err) {
        console.log('Sorry unable to connect to MongoDB Error:', err);
    }
    console.log("Connected to mongodb");
});

app.get('/', (req, res) => res.send('Hello World!'))

app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`))