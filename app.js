var bodyParser = require('body-parser');
const express = require('express');
const app = express();
var mongo = require('mongodb');
const { uuid } = require('uuidv4');
var randomWords = require('random-words');
const MongoClient = require('mongodb').MongoClient;

const port = 3500;

app.use(bodyParser.json());

// allow cross-origin requests
let allowCrossDomain = function(req, res, next) {
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Headers', '*');
	res.header('Access-Control-Allow-Methods', '*');
	next();
};
app.use(allowCrossDomain);

const uri = 'mongodb+srv://Server:Crowdpleaser!@crowd-cluster-mvc86.gcp.mongodb.net/test?retryWrites=true&w=majority';
mongo.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true }, function(err, db) {
	if (err) {
		console.log('Sorry unable to connect to MongoDB Error:', err);
	}
	console.log('Connected to mongodb');

	var dbo = db.db('crowdpleaser');

	app.get('/', (req, res) => res.send('Hello World!'));

	app.put('/devices', (req, res) => {
		// add to db
		for (key in req.body) {
			var device = JSON.parse(JSON.stringify({ _id: key, access_token: req.body[key] }));
		}
		dbo.collection('devices').find(device['_id']).toArray().then((results) => {
			//TODO: UPDATE DEVICE THAT'S ALREADY IN MONGO WITH NEW ACCESS TOKEN
			if (results.length !== 0) {
				res.send('Already in db');
				return;
			} else {
				dbo.collection('devices').insertOne(device, function(err, res) {
					if (err) throw err;
				});
				res.status(200).send('Device added to DB');
			}
		});
	});

	app.get('/access_token', (req, res) => {
		// search db for device_id
		dbo.collection('devices').find(req.query.device_id).toArray().then((results) => {
			res.status(200).send(results[0].access_token);
		});
	});

	app.post('/create_party', (req, res) => {
		// create unique user id
		var host_id = uuid();

		// create unique party id
		var party_id = randomWords({ exactly: 1, maxLength: 5 });

		// add party to db
		dbo
			.collection('parties')
			.find({})
			.project({ _id: 1 })
			.map((x) => x._id)
			.toArray()
			.then((current_parties) => {
				while (party_id[0].length !== 5 || current_parties.includes(party_id[0])) {
					party_id = randomWords({ exactly: 1, maxLength: 5 });
				}
			})
			.then(() => {
				let new_party = {
					_id: party_id[0],
					host: host_id,
					members: [],
					queue: []
				};
				dbo.collection('parties').insertOne(new_party).then(res.status(200).send(party_id));
			});
	});

	app.put('/join_party', (req, res) => {
		// create unique user id
		var member_id = uuid();

		// extract party code from request params
		var party_code = 'butts';

		// check if game is active
		dbo.collection('parties').find({ _id: party_code }).toArray().then((party) => {
			if (party.length !== 0) {
				let members = party[0].members;
				members.push(member_id);
				dbo
					.collection('parties')
					.update(
						{ _id: party[0]._id },
						{
							$set: { members: members }
						}
					)
					.then(res.status(200).send('added to db'));
			} else {
				res.status(200).send("party doesn't exist");
			}
		});

		// if active, update members

		// if not, let em know
	});
});

app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`));
