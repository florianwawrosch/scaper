// friendlyAiError: Anbieter-Fehler → handlungsfähige deutsche Meldung (Guthaben, Key, Limit, Modell)
const { ok, lib } = require('./setup');
const { friendlyAiError } = lib('aiProviders');
ok(friendlyAiError('You exceeded your current quota, please check your plan').startsWith('OpenAI-Guthaben'), 'OpenAI quota → Guthaben');
ok(friendlyAiError('Your credit balance is too low to access the Anthropic API.').startsWith('Anthropic-Guthaben'), 'Anthropic credit balance → Guthaben');
ok(friendlyAiError('Incorrect API key provided').startsWith('API-Key ungültig'), 'falscher Key');
ok(friendlyAiError('authentication_error: invalid x-api-key').startsWith('API-Key ungültig'), 'Anthropic auth error');
ok(friendlyAiError('RESOURCE_EXHAUSTED: Quota exceeded for quota metric').startsWith('Rate-Limit'), 'Gemini Kontingent → Rate-Limit');
ok(friendlyAiError('The model `gpt-9` does not exist').startsWith('Modell nicht verfügbar'), 'unbekanntes Modell');
ok(friendlyAiError('irgendwas anderes') === 'irgendwas anderes', 'unbekannter Fehler bleibt');
