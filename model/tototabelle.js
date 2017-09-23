var mongoose = require('mongoose');

var totoTabelleSchema = new mongoose.Schema({
   tabelleninhalt:   [{
         nickname: String,
         punkte: Number,
         spiele: Number,
         wertung: Number
   }] 
}, {collection: 'tototabelle'});

module.exports = mongoose.model('Tototabelle', totoTabelleSchema);