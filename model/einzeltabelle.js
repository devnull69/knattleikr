var mongoose = require('mongoose');

var einzelTabelleSchema = new mongoose.Schema({
   tabelleninhalt:   [{
         nickname: String,
         punkte: Number,
         zweiPunkte: Number,
         spiele: Number,
         wertung: Number,
         zweipunkteWertung: Number
   }] 
}, {collection: 'einzeltabelle'});

module.exports = mongoose.model('Einzeltabelle', einzelTabelleSchema);