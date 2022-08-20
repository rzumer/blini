# Blini

Chatbot module based on second-order Markov chains.

Note: needs some cleanup to be useable as a package, stay tuned.

## Features
* Text generation with two words of context (or fewer if the learned vocabulary is too small)
* Japanese tokenization using [TinySegmenter](http://chasen.org/~taku/software/TinySegmenter/), including mixed Japanese/alphabetical strings
* Index of image URLs (e.g. for overlaying text output on top of learned images)
* Tagging support for tokens (e.g. for generating output based on metadata gathered during learning)
