var express = require('express');
var app = express();
var session = require('express-session');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var MongoStore = require('connect-mongo')(session);

// MongoDB
var configDB = require('./config/database.js');
mongoose.connect(configDB.url);

//var UserTipp = require('./model/usertipp.js');
var Config = require('./model/config.js');

// App Middleware
app.set('port', (process.env.port || 1337));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

app.use(session({
	secret: ')NC=8n0n084nwCndnscd9828783497(/',
	saveUninitialized: false,
	resave: false,
   maxAge: 3 * 60 * 60 * 1000,                                              // 3 Stunden idle
   store: new MongoStore({ mongooseConnection: mongoose.connection })
}));

app.use(express.static('public'));

app.set('view engine', 'ejs');

// get configuration once at server start
Config.find({}, (err, docs) => {
   if(err)
      throw err;
   var Settings = docs[0];
   // Routen für die Views
   require('./viewroutes.js')(app, Settings);

   // Api-Routen
   require('./apiroutes.js')(app, Settings);
});

// Server
app.listen(app.get('port'), () => {
	console.log("Server listening on port " + app.get('port') + " ...");
});

// Testcode
// var newTipp = new UserTipp();
// newTipp.fiUser = "588ef1a55b8fbd94e8941d44";
// newTipp.matchNr = 39803;
// newTipp.pointsTeam1 = 1;
// newTipp.pointsTeam2 = 6;
// newTipp.save();