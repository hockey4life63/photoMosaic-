const inquirer = require('inquirer')
const fs = require('fs')
const mongoose = require("mongoose")
const ImageDb = require('./image')
const average = require('image-average-color')
const gm = require('gm')
const sharp = require('sharp');
const canvas = require('canvas')
const testImage = new canvas.Image;
const DEFAULT_VALUES = {
    IMAGESOURCE: './source_images',
    STARTINGVALUE: 0,
    TOTALIMAGES: 10
}
const fileNames = {}
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
                    const newImage = new ImageDb({
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
            const newImage = new ImageDb({
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

const tileImage = (thisImage, i, option, ctx)=>{
    let tileIndex = i
    let offsetX = (tileIndex % option.sideCount) * option.tileWidth;
    let offsetY = Math.floor(tileIndex / option.sideCount) * option.tileHeight;
    let imgFile = fs.readFileSync(thisImage)
    let img = new canvas.Image
    img.src = imgFile
    ctx.drawImage(img, offsetX, offsetY, option.tileWidth, option.tileHeight);
    
}

const analyzePhoto = _ => {
    inquirer.prompt([{
        type: 'input',
        name: 'filename',
        message: "Enter exact filename of file you want to analyze:",
    }, {
        type: 'input',
        name: 'sideCount',
        message: "Enter number of rows of photos you want:",
    }]).then(async option => {
        option = {
          filename:"4 - Fyt8Egq.jpg",
          sideCount:16,
          tileWidth: 32,
          tileHeight: 32,
        }; 
        sharp('./source_images/' + option.filename)
             //resize to smatch number of iamges to use
            .resize(option.sideCount, option.sideCount)
             //use buffer for pixelGetter
            .raw()
            .toBuffer()
            .then(async pixelData => {
                    const docs = []
                    const pixels = []
                    for (let i = 0; i < pixelData.length; i+=3) {
                        let r = pixelData[i]
                        let g = pixelData[i+1]
                        let b = pixelData[i+2]
                        pixels.push(`rgb(${r},${g},${b})`)
                        i%30 === 0?console.log('match colors:', `rgb(${r},${g},${b})`):null
                        // find closest match in db sqrt((r1 -r2)^2 + (g1 -g2)^2 +(b1 -b2)^2)
                        await ImageDb.aggregate([{
                                $project: {
                                    diff: {
                                        '$sqrt': {
                                            $add: [
                                                { '$pow': [{ '$subtract': [r, '$b'] }, 2] },
                                                { '$pow': [{ '$subtract': [g, '$g'] }, 2] },
                                                { '$pow': [{ '$subtract': [b, '$r'] }, 2] }
                                            ]
                                        }

                                    },
                                    doc: '$$ROOT'
                                },

                            },
                            { $sort: { diff: 1 } },
                            { $limit: 1 }
                        ]).allowDiskUse(true).then(results => {
                            i%30 === 0?console.log('dc colors',`rgb(${results[0].doc.r},${results[0].doc.g},${results[0].doc.b})`):null
                            docs.push('./source_images/'+ results[0].doc.filename)
                            pixels.push(`rgb(${results[0].doc.b},${results[0].doc.g},${results[0].doc.r})`)
                        })
                    }

                    console.log('docs length:', docs.length)
                    const newCanvas = new canvas(option.sideCount*option.tileHeight, option.sideCount*option.tileWidth)
                    const ctx = newCanvas.getContext('2d')
                    const secondCanvas = new canvas(option.sideCount, option.sideCount)
                    const ctxTwo = secondCanvas.getContext('2d')
                    for (let i = 0; i < option.sideCount; i++) {
                      for (let k = 0; k < option.sideCount; k++) {
                        let color = pixels[(i*option.sideCount)+k]
                        ctxTwo.fillStyle = color
                        ctxTwo.fillRect(k,i,1,1)
                      }
                    }
                    for (let i = 0; i < docs.length; i++) {
                      i%10 === 0?console.log('fina;l build loop:', i):null
                      tileImage(docs[i], i, option, ctx)
                    }
                    newCanvas.toBuffer(function(err, buf){
                      sharp(buf).toFile('mosaic.jpeg', (err, info)=>{
                        console.log(err, info)
                      })
                    });
                    secondCanvas.toBuffer(function(err, buf){
                      sharp(buf).toFile('pixelImage.jpeg', (err, info)=>{
                        console.log(err, info)
                      })
                    });
                
            })
    })
}

const buildDatabase = async _ => {
    // grab array of all file names
    let fileArr = fs.readdirSync(current_values.IMAGESOURCE)
    //use settings to chose which files to process
    fileArr = fileArr.slice(current_values.STARTINGVALUE, current_values.STARTINGVALUE + current_values.TOTALIMAGES)
    for (let i = 0; i < fileArr.length; i++) {
        //await to prevent freezing and to allow to run in background
        await getImageAvg(fileArr[i], i)
    }
    console.log('Finished!')
}

//program intro/main menu
const start = _ =>
    // use home function to keep current settings shown correctly
    inquirer.prompt(home()).then(async answer => {
        if (answer.option === 'run') {
            buildDatabase()
        } else if (answer.option === 'analyze photo') {
            analyzePhoto()
        } else {
            changeSettings()
        }
    })

start()