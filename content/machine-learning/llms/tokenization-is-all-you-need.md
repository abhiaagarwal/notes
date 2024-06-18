---
tags:
  - thoughts
title: Tokenization is all you need
---
A LLM, at the end of the day, is a fancy autocomplete. A fancy autocomplete that ingests a bunch of tokens, embeds them to "understand" the semantic context of said tokens, and then outputs a bunch of tokens based on statistical modeling.

I've been thinking a lot recently about how we can make LLMs really start to do interesting things. The current meta (pun not intended) is to make the LLMs output structured info. Say we want the LLM to call a function, we simply tell the LLM "hey, here's my registry of functions" and we expect it to output JSON that describes how it wants to utilize these functions. Of course, is very buggy as LLM's do not understand what "JSON" is and instead understand the statistical nature of what JSON should look like, leading to the development of many fault-tolerant JSON parsers. 

This sucks. In the context of "function calling", the LLM performs actions with the functions, and then it receives more inputs that it uses to form its next response. It's slow, inefficient, and it's not at all how humans operate. I mean, maybe we do, we operate on this world and then observe the side effects and continue operating. 

But what if, instead of teaching the LLM how to output its actions in a tokenized form, we allow it to output the actions itself in its embedded space?

For example, if we give the LLM 2 tokens — one represents "raise left hand", and the other represents "raise right hand", the LLM will output tokens that represent that reality. Then, some external system can interpret these tokens and do the appropriate action — after all, even the brain needs a body to actually execute actions — but the point being is that the LLM is consciously executing those actions, not describing *how* it wants to execute those actions.

Isn't that the same for what humans do? We're constantly ingesting information, whether it be sound, heat, visual, etc. I don't think we convert into numerical embeddings in the technical sense, but I do think we do something similar. When we receive stimulus, we act. Our supercomputer bodies are able to take all that information and react to it by converting it into a "process our body understands" involving complex chemistry, that enables us to do actions and interact with the world, continuously feeding feedback and acting. We're also really advanced prediction models.

For an example: most "text-to-speech" and "speech-to-text" AI systems that enable you to have an AI waifu operate on a two step process. First, you convert the speech into text, you tokenize the text, you feed it to the LLM, and it outputs some text, which is put back into words. It's costly, inefficient, and most importantly, it sucks. When your words are put into text, context is lost. Your tone of voice, your enunciation, every single subtlety is lost. And vice versa, the text being converted into speech loses the context for the tone of voice — after all, how does the speech model know what the AI "meant"?

The only problem becomes, "how do we turn voices into a numerical representation?" I don't have a good answer to this, but I do think  there are a bunch of smart people working and thinking about this. "how do tell an AI that if feels like it should lift its arm in response to stimulus, how can we represent that mathematically?" I don't know, but if you do, you've created Ultron.

I personally believe the next step towards our AI utopia is having LLMs understand more than words. We need them to understand *everything*. And to understand everything, we simply need to teach it how it can represent what we know as *everything* in terms of numerical values.

So tokenization is all you need. We need to find a way to break down every single stimulus in the world in terms of 1s and 0s and then force feed it down the throats of LLMs to make them understand.
