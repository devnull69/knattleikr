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
      if(spieltagCache[spieltag] && moment.duration(moment().diff(spieltagCache[spieltag].lastUpdate)).asMinutes() < cacheTimeoutInMin) {
         console.log("Spieltag " + spieltag + " aus dem Cache abgerufen");
         callback(null, spieltagCache[spieltag].matches);
      } else {
         client.get("https://www.openligadb.de/api/getmatchdata/bl1/2016/" + spieltag, args, (data, response) => {
            spieltagCache[spieltag] = {};
            spieltagCache[spieltag].matches = data;
            spieltagCache[spieltag].lastUpdate = moment();
            console.log("Spieltag " + spieltag + " live abgerufen und im Cache abgelegt");
            callback(null, data);
         });
      }
   }
}

module.exports = returnObject;