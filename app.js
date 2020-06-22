var bodyParser = require('body-parser');
const express = require('express');
const request = require('request');
var cors = require('cors');
var querystring = require('querystring');
var cookieParser = require('cookie-parser');

var mongo = require('mongodb');
const MongoClient = require('mongodb').MongoClient;

const config = require('./config');
var { clientId, secret, redirectUri, scopes } = config;
var randomWords = require('random-words');
const { uuid } = require('uuidv4');

const port = 3500;

var selectionSort = (arr) => {
	let len = arr.length;
	for (let i = 0; i < len; i++) {
		let min = i;
		for (let j = i + 1; j < len; j++) {
			if (arr[j].votes > arr[min].votes) {
				min = j;
			}
		}
		if (min !== i) {
			let tmp = arr[i];
			arr[i] = arr[min];
			arr[min] = tmp;
		}
	}
	return arr;
};

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
var generateRandomString = function(length) {
	var text = '';
	var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

	for (var i = 0; i < length; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
};

var stateKey = 'spotify_auth_state';

('use strict');

const app = express();

// allow cross-origin requests
let allowCrossDomain = function(req, res, next) {
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Headers', '*');
	res.header('Access-Control-Allow-Methods', '*');
	next();
};

app.use(bodyParser.json()).use(cors()).use(cookieParser()).use(allowCrossDomain);

const connectionString =
	'mongodb+srv://Server:Crowdpleaser!@crowd-cluster-mvc86.gcp.mongodb.net/test?retryWrites=true&w=majority';
MongoClient.connect(connectionString, { useUnifiedTopology: true })
	.then((client) => {
		console.log('Connected to Database');

		var dbo = client.db('crowdpleaser');

		app.get('/', (req, res) => res.status(200).send('Hello World!').end());

		// app.put('/devices', (req, res) => {
		// 	// add to db
		// 	for (key in req.body) {
		// 		var device = JSON.parse(JSON.stringify({ _id: key, access_token: req.body[key] }));
		// 	}
		// 	dbo.collection('devices').find(device['_id']).toArray().then((results) => {
		// 		//TODO: UPDATE DEVICE THAT'S ALREADY IN MONGO WITH NEW ACCESS TOKEN
		// 		if (results.length !== 0) {
		// 			res.send('Already in db');
		// 			return;
		// 		} else {
		// 			dbo.collection('devices').insertOne(device, function(err, res) {
		// 				if (err) throw err;
		// 			});
		// 			res.status(200).send('Device added to DB');
		// 		}
		// 	});
		// });

		app.get('/login', (req, res) => {
			var state = generateRandomString(16);
			res.cookie(stateKey, state);

			// your application requests authorization
			res.redirect(
				'https://accounts.spotify.com/authorize?' +
					querystring.stringify({
						response_type: 'token',
						client_id: clientId,
						scope: scopes,
						redirect_uri: redirectUri,
						state: state
					})
			);
		});

		app.get('/callback', function(req, res) {
			// your application requests refresh and access tokens
			// after checking the state parameter

			var code = req.query.code || null;
			var state = req.query.state || null;
			var storedState = req.cookies ? req.cookies[stateKey] : null;

			if (state === null || state !== storedState) {
				res.redirect(
					'/#' +
						querystring.stringify({
							error: 'state_mismatch'
						})
				);
			} else {
				res.clearCookie(stateKey);
				var authOptions = {
					url: 'https://accounts.spotify.com/api/token',
					form: {
						code: code,
						redirect_uri: redirectUri,
						grant_type: 'authorization_code'
					},
					headers: {
						Authorization: 'Basic ' + new Buffer(clientId + ':' + secret).toString('base64')
					},
					json: true
				};

				request.post(authOptions, function(error, response, body) {
					if (!error && response.statusCode === 200) {
						var access_token = body.access_token,
							refresh_token = body.refresh_token;

						var options = {
							url: 'https://api.spotify.com/v1/me',
							headers: { Authorization: 'Bearer ' + access_token },
							json: true
						};

						// use the access token to access the Spotify Web API
						request.get(options, function(error, response, body) {
							console.log(body);
						});

						// we can also pass the token to the browser to make requests from there
						res.redirect(
							'/#' +
								querystring.stringify({
									access_token: access_token,
									refresh_token: refresh_token
								})
						);
					} else {
						res.redirect(
							'/#' +
								querystring.stringify({
									error: 'invalid_token'
								})
						);
					}
				});
			}
		});

		app.get('/refresh_token', function(req, res) {
			// requesting access token from refresh token
			var refresh_token = req.query.refresh_token;
			var authOptions = {
				url: 'https://accounts.spotify.com/api/token',
				headers: { Authorization: 'Basic ' + new Buffer(clientId + ':' + secret).toString('base64') },
				form: {
					grant_type: 'refresh_token',
					refresh_token: refresh_token
				},
				json: true
			};

			request.post(authOptions, function(error, response, body) {
				if (!error && response.statusCode === 200) {
					var access_token = body.access_token;
					res.send({
						access_token: access_token
					});
				}
			});
		});

		// app.get('/access_token', (req, res) => {
		// 	// search db for device_id
		// 	dbo.collection('devices').find(req.query.device_id).toArray().then((results) => {
		// 		res.status(200).send(results[0].access_token);
		// 	});
		// });

		app.post('/create_party', (req, res) => {
			// create unique user id
			var host_id = uuid();

			var access_token = req.body.access_token;
			var host_name = req.body.host_name;

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
						host: { access_token: access_token, host_name: host_name },
						members: [ host_id ],
						queue: [],
						currently_playing: []
					};

					dbo
						.collection('parties')
						.insertOne(new_party)
						.then(res.send({ statusCode: 200, member_id: host_id, party_id: party_id }));
				});
		});

		app.put('/join_party', (req, res) => {
			// create unique user id
			var member_id = uuid();

			// extract party code from request params
			var party_code = req.query['party_code'];

			// check if party is active
			dbo.collection('parties').find({ _id: party_code }).toArray().then((party) => {
				if (party.length !== 0) {
					// if active, update members
					let members = party[0].members;
					members.push(member_id);
					dbo
						.collection('parties')
						.updateOne(
							{ _id: party[0]._id },
							{
								$set: { members: members }
							}
						)
						.then(res.send({ statusCode: 200, member_id: member_id }));
				} else {
					// if not, let em know
					res.status(404).send("Party doesn't exist");
				}
			});
		});

		app.get('/queue', (req, res) => {
			var party_code = req.query.party_code;

			dbo.collection('parties').find({ _id: party_code }).toArray().then((party) => {
				var queue = party[0].queue;
				res.status(200).send(queue);
			});
		});

		app.put('/queue_song', (req, res) => {
			// extract party code from request params
			var party_code = req.query['party_code'];

			var song = req.body;

			// check if song already in queue
			dbo.collection('parties').find({ _id: party_code }).toArray().then((party) => {
				var queue = party[0].queue;
				for (var key in queue) {
					if (queue[key].artist === song.artist && queue[key].name === song.name) {
						res.status(200).send('Already in queue');
						return;
					}
				}
				queue.push(song);

				dbo
					.collection('parties')
					.updateOne(
						{ _id: party[0]._id },
						{
							$set: { queue: queue }
						}
					)
					.then(res.status(200).send(queue));
			});
		});

		app.put('/dequeue_song', (req, res) => {
			var party_code = req.query['party_code'];

			dbo.collection('parties').find({ _id: party_code }).toArray().then((party) => {
				var queue = party[0].queue;
				queue.shift();

				dbo
					.collection('parties')
					.updateOne(
						{ _id: party[0]._id },
						{
							$set: { queue: queue }
						}
					)
					.then(res.status(200).send(queue));
			});
		});

		app.put('/change_playing', (req, res) => {
			// extract party code from request params
			var party_code = req.query['party_code'];

			var song = req.body;

			dbo.collection('parties').find({ _id: party_code }).toArray().then((party) => {
				dbo
					.collection('parties')
					.updateOne(
						{ _id: party[0]._id },
						{
							$set: { currently_playing: song }
						}
					)
					.then(res.status(200).send(song));
			});
		});

		app.get('/currently_playing', (req, res) => {
			var party_code = req.query['party_code'];

			dbo.collection('parties').find({ _id: party_code }).toArray().then((party) => {
				res.status(200).send(party[0].currently_playing);
			});
		});

		app.put('/vote', (req, res) => {
			var party_code = req.query['party_code'];
			var member_id = req.query['member_id'];

			var song = req.body;

			dbo.collection('parties').find({ _id: party_code }).toArray().then((party) => {
				var queue = party[0].queue;
				var voted, index;

				for (let i = 0; i < queue.length; i++) {
					if (song.uri === queue[i].uri) {
						voted = queue[i].voted;
						index = voted.indexOf(member_id);
						// index is -1 if the user has not already voted for this song
						if (index !== -1) {
							voted.splice(index);
							queue[i].votes = voted.length;
						} else {
							voted.push(member_id);
							queue[i].votes = voted.length;
						}

						queue[i].voted = voted;
						queue = selectionSort(queue);
						dbo
							.collection('parties')
							.updateOne(
								{ _id: party[0]._id },
								{
									$set: { queue: queue }
								}
							)
							.then(res.status(200).send(queue));
					}
				}
			});
		});
	})
	.catch((error) => console.error(error));

// Start the server
const PORT = process.env.PORT || 3500;
app.listen(PORT, () => {
	console.log(`App listening on port ${PORT}`);
	console.log('Press Ctrl+C to quit.');
});

module.exports = app;
