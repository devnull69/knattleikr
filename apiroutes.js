var mongoose = require('mongoose');
var OpenLigaDB = require('./openligadb.js');
var Helper = require('./util/helper.js');
var async = require('async');
var moment = require('moment');
var User = require('./model/user.js');
var UserDetail = require('./model/userdetail.js');
var UserTipp = require('./model/usertipp.js');
var Config = require('./model/config.js');
var Einzeltabelle = require('./model/einzeltabelle.js');
var Spieltagtabelle = require('./model/spieltagtabelle.js');

var gesamtzahlSpiele = 0;

module.exports = function(app, Settings) {
   
   app.get('/api/spieltag/:spieltag', (req, res) => {
      // Spieltag-Daten von OpenLigaDB
      OpenLigaDB.getSpieltag(req.params.spieltag, (err, data) => {

         var result = {};
         result.sessionOk = false;

         //Auffüllen mit Usertipps, falls vorhanden
         if(req.session.user) {
            var theUser = req.session.user;
            var gesamtPunkte = 0;
            var tippAnzahl = 0;
            result.sessionOk = true;

            // alle Matches
            async.forEach(data, (match, callback) => {
               var theMatchNr = match.MatchID;

               UserTipp.findOne({fiUser: new mongoose.Types.ObjectId(theUser._id), matchNr: theMatchNr}, (err, usertipp) => {
                  if(usertipp) {
                     match.usertipp = usertipp;
                     // Punkte berechnen, falls match schon beendet ist
                     if(match.MatchIsFinished) {
                        match.punkte = Helper.calcPunkte(match.MatchResults[1].PointsTeam1, match.MatchResults[1].PointsTeam2, usertipp.pointsTeam1, usertipp.pointsTeam2);
                        tippAnzahl++;
                        gesamtPunkte += match.punkte;
                     }
                  }
                  callback();
               });
            }, err => {
               // Async loop finished
               result.matches = data;
               if(tippAnzahl > 0)
                  result.wertung = gesamtPunkte / tippAnzahl;

               res.json(result);
            });
         } else {
            result.matches = data;
            res.json(result);
         }
      });
   });

   // Einen Einzeltipp abgeben
   app.post('/api/spieltag/:spieltag', (req, res) => {
      var tipps = req.body;
      var fehler = false;

      if(req.session.user) {
         var theUser = req.session.user;
         OpenLigaDB.getSpieltag(req.params.spieltag, (err, data) => {
            // alle Matches
            async.forEach(data, (match, callback) => {
               var theMatchNr = match.MatchID;
               // Ist Tipp vollständig, rechtzeitig und numerisch?
               if(tipps[theMatchNr + "_1"] && tipps[theMatchNr + "_2"]) {
                  // Beide Tipps sind da
                  if(tipps[theMatchNr + "_1"].match(/^\d+$/) && tipps[theMatchNr + "_2"].match(/^\d+$/)) {
                     // Beide Tipps sind numerisch
                     var matchDate = moment(match.MatchDateTimeUTC);
                     if(moment.duration(matchDate.diff(moment())).asHours() > Settings.stundenVorher) {
                        // Tipp ist rechtzeitig
                        // Hier ist also alles ok. Jetzt prüfen, ob Update oder Insert (Parameter upsert:true bei UserTipp.update)
                        var userObjectId = new mongoose.Types.ObjectId(theUser._id);
                        var pointsTeam1 = parseInt(tipps[theMatchNr + "_1"], 10);
                        var pointsTeam2 = parseInt(tipps[theMatchNr + "_2"], 10);
                        UserTipp.update({fiUser: userObjectId, matchNr: theMatchNr},
                           {fiUser: userObjectId, matchNr: theMatchNr, pointsTeam1: pointsTeam1, pointsTeam2: pointsTeam2},
                           {upsert: true}, err => {
                              if(err)
                                 fehler = true;     // technischer Fehler

                              // Loggen, dass Tipp abgegeben wurde
                              console.log("[" + req.session.user.nickname + "] tippte: " + match.Team1.TeamName + " - " + match.Team2.TeamName + " " + pointsTeam1 + ":" + pointsTeam2); 

                              callback();
                           });
                     } else {
                        // weniger als x Stunden vorher
                        fehler = true;
                        callback();
                     }
                  } else {
                     // Ein Tipp war nicht numerisch
                     fehler = true;
                     callback();
                  }
               } else if ((tipps[theMatchNr + "_1"] && !tipps[theMatchNr + "_2"]) || (!tipps[theMatchNr + "_1"] && tipps[theMatchNr + "_2"])) {
                  // der Tipp wurde nur halb abgegeben
                  fehler = true;
                  callback();
               } else {
                  // Tipp gar nicht da, wurde evtl. entfernt und muss dann aus den Usertipps gelöscht werden
                  if(tipps[theMatchNr + "_1"] == "" && tipps[theMatchNr + "_2"] == "") {
                     var userObjectId = new mongoose.Types.ObjectId(theUser._id);
                     UserTipp.remove({fiUser: userObjectId, matchNr: theMatchNr}, err => {
                        console.log("[" + req.session.user.nickname + "] löschte: " + match.Team1.TeamName + " - " + match.Team2.TeamName); 
                        if(err)
                           fehler = true;
                        callback();
                     });
                  } else
                     callback();
               }
            }, err => {
               // Async loop finished
               if(fehler)
                  res.json({err: 1, message: 'Mindestens ein Tipp wurde nicht rechtzeitig oder inhaltlich falsch abgegeben. Bitte prüfe Deine Tipps noch einmal.'});
               else
                  res.json({err: 0, message: 'Die Tipps wurden erfolgreich abgegeben.'});
            });
         });
      } else {
         res.redirect('/?err=1');
      }
   });

   app.get('/api/user/:userid/spieltag/:spieltag', (req, res) => {
      // Spieltag-Daten von OpenLigaDB
      OpenLigaDB.getSpieltag(req.params.spieltag, (err, data) => {

         var result = {};
         result.sessionOk = false;

         //Auffüllen mit Usertipps, falls vorhanden
         var theUser = req.params.userid;
         var gesamtPunkte = 0;
         var tippAnzahl = 0;
         result.sessionOk = true;

         // alle Matches
         async.forEach(data, (match, callback) => {
            var theMatchNr = match.MatchID;

            UserTipp.findOne({fiUser: theUser, matchNr: theMatchNr}, (err, usertipp) => {
               if(usertipp) {
                  if(match.MatchIsFinished) {
                     // Punkte berechnen, falls match schon beendet ist
                     match.usertipp = usertipp;
                     match.punkte = Helper.calcPunkte(match.MatchResults[1].PointsTeam1, match.MatchResults[1].PointsTeam2, usertipp.pointsTeam1, usertipp.pointsTeam2);
                     tippAnzahl++;
                     gesamtPunkte += match.punkte;
                  }
               }
               callback();
            });
         }, err => {
            // Async loop finished
            result.matches = data;
            if(tippAnzahl > 0)
               result.wertung = gesamtPunkte / tippAnzahl;

            res.json(result);
         });
      });
   });

   app.get('/api/spieltag/:spieltag/tabelle', (req, res) => {
      Spieltagtabelle.findOne({spieltagNr: req.params.spieltag}, (err, spieltagtabelle) => {
         if(spieltagtabelle)
            res.json(spieltagtabelle.tabelleninhalt);
         else
            res.json([]);
      });
   });

   // Administration

   app.post('/api/admin/config', (req, res) => {
      if(req.session.user) {
         UserDetail.findOne({fiUser: new mongoose.Types.ObjectId(req.session.user._id)}, (err, userdetail) => {
            if(userdetail.isAdmin) {
               var aktSpieltag = req.body.aktuellerSpieltag;
               if(aktSpieltag && aktSpieltag.match(/^\d+$/)) {
                  var neuerWert = parseInt(aktSpieltag, 10);
                  if(neuerWert > 0 && neuerWert < 35) {
                     Settings.aktuellerSpieltag = neuerWert;

                     // Konfiguration in Datenbank ablegen
                     Config.update({}, {$set: {aktuellerSpieltag: neuerWert}}, err => {
                        res.json({err: 0, message: 'Die Konfiguration wurde erfolgreich gespeichert.'});
                     });
                  }
               } else {
                  res.json({err: 1, message: 'Die Änderung der Konfiguration wurde nicht übernommen.'});
               }
            } else {
               res.json({err: 2, message: 'Deine Sitzung ist abgelaufen. Zugriff verweigert.'});
            }
         });
      } else {
         res.json({err: 2, message: 'Deine Sitzung ist abgelaufen. Zugriff verweigert.'});
      }
   });

   app.get('/api/admin/einzelwertung', (req, res) => {
      if(req.session.user) {
         UserDetail.findOne({fiUser: new mongoose.Types.ObjectId(req.session.user._id)}, (err, userdetail) => {
            if(userdetail.isAdmin) {
               // Schritt 0: Alle User holen
               // Schritt 1: Alle Spieltage durchgehen, dann Tipps sichten
               // Schritt 2: Benutzer updaten
               // Schritt 3: Tabelle berechnen aus Usern
               var allUsers = {};
               User.find({}, {}, (err, users) => {
                  async.forEach(users, (user, callback) => {
                     allUsers[user._id] = {nickname: user.nickname, punkte: 0, spiele: 0, wertung: -1};
                     callback();
                  }, err => {
                     gesamtzahlSpiele = 0;
                     einzelwertungRekursiv(1, res, allUsers);
                  });
               });
            } else {
               res.json({err: 2, message: 'Deine Sitzung ist abgelaufen. Zugriff verweigert.'});
            }
         });
      } else {
         res.json({err: 2, message: 'Deine Sitzung ist abgelaufen. Zugriff verweigert.'});
      }
   });

   function einzelwertungRekursiv(spieltag, res, users) {
      if(spieltag <= Settings.aktuellerSpieltag) {
         OpenLigaDB.getSpieltag(spieltag, (err, matches) => {
            // einen Spieltag durchgehen
            async.forEach(matches, (match, callback) => {
               if(match.MatchIsFinished) {
                  var theMatchNr = match.MatchID;
                  gesamtzahlSpiele++;

                  // Alle Tipps dazu suchen
                  UserTipp.find({matchNr: theMatchNr}, (err, usertipps) => {
                     async.forEach(usertipps, (usertipp, innercallback) => {
                        // Punkte berechnen und dem Benutzer hinzufügen
                        var punkte = Helper.calcPunkte(match.MatchResults[1].PointsTeam1, match.MatchResults[1].PointsTeam2, usertipp.pointsTeam1, usertipp.pointsTeam2);
                        users[usertipp.fiUser].punkte += punkte;
                        users[usertipp.fiUser].spiele++;
                        users[usertipp.fiUser].wertung = users[usertipp.fiUser].punkte/users[usertipp.fiUser].spiele;
                        innercallback();
                     }, err => {
                        // inner async forEach finished, go next on outer async forEach
                        callback();
                     });
                  });
               } else {
                  callback();
               }
            }, err => {
               // Async loop finished
               einzelwertungRekursiv(spieltag + 1, res, users);
            });
         });         
      } else {
         // Userdetails zurückschreiben
         async.forEach(Object.keys(users), (userid, callback) => {
            
            // Deaktivieren?
            var isAktiv = true;
            if(users[userid].spiele + Settings.maxVerpassteSpiele < gesamtzahlSpiele)
               isAktiv = false;

            UserDetail.update({fiUser: new mongoose.Types.ObjectId(userid)}, {$set: {punkte: users[userid].punkte, spiele: users[userid].spiele, wertung: users[userid].wertung, isAktiv: isAktiv}}, err => {
               callback();
            });
         }, err => {
            // Tabelle berechnen

            // Users-Objekt in Array umwandeln
            var userArray = [];
            for(userid in users) {
               // inaktive herausfiltern
               if(users[userid].spiele + Settings.maxVerpassteSpiele >= gesamtzahlSpiele)
                  userArray.push(users[userid]);
            }

            userArray.sort((user1, user2) => {
               return user2.wertung - user1.wertung;
            });

            mongoose.connection.db.dropCollection('einzeltabelle', (err, result) => {
               async.forEach(userArray, (user, callback) => {
                  Einzeltabelle.update({nickname: user.nickname}, {nickname: user.nickname, punkte: user.punkte, spiele: user.spiele, wertung: user.wertung}, {upsert: true}, (err, results) => {
                     callback();
                  })
               }, err => {
                  res.json({err: 0, message: 'Einzelwertung erfolgreich berechnet.'});
               });
            });

         });
      }
   }

   app.get('/api/admin/spieltag/:spieltag/wertung', (req, res) => {
      if(req.session.user) {
         UserDetail.findOne({fiUser: new mongoose.Types.ObjectId(req.session.user._id)}, (err, userdetail) => {
            if(userdetail.isAdmin) {
               // Schritt 0: Alle User holen
               // Schritt 1: Alle Spieltage durchgehen, dann Tipps sichten
               // Schritt 2: Benutzer updaten
               // Schritt 3: Tabelle berechnen aus Usern

               var spieltagNr = req.params.spieltag;

               var allUsers = {};
               User.find({}, {}, (err, users) => {
                  async.forEach(users, (user, callback) => {
                     allUsers[user._id] = {nickname: user.nickname, punkte: 0, spiele: 0, wertung: -1};
                     callback();
                  }, err => {
                     spieltagWertung(spieltagNr, res, allUsers);
                  });
               });
            } else {
               res.json({err: 2, message: 'Deine Sitzung ist abgelaufen. Zugriff verweigert.'});
            }
         });
      } else {
         res.json({err: 2, message: 'Deine Sitzung ist abgelaufen. Zugriff verweigert.'});
      }
   });

   function spieltagWertung(spieltag, res, users) {
      if(spieltag >= 1 && spieltag <= Settings.aktuellerSpieltag) {
         OpenLigaDB.getSpieltag(spieltag, (err, matches) => {
            // einen Spieltag durchgehen
            async.forEach(matches, (match, callback) => {
               if(match.MatchIsFinished) {
                  var theMatchNr = match.MatchID;

                  // Alle Tipps dazu suchen
                  UserTipp.find({matchNr: theMatchNr}, (err, usertipps) => {
                     async.forEach(usertipps, (usertipp, innercallback) => {
                        // Punkte berechnen und dem Benutzer hinzufügen
                        var punkte = Helper.calcPunkte(match.MatchResults[1].PointsTeam1, match.MatchResults[1].PointsTeam2, usertipp.pointsTeam1, usertipp.pointsTeam2);
                        users[usertipp.fiUser].punkte += punkte;
                        users[usertipp.fiUser].spiele++;
                        users[usertipp.fiUser].wertung = users[usertipp.fiUser].punkte/users[usertipp.fiUser].spiele;
                        innercallback();
                     }, err => {
                        // inner async forEach finished, go next on outer async forEach
                        callback();
                     });
                  });
               } else {
                  callback();
               }
            }, err => {
               // Async loop finished
               // Tabelle berechnen

               // Users-Objekt in Array umwandeln
               var userArray = [];
               for(userid in users) {
                  if(users[userid].wertung > -1)
                     userArray.push(users[userid]);
               }

               userArray.sort((user1, user2) => {
                  return user2.wertung - user1.wertung;
               });

               Spieltagtabelle.update({spieltagNr: spieltag}, {$set: {tabelleninhalt: userArray}}, {upsert: true}, (err, results) => {
                  res.json({err: 0, message: 'Spieltagwertung erfolgreich berechnet.'});
               })
            });
         });         
      }
   }

};