var Client = require('node-rest-client').Client;

var client = new Client();

var args = {
   headers: {"Accept": "application/json"}
}

var returnObject = {
   getSpieltag : function(jahr, spieltag, callback) {
      client.get("https://www.openligadb.de/api/getmatchdata/bl1/" + jahr + "/" + spieltag, args, (data, response) => {
         callback(null, data);
      });
   }
}

module.exports = returnObject;