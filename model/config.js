var mongoose = require('mongoose');

var configSchema = new mongoose.Schema({
   aktuellerSpieltag: Number,
   stundenVorher: Number,
   maxVerpassteSpiele: Number,
   hostUrl: String
}, {collection: 'config'});

module.exports = mongoose.model('Config', configSchema);