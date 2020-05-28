// var bodyParser = require('body-parser')
// const express = require('express')
// const app = express()
// var mongo = require('mongodb');
// const port = 3500
// const MongoClient = require('mongodb').MongoClient;

// app.use(bodyParser.json());

// // allow cross-origin requests
// let allowCrossDomain = function(req, res, next) {
//     res.header('Access-Control-Allow-Origin', "*");
//     res.header('Access-Control-Allow-Headers', "*");
//     res.header('Access-Control-Allow-Methods', "*");
//     next();
//   }
// app.use(allowCrossDomain);

// const uri = "mongodb+srv://Server:Crowdpleaser!@crowd-cluster-mvc86.gcp.mongodb.net/test?retryWrites=true&w=majority"
// mongo.connect(uri,  { useNewUrlParser: true, useUnifiedTopology: true }, function(err, db) {

//     if(err) {
//         console.log('Sorry unable to connect to MongoDB Error:', err);
//     }
//     console.log("Connected to mongodb");


//     var dbo = db.db("crowdpleaser");

//     app.get('/', (req, res) => res.send('Hello World!'))

//     app.put('/devices', (req, res) => {
//         // add to db
//         for (key in req.body) {
//             var device = JSON.parse(JSON.stringify({"_id": key, "access_token": req.body[key]}))
//         }
//         dbo.collection("devices").find(device["_id"]).toArray()
//         .then(results => {

//             //TODO: UPDATE DEVICE THAT'S ALREADY IN MONGO WITH NEW ACCESS TOKEN
//             if (results.length !== 0) {
//                 res.send("Already in db")
//                 return;
//             } else {
//                 dbo.collection("devices").insertOne(device, function(err, res) {
//                     if (err) throw err;
//                 });
//                 res.status(200).send("Device added to DB");
//             }
            
//         });
//     })


//     app.get('/access_token', (req, res) => {
//         // search db for device_id
//         dbo.collection("devices").find(req.query.device_id).toArray()
//         .then(results => {
//             res.status(200).send(results[0].access_token);
//         });
//     })
// });



// app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`))

// npm deps
const express = require('express');
const https = require('https');
const crypto = require('crypto');
const { URL } = require('url');
const QueryString = require('querystring');

// Require the framework and instantiate it
const app = express();

// init spotify config
const spClientId = process.env.SPOTIFY_CLIENT_ID;
const spClientSecret = process.env.SPOTIFY_CLIENT_SECRET;
const spClientCallback = process.env.SPOTIFY_CLIENT_CALLBACK;
const authString = Buffer.from(spClientId+':'+spClientSecret).toString('base64');
const authHeader = `Basic ${authString}`;
const spotifyEndpoint = 'https://accounts.spotify.com/api/token';

// encryption
const encSecret = process.env.ENCRYPTION_SECRET;
const encMethod = process.env.ENCRYPTION_METHOD || "aes-256-ctr";
const encrypt = (text) => {
	const aes = crypto.createCipher(encMethod, encSecret);
	let encrypted = aes.update(text, 'utf8', 'hex');
	encrypted += aes.final('hex');
	return encrypted;
};
const decrypt = (text) => {
	const aes = crypto.createDecipher(encMethod, encSecret);
	let decrypted = aes.update(text, 'hex', 'utf8');
	decrypted += aes.final('utf8');
	return decrypted;
};

// handle sending POST request
function postRequest(url, data={}) {
	return new Promise((resolve, reject) => {
		// build request data
		url = new URL(url);
		const reqData = {
			protocol: url.protocol,
			hostname: url.hostname,
			port: url.port,
			path: url.pathname,
			method: 'POST',
			headers: {
				'Authorization': authHeader,
				'Content-Type': 'application/x-www-form-urlencoded'
			}
		}

		// create request
		const req = https.request(reqData, (res) => {
			// build response
			let buffers = [];
			res.on('data', (chunk) => {
				buffers.push(chunk);
			});

			res.on('end', () => {
				// parse response
				let result = null;
				try {
					result = Buffer.concat(buffers);
					result = result.toString();
					var contentType = res.headers['content-type'];
					if(typeof contentType == 'string') {
						contentType = contentType.split(';')[0].trim();
					}
					if(contentType == 'application/x-www-form-urlencoded') {
						result = QueryString.parse(result);
					}
					else if(contentType == 'application/json') {
						result = JSON.parse(result);
					}
				}
				catch(error) {
					error.response = res;
					error.data = result;
					reject(error);
					return;
				}
				resolve({response: res, result: result});
			});
		});

		// handle error
		req.on('error', (error) => {
			reject(error);
		});

		// send
		data = QueryString.stringify(data);
		req.write(data);
		req.end();
	});
}

// support form body
app.use(express.urlencoded({extended: false}));

/**
 * Swap endpoint
 * Uses an authentication code on body to request access and refresh tokens
 */
app.post('/swap', async (req, res) => {
	try {
		// build request data
		const reqData = {
			grant_type: 'authorization_code',
			redirect_uri: spClientCallback,
			code: req.body.code
		};

		// get new token from Spotify API
		const { response, result } = await postRequest(spotifyEndpoint, reqData);

		// encrypt refresh_token
		if (result.refresh_token) {
			result.refresh_token = encrypt(result.refresh_token);
		}

		// send response
		res.status(response.statusCode).json(result);
	}
	catch(error) {
		if(error.response) {
			res.status(error.response.statusCode);
		}
		else {
			res.status(500);
		}
		if(error.data) {
			res.send(error.data);
		}
		else {
			res.send("");
		}
	}
});

/**
 * Refresh endpoint
 * Uses the refresh token on request body to get a new access token
 */
app.post('/refresh', async (req, res) => {
	try {
		// ensure refresh token parameter
		if (!req.body.refresh_token) {
			res.status(400).json({error: 'Refresh token is missing from body'});
			return;
		}

		// decrypt token
		const refreshToken = decrypt(req.body.refresh_token);
		// build request data
		const reqData = {
			grant_type: 'refresh_token',
			refresh_token: refreshToken
		};
		// get new token from Spotify API
		const { response, result } = await postRequest(spotifyEndpoint, reqData);

		// encrypt refresh_token
		if (result.refresh_token) {
			result.refresh_token = encrypt(result.refresh_token);
		}

		// send response
		res.status(response.statusCode).json(result);
	}
	catch(error) {
		if(error.response) {
			res.status(error.response.statusCode);
		}
		else {
			res.status(500);
		}
		if(error.data) {
			res.send(error.data);
		}
		else {
			res.send("");
		}
	}
});

// start server
const spServerPort = process.env.PORT ? parseInt(process.env.PORT) : 3000;
app.listen(spServerPort, () => {
	console.log('Example app listening on port '+spServerPort+'!');
});