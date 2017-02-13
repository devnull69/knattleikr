var mongoose = require('mongoose');

var lieferantenSchema = new mongoose.Schema({
   fiUser: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
   tabelleninhalt:   [{
         teamname: String,
         punkte: Number,
         spiele: Number,
         wertung: Number
   }] 
}, {collection: 'lieferanten'});

module.exports = mongoose.model('Lieferanten', lieferantenSchema);