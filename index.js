var express = require('express');
var app = express();
var session = require('express-session');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var MongoStore = require('connect-mongo')(session);

// MongoDB
var configDB = require('./config/database.js');
mongoose.connect(configDB.url);

var User = require('./model/user.js');
var UserTipp = require('./model/usertipp.js');
var Config = require('./model/config.js');

// App Middleware
var port = process.env.port || 1337;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

app.use(session({
	secret: ')NC=8n0n084nwCndnscd9828783497(/',
	saveUninitialized: false,
	resave: true,
   cookie: {path: '/', httpOnly: true, secure: false, maxAge: 60 * 60 * 1000}, // 1 Stunde
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
   require('./viewroutes.js')(app, User, Settings);

   // Api-Routen
   require('./apiroutes.js')(app, User, UserTipp);
});

// Server
app.listen(port, () => {
	console.log("Server listening on port " + port + " ...");
});

// Testcode
// var newTipp = new UserTipp();
// newTipp.fiUser = "588ef1a55b8fbd94e8941d44";
// newTipp.matchNr = 39803;
// newTipp.pointsTeam1 = 1;
// newTipp.pointsTeam2 = 6;
// newTipp.save();