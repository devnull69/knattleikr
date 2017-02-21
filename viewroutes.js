var bcrypt = require('bcrypt-nodejs');
var mongoose = require('mongoose');
var Mailer = require('sendgrid').mail;
var sg = require('sendgrid')(process.env.SENDGRID_API_KEY);

var User = require('./model/user.js');
var UserDetail = require('./model/userdetail.js');
var Einzeltabelle = require('./model/einzeltabelle.js');
var Lieferanten = require('./model/lieferanten.js');

var Helper = require('./util/helper.js');

// Authentication Middleware
function mustNotBeLoggedIn(req, res, next) {
   if(!req.session.user)
      next();
   else
      res.redirect('/');
}

function mustBeAdmin(req, res, next) {
   if(req.session.user) {
      UserDetail.findOne({fiUser: new mongoose.Types.ObjectId(req.session.user._id)}, (err, userdetail) => {
         if(userdetail.isAdmin) {
            req.userdetail = userdetail;
            next();
         } else {
            req.session.user = null;
            req.session.destroy();
            res.redirect('/?err=1');
         }
      });
   } else {
      req.session.user = null;
      req.session.destroy();
      res.redirect('/?err=1');
   }
}

function canBeLoggedIn(req, res, next) {
   if(req.session.user) {
      UserDetail.findOne({fiUser: new mongoose.Types.ObjectId(req.session.user._id)}, (err, userdetail) => {
         req.userdetail = userdetail;
         req.user = req.session.user;
         next();
      });
   } else {
      req.userdetail = null;
      req.user = null;
      next();
   }
}

// Modul-Export
module.exports = function(app, Settings) {
   app.get('/', canBeLoggedIn, (req, res) => {
      var spieltagNr = Settings.aktuellerSpieltag;
      var maxVerpassteSpiele = Settings.maxVerpassteSpiele;
      var stundenVorherString = Settings.stundenVorher==1?"1 Stunde":Settings.stundenVorher+" Stunden";
   
      res.render('index', {user: req.user, userdetail: req.userdetail, spieltagNr: spieltagNr, gravatarhash: req.user?Helper.md5(req.session.user.email):null, stundenVorherString: stundenVorherString, error: req.query.err, maxVerpassteSpiele: maxVerpassteSpiele});
   });

   app.get('/register', mustNotBeLoggedIn, (req, res) => {
      res.render('register', {message: '', email: '', nickname: ''});
   });

   app.post('/register', mustNotBeLoggedIn, (req, res) => {
      var email = req.body.email;
      var nickname = req.body.nickname;
      var password1 = req.body.password1;
      var password2 = req.body.password2;

      // Pflichtfelder?
      if(email == '' || nickname == '' || password1 == '' || password2 == '')
         return res.render('register', {message: 'Nicht alle Pflichtfelder wurden ausgefüllt', email: email, nickname: nickname});

      // Illegale Zeichen
      // Zuerst ein Buchstabe, dann beliebige Zeichen (Buchstaben, Ziffern, Unterstrich, Bindestrich, Leerzeichen, Punkt), am Ende Buchstabe oder Ziffer
      var regEx = /^[a-zA-Z][a-zA-Z0-9_\-\.\s]+[a-zA-Z0-9]$/;
      if(!nickname.match(regEx) || nickname.length < 3 || nickname.length > 20)
         return res.render('register', {message: 'Der Anzeigename muss mit einem Buchstaben beginnen und auf einen Buchstaben oder eine Ziffer enden. Gültige Zeichen sind: a-z, A-Z, 0-9, Unterstrich, Bindestrich, Leerzeichen, Punkt. Minimale Länge: 3, Maximale Länge: 20', email: email, nickname: ''});

      // Passwörter gleich?
      if(password1 != password2)
         return res.render('register', {message: 'Die Passwörter stimmen nicht überein', email: email, nickname: nickname});

      // Bcrypt anwenden
      var salt = bcrypt.genSaltSync(9);
      var hash = bcrypt.hashSync(password1, salt);

      // E-Mail oder Nickname schon vergeben?
      User.findOne({$or: [{nickname: nickname}, {email: email}]}, (err, user) => {
         if(err) {
            return res.render('register', {message: 'Es ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.', email: email, nickname: nickname});
         }
         if(user) {
            if(user.email == email)
               return res.render('register', {message: 'E-Mail wird bereits verwendet', email: '', nickname: nickname});
            else
               return res.render('register', {message: 'Anzeigename wird bereits verwendet', email: email, nickname: ''});
         } else {

            // Neuen User anlegen

            var newUser = new User();
            newUser.email = email;
            newUser.nickname = nickname;
            newUser.password = hash;
            newUser.isAdmin = false;
            newUser.isAktiv = true;
            newUser.memberOf = null;
            newUser.tlStatus = 0;
            newUser.save((err) => {
               if(err) {
                  throw err;
               }

               // Userdetails erzeugen
               var detail = new UserDetail();
               detail.fiUser = new mongoose.Types.ObjectId(newUser._id);
               detail.memberOf = null;
               detail.save(err => {
                  req.session.user = newUser;
                  res.redirect('/');
               });
            });
         }
      });


   });

   app.get('/login', mustNotBeLoggedIn, (req, res) => {
      res.render('login', { message : ''});
   });

   app.post('/login', mustNotBeLoggedIn, (req, res) => {
      var identifier = req.body.identifier;
      var password = req.body.password;

      if(identifier == '' || password == '')
         return res.render('login', {message: 'E-Mail/Anzeigename oder Passwort falsch'});

      // User finden und Passwörter vergleichen
      var theUser = null;
      var searchField = 'nickname';
      if(identifier.indexOf("@") != -1) {
         // Email-Adresse
         searchField = 'email';
      }
      var searchObject = {}
      searchObject[searchField] = identifier;
      User.findOne(searchObject, (err, user) => {
         if(err) {
            return res.render('login', {message: 'Es ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.'});
         }

         if(user) {
            if(bcrypt.compareSync(password, user.password)) {
               req.session.user = user;

               // forgottenPwKey löschen, da login erfolgreich war
               User.update(searchObject, {$set: {forgottenPwKey: ''}}, (err, results) => {
                  res.redirect('/');
               });
            } else {
               return res.render('login', {message: 'E-Mail/Anzeigename oder Passwort falsch'});
            }
         } else {
            return res.render('login', {message: 'E-Mail/Anzeigename oder Passwort falsch'});
         }
      });
   });

   app.get('/logout', (req, res) => {
      req.session.user = null;
      req.session.destroy();
      res.redirect('/');
   });

   app.get('/forgottenpw', mustNotBeLoggedIn, (req, res) => {
      res.render('forgottenpw', {message: '', errmessage: ''});
   });

   app.post('/forgottenpw', mustNotBeLoggedIn, (req, res) => {
      var email = req.body.email;

      // Pflichtfelder?
      if(email == '')
         return res.render('forgottenpw', {errmessage: 'Email-Feld muss ausgefüllt werden', message: ''});

      // User mit dieser E-Mail finden und key generieren
      User.findOne({email: email}, (err, user) => {
         if(err)
            return res.render('forgottenpw', {errmessage: 'Es ist ein Fehler aufgetreten', message: ''});
         if(!user)
            return res.render('forgottenpw', {errmessage: 'Ungültige E-Mail-Adresse', message: ''});

         var forgottenPwKey = Helper.md5(getRandomString(15));

         // Key speichern und Mail senden
         User.update({email: email}, {$set: {forgottenPwKey: forgottenPwKey}}, (err, results) => {
            var from_email = new Mailer.Email('noreply@knattleikr.herokuapp.com', 'Knattleikr - Bundesligatippspiel');
            var to_email = new Mailer.Email(email);
            var subject = 'Passwort zurücksetzen';

            var contentBody = '<html><head><meta charset="UTF-8"/></head><body>';
            contentBody += '<p>Hallo ' + user.nickname + '</p>';
            contentBody += '<p>Du erhältst diese Mail, da Du Dein Passwort auf KNATTLEIKR zurücksetzen möchtest.</p>';
            contentBody += '<a href="' + Settings.hostUrl + '/changepw?key=' + forgottenPwKey + '">Hier klicken zum Zurücksetzen Deines Passworts</a>';
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
               if(error)
                  return res.render('forgottenpw', {errmessage: 'Fehler beim Senden der Mail', message: ''});
               res.render('forgottenpw', {message: 'Es wurde eine E-Mail an Dich gesendet mit weiteren Anweisungen.', errmessage: ''});
            });      
         });
      });
   });

   function getRandomString(len) {
      var charString = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!§$%&/()=?#+*~-_.:,;<>|@€^°";
      var result = "";
      for(i=0; i<len; i++) {
         result += charString.charAt(Math.floor(Math.random()*charString.length));
      }
      return result;
   }

   app.get('/changepw', mustNotBeLoggedIn, (req, res) => {
      if(req.query.key) {
         // forgottenPwKey suchen
         User.findOne({forgottenPwKey: req.query.key}, (err, user) => {
            if(err)
               return res.redirect('/?err=1');
            if(!user)
               return res.redirect('/?err=1');

            res.render('changepw', {message: '', errmessage: '', forgottenPwKey: req.query.key});
         });
      }
      else
         res.redirect('/?err=1');
   });

   app.post('/changepw', mustNotBeLoggedIn, (req, res) => {
      var forgottenPwKey = req.body.forgottenPwKey;
      var password1 = req.body.password1;
      var password2 = req.body.password2;

      // Pflichtfelder?
      if(forgottenPwKey == '' || password1 == '' || password2 == '')
         return res.render('changepw', {errmessage: 'Fehlende Information', message: '', forgottenPwKey: forgottenPwKey});

      // Passwörter gleich?
      if(password1 != password2)
         return res.render('changepw', {errmessage: 'Die Passwörter stimmen nicht überein', message: '', forgottenPwKey: forgottenPwKey});

      // Bcrypt anwenden
      var salt = bcrypt.genSaltSync(9);
      var hash = bcrypt.hashSync(password1, salt);

      // forgottenPwKey suchen
      User.findOne({forgottenPwKey: forgottenPwKey}, (err, user) => {
         if(err)
            return res.render('changepw', {errmessage: 'Es ist ein Fehler aufgetreten', message: '', forgottenPwKey: forgottenPwKey});

         if(!user)
            return res.redirect('/?err=1');

         user.password = hash;
         user.forgottenPwKey = "";
         user.save(err => {
            if(err)
               return res.render('changepw', {errmessage: 'Es ist ein Fehler aufgetreten', message: '', forgottenPwKey: forgottenPwKey});
            req.session.user = user;
            res.redirect('/');
         });
      });
   });

   app.get('/admin', mustBeAdmin, (req, res) => {
      res.render('admin', {user: req.session.user, userdetail: req.userdetail, spieltagNr: Settings.aktuellerSpieltag, gravatarhash: Helper.md5(req.session.user.email)});
   });

   app.get('/tabelle', canBeLoggedIn, (req, res) => {
      Einzeltabelle.findOne({}, (err, tabelle) => {
         res.render('tabelle', {user: req.user, userdetail: req.userdetail, spieltagNr: Settings.aktuellerSpieltag, tabelle: tabelle, gravatarhash: req.user?Helper.md5(req.user.email):null});
      });
   });

   app.get('/lieferanten', canBeLoggedIn, (req, res) => {
      Lieferanten.findOne({fiUser: null}, (err, tabelle) => {
         res.render('lieferanten', {user: req.user, userdetail: req.userdetail, spieltagNr: Settings.aktuellerSpieltag, tabelle: tabelle, gravatarhash: req.user?Helper.md5(req.user.email):null, otherUser: null});
      });
   });

   app.get('/anleitung', canBeLoggedIn, (req, res) => {
      var stundenVorherString = Settings.stundenVorher==1?"1 Stunde":Settings.stundenVorher+" Stunden";
      res.render('anleitung', {user: req.user, userdetail: req.userdetail, gravatarhash: req.user?Helper.md5(req.session.user.email):null, stundenVorherString: stundenVorherString});
   });

   app.get('/user/:nickname', (req, res) => {  // Kann auch mit ?spieltag=XX aufgerufen werden!
      // Benutzer suchen
      User.findOne({nickname: req.params.nickname}, (err, otherUser) => {
         if(otherUser) {
            var andererUser = {};
            andererUser.nickname = otherUser.nickname;
            andererUser.userid = otherUser._id.toString();

            var spieltagNr = Settings.aktuellerSpieltag;
            if(req.query.spieltag)
               spieltagNr = parseInt(req.query.spieltag, 10);

            // Wertung aus den Userdetails
            UserDetail.findOne({fiUser: new mongoose.Types.ObjectId(otherUser._id)}, (err, otherUserdetail) => {
               andererUser.wertung = otherUserdetail.wertung;
               if(req.session.user) {
                  if(req.session.user.nickname == andererUser.nickname)
                     res.redirect('/');
                  else
                     UserDetail.findOne({fiUser: new mongoose.Types.ObjectId(req.session.user._id)}, (err, userdetail) => {
                        res.render('user', {user: req.session.user, userdetail: userdetail, spieltagNr: spieltagNr, otherUser: andererUser, gravatarhash: Helper.md5(req.session.user.email)});
                     });
               } else
                  res.render('user', {user: null, userdetail: null, spieltagNr: spieltagNr, otherUser: andererUser, gravatarhash: null});
            });
         } else {
            res.redirect('/');
         }
      });
   });

   app.get('/user/:nickname/lieferanten', canBeLoggedIn, (req, res) => {
      User.findOne({nickname: req.params.nickname}, (err, otherUser) => {
         if(otherUser) {
            Lieferanten.findOne({fiUser: new mongoose.Types.ObjectId(otherUser._id)}, (err, tabelle) => {
               res.render('lieferanten', {user: req.user, userdetail: req.userdetail, spieltagNr: Settings.aktuellerSpieltag, tabelle: tabelle, gravatarhash: req.user?Helper.md5(req.user.email):null, otherUser: otherUser.nickname});
            });
         } else {
            res.redirect('/');
         }
      });
   });
};