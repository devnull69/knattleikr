var mongoose = require('mongoose');

var userDetailSchema = new mongoose.Schema({
   fiUser: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
   isAdmin: {type: Boolean, required: true, default: false},
   isAktiv: {type: Boolean, required: true, default: true},
   memberOf: {type: mongoose.Schema.Types.ObjectId, ref: 'Team'},
   tlStatus: {type: Number, required: true, default: 0},
   punkte: {type: Number, default: 0},
   spiele: {type: Number, default: 0},
   wertung: {type: Number, default: -1}
}, {collection: 'userdetail'});

module.exports = mongoose.model('UserDetail', userDetailSchema);