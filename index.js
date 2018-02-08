/*data complier
take in a relative file location(default ./source_images) and a starting number(default 0) and a total images you want processed(default 100)
runs thru getAverageRgb stores filename, file extension, and rgb avg.
 {
    type: 'confirm',
    name: 'toBeDelivered',
    message: 'Is this for delivery?',
    default: false
  },
  {
    type: 'input',
    name: 'phone',
    message: "What's your phone number?",
    validate: function(value) {
      var pass = value.match(
        /^([01]{1})?[-.\s]?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})\s?((?:#|ext\.?\s?|x\.?\s?){1}(?:\d+)?)?$/i
      )
      if (pass) {
        return true
      }

      return 'Please enter a valid phone number'
    }
  },
  {
    type: 'list',
    name: 'size',
    message: 'What size do you need?',
    choices: ['Large', 'Medium', 'Small'],
    filter: function(val) {
      return val.toLowerCase()
    }
  },
  {
    type: 'input',
    name: 'quantity',
    message: 'How many do you need?',
    validate: function(value) {
      var valid = !isNaN(parseFloat(value))
      return valid || 'Please enter a number'
    },
    filter: Number
  },
*/
const inquirer = require('inquirer')
const fs = require('fs')
const mongoose = require("mongoose")
const Image = require('./image')
const Jimp = require('jimp')
const average = require('image-average-color')
const gm = require('gm')

const pixelGetter = require("pixel-getter");


const DEFAULT_VALUES = {
    IMAGESOURCE: './source_images',
    STARTINGVALUE: 0,
    TOTALIMAGES: 10
}

mongoose.Promise = Promise

mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost/photoMoasic", {})

const current_values = DEFAULT_VALUES

const buildCurrentInfo = _ =>
    'Photo Mosaic source image complier\n' +
    "source location: '" + current_values.IMAGESOURCE + "'\n" +
    'starting image index: ' + current_values.STARTINGVALUE + '\n' +
    'images to process: ' + current_values.TOTALIMAGES + '\n'

const home = _ => {
    return {
        type: 'list',
        name: 'option',
        message: buildCurrentInfo(),
        choices: ['Run', 'Settings', 'Analyze Photo'],
        filter: function(val) {
            return val.toLowerCase()
        }
    }
}
const settings = _ => {
    return {
        type: 'list',
        name: 'option',
        message: buildCurrentInfo(),
        choices: ['Home', 'IMAGESOURCE', 'STARTINGVALUE', 'TOTALIMAGES'],
    }
}
const settingsQuestions = {
    IMAGESOURCE: {
        type: 'input',
        name: 'ans',
        message: "Enter relative path to images folder:",
    },
    STARTINGVALUE: {
        type: 'input',
        name: 'ans',
        message: "Enter starting index:",
    },
    TOTALIMAGES: {
        type: 'input',
        name: 'ans',
        message: "Enter total number of images you want to process:",
    }
}

function saveValue(input, option) {
    console.log(option === 'source', option)
    if (option === 'source') {
        current_values.IMAGESOURCE = input
    } else if (option === 'stating index') {
        current_values.STARTINGVALUE = input
    } else {
        current_values.TOTALIMAGES = input
    }
}

async function fileLoop(ele, index) {
    console.log('index:', index)
    const newPromise = () => {
        return new Promise(resolve => {
            average('./source_images/' + ele, (err, color) => {
                if (err) {} else {
                    const [r, g, b, a] = color
                    filename = ele
                    extension = ele.split().splice(-3).join('')
                    const newImage = new Image({
                        r,
                        g,
                        b,
                        a,
                        filename,
                        extension
                    })
                    newImage.save().then(_ => {
                        console.log('image info saved')
                        resolve('saved')
                    }).catch(err => console.log(err))
                }
            })
        })
    }
    await newPromise()

}

const changeSettings = _ =>
    inquirer.prompt(settings()).then(answer => {
        if (answer.option === 'Home') {
          start()
        } else {
            inquirer.prompt(settingsQuestions[answer.option]).then(input => {
                current_values[answer.option] = input.ans
                console.log('after', current_values)
                changeSettings()
            }).catch(err => console.log(err))
        }
    })

const getImageAvg = async (imagePath, index) => {
    return new Promise(resolve => {
       gm('./source_images/' + imagePath).resize(1, 1).toBuffer(function(err, buffer) {
        const r = buffer.readUInt8(buffer.length - 3)
        const g = buffer.readUInt8(buffer.length - 2)
        const b = buffer.readUInt8(buffer.length - 1)
        const filename = imagePath
        const extension = imagePath.split().splice(-3).join('')
        const newImage = new Image({
            r,
            g,
            b,
            filename,
            extension
        })
        newImage.save().then(_ => {
            console.log('image info saved', index)
            resolve('saved')
        }).catch(err => console.log(err))
    })
    })
}

const analyzePhoto = _=>{
  inquirer.prompt([{
        type: 'input',
        name: 'filename',
        message: "Enter exact filename of file you want to analyze:",
    },{
        type: 'input',
        name: 'sideCount',
        message: "Enter number of rows of photos you want:",
    }]).then(option => {
      gm('./source_images/'+option.filename)
        .resize(option.sideCount, option.sideCount)
        .toBuffer((err, buffer)=>{
          pixelGetter.get(buffer, async (err, pixels)=>{
            const docs =[]
            for (var i = 0; i < pixels.length; i++) {
              console.log(i)
              let r = pixels[i].r
              let g = pixels[i].g
              let b = pixels[i].b
              await Image.aggregate([
               {'$project':{diff:
                  {'$add':[
                    {'$abs':{'$subtract':[r, '$r']}},
                    {'$abs':{'$subtract':[g, '$g']}},
                    {'$abs':{'$subtract':[b, '$b']}}
                    ]}
                  },
                  doc:'$$ROOT'
                },
               {'$sort':{diff:1}},
               {'$limit':1}
              ]).allowDiskUse(true).exec(results => {
                docs.push(results.filename)
              })
            }
            console.log(docs)
          })
      })
    })
}

const start = _=>
  inquirer.prompt(home()).then(async answer => {
    if (answer.option === 'run') {
        let fileArr = fs.readdirSync(current_values.IMAGESOURCE)
        fileArr = fileArr.slice(current_values.STARTINGVALUE, current_values.STARTINGVALUE + current_values.TOTALIMAGES)
        for (var i = 0; i < fileArr.length ;i++) {
            await getImageAvg(fileArr[i], i)
        }
        console.log('Finished!')
    } else if(answer.option === 'analyze photo'){
      analyzePhoto()
    }else {
        changeSettings()
    }
})

start()