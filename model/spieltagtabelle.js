var mongoose = require('mongoose');

var spieltagTabelleSchema = new mongoose.Schema({
   spieltagNr:       { type: Number, unique: true},
   tabelleninhalt:   [{
         nickname: String,
         punkte: Number,
         spiele: Number,
         wertung: Number
   }] 
}, {collection: 'spieltagtabelle'});

module.exports = mongoose.model('Spieltagtabelle', spieltagTabelleSchema);