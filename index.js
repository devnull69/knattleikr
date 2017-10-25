require('newrelic');
var express = require('express');
var app = express();
var session = require('express-session');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var MongoStore = require('connect-mongo')(session);
var Scheduler = require('node-schedule');
var OpenLigaDB = require('./openligadb');
var User = require('./model/user.js');
var Mailer = require('sendgrid').mail;
var sg = require('sendgrid')(process.env.SENDGRID_API_KEY);
var async = require('async');

// MongoDB
var configDB = require('./config/database.js');
mongoose.connect(process.env.MONGODB_URI || configDB.url);

//var UserTipp = require('./model/usertipp.js');
var Config = require('./model/config.js');

// App Middleware
app.set('port', (process.env.PORT || 1337));

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

   // Schedule a job for sending a mail for the next Spieltag
   OpenLigaDB.getSpieltag(Settings.aktuellerSpieltag, (err, data) => {
      // Date of first game
      var match = data[0];
      var scheduleDateStr = match.MatchDateTime.substring(0, 11) + "09:00:00Z";

      var scheduleDate = new Date(scheduleDateStr);
      var Job = Scheduler.scheduleJob(scheduleDate, () => {
         // Scheduled time reached, send mails
         console.log("Scheduled time reached!");
         User.find({}, (err, users) => {
            async.forEach(users, (user, callback) => {
               // Nur zu aktiven Usern schicken
               UserDetail.findOne({fiUser: new mongoose.Types.ObjectId(user._id)}, (err, userdetail) => {
                  if(!err && userdetail && userdetail.isAktiv)
                     sendMailToUser(user, "Tippen nicht vergessen", "<p>Nicht vergessen!</p><p>Heute beginnt der nächste Spieltag. Hast Du schon Deine Tipps abgegeben?</p>", callback);
               });
            }, err => {
               console.log("Mails have been sent");
            });
         });
      });

      console.log("Mail job scheduled for " + scheduleDateStr);

      // Routen für die Views
      require('./viewroutes.js')(app, Settings);

      // Api-Routen
      require('./apiroutes.js')(app, Settings, Job);
   });

});

function sendMailToUser(user, betreff, mailbody, callback) {
   if(user.notification == undefined || user.notification === true) {
      var from_email = new Mailer.Email('noreply@knattleikr.herokuapp.com', 'Knattleikr - Bundesligatippspiel');
      var to_email = new Mailer.Email(user.email);
      var subject = betreff;

      var contentBody = '<html><head><meta charset="UTF-8"/></head><body>';
      contentBody += '<p>Hallo ' + user.nickname + '</p>';
      contentBody += mailbody;
      contentBody += '<p>Liebe Grüße<br/>Dein KNATTLEIKR-Team</p>'
      contentBody += '</body></html>';

      var content = new Mailer.Content('text/html', contentBody);
      var mail = new Mailer.Mail(from_email, subject, to_email, content);

      var request = sg.emptyRequest({
        method: 'POST',
        path: '/v3/mail/send',
        body: mail.toJSON(),
      });

      sg.API(request, function(error, response) {
         callback();
      });      
   } else {
      console.log("Notification deaktiviert: " + user.nickname);       
      callback();
   }
}

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