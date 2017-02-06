var bcrypt = require('bcrypt-nodejs');
var User = require('./model/user.js');
var Einzeltabelle = require('./model/einzeltabelle.js');

module.exports = function(app, Settings) {
   app.get('/', (req, res) => {
      var spieltagNr = Settings.aktuellerSpieltag;
      if(req.session.user)
         res.render('index', {user: req.session.user, spieltagNr: spieltagNr, error: req.query.err});
      else
         res.render('index', {user: null, spieltagNr: spieltagNr, error: req.query.err});
   });

   app.get('/register', (req, res) => {
      // Nur rendern, wenn keine User-Session existiert
      if(!req.session.user)
         res.render('register', {message: '', email: '', nickname: ''});
      else
         res.redirect('/');
   });

   app.post('/register', (req, res) => {
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
               req.session.user = newUser;
               res.redirect('/');
            });
         }
      });


   });

   app.get('/login', (req, res) => {
      if(!req.session.user)
         res.render('login', { message : ''});
      else
         res.redirect('/');
   });

   app.post('/login', (req, res) => {
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
               res.redirect('/');
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

   app.get('/admin', (req, res) => {
      if(req.session.user && req.session.user.isAdmin) {
         res.render('admin', {user: req.session.user, spieltagNr: Settings.aktuellerSpieltag});
      } else {
         req.session.user = null;
         req.session.destroy();
         res.redirect('/?err=1');
      }
   });

   app.get('/tabelle', (req, res) => {
      Einzeltabelle.find({}, (err, tabelle) => {
         res.render('tabelle', {user: req.session.user, spieltagNr: Settings.aktuellerSpieltag, tabelle: tabelle});
      });
   });
};