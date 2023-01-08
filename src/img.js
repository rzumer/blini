const { createCanvas, Image, registerFont } = require('canvas');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

// Splits lines of a string based on rendered width and text replacement requirements.
async function getLines(ctx, text, maxWidth, fontSize) {
    const lineSpacing = 4;
    var lines = [];
    var chunks = text.split(/(<:.+?:\d+?>)/);
    var currentX = 0;
    var currentY = fontSize;

    for (const chunk of chunks) {
        var words = chunk.split(' ');
        var currentLine = words[0];

        for (const word of words.splice(1)) {
            var width = ctx.measureText(currentLine + ' ' + word).width;
            if (currentX + width < maxWidth) {
                currentLine += ' ' + word;
            } else {
                lines.push({ text: currentLine, x: currentX, y: currentY });
                currentLine = word;
                currentX = 0;
                currentY += fontSize + lineSpacing;
            }
        }
        lines.push({ text: currentLine, x: currentX, y: currentY });
        currentX += ctx.measureText(currentLine).width;
    }
    return lines;
}

async function getImage(src) {
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = err => { console.log(err); resolve(null); };
        img.src = src;
    });
}

/**
 * Overlay generated text from a blini instance onto a random image.
 * @param {Blini} [blini]
 * @param {string} [context]
 */
async function generateImage(blini, context) {
    if (blini.images.length === 0) return null;

    const attachmentsPath = path.resolve(process.cwd(), 'img', '.attachments');
    if (!fs.existsSync(attachmentsPath)) fs.mkdirSync(attachmentsPath);

    const imageURLs = Object.keys(blini.images);
    const randomImage = imageURLs[Math.floor(Math.random() * imageURLs.length)];
    const imagePath = path.resolve(attachmentsPath, uuidv4() + '.' + 'png');
    const generatedText = blini.generateOutput(context);

    const outputSize = 600;
    const captionPadding = 20;
    const fontSize = 36;

    if (blini.imageFonts) {
        blini.imageFonts.forEach(f => {
            if (fs.existsSync(f.path)) {
                registerFont(f.path, { family: f.family, weight: 'black', style: 'black' });
            } else {
                console.log('Could not find font ' + f.path);
            }
        });
    }

    const canvas = createCanvas(outputSize, outputSize);
    const baseImage = await getImage(randomImage);
    if (!baseImage) {
        console.log(`Failed to get image ${randomImage}`);
        blini.removeImage(randomImage);
        return generateImage(blini, context);
    }

    canvas.width = outputSize, canvas.height = outputSize;
    if (baseImage.width > baseImage.height) canvas.height = Math.round(outputSize * baseImage.height / baseImage.width);
    else if (baseImage.height > baseImage.width) canvas.width = Math.round(outputSize * baseImage.width / baseImage.height);
    const maxWidth = canvas.width - captionPadding * 2;

    const canvasCtx = canvas.getContext('2d');
    canvasCtx.fillStyle = 'white';
    canvasCtx.strokeStyle = 'black';
    canvasCtx.lineWidth = 1.5;
    if (blini.imageFonts.length > 0) {
        canvasCtx.font = `bold ${fontSize}px "${blini.imageFonts.map(f => f.family).join(', ')}"`;
    } else {
        canvasCtx.font = `bold ${fontSize}px "sans-serif"`
    }

    canvasCtx.drawImage(baseImage, 0, 0, baseImage.width, baseImage.height, 0, 0, canvas.width, canvas.height);

    const generatedLines = await getLines(canvasCtx, generatedText, maxWidth, fontSize);
    for (var i = 0; i < generatedLines.length; i++) {
        const line = generatedLines[i];
        if (line.img) {
            const emoji = line.img;
            var emojiWidth = fontSize, emojiHeight = fontSize;
            if (emoji.width > emoji.height) emojiHeight = Math.round(emojiHeight / emoji.width * emoji.height);
            else if (emoji.height > emoji.width) emojiWidth = Math.round(emojiWidth / emoji.height * emoji.width);
            const emojiX = Math.round(captionPadding + line.x + (fontSize - emojiWidth) / 2);
            const emojiY = Math.round(captionPadding + line.y + (fontSize - emojiHeight) / 2);
            canvasCtx.drawImage(emoji, 0, 0, emoji.width, emoji.height, emojiX, emojiY, emojiWidth, emojiHeight);
        } else {
            canvasCtx.fillText(line.text, captionPadding + line.x, captionPadding + line.y, maxWidth);
            canvasCtx.strokeText(line.text, captionPadding + line.x, captionPadding + line.y, maxWidth);
        }
    }

    return new Promise(resolve => {
        const buf = canvas.toBuffer('image/png');
        if (buf) fs.writeFileSync(imagePath, buf);
        blini.lastImage = randomImage;
        resolve(fs.existsSync(imagePath) ? imagePath : null);
    });
}

module.exports = {
    generateImage
}
