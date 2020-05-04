var bodyParser = require('body-parser')
const express = require('express')
const app = express()
var mongo = require('mongodb');
const port = 3500

const MongoClient = require('mongodb').MongoClient;

app.use(bodyParser.json());


const uri = "mongodb+srv://Server:Crowdpleaser!@crowd-cluster-mvc86.gcp.mongodb.net/test?retryWrites=true&w=majority"
mongo.connect(uri,  { useNewUrlParser: true, useUnifiedTopology: true }, function(err, db) {


    var dbo = db.db("crowdpleaser");




    if(err) {
        console.log('Sorry unable to connect to MongoDB Error:', err);
    }
    console.log("Connected to mongodb");

    app.get('/', (req, res) => res.send('Hello World!'))

    app.put('/devices', (req, res) => {
        // add to db
        for (key in req.body) {
            var device = JSON.parse(JSON.stringify({"_id": key, "access_token": req.body.device_id}))
        }

        dbo.collection("devices").find(device).toArray()
        .then(results => {
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
});



app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`))