var mongoose = require('mongoose');
var OpenLigaDB = require('./openligadb.js');
var Helper = require('./util/helper.js');
var async = require('async');
var moment = require('moment');

module.exports = function(app, User, UserTipp) {
   
   app.get('/api/spieltag/:spieltag', (req, res) => {
      // Spieltag-Daten von OpenLigaDB
      OpenLigaDB.getSpieltag(2016, req.params.spieltag, (err, data) => {

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

   app.post('/api/spieltag/:spieltag', (req, res) => {
      var tipps = req.body;
      var fehler = false;

      if(req.session.user) {
         console.log('Session ok');
         var theUser = req.session.user;
         OpenLigaDB.getSpieltag(2016, req.params.spieltag, (err, data) => {
            // alle Matches
            async.forEach(data, (match, callback) => {
               var theMatchNr = match.MatchID;
               // Ist Tipp vollständig, rechtzeitig und numerisch?
               if(tipps[theMatchNr + "_1"] && tipps[theMatchNr + "_2"]) {
                  // Beide Tipps sind da
                  if(tipps[theMatchNr + "_1"].match(/^\d+$/) && tipps[theMatchNr + "_1"].match(/^\d+$/)) {
                     // Beide Tipps sind numerisch
                     var matchDate = moment(match.MatchDateTimeUTC);
                     if(moment.duration(matchDate.diff(moment())).asHours() > 5) {
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
                              callback();
                           });
                     } else {
                        // weniger als 5 Stunden
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

};