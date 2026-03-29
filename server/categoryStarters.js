// Category-based sentence starters for the describer's word-building palette.
// These replace per-topic clues — the describer uses these freely during a round.

const CATEGORY_STARTERS = {
  'Thing': [
    'This thing is a type of',
    'This thing can be found',
    'This thing is used to',
    'This thing is known for',
    'You might see this thing',
    'This thing looks like',
    'This thing sounds like',
    'This thing is similar to',
    'This thing is nothing like',
    'This thing is associated with',
  ],
  'Person': [
    'This person is a',
    'This person is known for',
    'This person lived/lives in',
    'This person is associated with',
    'You might recognize this person by',
    'This person is similar to',
    'This person is nothing like',
    'This person is famous for',
    'This fictional person is from',
    'This fictional person is played by',
    'This fictional person is known for',
  ],
  'Place': [
    'This place is a type of',
    'This place can be found',
    'This place is known for',
    'People go to this place to',
    'This place is associated with',
    'This place looks like',
    'This place is similar to',
    'This place is nothing like',
  ],
  'Food/Drink': [
    'This food/drink is a type of',
    'This food/drink is made with',
    'This food/drink is often eaten/drunk',
    'This food/drink tastes like',
    'This food/drink smells like',
    'This food/drink looks like',
    'This food/drink is associated with',
    'This food/drink is similar to',
    'This food/drink is nothing like',
  ],
  'Activity': [
    'This activity involves',
    'This activity is done',
    'People do this activity to',
    'This activity requires',
    'This activity is associated with',
    'This activity looks like',
    'This activity is similar to',
    'This activity is nothing like',
  ],
  'Movie/Show': [
    'This movie/show is a type of',
    'This movie/show is about',
    'This movie/show features',
    'This movie/show is known for',
    'You might recognize this movie/show by',
    'This movie/show is similar to',
    'This movie/show is nothing like',
    'This movie/show is associated with',
    'This fictional world is set in',
    'This fictional story involves',
  ],
};

const CATEGORY_WORDS = {
  'Thing': [
    'small', 'large', 'metal', 'plastic', 'wooden', 'glass', 'electric',
    'common', 'rare', 'round', 'flat', 'sharp', 'soft', 'heavy', 'hollow',
  ],
  'Person': [
    'famous', 'fictional', 'real', 'historical', 'modern', 'actor', 'singer',
    'artist', 'scientist', 'politician', 'athlete', 'leader', 'inventor',
  ],
  'Place': [
    'country', 'city', 'island', 'mountain', 'ocean', 'desert', 'forest',
    'historic', 'tropical', 'cold', 'large', 'popular', 'remote', 'underground',
  ],
  'Food/Drink': [
    'sweet', 'sour', 'spicy', 'bitter', 'salty', 'hot', 'cold', 'raw',
    'cooked', 'popular', 'traditional', 'exotic', 'rich', 'creamy', 'crunchy',
  ],
  'Activity': [
    'indoor', 'outdoor', 'competitive', 'creative', 'physical', 'dangerous',
    'relaxing', 'social', 'solo', 'extreme', 'popular', 'seasonal', 'underwater',
  ],
  'Movie/Show': [
    'animated', 'live-action', 'classic', 'modern', 'popular', 'fictional',
    'series', 'film', 'comedy', 'drama', 'action', 'horror', 'sci-fi', 'fantasy',
  ],
};

module.exports = CATEGORY_STARTERS;
module.exports.CATEGORY_WORDS = CATEGORY_WORDS;
