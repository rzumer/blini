const ts = require('tiny-segmenter');
const SEGMENTER = new ts();
const NONWORD = '\n';
const STARTKEY = [ NONWORD, NONWORD ];

function trimSpaces(string) {
    return string.replace(/(?<![\u0000-\u1000]) (?![\u0000-\u1000])/gu, '');
}

function segmentWords(words) {
    var processedWords = [];
    words.forEach(w => {
        if (w.match(/([^\u0000-\u1000])+/gu)) {
            // Assuming Japanese text, segment using TinySegmenter.
            const segmented = SEGMENTER.segment(w);
            segmented.forEach(w2 => { processedWords.push(w2); });
        } else {
            processedWords.push(w);
        }
    });
    return processedWords.filter(w => w.trim());
}

class Blini {
    storage;
    dictionary = {};
    images = {};
    maxChain = 100;
    imageFonts = {};
    lastImage;

    /**
     * Adds a word to the dictionary given contextual words,
     * and optional tags to add to the entry.
     * @param {string} word
     * @param {string[]} [context]
     * @param {*} [tags]
     */
    addWord(word, context, tags) {
        if (!word) return false;
        if (context.every(w => w === NONWORD) && word === NONWORD) return false;
        if (!this.dictionary[context]) this.dictionary[context] = [];
        this.dictionary[context].push({ 'word': word, 'tags': tags });
        return true;
    }

    /**
     * Adds an image to the list with optional tags.
     * @param {string} url
     * @param {*} [tags]
     */
    addImage(url, tags) {
        if (!this.images[url]) {
            this.images[url] = { 'tags': tags };
            return true;
        }
        return false;
    }

    removeImage(url) {
        delete this.images[url];
        if (this.storage) {
            this.storage.setItem('bliniImages', JSON.stringify(this.images));
        }
    }

    /**
     * Filters the dictionary, or a context entry, based on tags.
     * If `tagName` and `tagValue` are both defined,
     * filters the dictionary (entry) to matching words.
     * If `tagValue` is undefined, filters the dictionary
     * (entry) to words that have the tag.
     * If `tagName` is empty, null, or undefined,
     * does not apply any filtering.
     * @param {any[]} context
     * @param {string} tagName
     * @param {string} tagValue
     */
    filterDictionaryByTag(context, tagName, tagValue) {
        const tagFilter = (w) => {
            if (tagName) {
                if (w.tags && w.tags[tagName]) {
                    return tagValue === undefined || w.tags[tagName] === tagValue
                } else {
                    return false;
                }
            } else {
                return true;
            }
        };

        if (context && context.length > 0) return context.filter(w => tagFilter(w));

        var newDictionary = {};
        if (this.dictionary.length > 0) {
            for (const entry in this.dictionary) {
                newDictionary[entry] = entry.filter(w => tagFilter(w));
            }
        }
        return newDictionary;
    }

    removeTagFromDictionary(context, tagName, tagValue) {
        const tagFilter = (w) => {
            if (tagName) {
                if (w.tags && w.tags[tagName]) {
                    return tagValue !== undefined && w.tags[tagName] !== tagValue
                } else {
                    return true;
                }
            } else {
                return true;
            }
        };

        if (context && context.length > 0) return context.filter(w => tagFilter(w));

        var newDictionary = {};
        if (this.dictionary.length > 0) {
            for (const entry in this.dictionary) {
                newDictionary[entry] = entry.filter(w => tagFilter(w));
            }
        }
        return newDictionary;
    }

    /**
     * Filters images based on tags.
     * If `tagName` and `tagValue` are both defined,
     * filters images to matching entries.
     * If `tagValue` is undefined, filters images
     * to entries that have the tag.
     * If `tagName` is empty, null, or undefined,
     * does not apply any filtering.
     * @param {string} [tagName]
     * @param {string} [tagValue]
     */
    filterImagesByTag(tagName, tagValue) {
        var filteredImages = {};
        for (const i of Object.keys(this.images)) {
            const image = this.images[i];
            if (tagName) {
                if (image.tags && image.tags[tagName]) {
                    if (tagValue === undefined || image.tags[tagName] === tagValue)
                        filteredImages[i] = image;
                }
            } else {
                filteredImages[i] = image;
            }
        }
        return filteredImages;
    }

    removeTagFromImages(tagName, tagValue) {
        var filteredImages = {};
        for (const i of Object.keys(this.images)) {
            const image = this.images[i];
            if (tagName) {
                if (image.tags && image.tags[tagName]) {
                    if (tagValue !== undefined && image.tags[tagName] !== tagValue)
                        filteredImages[i] = image;
                }
            } else {
                filteredImages[i] = image;
            }
        }
        return filteredImages;
    }

    /**
     * Take a list of tokens and adds them to the dictionary.
     * @param {string} input
     * @param {*} [tags]
     */
    processInput(input, tags) {
        const words = segmentWords(input.split(/(<:.+?:\d+?>)/).join(' ').split(' '));
        var [word1, word2] = STARTKEY;

        words.forEach(w => {
            // allow output with a single word of context to start from the middle of a sentence
            if (word2 !== NONWORD) this.addWord(word2, [ NONWORD, word1 ], tags);
            this.addWord(w, [ word1, word2 ], tags);
            word1 = word2; word2 = w;
        });
        if (word2 !== NONWORD) this.addWord(word2, [ NONWORD, word1 ], tags);
        this.addWord(NONWORD, [ word1, word2 ], tags);

        if (this.storage) {
            this.storage.setItem('bliniDictionary', JSON.stringify(this.dictionary));
        }
    }

    /**
     * Take an image with width, height and url properties, and adds it to the image list if valid.
     * @param {*} image
     * @param {*} [tags]
     */
    processImage(image, tags) {
        const maxAspectRatio = 2.5;
        if (!image.width || !image.height) return;
        if (!['gif', 'jpg', 'jpeg', 'png'].includes(image.url.split('.').pop().toLowerCase())) return;
        if (Math.max(image.width / image.height, image.height / image.width) > maxAspectRatio) return;
        this.addImage(image.url, tags);

        if (this.storage) {
            this.storage.setItem('bliniImages', JSON.stringify(this.images));
        }
    }

    /**
     * Generate a sentence with optional context.
     * @param {string} [context]
     * @param {string} [tagName]
     * @param {string} [tagValue]
     */
    generateOutput(context, tagName, tagValue) {
        var outputWords = [];
        var [word1, word2] = STARTKEY;

        if (!this.dictionary) return trimSpaces(outputWords.join(' ') + '?');

        if (context) {
            outputWords = segmentWords(context.split(' '));
            word1 = outputWords[outputWords.length - 2] || NONWORD;
            word2 = outputWords[outputWords.length - 1] || NONWORD;

            var contextWords = this.filterDictionaryByTag(this.dictionary[[word1, word2]], tagName, tagValue);
            if (Object.keys(contextWords).length === 0) {
                word1 = NONWORD;
                contextWords = this.filterDictionaryByTag(this.dictionary[[word1, word2]], tagName, tagValue);
                if (Object.keys(contextWords).length === 0) {
                    return trimSpaces(outputWords.join(' ') + '?');
                }
            }
        }

        for (var i = 0; i < this.maxChain; i++) {
            const validWords = this.filterDictionaryByTag(this.dictionary[[word1, word2]], tagName, tagValue);
            const nextWord = validWords[Math.floor(Math.random() * validWords.length)];
            if (!nextWord || nextWord.word === NONWORD) break;
            outputWords.push(nextWord.word); word1 = word2; word2 = nextWord.word;
        }

        const msgString = trimSpaces(outputWords.join(' '));
        return msgString.length === 0 ? '?' : msgString;
    }
}

module.exports = {
    Blini
}
