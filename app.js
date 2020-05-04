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

        if (dbo.collection("devices").find(device)) {
            console.log(device)
            res.send("already in db")
            return;
        }

        dbo.collection("devices").insertOne(device, function(err, res) {
            if (err) throw err;
            console.log("1 document inserted");
            db.close();
        });

    
        res.send(req.body);
    })
});



app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`))