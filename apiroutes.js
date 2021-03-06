var bcrypt = require('bcrypt-nodejs');
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
var Tototabelle = require('./model/tototabelle.js');
var Spieltagtabelle = require('./model/spieltagtabelle.js');
var Lieferanten = require('./model/lieferanten.js');
var Mailer = require('sendgrid').mail;
var sg = require('sendgrid')(process.env.SENDGRID_API_KEY);
var Scheduler = require('node-schedule');

var gesamtzahlSpiele = 0;

// Team-Mappings
var teamShort = {
   "t6"  : {shortname: "B04", iconId: 'de/f/f7/Bayer_Leverkusen_Logo.svg'},
   "t7"  : {shortname: "BVB", iconId: 'commons/6/67/Borussia_Dortmund_logo.svg'},
   "t9"  : {shortname: "S04", iconId: 'commons/6/6d/FC_Schalke_04_Logo.svg'},
   "t16" : {shortname: "VFB", iconId: 'commons/e/eb/VfB_Stuttgart_1893_Logo.svg'},
   "t40" : {shortname: "FCB", iconId: 'commons/thumb/1/1f/Logo_FC_Bayern_München_%282002–2017%29.svg/768px-Logo_FC_Bayern_München_%282002–2017%29.svg.png'},
   "t54" : {shortname: "BSC", iconId: 'de/3/38/Hertha_BSC_Logo.svg'},
   "t55" : {shortname: "H96", iconId: 'commons/c/cd/Hannover_96_Logo.svg'},
   "t65" : {shortname: "KOE", iconId: 'commons/0/0a/1.FC_Köln_escudo.png'},
   "t81" : {shortname: "M05", iconId: 'commons/d/d6/FSV_Mainz_05_Logo.png'},
   "t87" : {shortname: "BMG", iconId: 'commons/8/81/Borussia_Mönchengladbach_logo.svg'},
   "t91" : {shortname: "SGE", iconId: 'commons/0/04/Eintracht_Frankfurt_Logo.svg'},
   "t95" : {shortname: "FCA", iconId: 'de/b/b5/Logo_FC_Augsburg.svg'},
   "t100": {shortname: "HSV", iconId: 'commons/6/66/HSV-Logo.svg'},
   "t112": {shortname: "SCF", iconId: 'de/f/f1/SC-Freiburg_Logo-neu.svg'},
   "t118": {shortname: "D98", iconId: 'de/8/87/Svdarmstadt98.svg'},
   "t123": {shortname: "TSG", iconId: 'commons/e/e7/Logo_TSG_Hoffenheim.svg'},
   "t131": {shortname: "WOB", iconId: 'commons/c/ce/VfL_Wolfsburg_Logo.svg'},
   "t134": {shortname: "SVW", iconId: 'commons/b/be/SV-Werder-Bremen-Logo.svg'},
   "t171": {shortname: "FCI", iconId: 'de/5/55/FC-Ingolstadt_logo.svg'},
   "t1635":{shortname: "RBL", iconId: 'en/0/04/RB_Leipzig_2014_logo.svg'}
};

module.exports = function(app, Settings, Job) {
   
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

   // // Alle Tipps abgeben, für Rechner mit selektiv gesperrtem Javascript
   // app.post('/api/spieltag/:spieltag/alle', (req, res) => {
   //    var tipps = req.body;
   //    var fehler = false;

   //    if(req.session.user) {
   //       var theUser = req.session.user;
   //       OpenLigaDB.getSpieltag(req.params.spieltag, (err, data) => {
   //          // alle Matches
   //          async.forEach(data, (match, callback) => {
   //             var theMatchNr = match.MatchID;
   //             // Ist Tipp vollständig, rechtzeitig und numerisch?
   //             if(tipps[theMatchNr + "_1"] && tipps[theMatchNr + "_2"]) {
   //                // Beide Tipps sind da
   //                if(tipps[theMatchNr + "_1"].match(/^\d+$/) && tipps[theMatchNr + "_2"].match(/^\d+$/)) {
   //                   // Beide Tipps sind numerisch
   //                   var matchDate = moment(match.MatchDateTimeUTC);
   //                   if(moment.duration(matchDate.diff(moment())).asHours() > Settings.stundenVorher) {
   //                      // Tipp ist rechtzeitig
   //                      // Hier ist also alles ok. Jetzt prüfen, ob Update oder Insert (Parameter upsert:true bei UserTipp.update)
   //                      var userObjectId = new mongoose.Types.ObjectId(theUser._id);
   //                      var pointsTeam1 = parseInt(tipps[theMatchNr + "_1"], 10);
   //                      var pointsTeam2 = parseInt(tipps[theMatchNr + "_2"], 10);
   //                      UserTipp.update({fiUser: userObjectId, matchNr: theMatchNr},
   //                         {fiUser: userObjectId, matchNr: theMatchNr, pointsTeam1: pointsTeam1, pointsTeam2: pointsTeam2},
   //                         {upsert: true}, err => {
   //                            if(err)
   //                               fehler = true;     // technischer Fehler

   //                            // Loggen, dass Tipp abgegeben wurde
   //                            console.log("[" + req.session.user.nickname + "] tippte: " + match.Team1.TeamName + " - " + match.Team2.TeamName + " " + pointsTeam1 + ":" + pointsTeam2); 

   //                            callback();
   //                         });
   //                   } else {
   //                      // weniger als x Stunden vorher
   //                      fehler = true;
   //                      callback();
   //                   }
   //                } else {
   //                   // Ein Tipp war nicht numerisch
   //                   fehler = true;
   //                   callback();
   //                }
   //             } else if ((tipps[theMatchNr + "_1"] && !tipps[theMatchNr + "_2"]) || (!tipps[theMatchNr + "_1"] && tipps[theMatchNr + "_2"])) {
   //                // der Tipp wurde nur halb abgegeben
   //                fehler = true;
   //                callback();
   //             } else {
   //                // Tipp gar nicht da, wurde evtl. entfernt und muss dann aus den Usertipps gelöscht werden
   //                var userObjectId = new mongoose.Types.ObjectId(theUser._id);
   //                UserTipp.remove({fiUser: userObjectId, matchNr: theMatchNr}, err => {
   //                   if(err)
   //                      fehler = true;
   //                   callback();
   //                });
   //             }
   //          }, err => {
   //             // Async loop finished
   //             if(fehler)
   //                res.json({err: 1, message: 'Mindestens ein Tipp wurde nicht rechtzeitig oder inhaltlich falsch abgegeben. Bitte prüfe Deine Tipps noch einmal.'});
   //             else
   //                res.json({err: 0, message: 'Die Tipps wurden erfolgreich abgegeben.'});
   //          });
   //       });
   //    } else {
   //       res.redirect('/?err=1');
   //    }
   // });

   app.get('/api/matrix/:spieltag/:match', (req, res) => {
      OpenLigaDB.getSpieltag(req.params.spieltag, (err, data) => {
         // zunächst einmal den Matchinhalt holen
         var result = {};
         for(matchIdx in data) {
            var match = data[matchIdx];
            if(match.MatchID == req.params.match) {
               result.Team1 = match.Team1;
               result.Team2 = match.Team2;
               result.Ergebnis = "";
               result.Tipps = [];

               // Ist das Ergebnis schon da?
               if(match.MatchResults.length > 1 && match.MatchIsFinished) {
                  result.Ergebnis = match.MatchResults[1].PointsTeam1 + " : " + match.MatchResults[1].PointsTeam2;
                  result.PointsTeam1 = match.MatchResults[1].PointsTeam1;
                  result.PointsTeam2 = match.MatchResults[1].PointsTeam2;
               }

               // Jetzt alle Tipps zu dem Match holen, falls die korrekte Zeit erreicht ist
               var matchDate = moment(match.MatchDateTimeUTC);
               if(moment.duration(matchDate.diff(moment())).asHours() < Settings.stundenVorher) {
                  UserTipp.find({matchNr: match.MatchID}, (err, usertipps) => {
                     if(usertipps) {
                        async.forEach(usertipps, (usertipp, callback) => {
                           // Username holen
                           User.findOne({"_id": new mongoose.Types.ObjectId(usertipp.fiUser)}, (err, user) => {
                              var punkte = -1;
                              if(result.Ergebnis) {
                                 punkte = Helper.calcPunkte(result.PointsTeam1, result.PointsTeam2, usertipp.pointsTeam1, usertipp.pointsTeam2);
                              }
                              result.Tipps.push({nickname: user.nickname, ergebnis: usertipp.pointsTeam1 + " : " + usertipp.pointsTeam2, punkte: punkte});
                              callback();
                           });
                        }, err => {
                           res.json(result);
                        });
                     } else {
                        res.json(result);
                     }
                  });
               } else {
                  res.json(result);
               }
            }
         }
      });
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

   // Einstellungen
   app.post('/api/settings/changepw', (req,res) => {
      if(req.session.user) {
         var passwordold = req.body.passwordold;
         var password1 = req.body.password1;
         var password2 = req.body.password2;

         // Pflichtfelder?
         if(passwordold == '' || password1 == '' || password2 == '')
            return res.json({err: 1, message: 'Fehlende Information'});

         // Altes Passwort prüfen
         if(!bcrypt.compareSync(passwordold, req.session.user.password))
            return res.json({err: 1, message: 'Das alte Passwort ist falsch'});

         // Passwörter gleich?
         if(password1 != password2)
            return res.json({err: 1, message: 'Die neuen Passwörter stimmen nicht überein'});

         // Bcrypt anwenden
         var salt = bcrypt.genSaltSync(9);
         var hash = bcrypt.hashSync(password1, salt);

         // User updaten
         User.findOne({nickname: req.session.user.nickname}, (err, user) => {
            if(!user)
               return res.json({err: 1, message: 'Es ist ein Fehler aufgetreten'});
            user.password = hash;
            user.forgottenPwKey = "";
            user.save(err => {
               if(err)
                  return res.json({err: 1, message: 'Es ist ein Fehler aufgetreten'});
               req.session.user = user;
               res.json({err: 0, message: 'Das Passwort wurde erfolgreich geändert'});
            });
         });
      } else {
         res.json({err: 2, message: 'Deine Sitzung ist abgelaufen. Zugriff verweigert.'});
      }
   });

   app.post('/api/settings/savesettings', (req, res) => {
      if(req.session.user) {
         var notification = req.body.notification;

         if(notification===true || notification===false) {
            User.findOne({nickname: req.session.user.nickname}, (err, user) => {
               if(!user)
                  return res.json({err: 1, message: 'Es ist ein Fehler aufgetreten'});

               user.notification = notification;
               user.save(err => {
                  if(err)
                     return res.json({err: 1, message: 'Es ist ein Fehler aufgetreten'});
                  req.session.user = user;
                  res.json({err: 0, message: 'Die Einstellung wurde erfolgreich gespeichert'});
               });

            });
         } else {
            return res.json({err: 1, message: 'Es ist ein Fehler aufgetreten'});
         }
      } else {
         res.json({err: 2, message: 'Deine Sitzung ist abgelaufen. Zugriff verweigert.'});
      }
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


                        // Schedule a job for sending a mail for the next Spieltag
                        OpenLigaDB.getSpieltag(neuerWert, (err, data) => {
                           // Date of first game
                           var match = data[0];
                           var scheduleDateStr = match.MatchDateTime.substring(0, 11) + "09:00:00Z";

                           var scheduleDate = new Date(scheduleDateStr);
                           if(Job)
                              Job.cancel();
                           Job = Scheduler.scheduleJob(scheduleDate, () => {
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
                        });
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
                     allUsers[user._id] = {nickname: user.nickname, punkte: 0, zweiPunkte: 0, spiele: 0, wertung: -1, zweipunkteWertung: 0};
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
                        if(punkte == 2) 
                           users[usertipp.fiUser].zweiPunkte++;
                        users[usertipp.fiUser].spiele++;
                        users[usertipp.fiUser].wertung = users[usertipp.fiUser].punkte/users[usertipp.fiUser].spiele;
                        users[usertipp.fiUser].zweipunkteWertung = users[usertipp.fiUser].zweiPunkte/users[usertipp.fiUser].spiele;
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
         var gefaehrdeteUser = [];
         async.forEach(Object.keys(users), (userid, callback) => {
            
            // Deaktivieren?
            var isAktiv = true;
            if(users[userid].spiele + Settings.maxVerpassteSpiele < gesamtzahlSpiele)
               isAktiv = false;
            else
               // Gefährdet?
               if(users[userid].spiele + Settings.maxVerpassteSpiele < (gesamtzahlSpiele + 9))
                  gefaehrdeteUser.push(users[userid].nickname);

            UserDetail.update({fiUser: new mongoose.Types.ObjectId(userid)}, {$set: {punkte: users[userid].punkte, spiele: users[userid].spiele, wertung: users[userid].wertung, zweipunkteWertung: users[userid].zweipunkteWertung, isAktiv: isAktiv}}, err => {
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
               return (user2.wertung - user1.wertung) || (user2.punkte - user1.punkte);
            });

            Einzeltabelle.update({}, {$set: {tabelleninhalt: userArray}}, {upsert: true}, (err, results) => {
               res.json({err: 0, message: 'Einzelwertung erfolgreich berechnet.' + (gefaehrdeteUser.length?'Gefährdet: ' + gefaehrdeteUser.join('/'):'')});
            });

         });
      }
   }

   app.get('/api/admin/totowertung', (req, res) => {
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
                     totowertungRekursiv(1, res, allUsers);
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

   function totowertungRekursiv(spieltag, res, users) {
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
                        var punkte = Helper.calcTotoPunkte(match.MatchResults[1].PointsTeam1, match.MatchResults[1].PointsTeam2, usertipp.pointsTeam1, usertipp.pointsTeam2);
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
               totowertungRekursiv(spieltag + 1, res, users);
            });
         });         
      } else {
         // Tabelle berechnen

         // Users-Objekt in Array umwandeln
         var userArray = [];
         for(userid in users) {
            // inaktive herausfiltern
            if(users[userid].spiele + Settings.maxVerpassteSpiele >= gesamtzahlSpiele)
               userArray.push(users[userid]);
         }

         userArray.sort((user1, user2) => {
            return (user2.wertung - user1.wertung) || (user2.punkte - user1.punkte);
         });

         Tototabelle.update({}, {$set: {tabelleninhalt: userArray}}, {upsert: true}, (err, results) => {
            res.json({err: 0, message: 'Totowertung erfolgreich berechnet.'});
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
                     allTeams[match.Team1.TeamId] = {teamname: match.Team1.TeamName, teamShort: teamShort["t"+match.Team1.TeamId].shortname, teamUrl: getTeamIcon(match, 1), punkte: 0, spiele: 0, wertung: -1};
                     allTeams[match.Team2.TeamId] = {teamname: match.Team2.TeamName, teamShort: teamShort["t"+match.Team2.TeamId].shortname, teamUrl: getTeamIcon(match, 2), punkte: 0, spiele: 0, wertung: -1};
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

   function getTeamIcon(match, teamNr) {
      var iconId = teamShort["t"+match['Team'+teamNr].TeamId].iconId;
      return "https://upload.wikimedia.org/wikipedia/" + iconId;
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
            // User-Lieferanten-Tabellen berechnen
            async.forEach(Object.keys(users), (userid, callback) => {
               var userTeamArray = [];
               // User-Teams-Objekt in Array umwandeln
               var userTeamArray = [];
               for(teamid in users[userid]) {
                  userTeamArray.push(users[userid][teamid]);
               }

               userTeamArray.sort((team1, team2) => {
                  return (team2.wertung - team1.wertung) || (team2.punkte - team1.punkte);
               });

               Lieferanten.update({fiUser: new mongoose.Types.ObjectId(userid)}, {$set: {tabelleninhalt: userTeamArray}}, {upsert: true}, (err, results) => {
                  callback();
               });
            }, err => {
                  res.json({err: 0, message: 'Lieferantenwertungen erfolgreich berechnet.'});
               });
         });
      }
   }
   app.post('/api/admin/sendmail', (req, res) => {
      if(req.session.user) {
         UserDetail.findOne({fiUser: new mongoose.Types.ObjectId(req.session.user._id)}, (err, userdetail) => {
            if(userdetail.isAdmin) {
               var joinNicknames = req.body.joinNicknames;
               var betreff = req.body.betreff;
               var mailbody = req.body.mailbody;

               // Host-Url ersetzen
               mailbody = mailbody.replace(/\#\{hostUrl\}/g, Settings.hostUrl);

               if(!joinNicknames) {
                  User.find({}, (err, users) => {
                     async.forEach(users, (user, callback) => {
                        sendMailToUser(user, betreff, mailbody, callback);
                     }, err => {
                        res.json({err: 0, message: 'Mail(s) erfolgreich gesendet'});
                     });
                  });
               } else {
                  var nicknames = joinNicknames.split(',');
                  async.forEach(nicknames, (nickname, callback) => {
                     User.findOne({nickname: nickname}, (err, user) => {
                        if(user) {
                           sendMailToUser(user, betreff, mailbody, callback);
                        } else
                           callback();
                     });
                  }, err => {
                     res.json({err: 0, message: 'Mail(s) erfolgreich gesendet'});
                  });
               }
            } else {
               res.json({err: 2, message: 'Deine Sitzung ist abgelaufen. Zugriff verweigert.'});
            }
         });
      } else {
         res.json({err: 2, message: 'Deine Sitzung ist abgelaufen. Zugriff verweigert.'});
      }
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
            if(error)
               res.json({err: 1, message: 'Fehler beim Senden der Email(s).'});
            callback();
         });      
      } else {
         console.log("Notification deaktiviert: " + user.nickname);       
         callback();
      }
   }

   app.get('/api/admin/invalidatecache', (req, res) => {
      if(req.session.user) {
         UserDetail.findOne({fiUser: new mongoose.Types.ObjectId(req.session.user._id)}, (err, userdetail) => {
            if(userdetail.isAdmin) {
               OpenLigaDB.invalidateCache(Settings.aktuellerSpieltag);
               res.json({err: 0, message: 'Der Cache wurde erfolgreich invalidiert.'});
            } else {
               res.json({err: 2, message: 'Deine Sitzung ist abgelaufen. Zugriff verweigert.'});
            }
         });
      } else {
         res.json({err: 2, message: 'Deine Sitzung ist abgelaufen. Zugriff verweigert.'});
      }
   });

   app.get('/api/admin/checkjob', (req, res) => {
      console.log('Checking job ...');
      if(req.session.user) {
         console.log('User is logged in ...');
         UserDetail.findOne({fiUser: new mongoose.Types.ObjectId(req.session.user._id)}, (err, userdetail) => {
            if(userdetail.isAdmin) {
               console.log('User is admin ...');
               var message = 'Mailjob läuft nicht';
               if(Job && Job.nextInvocation())
                  message = 'Nächste Ausführung des Mailjobs: ' + Job.nextInvocation();
               res.json({err: 0, message: message});
            } else {
               res.json({err: 2, message: 'Deine Sitzung ist abgelaufen. Zugriff verweigert.'});
            }
         });
      } else {
         res.json({err: 2, message: 'Deine Sitzung ist abgelaufen. Zugriff verweigert.'});
      }
   });
};