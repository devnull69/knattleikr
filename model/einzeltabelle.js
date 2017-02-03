var mongoose = require('mongoose');

var einzelTabelleSchema = new mongoose.Schema({
   nickname: String,
   punkte: Number,
   spiele: Number,
   wertung: Number
}, {collection: 'einzeltabelle'});

module.exports = mongoose.model('Einzeltabelle', einzelTabelleSchema);