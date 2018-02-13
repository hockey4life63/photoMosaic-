const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ImageSchema = new Schema({
    filename: {
        type: String,
        required: true,
/*        unique:true
*/    },
    extension: {
        type: String,
        required: true
    },
    r:{
            type: Number,
            min: 0,
            max: 255
    },
    g: {
            type: Number,
            min: 0,
            max: 255
    },
    b: {
            type: Number,
            min: 0,
            max: 255
    },
    a: {
            type: Number,
            min: 0,
            max: 255
    }
});

const ImageDb = mongoose.model('Image', ImageSchema);

module.exports = ImageDb;
