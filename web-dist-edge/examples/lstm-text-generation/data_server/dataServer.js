var redis = require('redis');

let host = 'localhost';
let port = 6379;

let webPort = 3001;

const taskName = 'lstm_text_generation';
let taskTextUrl =  taskName + '_text'
let dataSetName = "el_quijote_full_trimmed.txt";

var client = redis.createClient(port, host);
client.on('connect', function() {
   	console.log('Redis client connected on '+webPort);

	//Checking if the dataset exists. If they do not exist they are loaded.
	client.get(taskTextUrl, function (error, result) {
	    if (error) {
		console.log(error);
		throw error;
	    }
	    if (!result) {
		console.log("Dataset not found in redis. Loading dataset in redis.");
		var fs = require('fs');
		fs.readFile(dataSetName, 'utf8', function(err, dataset) {
		  if (err) throw err;
		  let myjson = {};
		  myjson.GET = dataset;
		  client.set(taskTextUrl, JSON.stringify(myjson), redis.print);
		});		
	    } else {
	    	console.log("Dataset found in redis.");
	    }
	});
});

client.on('error', function (err) {
    console.log('Redis Something went wrong ' + err);
});

const http = require('http');

http.createServer((request, response) => {
	console.log("request.headers.origin = " + request.headers.origin);
	console.log("request = " + JSON.stringify(request.headers));
	response.setHeader('Access-Control-Allow-Origin', '*');//request.headers.origin);
	response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
	response.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
	response.setHeader('Access-Control-Allow-Credentials', true);


	var splittedPath = request.url.split("/");
	////////////// Printing path received
	console.log("requested URL " + splittedPath);
	for (let i = 0; i < splittedPath.length; i++) {
		console.log("splittedPath[", i, "] = ", splittedPath[i]);
	}
	/////////////

	
  if ((request.method === 'PUT') && splittedPath[1].toUpperCase() === 'SET') {// && request.url === '/SET') {
    let body = [];
    request.on('data', (chunk) => {
      body.push(chunk);
    }).on('end', () => {
      body = Buffer.concat(body).toString();
      //console.log(body);
      let myjson = {};
      myjson.GET = body;
      client.set(splittedPath[2], JSON.stringify(myjson), redis.print);
      response.end(body);
    });
  } else if (request.method === 'GET' && splittedPath.length == 4 && splittedPath[1].toUpperCase() === 'SET') { //BROWSER SET
      let myjson = {};
      myjson.GET = splittedPath[3];
      let result = client.set(splittedPath[2], JSON.stringify(myjson), redis.print);
      //console.log("result = " + result);
      response.end("OK " + result);
  } else if (request.method === 'GET' && splittedPath[1].toUpperCase() === 'GET') {
	client.get(splittedPath[2], function (error, result) {
	    if (error) {
		console.log(error);
		throw error;
	    }
	    //console.log('GET result ->' + JSON.stringify(result));
	    response.end(result);
	});

  } else if (request.method === 'GET' && splittedPath[1].toUpperCase() === 'DATASET') {
	client.get(splittedPath[2], function (error, result) {
	    if (error) {
		console.log(error);
		throw error;
	    }
	    //console.log('GET result ->' + JSON.stringify(result));
	    response.end(result);
	});	
  } else {
    console.log("request.method = " + request.method);
    console.log("Method not found.");
    response.statusCode = 404;
    response.end();
  }
}).listen(webPort);
