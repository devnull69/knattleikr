var mongoose = require('mongoose');

var userTippSchema = new mongoose.Schema({
   fiUser: {type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true},
   matchNr: {type: Number, required: true},
   pointsTeam1 : {type: Number, required: true},
   pointsTeam2 : {type: Number, required: true}
}, {collection: 'usertipp'});

userTippSchema.index({fiUser: 1, matchNr: 1}, {unique: true});

module.exports = mongoose.model('UserTipp', userTippSchema);