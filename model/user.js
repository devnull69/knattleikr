var mongoose = require('mongoose');

var userSchema = new mongoose.Schema({
	email: {type: String, required: true, unique: true},
	nickname: {type: String, required: true, unique: true},
	password: {type: String, required: true},
   isAdmin: {type: Boolean, required: true},
   isAktiv: {type: Boolean, required: true},
   memberOf: {type: mongoose.Schema.Types.ObjectId, ref: 'Team'},
   tlStatus: {type: Number, required: true},
   punkte: {type: Number, default: 0},
   spiele: {type: Number, default: 0},
   wertung: {type: Number, default: -1}
}, {collection: 'user'});

module.exports = mongoose.model('User', userSchema);