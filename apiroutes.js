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
var Lieferanten = require('./model/lieferanten.js');

var gesamtzahlSpiele = 0;

// Team-Mappings
var teamShort = {
   "t6"  : "B04",
   "t7"  : "BVB",
   "t9"  : "S04",
   "t40" : "FCB",
   "t54" : "BSC",
   "t65" : "KOE",
   "t81" : "M05",
   "t87" : "BMG",
   "t91" : "SGE",
   "t95" : "FCA",
   "t100": "HSV",
   "t112": "SCF",
   "t118": "D98",
   "t123": "TSG",
   "t131": "WOB",
   "t134": "SVW",
   "t171": "FCI",
   "t1635": "RBL"
};

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

   // Alle Tipps abgeben, für Rechner mit selektiv gesperrtem Javascript
   app.post('/api/spieltag/:spieltag/alle', (req, res) => {
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
                  var userObjectId = new mongoose.Types.ObjectId(theUser._id);
                  UserTipp.remove({fiUser: userObjectId, matchNr: theMatchNr}, err => {
                     if(err)
                        fehler = true;
                     callback();
                  });
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
                  } else {
                     // Match ist noch nicht fertig, trotzdem Tipp anzeigen, falls Tipp nicht mehr veränderbar
                     var matchDate = moment(match.MatchDateTimeUTC);
                     if(moment.duration(matchDate.diff(moment())).asHours() < Settings.stundenVorher) {
                        match.usertipp = usertipp;
                     }
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

            Einzeltabelle.update({}, {$set: {tabelleninhalt: userArray}}, {upsert: true}, (err, results) => {
               res.json({err: 0, message: 'Einzelwertung erfolgreich berechnet.'});
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
               });
            });
         });         
      }
   }

   app.get('/api/admin/lieferantenwertung', (req, res) => {
      if(req.session.user) {
         UserDetail.findOne({fiUser: new mongoose.Types.ObjectId(req.session.user._id)}, (err, userdetail) => {
            if(userdetail.isAdmin) {
               // Schritt 0: Alle Teams holen
               // Schritt 1: Alle User holen und alle Teams zuordnen
               // Schritt 2: Alle Spieltage durchgehen, dann Tipps sichten
               // Schritt 3: Tabellen berechnen aus Teams

               var allTeams = {};
               OpenLigaDB.getSpieltag(1, (err, matches) => {
                  async.forEach(matches, (match, callback) => {
                     allTeams[match.Team1.TeamId] = {teamname: match.Team1.TeamName, teamShort: teamShort["t"+match.Team1.TeamId], teamUrl: match.Team1.TeamIconUrl, punkte: 0, spiele: 0, wertung: -1};
                     allTeams[match.Team2.TeamId] = {teamname: match.Team2.TeamName, teamShort: teamShort["t"+match.Team2.TeamId], teamUrl: match.Team2.TeamIconUrl, punkte: 0, spiele: 0, wertung: -1};
                     callback();
                  }, err => {
                     var allUsers = {};
                     User.find({}, {}, (err, users) => {
                        async.forEach(users, (user, callback) => {
                           allUsers[user._id] = deepClone(allTeams);
                           callback();
                        }, err => {
                           lieferantenwertungRekursiv(1, res, allUsers, allTeams);
                        });
                     });
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

   function deepClone(obj) {
      return JSON.parse(JSON.stringify(obj));
   }

   function lieferantenwertungRekursiv(spieltag, res, users, teams) {
      if(spieltag <= Settings.aktuellerSpieltag) {
         OpenLigaDB.getSpieltag(spieltag, (err, matches) => {
            // einen Spieltag durchgehen
            async.forEach(matches, (match, callback) => {
               if(match.MatchIsFinished) {
                  var theMatchNr = match.MatchID;

                  // Alle Tipps dazu suchen
                  UserTipp.find({matchNr: theMatchNr}, (err, usertipps) => {
                     async.forEach(usertipps, (usertipp, innercallback) => {
                        // Punkte berechnen und dem Team sowie dem Benutzer-Team hinzufügen
                        var punkte = Helper.calcPunkte(match.MatchResults[1].PointsTeam1, match.MatchResults[1].PointsTeam2, usertipp.pointsTeam1, usertipp.pointsTeam2);

                        teams[match.Team1.TeamId].punkte += punkte;
                        teams[match.Team2.TeamId].punkte += punkte;
                        users[usertipp.fiUser][match.Team1.TeamId].punkte += punkte;
                        users[usertipp.fiUser][match.Team2.TeamId].punkte += punkte;

                        teams[match.Team1.TeamId].spiele++;
                        teams[match.Team2.TeamId].spiele++;
                        users[usertipp.fiUser][match.Team1.TeamId].spiele++;
                        users[usertipp.fiUser][match.Team2.TeamId].spiele++;

                        teams[match.Team1.TeamId].wertung = teams[match.Team1.TeamId].punkte / teams[match.Team1.TeamId].spiele;
                        teams[match.Team2.TeamId].wertung = teams[match.Team2.TeamId].punkte / teams[match.Team2.TeamId].spiele;
                        users[usertipp.fiUser][match.Team1.TeamId].wertung = users[usertipp.fiUser][match.Team1.TeamId].punkte / users[usertipp.fiUser][match.Team1.TeamId].spiele;
                        users[usertipp.fiUser][match.Team2.TeamId].wertung = users[usertipp.fiUser][match.Team2.TeamId].punkte / users[usertipp.fiUser][match.Team2.TeamId].spiele;

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
               lieferantenwertungRekursiv(spieltag + 1, res, users, teams);
            });
         });         
      } else {
         // Gesamt-Tabelle berechnen

         // Teams-Objekt in Array umwandeln
         var teamArray = [];
         for(teamid in teams) {
            teamArray.push(teams[teamid]);
         }

         teamArray.sort((team1, team2) => {
            return (team2.wertung - team1.wertung) || (team2.punkte - team1.punkte);
         });

         Lieferanten.update({fiUser: null}, {$set: {tabelleninhalt: teamArray}}, {upsert: true}, (err, results) => {
            res.json({err: 0, message: 'Lieferantenwertung erfolgreich berechnet.'});
         });
      }
   }
};