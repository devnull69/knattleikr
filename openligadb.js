var Client = require('node-rest-client').Client;
var moment = require('moment');

var client = new Client();

var spieltagCache = [];
var cacheTimeoutInMin = 30;

var args = {
   headers: {"Accept": "application/json"}
}

var returnObject = {
   getSpieltag : function(spieltag, callback) {
      if(spieltagCache[spieltag] && (spieltagCache[spieltag].permanent || moment.duration(moment().diff(spieltagCache[spieltag].lastUpdate)).asMinutes() < cacheTimeoutInMin)) {
         console.log("Spieltag " + spieltag + " aus dem Cache abgerufen");
         for(j=0; j<spieltagCache[spieltag].matches.length; j++) {
            spieltagCache[spieltag].matches[j].usertipp = null;
            spieltagCache[spieltag].matches[j].punkte = null;
         }
         callback(null, spieltagCache[spieltag].matches);
      } else {
         client.get("https://www.openligadb.de/api/getmatchdata/bl1/2016/" + spieltag, args, (data, response) => {
            spieltagCache[spieltag] = {};
            spieltagCache[spieltag].matches = data;
            spieltagCache[spieltag].lastUpdate = moment();

            // Ist Spieltag komplett, dann Flag setzen
            var spieltagKomplett = true;
            var i=0;
            do {
               if(!data[i].MatchIsFinished)
                  spieltagKomplett = false;
               i++;
            } while (spieltagKomplett && i < data.length);

            if(spieltagKomplett)
               spieltagCache[spieltag].permanent = true;
            else
               spieltagCache[spieltag].permanent = false;

            console.log("Spieltag " + spieltag + " live abgerufen und im Cache abgelegt" + (spieltagKomplett?" (permanent)":""));
            callback(null, data);
         });
      }
   }
}

module.exports = returnObject;