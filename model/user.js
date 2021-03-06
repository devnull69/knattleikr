var mongoose = require('mongoose');

var userSchema = new mongoose.Schema({
	email: {type: String, required: true, unique: true},
	nickname: {type: String, required: true, unique: true},
	password: {type: String, required: true},
   forgottenPwKey: {type: String, default: ''},
   notification: {type: Boolean, default: true}
}, {collection: 'user'});

module.exports = mongoose.model('User', userSchema);