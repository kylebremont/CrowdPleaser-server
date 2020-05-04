var bodyParser = require('body-parser')
const express = require('express')
const app = express()
var mongo = require('mongodb');
const port = 3500
const MongoClient = require('mongodb').MongoClient;

app.use(bodyParser.json());

// allow cross-origin requests
let allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', "*");
    res.header('Access-Control-Allow-Headers', "*");
    res.header('Access-Control-Allow-Methods', "*");
    next();
  }
app.use(allowCrossDomain);

const uri = "mongodb+srv://Server:Crowdpleaser!@crowd-cluster-mvc86.gcp.mongodb.net/test?retryWrites=true&w=majority"
mongo.connect(uri,  { useNewUrlParser: true, useUnifiedTopology: true }, function(err, db) {

    if(err) {
        console.log('Sorry unable to connect to MongoDB Error:', err);
    }
    console.log("Connected to mongodb");


    var dbo = db.db("crowdpleaser");

    app.get('/', (req, res) => res.send('Hello World!'))

    app.put('/devices', (req, res) => {
        // add to db
        for (key in req.body) {
            var device = JSON.parse(JSON.stringify({"_id": key, "access_token": req.body[key]}))
        }
        dbo.collection("devices").find(device["_id"]).toArray()
        .then(results => {

            //TODO: UPDATE DEVICE THAT'S ALREADY IN MONGO WITH NEW ACCESS TOKEN
            if (results.length !== 0) {
                res.send("Already in db")
                return;
            } else {
                dbo.collection("devices").insertOne(device, function(err, res) {
                    if (err) throw err;
                });
                res.status(200).send("Device added to DB");
            }
            
        });
    })


    app.get('/access_token', (req, res) => {
        // search db for device_id
        dbo.collection("devices").find(req.query.device_id).toArray()
        .then(results => {
            res.status(200).send(results[0].access_token);
        });
    })
});



app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`))